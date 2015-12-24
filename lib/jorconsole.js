/**
 * JorConsole - Run Jor1k in a console
 *
 */
var emulator = require('./emulator');

var EXIT_OK = 0;
var EXIT_EMULATOR = 10;

function start () {
	console.log("Initializing console subsystem...");
	// TODO
	console.log("Checking emulator interface...");
	var emu = emulator.create();
	if (!emu.test()) {
		console.log("  Emulator interface test failed");
		process.exit(EXIT_EMULATOR);
	}
	console.log("Ok, continuing");
}

exports = module.exports = {
	start: start
};
