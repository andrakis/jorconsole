/**
 * JorConsole - Jor1k running in a standard console
 */

var fs = require('fs');
var jorconsole = require('./lib/jorconsole');
var JorConsole = jorconsole.jorConsole;

//var httpBase = "https://s-macke.github.io/jor1k/";
var httpBase = "file://";
var fileBase = __dirname + "/" + "jor1k-sysroot/or1k/";

var vmlinux = "vmlinux.bin";
if(!fs.existsSync(fileBase + vmlinux)) {
	console.log("Consider unpacking vmlinux using: bunzip2 -k vmlinux.bin.bz2 in the " + fileBase + " directory");
	vmlinux += ".bz2";
	if(!fs.existsSync(fileBase + vmlinux)) {
		console.log("Couldn't find " + fileBase + vmlinux + ", were the submodules initialized? Kernel probably won't boot");
	}
}

var threading = 'webthreads';
// also available: webworker
//threading = 'webworker';

var jc = new JorConsole({
	path: httpBase + fileBase,
	system: {
		kernelURL: vmlinux,
		cpu: 'safe',
	},
	threading: threading,
});
