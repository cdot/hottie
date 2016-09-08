const getopt = require("node-getopt");
const Q = require("q");
const Utils = require("../common/Utils.js");
const MetOffice = require("./MetOffice.js");
const Config = require("./Config.js");

var cliopt = getopt.create([
    [ "h", "help", "Show this help" ],
    [ "c", "config=ARG", "Configuration file (default ./hotpot.cfg)" ]
])
    .bindHelp()
    .parseSystem()
    .options;

if (typeof cliopt.config === "undefined")
    cliopt.config = "./hotpot.cfg";

Utils.setTRACE("all");

Q.longStackSupport = true;

Config.load(cliopt.config)
.then(function(config) {
    var mo = new MetOffice(config.controller.weather.MetOffice);
    mo.setLocation(config.server.location).done();

    mo.getSerialisableState().then(function(d) {
        Utils.TRACE("STATE", d);
	Utils.TRACE("LOG", mo.getSerialisableLog());
    });
});
