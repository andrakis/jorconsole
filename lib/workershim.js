var util = require('util');
var marshal = require('marshal');
var m_client = marshal.Client;
var m_shared = marshal.Shared;
// This sets up the worker message handler. We'll override this later
// such that we can intercept messages.
var message = require('../jor1k/js/worker/messagehandler');

var useStub = false;
if(!useStub) {
	var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
	global.XMLHttpRequest = XMLHttpRequest;
}

//global.onmessage = undefined;

global.location = {
	protocol: ""
};

// Override utils.LoadBinaryResource, since it's checking the wrong property
var utils = require('jor1k/js/worker/utils');
function LoadBinaryResource(url, OnSuccess, OnError) {
    var req = new XMLHttpRequest();
    // open might fail, when we try to open an unsecure address, when the main page is secure
    try {
        req.open('GET', url, true);
    } catch(err) {
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
        var arrayBuffer = req.responseText;
        if (arrayBuffer) {
            OnSuccess(arrayBuffer);
        } else {
            OnError("Error: No data received from: " + url);
        }
    };
    req.send(null);
}
utils.LoadBinaryResource = LoadBinaryResource;

if (useStub) {
	function XMLHttpRequest() {
		this.onreadystatechange = function() {
			console.log("XHR: no handler setup for onreadystatechange");
		};
	}
	XMLHttpRequest.prototype.open = function(method, url) {
		this.url = url || this.url;
		console.log("XHR open: " + this.url);
	};
	XMLHttpRequest.prototype.send = function() {
		console.log("XHR send");
	};

	global.XMLHttpRequest = XMLHttpRequest;
}

function jbug (msg) {
	//postMessage(JSON.stringify({type:'debug',msg:msg}));
	message.Debug(msg);
	//fs.appendFile("/home/freestyle/git/jorconsole/jbug.txt", msg, function(err) {
	//});
	//console.log(msg);
}
global.jbug = jbug;

function SHIM_Startup () {
	jbug("SHIM starting up");
	//jbug("Current onmessage handler: " + onmessage);
	var worker_handler = onmessage;
	onmessage = function(event) {
		var data = event.data;
		try {
			if(typeof data != 'object') {
				data = JSON.parse(data);
				//jbug("Parsed response data: " + util.inspect(data));
			}
		} catch (e) {
			jbug("Data: " + util.inspect(data));
			jbug("Failed to parse response");
		}
		if(data.marshal) {
			//jbug("(WORKER) Unmarshalling request");
			try {
				m_client.handleClientMessage(data.marshal);
			} catch (e) {
				jbug("(WORKER) exception in unmarshal process" + util.inspect(e));
			}
		} else {
			// Call old message handler
			//jbug("(WORKER) forwarding to worker");
			worker_handler(event);
		}
	}

	override_fs_module();
	//override_system_module();
}

function override_fs_module() {
	var fs = require('fs');

	fs.readFile = function(file, options, callback) {
		if (typeof options == 'function') {
			callback = options;
			options = undefined;
		}
		jbug("Attempt to read local file " + file);
		// marshal the request

		// switch encoding
		options = 'hex';

		var request = {
			module: 'fs', function: 'readFile',
			arguments: [file, options, function(err, data) {
				/*console.log("readFile request, err: ", err);
				if(data) {
					console.log("         ,data length: ", data.length, ", type:", typeof data);
				}
				console.log("Buffer length: ", buffer.length, ", content: ", util.inspect(buffer));
				console.log("String content: ", hexPreview(data));*/
				var buffer = new Buffer(data, 'hex');
				callback(err, buffer);
			}]
		};
		//console.log("Marshalling:", request);
		m_client.marshalRequest(request);
	};
}

function hexPreview(string) {
	var chars = 32;
	var result = [];
	for( var i = 0; i < chars; i++ ) {
		var ch = string.charCodeAt(i);
		result.push(ch.toString(16));
	}
	return result.join(' ');
}

function override_system_module() {
	console.log("Overriding System.prototype.OnKernelLoaded");
	var system = require('../jor1k/js/worker/system');
	system.prototype.oldOnKernelLoaded = system.prototype.OnKernelLoaded;
	system.prototype.OnKernelLoaded = function(string) {
		// For some reason, we end up with a string here. We need to convert it
		// into a Buffer for use with the Uint8Array constructor.
		var buffer = new Buffer(string);
		console.log("Buffer created: ", util.inspect(buffer));
		this.oldOnKernelLoaded(buffer);
	};
}

SHIM_Startup();
