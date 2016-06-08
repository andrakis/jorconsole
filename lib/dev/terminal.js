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
			d.forEach(function(c) {
				self.PutChar.call(self, c&0xFF);
			});
		} else {
			self.PutChar.call(self, d&0xFF);
		}
	});
};
ConsoleTerminal.prototype.PutChar = function(c) {
	/*this.buffer += String.fromCharCode(c);
	clearTimeout(this.redraw);
	var self = this;
	this.redraw = setTimeout(function() { self.flush(); }, this.autoflushTimeout);*/
	process.stdout.write(String.fromCharCode(c));
};
ConsoleTerminal.prototype.flush = function() {
	process.stdout.write(this.buffer);
	this.buffer = "";
};

module.exports = ConsoleTerminal;
