const Lgtv2 = require('lgtv2');
const tcpp = require('tcp-ping');
const fs = require('fs');
const mkdirp = require('mkdirp');

let Service;
let Characteristic;

let lgtv;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory('homebridge-webos-notification', 'webos-notification', webosNotificationAccessory);
};


class webosNotificationAccessory {
	constructor(log, config, api) {
		this.log = log;
		this.port = 3000;

		// configuration
		this.ip = config['ip'];
		this.name = config['name'] || 'webOS Notification';
		this.mac = config['mac'];
		this.broadcastAdr = config['broadcastAdr'] || '255.255.255.255';
		this.keyFile = config['keyFile'];
		this.prefsDir = config['prefsDir'];
		this.alivePollingInterval = config['pollingInterval'] || 5;
		this.alivePollingInterval = this.alivePollingInterval * 1000;
		this.notificationButtons = config['notificationButtons'];

		// prepare variables
		this.url = 'ws://' + this.ip + ':' + this.port;
		this.enabledServices = [];
		this.connected = false;
		this.checkAliveInterval = null;

		// check if prefs directory ends with a /, if not then add it
		if (this.prefsDir.endsWith('/') === false) {
			this.prefsDir = this.prefsDir + '/';
		}

		// check if the tv preferences directory exists, if not then create it
		if (fs.existsSync(this.prefsDir) === false) {
			mkdirp(this.prefsDir);
		}

		// prepare file paths
		this.tvInfoFile = this.prefsDir + 'info_' + this.mac.split(':').join('');

		// create the lgtv instance
		this.lgtv = new Lgtv2({
			url: this.url,
			timeout: 6000,
			reconnect: 3000,
			keyFile: this.keyFile
		});

		// start the polling
		if (!this.checkAliveInterval) {
			this.checkAliveInterval = setInterval(this.checkTVState.bind(this), this.alivePollingInterval);
		}

		//register to listeners
		this.lgtv.on('connect', () => {
			this.log.debug('webOS - connected to TV, checking power status');
			this.lgtv.request('ssap://com.webos.service.tvpower/power/getPowerState', (err, res) => {
				if (err || (res && res.state && res.state === 'Active Standby')) {
					this.log.debug('webOS - power status - TV is Off or Pixel Refresher is running, disconnecting');
					this.connected = false;
					this.lgtv.disconnect();
				} else {
					this.log.debug('webOS - power status - TV is On');
					this.connected = true;
					this.connect();
				}
			});
		});

		this.lgtv.on('close', () => {
			this.log.debug('webOS - disconnected from TV');
			this.connected = false;
		});

		this.lgtv.on('error', (error) => {
			this.log.error('webOS - %s', error);
		});

		this.lgtv.on('prompt', () => {
			this.log.debug('webOS - prompt for confirmation');
			this.connected = false;
		});

		this.lgtv.on('connecting', () => {
			this.log.debug('webOS - connecting to TV');
			this.connected = false;
		});

		// preapre the services
		this.prepareInformationService();
		this.prepareNotificationButtonService();
	}


	// --== CONNECT/DISCONNECT METHODS ==--	
	connect() {
		this.log.info('webOS - connected to TV');
		this.getTvInformation();
		this.connected = true;
		this.subscribeToServices();
	}

	disconnect() {
		this.log.info('webOS - disconnected from TV');
		this.lgtv.disconnect();
		this.connected = false;
	}


	// --== INIT HELPER METHODS ==--
	getTvInformation() {
		setTimeout(() => {
			this.log.debug('webOS - requesting TV information');

			this.lgtv.request('ssap://system/getSystemInfo', (err, res) => {
				if (!res || err || res.errorCode) {
					this.log.debug('webOS - system info - error while getting system info');
				} else {
					delete res['returnValue'];
					this.log.debug('webOS - system info:' + '\n' + JSON.stringify(res, null, 2));
					// save the tv info to a file if does not exists
					if (fs.existsSync(this.tvInfoFile) === false) {
						fs.writeFile(this.tvInfoFile, JSON.stringify(res), (err) => {
							if (err) {
								this.log.debug('webOS - error occured could not write tv info %s', err);
							} else {
								this.log.debug('webOS - tv info successfully saved!');
							}
						});
					} else {
						this.log.debug('webOS - tv info file already exists, not saving!');
					}
				}
			});
		}, 100);
	}

	subscribeToServices() {
		this.log.debug('webOS - subscribing to TV services');

		// power status
		this.lgtv.subscribe('ssap://com.webos.service.tvpower/power/getPowerState', (err, res) => {
			if (!res || err) {
				this.log.error('webOS - TV power status - error while getting power status');
			} else {
				let statusState = (res && res.state ? res.state : null);
				let statusProcessing = (res && res.processing ? res.processing : null);
				let statusPowerOnReason = (res && res.powerOnReason ? res.powerOnReason : null);
				let powerState = '';

				if (statusState) {
					powerState = powerState + ' state: ' + statusState + ',';
				}

				if (statusProcessing) {
					powerState = powerState + ' processing: ' + statusProcessing + ',';
				}

				if (statusPowerOnReason) {
					powerState = powerState + ' power on reason: ' + statusPowerOnReason + ',';
				}

				this.log.debug('webOS - TV power status changed, status: %s', powerState);

				// if pixel refresher is running then disconnect from TV
				if (statusState === 'Active Standby') {
					this.disconnect();
				}
			}
		});
	}


	// --== SETUP SERVICES  ==--
	prepareInformationService() {
		// currently i save the tv info in a file and load if it exists
		let modelName = this.name;
		try {
			let infoArr = JSON.parse(fs.readFileSync(this.tvInfoFile));
			modelName = infoArr.modelName;
		} catch (err) {
			this.log.debug('webOS - tv info file does not exist');
		}

		// there is currently no way to update the AccessoryInformation service after it was added to the service list
		// when this is fixed in homebridge, update the informationService with the TV info?
		this.informationService = new Service.AccessoryInformation();
		this.informationService
			.setCharacteristic(Characteristic.Manufacturer, 'LG Electronics Inc.')
			.setCharacteristic(Characteristic.Model, modelName)
			.setCharacteristic(Characteristic.SerialNumber, this.mac)
			.setCharacteristic(Characteristic.FirmwareRevision, '1.0.0');

		this.enabledServices.push(this.informationService);
	}

	// additional services ----------------------------------------------------------------
	prepareNotificationButtonService() {
		if (this.notificationButtons === undefined || this.notificationButtons === null || this.notificationButtons.length <= 0) {
			return;
		}

		if (Array.isArray(this.notificationButtons) === false) {
			this.notificationButtons = [this.notificationButtons];
		}

		this.notificationButtonService = new Array();
		this.notificationButtons.forEach((value, i) => {
			this.notificationButtons[i] = this.notificationButtons[i].toString();
			let tmpNotification = new Service.Switch(this.name + ': ' + value, 'notificationButtonService' + i);
			tmpNotification
				.getCharacteristic(Characteristic.On)
				.on('get', (callback) => {
					this.getNotificationButtonState(callback);
				})
				.on('set', (state, callback) => {
					this.setNotificationButtonState(state, callback, this.notificationButtons[i]);
				});

			this.enabledServices.push(tmpNotification);
			this.notificationButtonService.push(tmpNotification);
		});
	}

	// --== HELPER METHODS ==--
	disableAllServiceButtons(service) {
		if (service) {
			// we need to wait a moment (100ms) till we can disable the button
			setTimeout(() => {
				service.forEach((tmpServiceButton, i) => {
					tmpServiceButton.getCharacteristic(Characteristic.On).updateValue(false);
				});
			}, 100);
		}
	}

	checkTVState(callback) {
		tcpp.probe(this.ip, this.port, (err, isAlive) => {
			if (!isAlive && this.connected) {
				this.log.debug('webOS - TV state: Off');
				this.disconnect();
			} else if (isAlive && !this.connected) {
				this.lgtv.connect(this.url);
				this.log.debug('webOS - TV state: got response from TV, connecting...');
			}
		});
	}

	// --== HOMEBRIDGE STATE SETTERS/GETTERS ==--
	getNotificationButtonState(callback) {
		callback(null, false);
	}

	setNotificationButtonState(state, callback, notification) {
		if (this.connected && state) {
			this.log.info('webOS - notification button service - displaying notification with message: %s', notification);
			this.lgtv.request('ssap://system.notifications/createToast', {
				message: notification
			});
		}
		this.disableAllServiceButtons(this.notificationButtonService);
		callback(); // always report success, if i return an error here then siri will respond with 'Some device are not responding' which is bad for automation or scenes
	}

	getServices() {
		return this.enabledServices;
	}

}
