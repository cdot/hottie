/*@preserve Copyright (C) 2016 Crawford Currie http://c-dot.co.uk license MIT*/

/*eslint-env node */

const Q = require("q");
const Fs = require("fs");
const readFile = Q.denodeify(Fs.readFile);

var google = require("googleapis");
var googleAuth = require("google-auth-library");

const Utils = require("../common/Utils.js");

const CACHE_LENGTH = 24 * 60 * 60 * 1000; // cache size in ms

const TAG = "Scheduled";

/**
 * Get active events from a Google calendar
*/
function Scheduled(id, config) {
    "use strict";
    this.name = id;
    this.secrets = config.get("secrets");
    this.cache_file = config.get("cache");
    this.oauth2Client = undefined;
    this.schedule = [];
}
module.exports = Scheduled;

/**
 * Return a promise to start the calendar
 * @private
 */
Scheduled.prototype.authorise = function() {
    "use strict";
    if (typeof this.oauth2Client !== "undefined")
        return Q(); // already started

    var self = this;

    return readFile(Utils.expandEnvVars(self.cache_file))

    .then(function(token) {
        var clientSecret = self.secrets.client_secret;
        var clientId = self.secrets.client_id;
        var redirectUrl = self.secrets.redirect_uris[0];
        var auth = new googleAuth();
        self.oauth2Client = new auth.OAuth2(
            clientId, clientSecret, redirectUrl);
        self.oauth2Client.credentials = JSON.parse(token);
    });
};

/**
 * Return a promise that will update the list of the events
 * stored for the next 24 hours.
 * @public
 */
Scheduled.prototype.fillCache = function() {
    "use strict";
    var self = this;

    Utils.TRACE(TAG, "Updating calendar '", this.name, "'");

    return this.authorise()

    .then(function() {
        var calendar = google.calendar("v3");
        var list = Q.denodeify(calendar.events.list);
        var now = Date.now();

        // Q.denodeify doesn't work for this, so have to promisify it
        // manually :-(
        return Q.Promise(function(ok, fail) {
            calendar.events.list(
                {
                    auth: self.oauth2Client,
                    calendarId: "primary",
                    // For reasons undocumented by google, if timeMin and
                    // timeMax are the same time it returns no events. So
                    // we need to offset them by a second.
                    timeMin: (new Date()).toISOString(),
                    timeMax: (new Date(now + CACHE_LENGTH))
                              .toISOString(),
                    q: "Hotpot:",
                    singleEvents: true
                },
                function(err, response) {
                    if (err) {
                        fail(err);
                    } else {
                        ok(response);
                    }
                });
        });
    })

    .then(function(response) {
        self.schedule = [];
        var events = response.items;
        for (var i = 0; i < events.length; i++) {
            var event = events[i];
            var start = Date.parse(event.start.dateTime || event.start.date);
            var end = Date.parse(event.end.dateTime || event.end.date);
            // Can have orders in the event summary or the description
            // Only the first found is obeyed.
            var fullText = event.summary + " " + event.description;
            var match = /Hotpot:([A-Za-z]+)=([A-Za-z]+)/.exec(fullText);
            if (match !== null) {
                var channel = match[1];
                var state = match[2];
                self.schedule.push({
                    start: start, end: end,
                    pin: match[1], state: match[2] });
            }
        }
    })

    .catch(function(e) {
        throw "Calendar had an error: " + e.stack;
    });
};

/**
 * Schedule a calendar update in 'after' milliseconds. The update is
 * performed asynchrnously.
 * @param {Number} after delay before updating the calendar asynchronously
 */
Scheduled.prototype.update = function(after) {
    "use strict";
    var self = this;

    // Kill the old timer
    if (this.timeout)
        clearTimeout(this.timeout);
    this.timeout = setTimeout(function() {
        self.fillCache().done(function() {
            self.timeout = undefined;
            self.update(CACHE_LENGTH);
        });
    }, after);
};

/**
 * Get the current event (if there is one).
 * @return {object} the most recent event that overlaps the current time
 */
Scheduled.prototype.getCurrent = function() {
    "use strict";
    var now = Time.now();
    // Could prune the event list, but there are unlikely to be
    // enough events to make it worthwhile
    var best;
    for (var i = 0; i < self.schedule.length; i++) {
        var evt = self.schedule[i];
        if (evt.start <= now && evt.end >= now
            && (!best || best.start < evt.start))
            best = evt;
    }
    return best;
};
