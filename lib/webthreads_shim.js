var util = require('util');
var JorSystem = require('jor1k/js/worker/system');
var JorEthMac = require('jor1k/js/worker/dev/ethmac');
var message = require('jor1k/js/worker/messagehandler');

// Override the Init function of System so that we can alter the ethernet
// TransmitCallback function.
var oldInit = JorSystem.prototype.Init;
JorSystem.prototype.Init = function(system) {
	console.log("(Worker) Init overrided!");
	oldInit.call(this, system);
	var oldCallback = this.ethdev.TransmitCallback;
	this.ethdev.TransmitCallback = function(data){
		//console.log("(Worker/eth) Transmit: ", data.byteLength);
		// Convert to a buffer, grab the hex data, send that, and
		// the master jorconsole will convert it back to an ArrayBuffer
		var buffer = new Buffer(data);
		var hex = buffer.toString('hex');
		oldCallback(hex);
	};

	// Override the Receive function of the ethernet device so that we can
	// intercept the data (which was transmitted in hex format) and convert it
	// into an ArrayBuffer that the callback accepts.
	var ethdev = this.ethdev;
	var oldReceive = this.ethdev.Receive;
	message.Register("ethmac", function(hex) {
		var buffer = new Buffer(hex, 'hex');
		var arbuffer = new ArrayBuffer(buffer.length);
		var view = new Uint8Array(arbuffer);
		for(var i = 0; i < buffer.length; i++)
			view[i] = buffer[i];
		//console.log("(shim/ethdev.Receive) Received ArrayBuffer of length " + arbuffer.byteLength);
		oldReceive.call(ethdev, arbuffer);
	});
};

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
global.XMLHttpRequest = XMLHttpRequest;

// Override utils.LoadBinaryResource, since it's checking the wrong property
var utils = require('jor1k/js/worker/utils');
function LoadBinaryResource(url, OnSuccess, OnError) {
	url = url.replace(/^..\/sys/, 'jor1k-sysroot');
	url = url.replace(/file:\/\//, '');
	if(true) {
		var fs = require('fs');
		fs.readFile(url, function(err, data) {
			try {
				if(err) {
					console.log("(SHIM) Failed to LoadBinaryResource! " + util.inspect(err));
					return OnError();
				}
				//console.log("(WORKER) LoadBinaryResource: " + (err ? 'failure' : 'success'));
				//var buffer = new Buffer(data, 'binary');
				//data = buffer;
				//console.log(data.length + " bytes loaded");
				//data = new ArrayBuffer(data);
				if(0) {
					var ab = new ArrayBuffer(data.length);
					var view = new Uint8Array(ab);
					for(var i = 0; i < buffer.length; i++) {
						view[i] = buffer[i];
					}
					data = ab;
				//	console.log(data.byteLength + " bytes loaded");
				}
				if(err) {
					console.log("(SHIM) Error in LoadBinaryResource: " + util.inspect(err));
					OnError();
				} else {
					try {
						OnSuccess(data);
					} catch (e) {
						console.log("(WORKER/LoadBinaryResource ERROR: ", e);
					}
				}
			} catch (e) {
				console.log("(SHIM) ERROR IN LoadBinaryResource: " + util.inspect(e));
				//console.log(e.stack);
			}
		});
		return;
	}
	var req = new XMLHttpRequest();
	url = 'file://' + __dirname + '/../' + url;
	console.log("LoadBinaryResource: " + url);
    // open might fail, when we try to open an unsecure address, when the main page is secure
    try {
        req.open('GET', url, true);
    } catch(err) {
		console.log("Failed to load resource");
        OnError(err);
        return;
    }
    req.responseType = "arraybuffer";
    req.onreadystatechange = function () {
        if (req.readyState != 4) {
            return;
        }
        if ((req.status != 200) && (req.status != 0)) {
            OnError("Error: Could not load file " + url);
            return;
        }
        var arrayBuffer = new Buffer(req.responseText);
        if (arrayBuffer) {
			console.log("Load resource success: " + typeof arrayBuffer);
            OnSuccess(arrayBuffer);
        } else {
            OnError("Error: No data received from: " + url);
        }
    };
    req.send(null);
}
utils.LoadBinaryResource = LoadBinaryResource;

require('jor1k/js/worker/worker');
