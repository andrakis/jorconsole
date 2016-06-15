// -------------------------------------------------
// -------------- Terminal Output ------------------
// -------------------------------------------------
function ConsoleTerminal () {
	this.buffer = "";
	this.autoflushTimeout = 10;
}
ConsoleTerminal.prototype.Init = function(target, tty) {
	this.tty = tty;
	var self = this;
	target.message.Register(tty, function(d) {
		//console.log("(TTY) got data", d);
		if(d && d.constructor == Array) {
			var chars = d.map((c) => String.fromCharCode(c & 0xFF));
			self.PutString.call(self, chars.join(''));
		} else {
			self.PutChar.call(self, d&0xFF);
		}
	});
};
ConsoleTerminal.prototype.PutChar = function(c) {
//	this.buffer += String.fromCharCode(c);
//	clearTimeout(this.redraw);
//	var self = this;
//	this.redraw = setTimeout(function() { self.flush(); }, this.autoflushTimeout);
	process.stdout.write(String.fromCharCode(c));
};
ConsoleTerminal.prototype.PutString = function(s) {
	process.stdout.write(s);
};
ConsoleTerminal.prototype.flush = function() {
	process.stdout.write(this.buffer);
	this.buffer = "";
};

module.exports = ConsoleTerminal;
