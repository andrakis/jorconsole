var util = require('util');
var fs = require('fs');
var j = require('../jor1k-legacy/js/jor1k');

var fb;
var ram;
var uart;
var cpu;

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
	self.stdin.setRawMode(true);
	self.stdin.on('data', (data) => {
		handleKeyPress(self, data);
	});
}
function handleKeyPress(term, data) {
	var keycode = data[0];
	//process.stdout.write("Got keypress: " + util.inspect(data) + "\n");
	if (abortCodes[keycode] == true) {
		term.stdin.setRawMode(false);
		process.stdout.write("\n\nabort pressed, aborting\n");
		process.exit();
	}
	switch (keycode) {
		case 0x1b:  // Arrow keys
			if (data[1] == 0x5b) {
				switch (data[2]) {
					case 0x41:  // Up
					case 0x42:  // Down
					case 0x43:  // Left
					case 0x44:  // Right
						break;
				}
			}
			break;

		case 0x10: // Ctrl+P - Print CPU state
			j.PrintState();
			break;

		default:
			uart.ReceiveChar(keycode);
			break;
	}
}

// -------------------------------------------------
// ------------ System Initialization --------------
// -------------------------------------------------

function MainLoop ()
{
	cpu.Step(0x10000);
	setTimeout(MainLoop, 0);
}

exports.start = () => {
	var term = new MyTerminal();
	j.setTerm(term);
	j.DebugMessage("Terminal initialized");
	new MyTerminalInput();
	j.DebugMessage("Terminal input initialized");
	fb = new MyFramebuffer();
	j.setFb(fb);
	j.DebugMessage("Framebuffer initialized");
	ram = new j.RAM(0x2000000);
	j.setRam(ram);
	j.DebugMessage("RAM initialized");
	uart = new j.UART();
	j.setUart(uart);
	j.DebugMessage("UART initialized");
	cpu = new j.CPU();
	j.setCpu(cpu);
	j.DebugMessage("CPU initialized");

	var str = "Loading Image from local storage (5 MB). Please wait ..."
	for (var i = 0; i < str.length; i++) {
		term.PutChar(str.charCodeAt(i));
	}

	img = __dirname + "/../jor1k-legacy/bin/vmlinux.bin";
	fs.readFile(img, (err, data) => {
		if (err) throw err;

		j.DebugMessage("Got FS data: " + data.length + " bytes");
		var buffer8 = new Uint8Array(data);
		for (var i = 0; i < buffer8.length; i++) ram.uint8mem[i] = buffer8[i];
		for (var i = 0; i < buffer8.length >>> 2; i++) ram.uint32mem[i] = j.Swap32(ram.uint32mem[i]); // big endian to little endian

		j.DebugMessage("Starting emulation");
		MainLoop();
	});
};
