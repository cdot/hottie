/*@preserve Copyright (C) 2016 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Useful utilities
 * @exports Utils
 */

module.exports = {
    /**
     * Expand environment variables in the data string
     * @param {String} data string containing env var references
     * @return {String} data string with env vars expanded
     */
    expandEnvVars: function(data) {
        "use strict";
        if (typeof data !== "string")
            throw "Cannot expand " + data;
        return data.replace(
                /(\$[A-Z]+)/g, function(match) {
                    var v = match.substring(1);
                    if (typeof process.env[v] !== "undefined")
                        return process.env[v];
                    return match;
                });
    }
};
