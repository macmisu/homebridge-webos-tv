# homebridge-webos-notification

`homebridge-webos-notification` is a plugin for Homebridge which allows you to send notification to your webOS TV! It should work with all TVs that support webOS2 and newer. This is based on [homebridge-webos-tv](https://github.com/merdok/homebridge-webos-tv) with only notification function.

### Features
* Show notifications

## Installation

If you are new to Homebridge, please first read the Homebridge [documentation](https://www.npmjs.com/package/homebridge).
If you are running on a Raspberry, you will find a tutorial in the [homebridge-punt Wiki](https://github.com/cflurin/homebridge-punt/wiki/Running-Homebridge-on-a-Raspberry-Pi).

Install homebridge:
```sh
sudo npm install -g homebridge
```

Install homebridge-webos-tv:
```sh
sudo npm install -g homebridge-webos-notification
```

## Configuration

Add the accessory in `config.json` in your home directory inside `.homebridge`.

Example configuration:

```js
{
  "accessories": [
    {
      "accessory": "webos-notification",
      "name": "webOS tv",
      "ip": "192.168.0.2",
      "mac": "ab:cd:ef:fe:dc:ba",
      "keyFile": "/var/lib/homebridge/webostv/lgtvKeyFile",
      "pollingInterval": 10,
      "notificationButtons": [
         "Motion detected - Living Room",
         "Motion detected - Kitchen",
         "Warning - Front door unlocked"
      ]
    }
  ]  
}
```

You also need to enable **mobile TV on** on your TV for the turn on feature to work correctly.

This is located on your TV under `Settings > General > Mobile TV On`

On newer TVs **LG Connect Apps** under the network settings needs to be enabled.

### Configuration fields
- `accessory` [required]
Should always be "webos-notification".
- `name` [required]
Name of your accessory.
- `ip` [required]
ip address of your TV.
- `mac` [required]
Mac address of your TV.
- `broadcastAdr` [optional]
If homebridge runs on a host with more than one network interface use this to specify the broadcast address.
- `keyFile` [optional]
To prevent the TV from asking for permission when you reboot homebridge, specify a file path to store the permission token. If the file doesn't exist it'll be created. Don't specify a directory or you'll get an `EISDIR` error.
- `prefsDir` [optional]
The directory where input names and TV model info should be saved. **Default: "~/.webosTv"**
- `pollingInterval` [optional]
The TV state background polling interval in seconds. **Default: 5**
- `notificationButtons` [optional] 
Wheter the notification buttons service is enabled. This allows to create buttons which when pressed display the specified text on the TV screen. Useful for HomeKit automation or to display text on TV for viewers. **Default: "" (disabled)**
  - Set an array of notification texts as the value
  
## Troubleshooting
If you have any issues with the plugin or TV services then you can run homebridge in debug mode, which will provide some additional information. This might be useful for debugging issues. 

Homebridge debug mode:
```sh
homebridge -D
```

## Special thanks
[homebridge-webos-tv](https://github.com/merdok/homebridge-webos-tv) - Homebridge plugin for LG webOS TVs

[lgtv2](https://github.com/hobbyquaker/lgtv2) - the Node.js remote control module for LG WebOS smart TVs

[homebridge-webos2](https://github.com/zwerch/homebridge-webos2) - the basic idea for the plugin

[HAP-NodeJS](https://github.com/KhaosT/HAP-NodeJS) & [homebridge](https://github.com/nfarina/homebridge) - for making this possible
