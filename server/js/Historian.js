/*@preserve Copyright (C) 2016-2019 Crawford Currie http://c-dot.co.uk license MIT*/

/*eslint-env node */

define("server/js/Historian", ["fs-extra", "common/js/Time", "common/js/Utils", "common/js/DataModel"], function(Fs, Time, Utils, DataModel) {
    
    const TAG = "Historian";
    
    /**
     * Logger. Can either log according to a time interval using a sampling
     * callback, or only on demand.
     * @param {string} name identifier
     * @param {object} proto see Historian.Model
     * If `sample` is not given, or `start()` is not called, sampling is only by
     * calling `record()`
     * @class
     */
    class Historian {
        
        constructor(proto, name) {
            Utils.extend(this, proto);
            
            this.name = name;
            
            this.timeout = null;
            Utils.TRACE(TAG, "for ", name, " in ", this.path());
        }
        
        
        /**
         * Get the expanded file name
         * @private
         */
        path() {
            return Utils.expandEnvVars(this.file);
        };
        
        /**
         * Return a promise to rewrite the history file with the given data
         * @private
         */
        rewriteFile(report) {
            let s = "";
            for (let i = 0; i < report.length; i++)
                s += report[i].time + "," + report[i].sample + "\n";
            let self = this;
            return Fs.writeFile(this.path(), s)
            .then(function () {
                Utils.TRACE(TAG, "Wrote ", self.path());
            });
        };
        
        /**
         * Load history from the data file
         * @private
         */
        loadFromFile() {
            let self = this;
            
            return Fs.readFile(this.path())
            .then(function (data) {
                let lines = data.toString().split("\n");
                let report = [];
                let i;
                
                // Load report
                for (i in lines) {
                    let csv = lines[i].split(",", 2);
                    if (csv.length === 2) {
                        let point = {
                            time: parseFloat(csv[0]),
                            sample: parseFloat(csv[1])
                        };
                        report.push(point);
                    }
                }
                if (self.unordered && report.length > 1) {
                    // Sort samples by time. If two samples occur at the same
                    // time, keep the most recently added.
                    let doomed = report;
                    report = [];
                    for (i = 0; i < doomed.length; i++)
                        doomed[i].index = i;
                    doomed.sort(function (a, b) {
                        if (a.time < b.time)
                            return -1;
                        if (a.time > b.time)
                            return 1;
                        if (a.index < b.index)
                            a.dead = true;
                        else
                            b.dead = true;
                        return 0;
                    });
                    for (i = 0; i < doomed.length; i++) {
                        if (!doomed[i].dead)
                            report.push({
                                time: doomed[i].time,
                                sample: doomed[i].sample
                            });
                    }
                    if (report.length !== doomed.length)
                        self.rewriteFile(report);
                }
                
                return report;
            })
            .catch(function (e) {
                Utils.TRACE(TAG, "Failed to open history ", e);
                return [];
            });
        };
        
        /**
         * Get a promise for a serialisable 1D array for the history.
         * @param since earliest datime we are interested in. Can prune log
         * data before this.
         * @return {array} First element is the base time in epoch ms,
         * subsequent elements are alternating times and samples. Times are
         * in ms.
         */
        getSerialisableHistory(since) {
            return this.loadFromFile()
            .then(function (report) {
                let basetime = report.length > 0 ? report[0].time : Time.now();
                let res = [basetime];
                for (let i in report) {
                    if (typeof since === "undefined" || report[i].time >= since) {
                        res.push(report[i].time - basetime);
                        res.push(report[i].sample);
                    }
                }
                return res;
            });
        };
        
        /**
         * Start the history polling loop.
         * Records are written according to the interval set in the config.
         * Requires the `interval` option to be given.
         * @param {function} sample sampling function (required)
         */
        start(sample) {
            
            if (typeof sample !== "function")
                throw new Utils.exception(TAG, "Cannot start; sample not a function");
            this.sampler = sample;

            if (typeof this.interval === "undefined")
                throw new Utils.exception(TAG, "Cannot start; interval not defined");
            // Polling will continue until the timer is deleted
            let self = this;
            this.timeout = setTimeout(() => { self._poll(); }, 100);
        }

        /**
         * Private method woken on each poll
         */
        _poll() {
            let datum = this.sampler();

            let p;
            // Don't record repeat of same sample
            if (typeof datum === "number" && datum !== this.last_sample)
                p = this.record(datum);
            else
                p = Promise.resolve();

            p.then(() => {
                if (this.timeout) {
                    // Existance of a timer indicates we must continue
                    // to poll
                    this.timeout = setTimeout(() => {
                        this._poll();
                    }, this.interval);
                }
            });
        }
        
        /**
         * Stop the polling loop
         */
        stop() {
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
                Utils.TRACE(TAG, this.name, " stopped");
            }
        };
        
        /**
         * Get a promise to record a sample in the log.
         * @param {number} sample the data to record
         * @param {int} time (optional) time in ms to force into the record
         * @public
         */
        record(sample, time) {
            
            if (typeof time === "undefined")
                time = Time.now();
            
            let promise;
            
            // If we've skipped recording an interval since the last
            // recorded sample, pop in a checkpoint
            if (typeof this.last_time !== "undefined" &&
                time > this.last_time + 5 * this.interval / 4)
                promise = Fs.appendFile(
                    this.path(),
                    (time - this.interval) + "," + this.last_sample + "\n");
            else
                promise = Promise.resolve();
            
            this.last_time = time;
            this.last_sample = sample;
            
            let self = this;
            return promise.then(function () {
                return Fs.appendFile(self.path(), time + "," + sample + "\n")
                .catch(function (ferr) {
                    Utils.ERROR(TAG, "failed to append to '",
                                self.path(), "': ", ferr);
                });
            });
        };
    }
    
    Historian.Model = {
        $class: Historian,
        file: {
            $doc: "Full path to the log file",
            $class: DataModel.File,
            $mode: "w"
        },
        unordered: {
            $doc: "Set if sample events may be added out of order",
            $optional: true,
            $class: Boolean
        },
        interval: {
            $doc: "Sample frequency in ms, required if `start()` is called",
            $optional: true,
            $class: Number
        }
    };
    
    return Historian;
});
