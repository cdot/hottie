/*@preserve Copyright (C) 2016 Crawford Currie http://c-dot.co.uk license MIT*/

/*eslint-env node */

/**
 * @module Apis
 */
var setup = {
    /**
     * @param {Config} config the configuration data
     */
    configure: function(config) {
        "use strict";
        setup.apis = config.data;
    },

    /**
     * Get the given API
     * @param {string} key api information required
     */
    get: function(key) {
        "use strict";
        return setup.apis[key];
    },

    /**
     * Get a serialisable version of the config
     * @param {boolean} ajax set true if this config is for AJAX
     */
    getSerialisableConfig: function(ajax) {
        "use strict";
        return setup.apis;
    }
};
module.exports = setup;
