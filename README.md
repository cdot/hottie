# Hotpot

Central heating controller for a Y-plan central heating system, using
node.js on Raspberry Pi. Piggybacks on the existing system so that the existing
controller can still be used (though not at the same time).

The controller collates data from a number of sources to support rules that
decide if the heating needs to come on.
- Any number of DS18x20 temperature sensors, usually one for heating (CH) and one for hot water (HW), connected to GPIO.
- Any number of Google calendars,
- Any number of web browsers talking directly to the controller,
- Weather information from the UK Meteorological Office data service.

The controller supports user-defined rules that use this information to set the state of RPi GPIO pins to turn on the relevant heating control.

# Hardware

Aside from the Raspberry Pi, the only additional hardware required are two DS18x20 temperature sensors, and two relays. A dual SRD-05VDC-SL-C relay module is ideal for this. The wiring capitalises on the fact that when the controller for a Y system is powered on, but set to "off", the "Hot water off" control line is held high (at 250V). See Mains.svg for details of the mains level wiring.

The wiring of the temperature sensors and the control side of the relays is shown in 5V-3.5V control.svg

## Configuring the Hardware

The included diagram "5V-3.5V control.svg" shows the wiring I use. Note that the
pin used for the temperature sensors has to be changed in /boot/config.txt,
thus:

```
# 1-wire settings
dtoverlay=w1-gpio,gpiopin=18
```
Reboot your Pi.
```
modprobe w1-gpio
modprobe w1-therm
```
(you will probably want to add these commands to the service script).
You can see what sensors are attached to the system using:
```
ls /sys/bus/w1/devices/w1_bus_master1
```
Expect to see devices such as '28-0316027f81ff'.

If you follow my wiring, it is safe to continue to use the existing controller
and thermostats. Note that if your existing thermostats are set to a lower temperature than required by Hotpot, then the thermostats will always win. I recommend either switching the existing controller to an "always on" state, or programming in a simple "on-off" schedule that sets hot water and central heating are "on" during the time Hotpot is likely to be managing the temperature. This way if Hotpot fails for any reason, the original controller takes over.

# Server Software

The controller uses rules defined in javascript functions to control
the temperature of the different services offered by the central heating
system. It runs a HTTP(S) server that supports querying and changing the
configuration of the system from a browser.

The server is implemented using node.js, version 11.15.0 (at time of
writing this is the most recent version available for the RPi).

## Configuring the Server

The server can be run as follows:
```
$ node server/js/Hotpot.js <options>
```
Note that when running with real hardware, the user running the Hotpot script
must have read/write access to gpio control files. The easiest way to do this is to add them to the gpio group. For example:
```
$ sudo usermod -a -G gpio hotpot
```
Pass --help on the command-line to see options.
```
$ node server/js/Hotpot.js --help
  -h, --help        Show this help
  -c, --config=ARG  Configuration file (default ./hotpot.cfg)
  -C, --confhelp    Configuration file help
  -t, --trace[=ARG] Trace module e.g. --trace all
  -d, --debug       Run in debug mode - uses stubs for missing hardware
```
All trace and debug statements are tagged with the time and the module e.g 
```
2016-08-13T08:37:08.694Z Server: HTTP starting on port 13196
```
You can choose just to monitor just particular modules e.g. `--trace=Server`,
or you can enable `all` and then choose which modules to *ignore* by prepending a minus sign e.g. `--trace=all,-Historian,-Server`

Developers should note that the server must be run with --debug on any
platform that doesn't have the expected hardware (pins and thermostats)
installed, so that appropriate device stubs can be put in place.

The server is configured by Javascript read from a file (default `./hotpot.cfg`)After the initial setup, the HTTP interface can be used to query and modify
the configuration. If time the server configuration is changed from the browser interface, the configuration file will be automatically saved.

An annotated example configuration file is given in `hotpot.cfg`.

## Service startup script
If you are using a Debian-based OS, you can customise the included 'environment/init.d_hotpot' script to assist with starting and stopping the service. The script is placed in /etc/init.d and will automatically start the service after every reboot.
```
chmod +x /etc/init.d/hotpot 
update-rc.d hotpot defaults
```

### History

System change events, such as temperature and pin state, can be logged to files
for later analysis. There is no limit on the size of these files, and you are
recommended to rotate them on a regular basis. When a log is rotated make sure the old log is deleted - you don't want to leave an empty file behind.

Histories can either be sampling - such as temperatures - or logging, such as pin states or weather agents. Sampling histories require an interval to be specified to set how often the item is sampled. Logging histories rely on the caller explicitly logging events.

## Weather
Weather information can be retrieved from the UK Meteorological Office data service, via a simple API that can easily be overridden with your own weather service provider. The class "MetOffice" is the reference implementation.

An API key is required to access weather information from the Met Office. These
are available for free.

The weather feature is considered experimental, and is likely to change.

## Rules

Rules are subclasses of the 'Rule' class that implement a test function.
Each test function is called in in a polling loop, and they are able to
control settings via the controller.

Rule functions can interrogate any part of the system using the internal APIs.
Default rules are given for Hot Water `server/js/HotWaterRule.js` and
Central Heating `server/js/CentralHeatingRule.js`. You can derive your own
rules and point your hotpot.cfg at them.

# AJAX interface
The AJAX interface gives access to the
functions of the controller using AJAX requests to the server. It can
be used to review temperature logs, and perform simple overrides such as
boosting temperature. The following URL requests are available:

* `/config` - retrieve the configuration of the controller (JSON)
* `/reconfig` - write a new config. Doesn't restart the server, just updates the files that store the config
* `/state` - retrieve the current state of the controller (JSON)
* `/log/{type}/{name}` - retrieve type `pin`, `thermostat`, or `weather` logs, or all logs if `{type}/{name}` is not given (or all `{type}` logs if `{name}` is not given)
* `/request?source={name};pin={name};state=[0|1|2];until={epoch}` - set a request on behalf of the given source for the given pin, asking for the given state. The request will (optionally) remain active until the given date.
* `/refresh_calendars` - force a calendar refresh from google, useful if an event has been added/removed from the calendar (there is no support for push notifications)
* `/restart` - force a restart of the server.

# Calendars

Hotpot can interface to any number of Google calendars.

## Setting up a calendar
Follow the instructions in https://developers.google.com/google-apps/calendar/quickstart/nodejs for configuring the calendar API.

Open the downloaded `client_secret` file and copy the following fields:
```
     client_id: "738956347299-catel312312sdfafj546754ajfghph3n.apps.googleusercontent.com",
     client_secret: "XAfsu6askjhqweo391d6s6ZD",
     redirect_uris: [ "urn:ietf:wg:oauth:2.0:oob", "http://localhost" ]
```
Create a calendar in `hotpot.cfg` e.g.
```
calendar: {
  "Example": {
   id: "primary",
   secrets: {
   },
   auth_cache: "./example.auth"
  }
}
```
Paste the copied fields from `client_secret` into the `secrets` object. The `primary` id will access your main calendar. The `node TestCalendars.js` command-line program in the `test` subdirectory can be used to list all the available calendars.

`cd` to the `server` subdirectory and run the command-line program `node AuthoriseCalendar.js` and follow the instructions. Note that this requires an existing `hotpot.cfg`.

Calendars are cached and updated as required. An update can be forced at any time by sending a `/refresh_calendars` request to the server.

## Controlling Hotpot from the Calendar
Hotpot is controlled by events in a calendar which contain special commands in the event summary or description. For example, `Hotpot:HW=on` will raise a request for Hotpot to turn the hot water on for the duration of the event. Requests are handled in the rules - see `hw_rules.js` for an example.

The format of commands is `Hotpot: <pin> = <state>` where `<pin>` can be the name of a pin in `hotpot.cfg` (e.g. `HW` or `CH`) and `<state>` can be a number (0=off, 1=on, 2=boost, 3=away) or one of the commands `on`, `off`, `boost` or `away'. `all` is special pin that will apply the command to all pins. Pin names are case sensitive; nothing else is. Examples:
```
Hotpot: ch=0
HOTPOT: HW = 45
```
The first turns the central heating off for the duration of the event. The second sets hot water to 45 degrees.

Note that calendar events are only used to generate requests. It is up to the
rules whether and how those requests are interpreted. Rules should always
contain conditions to stop runaway temperature rises and freezing.

An option is to create a specific calendar for Hotpot control, in which case all event in the calendar relate to Hotpot. In this case you can modify the configuration to dispense with the prefix.

An implementation of the Calendar interface using Google Calendar is provided
in 'server/js/GoogleCalendar.js'.

## Browser App
The browser app is served automatically when `/browser.html` is loaded from
a browser. The app provides control and monitoring capabilities in a portable
interface that can be used fom desktops, laptops, tablets and smartphones.

# Debugging

cd to $packageroot/server/test
node ../js/Hotpot.js -d --trace all -c simulated_hotpot.cfg

This will start a debug mini-web-server listening on port 13196

In a web browser on localhost, load http://localhost:13196/
