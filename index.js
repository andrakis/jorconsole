/**
 * JorConsole - Jor1k running in a standard console
 */

var JorConsole = require('./lib/jorconsole');

//var httpBase = "https://s-macke.github.io/jor1k/";

// worker has no access to fs library
var httpBase = "file://" + __dirname + "/";
var jc = new JorConsole({
	path: httpBase + "jor1k-sysroot/or1k/",
	system: {
	}
});
