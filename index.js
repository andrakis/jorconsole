/**
 * JorConsole - Jor1k running in a standard console
 */

var fs = require('fs');
var jorconsole = require('./lib/jorconsole');
var JorConsole = jorconsole.jorConsole;

var useSimpleFs = false;

//var httpBase = "https://s-macke.github.io/jor1k/";
var httpBase = "file://";
var fileBase = __dirname + "/" + "jor1k-sysroot/or1k/";
var fileSrc  = "basefs.json";
if(!useSimpleFs) {
	fileBase = __dirname + "/" + "jor1k-sysroot/fs/";
	fileSrc  = "fs.json";
}

var vmlinux = "vmlinux.bin";
if(!fs.existsSync(fileBase + vmlinux)) {
	console.log("Consider unpacking vmlinux using: bunzip2 -k vmlinux.bin.bz2 in the " + fileBase + " directory");
	vmlinux += ".bz2";
	if(!fs.existsSync(fileBase + vmlinux)) {
		console.log("Couldn't find " + fileBase + vmlinux + ", were the submodules initialized? Kernel probably won't boot");
	}
}

var cpu = 'safe';

var jc = new JorConsole({
	path: httpBase + fileBase,
	fs: {
		basefsURL: fileSrc,
	},
	system: {
		kernelURL: vmlinux,
		cpu: cpu
	}
});
