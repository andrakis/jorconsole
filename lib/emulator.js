/**
 * JorConsole - Emulator interface
 * Interfaces with Jor1k to control it.
 */

var fs = require('fs');
var blessed = require('blessed');          // Terminal library

global.onmessage = null;

var ARCH_OR1K = "or1k";

function EmuInstance (settings) {
	this.settings     = settings || {};
	this.cpu_name     = this.settings.cpu_type || "safe";
	this.arch         = this.settings.arch || ARCH_OR1K;
	this.memorySizeMB = settings.memorySizeMB || 2;
	this.ramOffset    = settings.ramOffset || 0x100000;
}

function FileMissingException (path) {
	this.file = path;
}

function jorRequire (path) {
	var file = __dirname + '/' + '../node_modules/jor1k/js/' + path;
	try {
		var stat = fs.statSync(file + '.js');
	} catch (e) {
		throw new FileMissingException(file + '.js');
	}

	return require(file);
}

// Reproduced from jor1k/js/worker/messagehandler.js, since it doesn't
// correctly update the global scope.
global.onmessage = function(e) {
	if (!run)

var message  = jorRequire('worker/messagehandler');
var jorutils = jorRequire('worker/utils');
var RAM      = jorRequire('worker/ram');
var CPU      = jorRequire('worker/or1k/' + this.cpu_name + 'cpu');
var bzip2    = jorRequire('worker/bzip2');
var elf      = joRequire ('worker/elf');
var Timer    = jorRequire('worker/timer');

// Devices
var UARTDev       = jorRequire('worker/dev/uart');
var IRQDev        = jorRequire('worker/dev/irq');
var TimerDev      = jorRequire('worker/dev/timer');
var ATADev        = jorRequire('worker/dev/ata');
var RTCDev        = jorRequire('worker/dev/rtc');
var KeyboardDev   = jorRequire('worker/dev/keyboard');
var VirtIODev     = jorRequire('worker/dev/virtio');
var VirtioDummy   = jorRequire('worker/dev/virtio/dummy');
var VirtioInput   = jorRequire('worker/dev/virtio/input');
var VirtioBlock   = jorRequire('worker/dev/virtio/block');
var VirtioConsole = jorRequire('worker/dev/virtio/console');
var FS            = jorRequire('worker/filesystem/filesystem');

var SYSTEM_RUN  = 0x1;
var SYSTEM_STOP = 0x2;
var SYSTEM_HALT = 0x3; // Idle

function System () {

}

EmuInstance.prototype.tryInit = function() {
	// Initialise CPU
	var ramoffset = 0x100000;
	this.heap = new ArrayBuffer(this.memorySizeMB * 0x100000);
	this.h = new Uint32Array(this.heap);
	this.registers = new Uint32Array(this.heap);
	this.ram = new RAM(this.heap, this.ramOffset);
	console.log("Create CPU...");
	this.cpu = new CPU(this.ram);
	console.log("Success! Create devices");
	
	this.devices = [];
	this.devices.push(this.cpu);

	switch(this.arch) {
		case ARCH_OR1K:
			// Much of this comes from jor1k/js/worker/system.js
			// For now, just trying to produce a minimal working system.
			this.irqdev = new IRQDev(this);
			this.timerdev = new TimerDev();
			this.uartdev0 = new UARTDev(0, this, 0x2);
			this.uartdev1 = new UARTDev(1, this, 0x3);
			// TODO: this.ethdev =
			// TODO: this.fbdev = (framebuffer)
			this.atadev = new ATADev(this);
			// TODO: this.tsdev = (touchscreen)
			this.kbdev = new KeyboardDev(this);
			// TODO: this.snddev = (sound)
			this.rtcdev = new RTCDev(this);

			// VirtIO stuff. Not all of what's needed is here.
			this.virtioinputdev = new VirtioInput(this.ram);
			this.virtioblockdev = new VirtioBlock(this.ram);
			this.virtiodummydev = new VirtioDummy(this.ram);
			this.virtioconsoledev = VirtioConsole(this.ram);
			this.virtiodev2 = new VirtIODev(this, 0xB, this.ram, this.virtiodummydev);
			this.virtiodev3 = new VirtIODev(this, 0xC, this.ram, this.virtiodummydev);

			
			this.filesystem = new FS();
			// TODO: filesystem
			// Yeah, no filesystem is going to be problematic, but we can deal for now.
			// The idea is to implement native filesystem access (instead of the 9p filesystem),
			// and in the future loop filesystems instead of loose files.

			this.devices.push(this.irqdev);
			this.devices.push(this.timerdev);
			this.devices.push(this.uartdev0);
			this.devices.push(this.uartdev1);
			this.devices.push(this.atadev);
			this.devices.push(this.kbdev);
			this.devices.push(this.rtcdev);
			this.devices.push(this.virtiodev2);
			this.devices.push(this.virtiodev3);

			this.devices.push(
			break;

		default:
			console.log("Unknown architecture: " + this.arch);
			return false;
	}
	return true;
}

exports = module.exports = {
	create: function(settings) {
		return new EmuInstance(settings || {});
	},
};
