/**
 * Worker launcher
 *
 * Supports the following worker threading libraries:
 *
 * - webworker-threads
 * - webthreads (preferred)
 */

'use strict';

var util = require('util');

var webworker;
var webthreads;

try {
	webworker = require('webworker-threads').Worker;
} catch (e) {}

try {
	webthreads = require('webthreads');
} catch (e) {}

if(!webworker && !webthreads)
	throw 'No eligible threading library found';

function setupWorker (worker, target) {
	worker.onmessage = function(event) {
		try {
			target.onmessage(event);
		} catch (e) {
			console.log("(WORKER) Error in onmessage: " + e);
			console.log(e.stack);
		}
	};
	worker.onerror = function(event) {
		try {
			target.onerror(event);
		} catch (e) {
			console.log("(WORKER) Error in onmessage: " + e);
			console.log(e.stack);
		}
	};
}

function ThreadBase () {
	this.onmessage = null; /* set by user */
	this.onerror = null; /* set by user */

	this.thread = null; /* set by subclasses*/
}
ThreadBase.prototype.spawn = function() {
	this.handle_spawn();
};
ThreadBase.prototype.send = 
ThreadBase.prototype.postMessage = function(m) {
	this.worker.send(m);
};

function WebWorkerThread () {
	if(!webworker)
		throw 'WebWorker not available';
};
util.inherits(WebWorkerThread, ThreadBase);

WebWorkerThread.prototype.handle_spawn = function() {
	var worker_path = __dirname + "/../runtime/jor1k-worker-min.js";
	this.worker = new webworker(worker_path);
	setupWorker(this.worker, this);
	this.worker.send = this.worker.postMessage;
};

function WebThreadsThread () {
	if(!webthreads)
		throw 'Webthreads not available';
}
util.inherits(WebThreadsThread, ThreadBase);

WebThreadsThread.prototype.handle_spawn = function() {
	this.worker = webthreads.spawn_shim(__dirname + '/webthreads_shim');
	setupWorker(this.worker, this);
};

var implementations = {
	'webworker': WebWorkerThread,
	'webthreads': WebThreadsThread,
};

exports.create = function(preferred) {
	var impl = implementations[preferred] || webthreads || webworker;
	console.log("Using: " + util.inspect(impl));
	var instance = new impl();
	instance.spawn();
	return instance;
};
