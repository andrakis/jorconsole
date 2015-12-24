/**
 * JorConsole - Emulator interface
 * Interfaces with Jor1k to control it.
 */

var blessed = require('blessed');          // Terminal library

global.onmessage = null;

function EmuInstance (settings) {
	var cpu_name = settings.cpu_type || "safe";
	this.RAM = require('../node_modules/jor1k/js/worker/ram');
	this.CPU = require('../node_modules/jor1k/js/worker/or1k/' + cpu_name + 'cpu');
}

EmuInstance.prototype.test = function() {
	return true;
}

exports = module.exports = {
	create: function(settings) {
		return new EmuInstance(settings || {});
	},
};
