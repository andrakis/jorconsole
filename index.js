/**
 * JorConsole - Jor1k running in a standard console
 */

var fs = require('fs');
var Getopt = require('node-getopt');
var jorconsole = require('./lib/jorconsole');
var JorConsole = jorconsole.jorConsole;

var memorysize = 32; // memory available in mb
var ncores = 1;
var threading = 'webthreads';
var useSimpleFs = false;
var cpu = 'asm';
var relayURL = 'https://relay.widgetry.org/';
var networkEnabled = false;


var getopt = new Getopt([
	['m', 'memory=ARG', `Set memory size (default: ${memorysize})`],
	['s', 'cpu-safe', 'Use safe CPU'],
	['a', 'cpu-asm', 'Use assembly CPU (default)'],
	['S', 'cpu-smp', 'Use SMP CPU (buggy)'],
	['C', 'cpu-cores=ARG', 'SMP CPU cores (default: 2)'],
	['v', 'vmlinux=ARG', 'Set vmlinux path (default: autodetected)'],
	['n', 'network', 'Enable networking'],
	['r', 'relay=ARG', `Set networking relay (default: ${relayURL})`],
	['f', 'simple-fs', 'Use simple filesystem (no games, demos, etc)'],
	['h', 'help', 'Show this help']
]);
getopt.setHelp(
	"Usage: node index.js [OPTION]\n" +
	"JOR1k Emulator in the console\n" +
	"\n" +
	"[[OPTIONS]]\n" +
	"\n"
);
var opt = getopt.parse(process.argv.slice(2));
if(opt.options.help) {
	getopt.showHelp();
	process.exit();
}

if(opt.options['memory']) memorysize = parseInt(opt.options['memory']);
if(opt.options['cpu-safe']) cpu = 'safe';
if(opt.options['cpu-asm']) cpu = 'asm';
if(opt.options['cpu-smp']) { cpu = 'smp'; ncores = 2; vmlinux = "vmlinuxsmp.bin.bz2"; }
if(opt.options['cpu-cores']) ncores = parseInt(opt.options['cpu-cores']);
if(opt.options['vmlinux']) vmlinux = opt.options['vmlinux'];
if(opt.options['network']) networkEnabled = true;
if(opt.options['relay']) relayURL = opt.options['relay'];
if(opt.options['simple-fs']) useSimpleFs = true;

if(!networkEnabled) relayURL = false;

var httpBase = "file://";
var realBase = fileBase = __dirname + "/" + "jor1k-sysroot/";
var BasefsJson  = "or1k/basefs.json";
var extBase = __dirname + "/" + "jor1k-sysroot/";
var extFsUrl = "";
if(!useSimpleFs) {
	extFsUrl = "fs.json";
}

var vmlinux = "or1k/vmlinux.bin";
if(!fs.existsSync(fileBase + vmlinux)) {
	console.log("Consider unpacking vmlinux using: bunzip2 -k vmlinux.bin.bz2 in the " + realBase + " directory");
	vmlinux += ".bz2";
	if(!fs.existsSync(fileBase + vmlinux)) {
		console.log("Couldn't find " + fileBase + vmlinux + ", were the submodules initialized? Kernel probably won't boot");
	}
}

console.log(
	"Creating emulator with settings:\n" +
	`	CPU: ${cpu}\n` +
	`	CPU Cores: ${ncores}\n` +
	`	Memory: ${memorysize}\n` +
	`	Kernel: ${vmlinux}\n` +
	`	Networking: ${relayURL}\n` +
	`	Base FS: ${fileBase}\n` +
	`	Ext  FS: ${extFsUrl}\n`
);
var jc = new JorConsole({
	path: httpBase + fileBase,
	fs: {
		basefsURL: BasefsJson,
		extendedfsURL: extFsUrl,
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
