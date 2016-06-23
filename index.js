/**
 * JorConsole - Jor1k running in a standard console
 */

var fs = require('fs');
var jorconsole = require('./lib/jorconsole');
var JorConsole = jorconsole.jorConsole;

var memorysize = 64; // memory available in mb

var useSimpleFs = false;

//var httpBase = "https://s-macke.github.io/jor1k/";
var httpBase = "file://";
var realBase = fileBase = __dirname + "/" + "jor1k-sysroot/or1k/";
var fileSrc  = "basefs.json";
if(!useSimpleFs) {
	fileBase = __dirname + "/" + "jor1k-sysroot/fs/";
	fileSrc  = "fs.json";
}

var vmlinux = "vmlinux.bin";
if(!fs.existsSync(fileBase + vmlinux)) {
	console.log("Consider unpacking vmlinux using: bunzip2 -k vmlinux.bin.bz2 in the " + realBase + " directory");
	vmlinux += ".bz2";
	if(!fs.existsSync(fileBase + vmlinux)) {
		console.log("Couldn't find " + fileBase + vmlinux + ", were the submodules initialized? Kernel probably won't boot");
	}
}

var ncores = 1;
var threading = 'webthreads';
// also available: webworker
//threading = 'webworker';
var cpu = 'safe';
cpu = 'asm';

// Not recommended: kernel fails to find root
if(false) {
	cpu = 'smp';
	ncores = 2;
	vmlinux = "vmlinuxsmp.bin.bz2";
}

var relayURL = 'https://relay.widgetry.org/';
//relayURL = false; // disable networking

var jc = new JorConsole({
	path: httpBase + fileBase,
	fs: {
		basefsURL: fileSrc,
	},
	relayURL: relayURL,
	system: {
		cpu: cpu,
		kernelURL: vmlinux,
		memorysize: memorysize,
		ncores: ncores,
	},
	threading: threading,
});
