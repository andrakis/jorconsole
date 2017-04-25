var create_worker = require('./worker').create;
var fs = require('fs');
var util = require('util');
var marshal = require('marshal');
var m_shared = marshal.Shared;
var m_server = marshal.Server;
var shared = require('./shared');
var EmulatorInfo = shared.EmulatorInfo;

var jorPath = __dirname + '/../jor1k/js/';
function jormodule (module) {
	return require(jorPath + module);
}

var ConsoleTerminal = require('./dev/terminal');
var ConsoleTerminalInput = require('./dev/terminal-input');
var ConsoleFramebuffer = require('./dev/framebuffer');
var ConsoleEthernet = require('./dev/ethernet');
var ConsoleLoopSoundBuffer = require('./dev/sound');
var ConsoleFilesystem = require('./dev/filesystem');
var utils = jormodule('master/utils');
var message = jormodule('master/messagehandler');

var active_instance = null;

function jorConsole(parameters)
{
	active_instance = this;

	var emulator_info = new EmulatorInfo();

	this.params = parameters || {};
	this.message = message;

	this.showIPS = false;

	// --- parameters parsing ---
	this.params.system = this.params.system  || {};

	this.params.path = this.params.path || "";

	this.params.system.kernelURL = this.params.system.kernelURL || "vmlinux.bin.bz2";
	this.params.system.memorysize = this.params.system.memorysize || 32;
	this.params.system.arch = this.params.system.arch || "or1k";
	this.params.system.cpu = this.params.system.cpu || "asm";
	this.params.system.ncores = this.params.system.ncores || 1;
	this.params.syncURL = this.params.syncURL || "";

	this.params.fs = this.params.fs  || {};
	this.params.fs.basefsURL = this.params.fs.basefsURL || "basefs.json";
	this.params.fs.earlyload = this.params.fs.earlyload  || [];
	this.params.fs.lazyloadimages = this.params.fs.lazyloadimages  || [];

	this.params.system.kernelURL = this.params.path + this.params.system.kernelURL;
	this.params.fs.basefsURL = this.params.path + this.params.fs.basefsURL;
	if (this.params.fs.extendedfsURL) {
		this.params.fs.extendedfsURL = this.params.path + this.params.fs.extendedfsURL;
	}

	this.params.userid = this.params.userid || "";

	// ----------------------
	this.worker = create_worker(this.params.threading);
	message.SetWorker(this.worker);
	m_server.SetWorker(this.worker);
	m_server.Init();

	// Override the current onmessage handler
	//console.log("Overriding worker.onmessage, was:", this.worker.onmessage);
	var workerHandler = this.worker.onmessage;
	this.worker.onmessage = function(event) {
		//console.log("(MASTER) Receive event", util.inspect(event));
		var data = event.data;
		try {
			data = JSON.parse(data);
		} catch (e) { }
		if (data.marshal) {
			//console.log("(MASTER) Marshalling request");
			try {
				m_server.handleMarshalRequest(data.marshal);
			} catch (e) {
				console.log("(MASTER) Failure: ", e);
			}
		} else {
			//console.log("(MASTER) Send request to worker");
			//console.log(event);
			try {
				workerHandler({data:event});
			} catch (e) {
				console.log("(MASTER) exception", e);
			}
		}
	};
	this.worker.onerror = function(event) {
		console.log("(MASTER) Worker error: ", event);
		console.log(e.stack);
	};

	this.terms = [];
	if (this.params.term) {
		this.terms = [this.params.term];
	} else if (this.params.terms) {
		this.terms = this.params.terms.slice(0, 2); // support up to 2 terminals
	} else {
		this.terms.push(new ConsoleTerminal());
	}
	for (var i = 0; i < this.terms.length; i++) {
		this.terms[i].Init(this, "tty" + i);
	}

	this.activeTTY = "tty0";
	this.terminput = new ConsoleTerminalInput(this.SendChars.bind(this));

	this.fs = new ConsoleFilesystem(this.params.syncURL, this.params.userid);

	//this.sound = new LoopSoundBuffer(22050);
	//message.Register("sound",      this.sound.AddBuffer.bind(this.sound));
	//message.Register("sound.rate", this.sound.SetRate.bind(this.sound));

	if (false && this.clipboard) {
		this.clipboard.onpaste = function(event) {
			this.clipboard.value = "";
			setTimeout(this.SendClipboard.bind(this), 4);    
		}.bind(this);


		this.SendClipboard = function() {
			var chars = [];
			var v = this.clipboard.value;

			for(var i=0; i<v.length; i++) {
				chars.push(v.charCodeAt(i));
			}

			this.SendChars(chars);
			this.clipboard.value = "";
		}.bind(this);
	}

	this.IgnoreKeys = function() {
		return (
				(this.lastMouseDownTarget != TERMINAL) &&
				(this.framebuffer ? this.lastMouseDownTarget != this.framebuffer.fbcanvas : true) &&
				(this.lastMouseDownTarget != this.clipboard)
			   );
	}

	var recordTarget = function(event) {
		var termHitByEvent = false;
		for (var i = 0; i < this.terms.length; i++) {
			if (this.terms[i].WasHitByEvent(event)) {
				termHitByEvent = true;
				this.activeTTY = "tty" + i;
				break;
			}
		}
		if (termHitByEvent)
			this.lastMouseDownTarget = TERMINAL;
		else
			this.lastMouseDownTarget = event.target;
	}.bind(this);

	// TODO: mouse event listener: send events to recordTarget

	// TODO: hook into input stream
	var onkeypress = function(event) {
		if(this.IgnoreKeys()) return true;
		if ((this.lastMouseDownTarget == TERMINAL) || (this.lastMouseDownTarget == this.clipboard)) {
			return this.terminput.OnKeyPress(event);
		}
		message.Send("keypress", {keyCode:event.keyCode, charCode:event.charCode});
		return false;
	}.bind(this);

	var onkeydown = function(event) {
		if(this.IgnoreKeys()) return true;
		if ((this.lastMouseDownTarget == TERMINAL) || (this.lastMouseDownTarget == this.clipboard)) {
			return this.terminput.OnKeyDown(event);
		}
		message.Send("keydown", {keyCode:event.keyCode, charCode:event.charCode});
		return false;
	}.bind(this);

	var onkeyup = function(event) {
		if(this.IgnoreKeys()) return true;
		if ((this.lastMouseDownTarget == TERMINAL) || (this.lastMouseDownTarget == this.clipboard)) {
			return this.terminput.OnKeyUp(event);
		}
		message.Send("keyup", {keyCode:event.keyCode, charCode:event.charCode});
		return false;
	}.bind(this);

	emulator_info["network"] = (this.params.relayURL ? "1" : "0");
	if (this.params.relayURL) {
		try {
			this.ethernet = new ConsoleEthernet(this.params.relayURL);
			this.ethernet.onmessage = function(e) {
				// Convert the message into a hex buffer for the other end to receive correctly
				var buffer = new Buffer(e.data);
				var hex = buffer.toString('hex');
				//console.log("(master/ethernet.onmessage) received: " + hex);
				message.Send("ethmac", hex);
			}.bind(this);
			//message.Register("ethmac", this.ethernet.SendFrame.bind(this.ethernet));
			var self = this;
			message.Register("ethmac", function(e) {
				// Receive the hex buffer data and convert it into the ArrayBuffer expected
				//console.log("(ETHMAC)", typeof e, e, util.inspect(e));
				var buffer = new Buffer(e, 'hex');
				var arbuffer = new ArrayBuffer(buffer.length);
				var view = new Uint8Array(arbuffer);
				for(var i = 0; i < buffer.length; i++)
					view[i] = buffer[i];
				self.ethernet.SendFrame.call(self.ethernet, arbuffer);
			});
		} catch (e) {
		}
	}

	message.Register("GetIPS", this.ShowIPS.bind(this));
	message.Register("execute", this.Execute.bind(this));

	this.Reset();

	// set terminal size
	emulator_info["columns"] = process.stdout.columns;
	emulator_info["rows"] =  process.stdout.rows;

	fs.writeFileSync("jor1k-sysroot/fs/etc/emulator_info", emulator_info + "");
	message.Send("emulator_info", emulator_info.toJson());

	if(0) process.stdout.on('resize', () => {
		message.Send("resize", { columns: process.stdout.columns, rows: process.stdout.rows });
	});

	setInterval(function(){message.Send("GetIPS", 0)}.bind(this), 1000);
}

// this command is send back and forth to be responsive
jorConsole.prototype.Execute = function() {
	if(this.stop) {
		console.log("(MASTER) Executing avoided because this.stop == true");
		return;
	}
	if(this.userpaused) {
		console.log("(MASTER) User paused is true");
		this.executepending = true;
	} else {
		//console.log("(MASTER) Sending execute");
		this.executepending = false;
		message.Send("execute", 0);
	}
};

jorConsole.prototype.ShowIPS = function(ips) {
	if (!this.stats) {
		if(!this.showIPS) return;
		console.log("(MASTER) " + (ips<1000000?
			Math.floor(ips/1000) + " KIPS"
			:
			(Math.floor(ips/100000)/10.) + " MIPS"));
		return;
	}
	if (this.userpaused) {
		this.stats.innerHTML = "Paused"; 
	} else {
		this.stats.innerHTML = ips<1000000?
			Math.floor(ips/1000) + " KIPS"
			:
			(Math.floor(ips/100000)/10.) + " MIPS";
	}
};

jorConsole.prototype.ChangeCore = function(core) {
	message.Send("ChangeCore", core);
};

jorConsole.prototype.Reset = function () {
	this.stop = false; // VM Stopped/Aborted
	this.userpaused = false;
	this.executepending = false; // if we rec an execute message while paused      

	message.Send("Init", this.params.system);
	message.Send("Reset");
	message.Send("LoadAndStart", this.params.system.kernelURL);
	message.Send("LoadFilesystem", this.params.fs);

	if (this.terms.length > 0) {
		this.terms.forEach(function (term) {
				//term.PauseBlink(false);
				});
		//this.lastMouseDownTarget = TERMINAL;
		// activeTTY remains the same, so the user can start typing into the terminal last used
		// or the default terminal initialized in the constructor
	}
}

jorConsole.prototype.Pause = function(pause) {
	pause = !! pause; // coerce to boolean
	if(pause == this.userpaused) return; 
	this.userpaused = pause;
	if(! this.userpaused && this.executepending) {
		this.executepending = false;
		message.Send("execute", 0);
	}
	this.terms.forEach(function (term) {
			term.PauseBlink(pause);
			});
}

// sends the input characters for the terminal
jorConsole.prototype.SendChars = function(chars) {
	//if (this.lastMouseDownTarget == this.fbcanvas) return;
	//console.log("Sending chars: " + util.inspect(chars));
	message.Send(this.activeTTY, chars);
	message.Send("htif.term0.Transfer", chars);
}

// Returns the terminal attached to tty
// tty is the tty string, for example, tty0
jorConsole.prototype.GetTerm = function(tty) {
	var index = parseInt(tty.slice(3));
	return this.terms[index];
}

jorConsole.prototype.FocusTerm = function(tty) {
	this.activeTTY = tty;
	this.lastMouseDownTarget = TERMINAL;
}

jorConsole.prototype.ToggleIPS = function() {
	this.showIPS = !this.showIPS;
	console.log("IPS display: " + (this.showIPS ? 'on' : 'off'));
};

jorConsole.prototype.PrintState = function() {
	console.log("(MASTER) Requesting CPU state");
	message.Send("PrintOnAbort");
};

jorConsole.prototype.Exit = function() {
	console.log("(MASTER) Requesting worker exit");
	message.Send("Reset");
	message.Send("Exit");
	setTimeout(process.exit, 100);
};

function GetActiveInstance () { return active_instance; };

module.exports = {
	GetActiveInstance: GetActiveInstance,
	jorConsole: jorConsole
};
