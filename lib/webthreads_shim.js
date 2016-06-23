var util = require('util');

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
global.XMLHttpRequest = XMLHttpRequest;

var message = require('jor1k/js/worker/messagehandler');

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

// Register the 'Exit' event, used when emulator host is exiting
message.Register('Exit', function() {
	console.log("(WORKER) Cleanly exiting");
	process.exit();
});

require('jor1k/js/worker/worker');
