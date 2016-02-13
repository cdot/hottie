// Test support

// Global object that records current pin state
var pinstate = {};

function DS18x20() {
    this.cur = 20;
    this.mapID = {};
}

DS18x20.prototype.get = function(id, fn) {
    if (pinstate[this.mapID[id]] === 1)
        this.cur += Math.random();
    else
        this.cur -= Math.random();
    //console.log("GET "+id+":"+this.mapID[id]+"("+pinstate[this.mapID[id]]+")="+this.cur);
    if (fn)
        fn(null, this.cur);
    else
        return this.cur;
};

function Gpio(pin, name) {
    this.pin = pin;
    this.name = name;
    pinstate[this.name] = 0;
}

Gpio.prototype.writeSync = function(n) {
    pinstate[this.name] = n;
    console.log("TEST Gpio: " + this.pin + "(" + this.name + ") = " + n);
};

module.exports = {
    Gpio: Gpio,
    DS18x20: DS18x20,
    pinstate: pinstate
};