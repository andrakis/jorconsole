// manages the websocket connection for the ethmac peripheral

"use strict";

var message = require(__dirname + '/../../jor1k/js/master/messagehandler');
var websocket; // the library
var WebSocket; // the class

try {
	websocket = require('websocket');
	WebSocket = websocket.w3cwebsocket;
} catch (e) {
	console.log("(WARN) Optional module webthreads not available.");
	console.log("(    ) Ethernet support not available.");
}

function Ethernet(relayURL) {
    if(!WebSocket)
		throw 'Not available';
    this.url = relayURL;
    this.onmessage = function(e) { };
    this.ntries = 0;
    this.OpenSocket();
}

function EthernetMessageHandler(e) {
	//console.log("(master/ethernet) message: ", e.data instanceof ArrayBuffer ? 'ArrayBuffer' : typeof e.data);
    // if we recv binary data, call the onmessage handler
    // which was assigned to this Ethernet object
    if (e.data instanceof ArrayBuffer) {
        this.onmessage(e);
    } else
        // otherwise, this might be a textual "ping" message to keep
        // the connection alive
        if (e.data.toString().indexOf('ping:') == 0) {
        this.socket.send('pong:' + e.data.toString().substring(5));
    }
}

function EthernetOpenHandler(e) {
    this.ntries = 0;
}

function EthernetCloseHandler(e) {
    // reopen websocket if it closes
    if (this.ntries > 3) {
        message.Debug("Websocket error: Connection failed");
        return;
    }
    this.ntries++;
    message.Debug("Websocket closed. Reopening.");
    this.OpenSocket();
}

function EthernetErrorHandler(e) {
    // just report the error to console, close event
    // will handle reopening if possible
    message.Debug("Websocket error:");
    message.Debug(e);
}

Ethernet.prototype.OpenSocket = function() {        
    try {
		console.log("Ethernet via websocket opening to " + this.url);
        this.socket = new WebSocket(this.url);
    } catch(err) {
		console.log("OpenSocket failure");
        delete this.socket;
        EthernetErrorHandler(err);
        return;
    }
    this.socket.binaryType = 'arraybuffer';
    this.socket.onmessage = EthernetMessageHandler.bind(this);
    this.socket.onclose = EthernetCloseHandler.bind(this);
    this.socket.onopen = EthernetOpenHandler.bind(this);
    this.socket.onerror = EthernetErrorHandler.bind(this);
}

Ethernet.prototype.SendFrame = function(data) {
    //if (typeof this.socket == "undefined") return;
	//console.log("SendFrame", data.byteLength);
    try {
        this.socket.send(data);
    } catch (err) {
        // this is unusual error, object exists, but send does not work 
		console.log("Could not SendFrame for " + data.constructor);
        EthernetErrorHandler(err);
    }
}

Ethernet.prototype.Close = function() {
    this.socket.onclose = undefined;
    this.socket.close();
}

module.exports = Ethernet;

