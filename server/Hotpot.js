/*@preserve Copyright (C) 2016 Crawford Currie http://c-dot.co.uk license MIT*/

/*eslint-env node */

const DESCRIPTION =
"DESCRIPTION\nA Raspberry PI central heating control server.\n" +
"See README.md for details\n\nOPTIONS\n";

const getopt = require("node-getopt");
const Q = require("q");

const Location = require("../common/Location.js");
const Utils = require("../common/Utils.js");

const Config = require("./Config.js");
const Apis = require("./Apis.js");
const Server = require("./Server.js");
const Controller = require("./Controller.js");

const TAG = "Hotpot";

HOTPOT_DEBUG = undefined;

const Rule = require("./Rule.js");

/** Main program */
(function () {
    "use strict";

    var cliopt = getopt.create([
        [ "h", "help", "Show this help" ],
        [ "c", "config=ARG", "Configuration file (default ./hotpot.cfg)" ],
        [ "d", "debug=ARG", "Run in debug mode e.g. --debug all" ]
    ])
        .bindHelp()
        .setHelp(DESCRIPTION + "[[OPTIONS]]")
        .parseSystem()
        .options;
   
    if (typeof cliopt.config === "undefined")
        cliopt.config = "./hotpot.cfg";

    if (typeof cliopt.debug !== "undefined") {
        // Development only
        Q.longStackSupport = true;
        var TestSupport = require("./TestSupport.js");
        HOTPOT_DEBUG = new TestSupport(cliopt.debug);
        console.TRACE = function() {
            HOTPOT_DEBUG.TRACE.apply(HOTPOT_DEBUG, arguments);
        };
    } else
        console.TRACE = function() {};

    console.ERROR = function() {
        console.error(Utils.joinArgs(arguments));
    };

    var config = new Config(cliopt.config);
    var controller;

    config.load()

    .then(function() {
        Apis.configure(config.getConfig("apis"));
    })

    .then(function() {
        controller = new Controller(config.getConfig("controller"));
        return controller.initialise();
    })

    .then(function() {
        return Server.configure(config.getConfig("server"), controller);
    })

    .then(function() {
        controller.setLocation(new Location(
            Server.server.config.get("location")));

        // Save config when it changes, so we restart to the
        // same state
        controller.on("config_change",
                      function() {
                          config.set("controller",
                                     controller.getSerialisableConfig(false));
                          config.save().done();
                      });
    })

    .catch(function(e) {
        console.error("Controller initialisation failed: " + e.stack);
    });

})();
