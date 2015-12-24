/**
 * JorConsole - Emulator interface
 * Interfaces with Jor1k to control it.
 */

var fs = require('fs');
var blessed = require('blessed');          // Terminal library

global.onmessage = null;

function EmuInstance (settings) {
	this.settings = settings || {};
	this.cpu_name = this.settings.cpu_type || "safe";
}

EmuInstance.prototype.tryInit = function() {
	var RAMmodule = '../node_modules/jor1k/js/worker/ram';
	var CPUmodule = '../node_modules/jor1k/js/worker/or1k/' + this.cpu_name + 'cpu';

	var required_files = [RAMmodule, CPUmodule];
	for (var i = 0; i < required_files.length; i++) {
		var file = __dirname + "/" + required_files[i] + ".js";
		try {
			var stat = fs.statSync(file);
		} catch (e) {
			console.log("File " + file + " is not present");
			return false;
		}
	}

	this.RAM = require(RAMmodule);
	this.CPU = require(CPUmodule);
	return true;
}

exports = module.exports = {
	create: function(settings) {
		return new EmuInstance(settings || {});
	},
};
