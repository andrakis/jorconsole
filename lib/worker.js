var Worker = require('webworker-threads').Worker;

function LocalWorker (module_path) {
	this.module = require(module_path);
}

LocalWorker.prototype.Send = function(m) {
	console.log("(LocalWorker) Send: " + util.inspect(m));
};

module.exports.Worker = Worker;
module.exports.LocalWorker = LocalWorker;
