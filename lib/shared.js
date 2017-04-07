function EmulatorInfo (info) {
	info = info || {};
	this.network = info.network || false;
	this.columns = info.columns || process.stdout.columns || 80;
	this.rows    = info.rows    || process.stdout.rows    || 24;

	Object.defineProperty(this, 'toString', {
		enumerable: false,
		value: function() {
			var result = [];
			for(var key in this) {
				result.push(key + ":" + this[key]);
			}
			return result.join("\n") + "\n";
		}
	});

	Object.defineProperty(this, 'toJson', {
		enumerable: false,
		value: function() {
			var result = {};
			for(var key in this)
				result[key] = this[key];
			return result;
		}
	});
}

exports.EmulatorInfo = EmulatorInfo;
