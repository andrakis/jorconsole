// -------------------------------------------------
// -------------- Terminal Input -------------------
// -------------------------------------------------

var util = require('util');
var Table = require('cli-table2');
var message = require(__dirname + '/../../jor1k/js/master/messagehandler');

// Set which codes are captured and cause the emulator to abort
var abortCodes = {
	0x1a: false,      // Ctrl+Z
	0x18: false,      // Ctrl+X
	0x3 : false,      // Ctrl+C
};

var emulatorCommands = {
	//s: StartEmulator
	//c: Cycle,
	i: ToggleIPS,
	p: PrintState,
	x: ExitNow,
	24: ExitNow,
	'?': ShowEmulatorCommands
};

function ConsoleTerminalInput (SendChars) {
	var self = this;
	self.SendChars = SendChars;
	self.enabled = true;
	self.emulatorCommand = false;
	this.stdin = process.openStdin();
	if (process.stdin.isTTY) {
		self.stdin.setRawMode(true);
	} else {
		console.log("WARNING: STDIN is not a TTY, your input may not work correctly");
	}
	self.stdin.on('data', this.handleKeyPress.bind(this));
	ShowEmulatorCommands();
}

ConsoleTerminalInput.prototype.handleKeyPress = function(data) {
	var keycode = data[0];
	var keycodeStr = String.fromCharCode(keycode);
	if (process.env.JOR_VERBOSE) {
		process.stdout.write("Got keypress: " + util.inspect(data) + "\n");
	}
	if (abortCodes[keycode] == true) {
		if (process.stdin.isTTY) {
			this.stdin.setRawMode(false);
		}
		process.stdout.write("\n\nabort pressed, aborting\n");
		process.exit();
	}
	if (this.emulatorCommand) {
		if (emulatorCommands[keycodeStr]) {
			emulatorCommands[keycodeStr].call(this);
		} else if (emulatorCommands[keycode]) {
			emulatorCommands[keycode].call(this);
		} else {
			console.log("Ctrl+X+" + keycodeStr + "(" + keycode + ")" + ": unknown combination");
		}
		this.emulatorCommand = false;
		return;
	}
	switch (keycode) {
		case 0x10: // Ctrl+P - Print CPU state
			//j.PrintState();
			break;

		//case 0x13: // Ctrl+S - Start emulation
			/*if (!running) {
				MainLoop();
			}*/
			break;

		case 0x18:  // Ctrl+X - special input
			this.emulatorCommand = true;
			break;

		default:
			this.SendChars([data[0]]);
			break;
	}
}

function ExitNow () {
	var jorconsole = require(__dirname + '/../jorconsole');
	process.stdout.write("\n\nabort pressed, aborting\n");
	jorconsole.GetActiveInstance().Exit();
	// Restore keyboard handling
	if (process.stdin.isTTY) {
		this.stdin.setRawMode(false);
	}
};
ExitNow.description = "Exit the emulator immediately";

function ToggleIPS () {
	var jorconsole = require(__dirname + '/../jorconsole');
	jorconsole.GetActiveInstance().ToggleIPS();
}
ToggleIPS.description = "Toggle Instructions Per Second display";

function PrintState () {
	var jorconsole = require(__dirname + '/../jorconsole');
	jorconsole.GetActiveInstance().PrintState();
}
PrintState.description = "Print the current CPU state";

function ShowEmulatorCommands () {
	console.log("Press CTRL+X, then any of the following keys:");
	var table = new Table({
		head: ["Key", "Command", "Description"]
	});
	var alreadyOutput = {};
	for(var k in emulatorCommands) {
		var name = '';
		var matches = emulatorCommands[k].toString().match(/function ([^(]+)/);
		var key = k;
		if (key.match(/^[0-9]+$/)) {
			// Skip
			continue;
		}
		if (!alreadyOutput[k]) {
			if (matches)
				name = matches[1];
			table.push([key, name, emulatorCommands[k].description]);
		}
		alreadyOutput[k] = true;
	}
	console.log(table.toString());
}
ShowEmulatorCommands.description = "Show emulator commands";

function StartEmulator() {
}
StartEmulator.description = "Start emulation";

function Cycle() {
	var r = message.Send("execute");
	console.log("Cycle result: " + r);
}
Cycle.description = "Cycle the emulator";

module.exports = ConsoleTerminalInput;
