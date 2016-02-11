var util = require('util');
var fs = require('fs');

var jorPath = __dirname + '/../jor1k/js/';
function jormodule (module) {
	return require(jorPath + module);
}

function DebugMessage() {
	return console.log.apply(console, arguments);
}

// Must be set prior to including messagehandler (which RAM does)
global.onmessage = {};

var RAM = jormodule("worker/ram");
var message = jormodule("worker/messagehandler");
var utils = jormodule("worker/utils");
var elf = jormodule("worker/elf");

if (!Math.imul) {
	jormodule("worker/imul");
}

console.log("Modules import OK");
process.exit();

var fb;
var ram;
var uart;
var cpu;
var running = false;

// -------------------------------------------------
// -------------- Terminal Output ------------------
// -------------------------------------------------
function MyTerminal () {
	this.buffer = "";
	this.autoflushTimeout = 10;
}
MyTerminal.prototype.PutChar = function(c) {
	this.buffer += String.fromCharCode(c);
	clearTimeout(this.redraw);
	var self = this;
	this.redraw = setTimeout(function() { self.flush(); }, this.autoflushTimeout);
};
MyTerminal.prototype.flush = function() {
	process.stdout.write(this.buffer);
	this.buffer = "";
};

// -------------------------------------------------
// ---------------- Framebuffer --------------------
// -------------------------------------------------
// Framebuffer not presently implemented, a dummy is provided

function MyFramebuffer() { }
MyFramebuffer.prototype.SetAddr = function(addr) { };
MyFramebuffer.prototype.Update = function() { };

// -------------------------------------------------
// -------------- Terminal Input -------------------
// -------------------------------------------------

// Set which codes are captured and cause the emulator to abort
var abortCodes = {
	0x1a: false,      // Ctrl+Z
	0x18: true,       // Ctrl+X
	0x3 : false,      // Ctrl+C
};

function MyTerminalInput () {
	var self = this;
	this.stdin = process.openStdin();
	if (process.stdin.isTTY) {
		self.stdin.setRawMode(true);
	} else {
		console.log("WARNING: STDIN is not a TTY, your input may not work correctly");
	}
	self.stdin.on('data', (data) => {
		handleKeyPress(self, data);
	});
}
function handleKeyPress(term, data) {
	var keycode = data[0];
	if (process.env.JOR_VERBOSE) {
		process.stdout.write("Got keypress: " + util.inspect(data) + "\n");
	}
	if (abortCodes[keycode] == true) {
		if (process.stdin.isTTY) {
			term.stdin.setRawMode(false);
		}
		process.stdout.write("\n\nabort pressed, aborting\n");
		process.exit();
	}
	switch (keycode) {
		case 0x10: // Ctrl+P - Print CPU state
			//j.PrintState();
			break;

		case 0x13: // Ctrl+S - Start emulation
			if (!running) {
				MainLoop();
			}
			break;

		default:
			//if (!running)
			//	break;
			switch (keycode) {
				case 0x1b:  // Arrow keys
					if (data[1] == 0x5b) {
						switch (data[2]) {
							case 0x41:  // Up
								uart.ReceiveChar(0x10);
								break;
							case 0x42:  // Down
								uart.ReceiveChar(0x0E);
								break;
							case 0x43:  // Left
								uart.ReceiveChar(0x6);
								break;
							case 0x44:  // Right
								uart.ReceiveChar(0x2);
								break;
						}
					}
					break;

				default:
					uart.ReceiveChar(keycode);
			}
			break;
	}
}

// -------------------------------------------------
// ------------ System Initialization --------------
// -------------------------------------------------

function MainLoop ()
{
	cpu.Step(0x10000);
	if (running)
		setTimeout(MainLoop, 0);
}

var term = new MyTerminal();
DebugMessage("Terminal initialized");
new MyTerminalInput();
DebugMessage("Terminal input initialized");
//fb = new MyFramebuffer();
//j.DebugMessage("Framebuffer initialized");
//ram = new j.RAM(0x2000000);
//j.DebugMessage("RAM initialized");
//uart = new j.UART();
//j.setUart(uart);
//j.DebugMessage("UART initialized");
//cpu = new j.CPU();
//j.setCpu(cpu);
//j.DebugMessage("CPU initialized");

var str = "Loading Image from local storage (5 MB). Please wait ..."
for (var i = 0; i < str.length; i++) {
	term.PutChar(str.charCodeAt(i));
}

/*img = __dirname + "/../jor1k-legacy/bin/vmlinux.bin";
fs.readFile(img, (err, data) => {
	if (err) throw err;

	j.DebugMessage("Got FS data: " + data.length + " bytes");
	var buffer8 = new Uint8Array(data);
	for (var i = 0; i < buffer8.length; i++) ram.uint8mem[i] = buffer8[i];
	for (var i = 0; i < buffer8.length >>> 2; i++) ram.uint32mem[i] = j.Swap32(ram.uint32mem[i]); // big endian to little endian

	if (process.env.JOR_NO_EMU) {
		j.DebugMessage("Emulation paused. Press CTRL+S to start.");
	} else {
		j.DebugMessage("Starting emulation");
		running = true;
		MainLoop();
	}
});*/
