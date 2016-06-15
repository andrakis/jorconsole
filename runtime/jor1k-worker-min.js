(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// -------------------------------------------------
// -------------------- Worker ---------------------
// -------------------------------------------------

var message = require('./messagehandler');
var System = require('./system');

new System();
message.Send("WorkerReady", 0);

},{"./messagehandler":43,"./system":56}],2:[function(require,module,exports){
(function (global,Buffer){
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
	url = url.replace(/^..\/sys/, 'jor1k-sysroot');
	url = url.replace(/file:\/\//, '');
	if(true) {
		var fs = require('fs');
		fs.readFile(url, 'hex', function(err, data) {
			try {
				if(err) {
					console.log("(SHIM) Failed to LoadBinaryResource! " + util.inspect(err));
					return OnError();
				}
				//console.log("(WORKER) LoadBinaryResource: " + (err ? 'failure' : 'success'));
				//console.log(data.toString().length + " bytes loaded");
				var buffer = data;
				//var buffer = new Buffer(data, 'hex');
				//data = new ArrayBuffer(data);
				//var ab = new ArrayBuffer(data.length);
				//var view = new Uint8Array(ab);
				//for(var i = 0; i < buffer.length; i++) {
				//	view[i] = buffer[i];
				//}
				//data = ab;
				//console.log(data.byteLength + " bytes loaded");
				if(err) {
					console.log("(SHIM) Error in LoadBinaryResource: " + util.inspect(err));
					OnError();
				} else {
					try {
						OnSuccess(data);
					} catch (e) {
						console.log("(WORKER/LoadBinaryResource ERROR");
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
        var arrayBuffer = req.responseText;
        if (arrayBuffer) {
			console.log("Load resource success");
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
				jbug(e.stack);
			}
		} else {
			// Call old message handler
			//jbug("(WORKER) forwarding to worker");
			try {
				worker_handler(event);
			} catch (e) {
				jbug("(WORKER) exception in worker" + util.inspect(e));
			}
		}
	}
	onerror = function(e) {
		jbug("WORKER ERROR DETECTED: " + util.inspect(e));
	};

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
				try {
					if(data) {
						var buffer = new Buffer(data, 'hex');
						callback(err, buffer);
					} else {
						callback(err, null);
					}
				} catch (e) {
					console.log("(SHIM) Error in fs.readFile: " + util.inspect(e));
					//console.log(e.stack);
				}
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"../jor1k/js/worker/messagehandler":43,"../jor1k/js/worker/system":56,"buffer":7,"fs":5,"jor1k/js/worker/utils":58,"marshal":61,"util":89,"xmlhttprequest":90}],3:[function(require,module,exports){
'use strict'

exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

function init () {
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63
}

init()

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],4:[function(require,module,exports){

},{}],5:[function(require,module,exports){
arguments[4][4][0].apply(exports,arguments)
},{"dup":4}],6:[function(require,module,exports){
(function (global){
'use strict';

var buffer = require('buffer');
var Buffer = buffer.Buffer;
var SlowBuffer = buffer.SlowBuffer;
var MAX_LEN = buffer.kMaxLength || 2147483647;
exports.alloc = function alloc(size, fill, encoding) {
  if (typeof Buffer.alloc === 'function') {
    return Buffer.alloc(size, fill, encoding);
  }
  if (typeof encoding === 'number') {
    throw new TypeError('encoding must not be number');
  }
  if (typeof size !== 'number') {
    throw new TypeError('size must be a number');
  }
  if (size > MAX_LEN) {
    throw new RangeError('size is too large');
  }
  var enc = encoding;
  var _fill = fill;
  if (_fill === undefined) {
    enc = undefined;
    _fill = 0;
  }
  var buf = new Buffer(size);
  if (typeof _fill === 'string') {
    var fillBuf = new Buffer(_fill, enc);
    var flen = fillBuf.length;
    var i = -1;
    while (++i < size) {
      buf[i] = fillBuf[i % flen];
    }
  } else {
    buf.fill(_fill);
  }
  return buf;
}
exports.allocUnsafe = function allocUnsafe(size) {
  if (typeof Buffer.allocUnsafe === 'function') {
    return Buffer.allocUnsafe(size);
  }
  if (typeof size !== 'number') {
    throw new TypeError('size must be a number');
  }
  if (size > MAX_LEN) {
    throw new RangeError('size is too large');
  }
  return new Buffer(size);
}
exports.from = function from(value, encodingOrOffset, length) {
  if (typeof Buffer.from === 'function' && (!global.Uint8Array || Uint8Array.from !== Buffer.from)) {
    return Buffer.from(value, encodingOrOffset, length);
  }
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number');
  }
  if (typeof value === 'string') {
    return new Buffer(value, encodingOrOffset);
  }
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    var offset = encodingOrOffset;
    if (arguments.length === 1) {
      return new Buffer(value);
    }
    if (typeof offset === 'undefined') {
      offset = 0;
    }
    var len = length;
    if (typeof len === 'undefined') {
      len = value.byteLength - offset;
    }
    if (offset >= value.byteLength) {
      throw new RangeError('\'offset\' is out of bounds');
    }
    if (len > value.byteLength - offset) {
      throw new RangeError('\'length\' is out of bounds');
    }
    return new Buffer(value.slice(offset, offset + len));
  }
  if (Buffer.isBuffer(value)) {
    var out = new Buffer(value.length);
    value.copy(out, 0, 0, value.length);
    return out;
  }
  if (value) {
    if (Array.isArray(value) || (typeof ArrayBuffer !== 'undefined' && value.buffer instanceof ArrayBuffer) || 'length' in value) {
      return new Buffer(value);
    }
    if (value.type === 'Buffer' && Array.isArray(value.data)) {
      return new Buffer(value.data);
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ' + 'ArrayBuffer, Array, or array-like object.');
}
exports.allocUnsafeSlow = function allocUnsafeSlow(size) {
  if (typeof Buffer.allocUnsafeSlow === 'function') {
    return Buffer.allocUnsafeSlow(size);
  }
  if (typeof size !== 'number') {
    throw new TypeError('size must be a number');
  }
  if (size >= MAX_LEN) {
    throw new RangeError('size is too large');
  }
  return new SlowBuffer(size);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"buffer":7}],7:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; i++) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  that.write(string, encoding)
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

function arrayIndexOf (arr, val, byteOffset, encoding) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var foundIndex = -1
  for (var i = 0; byteOffset + i < arrLength; i++) {
    if (read(arr, byteOffset + i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
      if (foundIndex === -1) foundIndex = i
      if (i - foundIndex + 1 === valLength) return (byteOffset + foundIndex) * indexSize
    } else {
      if (foundIndex !== -1) i -= i - foundIndex
      foundIndex = -1
    }
  }
  return -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  if (Buffer.isBuffer(val)) {
    // special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(this, val, byteOffset, encoding)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset, encoding)
  }

  throw new TypeError('val must be string, number or Buffer')
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; i++) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; i++) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":3,"ieee754":12,"isarray":15}],8:[function(require,module,exports){
module.exports = {
  "100": "Continue",
  "101": "Switching Protocols",
  "102": "Processing",
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "203": "Non-Authoritative Information",
  "204": "No Content",
  "205": "Reset Content",
  "206": "Partial Content",
  "207": "Multi-Status",
  "208": "Already Reported",
  "226": "IM Used",
  "300": "Multiple Choices",
  "301": "Moved Permanently",
  "302": "Found",
  "303": "See Other",
  "304": "Not Modified",
  "305": "Use Proxy",
  "307": "Temporary Redirect",
  "308": "Permanent Redirect",
  "400": "Bad Request",
  "401": "Unauthorized",
  "402": "Payment Required",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "407": "Proxy Authentication Required",
  "408": "Request Timeout",
  "409": "Conflict",
  "410": "Gone",
  "411": "Length Required",
  "412": "Precondition Failed",
  "413": "Payload Too Large",
  "414": "URI Too Long",
  "415": "Unsupported Media Type",
  "416": "Range Not Satisfiable",
  "417": "Expectation Failed",
  "418": "I'm a teapot",
  "421": "Misdirected Request",
  "422": "Unprocessable Entity",
  "423": "Locked",
  "424": "Failed Dependency",
  "425": "Unordered Collection",
  "426": "Upgrade Required",
  "428": "Precondition Required",
  "429": "Too Many Requests",
  "431": "Request Header Fields Too Large",
  "500": "Internal Server Error",
  "501": "Not Implemented",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout",
  "505": "HTTP Version Not Supported",
  "506": "Variant Also Negotiates",
  "507": "Insufficient Storage",
  "508": "Loop Detected",
  "509": "Bandwidth Limit Exceeded",
  "510": "Not Extended",
  "511": "Network Authentication Required"
}

},{}],9:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})
},{"../../is-buffer/index.js":14}],10:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],11:[function(require,module,exports){
var http = require('http');

var https = module.exports;

for (var key in http) {
    if (http.hasOwnProperty(key)) https[key] = http[key];
};

https.request = function (params, cb) {
    if (!params) params = {};
    params.scheme = 'https';
    params.protocol = 'https:';
    return http.request.call(this, params, cb);
}

},{"http":79}],12:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],13:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],14:[function(require,module,exports){
/**
 * Determine if an object is Buffer
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install is-buffer`
 */

module.exports = function (obj) {
  return !!(obj != null &&
    (obj._isBuffer || // For Safari 5-7 (missing Object.prototype.constructor)
      (obj.constructor &&
      typeof obj.constructor.isBuffer === 'function' &&
      obj.constructor.isBuffer(obj))
    ))
}

},{}],15:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],16:[function(require,module,exports){
// -------------------------------------------------
// ------------------ UTF8 Helpers -----------------
// -------------------------------------------------
// http://en.wikipedia.org/wiki/UTF-8
"use strict";

function UTF8StreamToUnicode() {

    this.stream = new Uint8Array(5);
    this.ofs = 0;

    this.Put = function(key) {
        this.stream[this.ofs] = key;
        this.ofs++;
        switch(this.ofs) {
            case 1:
                if (this.stream[0] < 0x80) {
                    this.ofs = 0;
                    return this.stream[0];
                }
                break;

            case 2:
                if ((this.stream[0]&0xE0) == 0xC0)
                if ((this.stream[1]&0xC0) == 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0]&0x1F)<<6) | 
                        ((this.stream[1]&0x3F)<<0);
                }
                break;

            case 3:
                if ((this.stream[0]&0xF0) == 0xE0)
                if ((this.stream[1]&0xC0) == 0x80)
                if ((this.stream[2]&0xC0) == 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0]&0xF ) << 12) | 
                        ((this.stream[1]&0x3F) << 6)  | 
                        ((this.stream[2]&0x3F) << 0);
                }
                break;

            case 4:
                if ((this.stream[0]&0xF8) == 0xF0)
                if ((this.stream[1]&0xC0) == 0x80)
                if ((this.stream[2]&0xC0) == 0x80)
                if ((this.stream[3]&0xC0) == 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0]&0x7 ) << 18) | 
                        ((this.stream[1]&0x3F) << 12) | 
                        ((this.stream[2]&0x3F) << 6)  |
                        ((this.stream[3]&0x3F) << 0);
                }
                this.ofs = 0;
                return -1; //obviously illegal character, so reset
                break;

            default:
                this.ofs = 0;
                return -1;
                break;
        }
        return -1;
    }

}

function UnicodeToUTF8Stream(key) {
    key = key|0;
    if (key < 0x80) {
        return [key];
    } else 
    if (key <= 0x7FF) {
        return [
            (key >> 6) | 0xC0, 
            (key & 0x3F) | 0x80
            ];
    } else 
    if (key <= 0xFFFF) {
        return [
            (key >> 12) | 0xE0,
            ((key >> 6) & 0x3F) | 0x80,
            (key & 0x3F) | 0x80
            ];
    } else 
    if (key <= 0x10FFFF) {
        return [
            (key >> 18) | 0xF0,
            ((key >> 12) & 0x3F) | 0x80,
            ((key >> 6) & 0x3F) | 0x80,
            (key & 0x3F) | 0x80
            ];
    } else {
        //message.Debug("Error in utf-8 encoding: Invalid key");
    }
    return [];
}

function UTF8Length(s)
{
    var length = 0;
    for(var i=0; i<s.length; i++) {
        var key = s.charCodeAt(i);
        if (key < 0x80) {
            length += 1;
        } else
        if (key <= 0x7FF) {
            length += 2;
        } else 
        if (key <= 0xFFFF) {
            length += 3;
        } else 
        if (key <= 0x10FFFF) {
            length += 4;
        } else {
        }
    }
    return length;
}

module.exports.UTF8StreamToUnicode = UTF8StreamToUnicode;
module.exports.UTF8Length = UTF8Length;
module.exports.UnicodeToUTF8Stream = UnicodeToUTF8Stream;

},{}],17:[function(require,module,exports){
/* 
  bzip2.js - a small bzip2 decompression implementation
  
  Copyright 2011 by antimatter15 (antimatter15@gmail.com)
  
  Based on micro-bunzip by Rob Landley (rob@landley.net).

  Copyright (c) 2011 by antimatter15 (antimatter15@gmail.com).

  Permission is hereby granted, free of charge, to any person obtaining a
  copy of this software and associated documentation files (the "Software"),
  to deal in the Software without restriction, including without limitation
  the rights to use, copy, modify, merge, publish, distribute, sublicense,
  and/or sell copies of the Software, and to permit persons to whom the
  Software is furnished to do so, subject to the following conditions:
  
  The above copyright notice and this permission notice shall be included
  in all copies or substantial portions of the Software.
  
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH
  THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var message = require('./messagehandler');

var bzip2 = {};

bzip2.crcTable = 
[
   0x00000000, 0x04c11db7, 0x09823b6e, 0x0d4326d9,
   0x130476dc, 0x17c56b6b, 0x1a864db2, 0x1e475005,
   0x2608edb8, 0x22c9f00f, 0x2f8ad6d6, 0x2b4bcb61,
   0x350c9b64, 0x31cd86d3, 0x3c8ea00a, 0x384fbdbd,
   0x4c11db70, 0x48d0c6c7, 0x4593e01e, 0x4152fda9,
   0x5f15adac, 0x5bd4b01b, 0x569796c2, 0x52568b75,
   0x6a1936c8, 0x6ed82b7f, 0x639b0da6, 0x675a1011,
   0x791d4014, 0x7ddc5da3, 0x709f7b7a, 0x745e66cd,
   0x9823b6e0, 0x9ce2ab57, 0x91a18d8e, 0x95609039,
   0x8b27c03c, 0x8fe6dd8b, 0x82a5fb52, 0x8664e6e5,
   0xbe2b5b58, 0xbaea46ef, 0xb7a96036, 0xb3687d81,
   0xad2f2d84, 0xa9ee3033, 0xa4ad16ea, 0xa06c0b5d,
   0xd4326d90, 0xd0f37027, 0xddb056fe, 0xd9714b49,
   0xc7361b4c, 0xc3f706fb, 0xceb42022, 0xca753d95,
   0xf23a8028, 0xf6fb9d9f, 0xfbb8bb46, 0xff79a6f1,
   0xe13ef6f4, 0xe5ffeb43, 0xe8bccd9a, 0xec7dd02d,
   0x34867077, 0x30476dc0, 0x3d044b19, 0x39c556ae,
   0x278206ab, 0x23431b1c, 0x2e003dc5, 0x2ac12072,
   0x128e9dcf, 0x164f8078, 0x1b0ca6a1, 0x1fcdbb16,
   0x018aeb13, 0x054bf6a4, 0x0808d07d, 0x0cc9cdca,
   0x7897ab07, 0x7c56b6b0, 0x71159069, 0x75d48dde,
   0x6b93dddb, 0x6f52c06c, 0x6211e6b5, 0x66d0fb02,
   0x5e9f46bf, 0x5a5e5b08, 0x571d7dd1, 0x53dc6066,
   0x4d9b3063, 0x495a2dd4, 0x44190b0d, 0x40d816ba,
   0xaca5c697, 0xa864db20, 0xa527fdf9, 0xa1e6e04e,
   0xbfa1b04b, 0xbb60adfc, 0xb6238b25, 0xb2e29692,
   0x8aad2b2f, 0x8e6c3698, 0x832f1041, 0x87ee0df6,
   0x99a95df3, 0x9d684044, 0x902b669d, 0x94ea7b2a,
   0xe0b41de7, 0xe4750050, 0xe9362689, 0xedf73b3e,
   0xf3b06b3b, 0xf771768c, 0xfa325055, 0xfef34de2,
   0xc6bcf05f, 0xc27dede8, 0xcf3ecb31, 0xcbffd686,
   0xd5b88683, 0xd1799b34, 0xdc3abded, 0xd8fba05a,
   0x690ce0ee, 0x6dcdfd59, 0x608edb80, 0x644fc637,
   0x7a089632, 0x7ec98b85, 0x738aad5c, 0x774bb0eb,
   0x4f040d56, 0x4bc510e1, 0x46863638, 0x42472b8f,
   0x5c007b8a, 0x58c1663d, 0x558240e4, 0x51435d53,
   0x251d3b9e, 0x21dc2629, 0x2c9f00f0, 0x285e1d47,
   0x36194d42, 0x32d850f5, 0x3f9b762c, 0x3b5a6b9b,
   0x0315d626, 0x07d4cb91, 0x0a97ed48, 0x0e56f0ff,
   0x1011a0fa, 0x14d0bd4d, 0x19939b94, 0x1d528623,
   0xf12f560e, 0xf5ee4bb9, 0xf8ad6d60, 0xfc6c70d7,
   0xe22b20d2, 0xe6ea3d65, 0xeba91bbc, 0xef68060b,
   0xd727bbb6, 0xd3e6a601, 0xdea580d8, 0xda649d6f,
   0xc423cd6a, 0xc0e2d0dd, 0xcda1f604, 0xc960ebb3,
   0xbd3e8d7e, 0xb9ff90c9, 0xb4bcb610, 0xb07daba7,
   0xae3afba2, 0xaafbe615, 0xa7b8c0cc, 0xa379dd7b,
   0x9b3660c6, 0x9ff77d71, 0x92b45ba8, 0x9675461f,
   0x8832161a, 0x8cf30bad, 0x81b02d74, 0x857130c3,
   0x5d8a9099, 0x594b8d2e, 0x5408abf7, 0x50c9b640,
   0x4e8ee645, 0x4a4ffbf2, 0x470cdd2b, 0x43cdc09c,
   0x7b827d21, 0x7f436096, 0x7200464f, 0x76c15bf8,
   0x68860bfd, 0x6c47164a, 0x61043093, 0x65c52d24,
   0x119b4be9, 0x155a565e, 0x18197087, 0x1cd86d30,
   0x029f3d35, 0x065e2082, 0x0b1d065b, 0x0fdc1bec,
   0x3793a651, 0x3352bbe6, 0x3e119d3f, 0x3ad08088,
   0x2497d08d, 0x2056cd3a, 0x2d15ebe3, 0x29d4f654,
   0xc5a92679, 0xc1683bce, 0xcc2b1d17, 0xc8ea00a0,
   0xd6ad50a5, 0xd26c4d12, 0xdf2f6bcb, 0xdbee767c,
   0xe3a1cbc1, 0xe760d676, 0xea23f0af, 0xeee2ed18,
   0xf0a5bd1d, 0xf464a0aa, 0xf9278673, 0xfde69bc4,
   0x89b8fd09, 0x8d79e0be, 0x803ac667, 0x84fbdbd0,
   0x9abc8bd5, 0x9e7d9662, 0x933eb0bb, 0x97ffad0c,
   0xafb010b1, 0xab710d06, 0xa6322bdf, 0xa2f33668,
   0xbcb4666d, 0xb8757bda, 0xb5365d03, 0xb1f740b4
];

bzip2.array = function(bytes) {
    var bit = 0, byte = 0;
    var BITMASK = [0, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF ];
    return function(n) {
        var result = 0;
        while(n > 0) {
            var left = 8 - bit;
            if (n >= left) {
                result <<= left;
                result |= (BITMASK[left] & bytes[byte++]);
                bit = 0;
                n -= left;
            } else {
                result <<= n;
                result |= ((bytes[byte] & (BITMASK[n] << (8 - n - bit))) >> (8 - n - bit));
                bit += n;
                n = 0;
            }
        }
        return result;
    }
}

bzip2.IsBZIP2 = function(buffer) {
    if ((buffer[0] == 0x42) && (buffer[1] == 0x5A) && (buffer[2] == 0x68)) return true;
    return false;
}

    
bzip2.simple = function(srcbuffer, stream) {
    var bits = bzip2.array(srcbuffer);
    var size = bzip2.header(bits);
    var ret = false;
    var bufsize = 100000 * size;
    var buf = new Int32Array(bufsize);
    
    this.byteCount = new Int32Array(256);
    this.symToByte = new Uint8Array(256);
    this.mtfSymbol = new Int32Array(256);
    this.selectors = new Uint8Array(0x8000);
    
    do {
        ret = bzip2.decompress(bits, stream, buf, bufsize);        
    } while(!ret);
}

bzip2.header = function(bits) {
    if (bits(8*3) != 4348520) message.Error("No magic number found");
    var i = bits(8) - 48;
    if (i < 1 || i > 9) message.Error("Not a BZIP archive");
    return i;
};


//takes a function for reading the block data (starting with 0x314159265359)
//a block size (0-9) (optional, defaults to 9)
//a length at which to stop decompressing and return the output
bzip2.decompress = function(bits, stream, buf, bufsize) {
    var MAX_HUFCODE_BITS = 20;
    var MAX_SYMBOLS = 258;
    var SYMBOL_RUNA = 0;
    var SYMBOL_RUNB = 1;
    var GROUP_SIZE = 50;
    var crc = 0 ^ (-1);
    
    for(var h = '', i = 0; i < 6; i++) h += bits(8).toString(16);
    if (h == "177245385090") return true; //last block
    if (h != "314159265359") message.Error("eek not valid bzip data");
    var crcblock = bits(32)|0; // CRC code
    if (bits(1)) message.Error("unsupported obsolete version");
    var origPtr = bits(24);
    if (origPtr > bufsize) message.Error("Initial position larger than buffer size");
    var t = bits(16);
    var symTotal = 0;
    for (i = 0; i < 16; i++) {
        if (t & (1 << (15 - i))) {
            var k = bits(16);
            for(j = 0; j < 16; j++) {
                if (k & (1 << (15 - j))) {
                    this.symToByte[symTotal++] = (16 * i) + j;
                }
            }
        }
    }

    var groupCount = bits(3);
    if (groupCount < 2 || groupCount > 6) message.Error("another error");
    var nSelectors = bits(15);
    if (nSelectors == 0) message.Error("meh");
    for(var i = 0; i < groupCount; i++) this.mtfSymbol[i] = i;

    for(var i = 0; i < nSelectors; i++) {
        for(var j = 0; bits(1); j++) if (j >= groupCount) message.Error("whoops another error");
        var uc = this.mtfSymbol[j];
        for(var k = j-1; k>=0; k--) {
            this.mtfSymbol[k+1] = this.mtfSymbol[k];
        }
        this.mtfSymbol[0] = uc;
        this.selectors[i] = uc;
    }

    var symCount = symTotal + 2;
    var groups = [];
    var length = new Uint8Array(MAX_SYMBOLS),
    temp = new Uint8Array(MAX_HUFCODE_BITS+1);

    var hufGroup;

    for(var j = 0; j < groupCount; j++) {
        t = bits(5); //lengths
        for(var i = 0; i < symCount; i++) {
            while(true){
                if (t < 1 || t > MAX_HUFCODE_BITS) message.Error("I gave up a while ago on writing error messages");
                if (!bits(1)) break;
                if (!bits(1)) t++;
                else t--;
            }
            length[i] = t;
        }
        var  minLen,  maxLen;
        minLen = maxLen = length[0];
        for(var i = 1; i < symCount; i++) {
            if (length[i] > maxLen) maxLen = length[i];
            else if (length[i] < minLen) minLen = length[i];
        }
        hufGroup = groups[j] = {};
        hufGroup.permute = new Int32Array(MAX_SYMBOLS);
        hufGroup.limit = new Int32Array(MAX_HUFCODE_BITS + 1);
        hufGroup.base = new Int32Array(MAX_HUFCODE_BITS + 1);

        hufGroup.minLen = minLen;
        hufGroup.maxLen = maxLen;
        var base = hufGroup.base.subarray(1);
        var limit = hufGroup.limit.subarray(1);
        var pp = 0;
        for(var i = minLen; i <= maxLen; i++)
        for(var t = 0; t < symCount; t++)
        if (length[t] == i) hufGroup.permute[pp++] = t;
        for(i = minLen; i <= maxLen; i++) temp[i] = limit[i] = 0;
        for(i = 0; i < symCount; i++) temp[length[i]]++;
        pp = t = 0;
        for(i = minLen; i < maxLen; i++) {
            pp += temp[i];
            limit[i] = pp - 1;
            pp <<= 1;
            base[i+1] = pp - (t += temp[i]);
        }
        limit[maxLen] = pp + temp[maxLen] - 1;
        base[minLen] = 0;
    }

    for(var i = 0; i < 256; i++) { 
        this.mtfSymbol[i] = i;
        this.byteCount[i] = 0;
    }
    var runPos, count, symCount, selector;
    runPos = count = symCount = selector = 0;    
    while(true) {
        if (!(symCount--)) {
            symCount = GROUP_SIZE - 1;
            if (selector >= nSelectors) message.Error("meow i'm a kitty, that's an error");
            hufGroup = groups[this.selectors[selector++]];
            base = hufGroup.base.subarray(1);
            limit = hufGroup.limit.subarray(1);
        }
        i = hufGroup.minLen;
        j = bits(i);
        while(true) {
            if (i > hufGroup.maxLen) message.Error("rawr i'm a dinosaur");
            if (j <= limit[i]) break;
            i++;
            j = (j << 1) | bits(1);
        }
        j -= base[i];
        if (j < 0 || j >= MAX_SYMBOLS) message.Error("moo i'm a cow");
        var nextSym = hufGroup.permute[j];
        if (nextSym == SYMBOL_RUNA || nextSym == SYMBOL_RUNB) {
            if (!runPos){
                runPos = 1;
                t = 0;
            }
            if (nextSym == SYMBOL_RUNA) t += runPos;
            else t += 2 * runPos;
            runPos <<= 1;
            continue;
        }
        if (runPos) {
            runPos = 0;
            if (count + t >= bufsize) message.Error("Boom.");
            uc = this.symToByte[this.mtfSymbol[0]];
            this.byteCount[uc] += t;
            while(t--) buf[count++] = uc;
        }
        if (nextSym > symTotal) break;
        if (count >= bufsize) message.Error("I can't think of anything. Error");
        i = nextSym - 1;
        uc = this.mtfSymbol[i];
        for(var k = i-1; k>=0; k--) {
            this.mtfSymbol[k+1] = this.mtfSymbol[k];
        }
        this.mtfSymbol[0] = uc
        uc = this.symToByte[uc];
        this.byteCount[uc]++;
        buf[count++] = uc;
    }
    if (origPtr < 0 || origPtr >= count) message.Error("I'm a monkey and I'm throwing something at someone, namely you");
    var j = 0;
    for(var i = 0; i < 256; i++) {
        k = j + this.byteCount[i];
        this.byteCount[i] = j;
        j = k;
    }
    for(var i = 0; i < count; i++) {
        uc = buf[i] & 0xff;
        buf[this.byteCount[uc]] |= (i << 8);
        this.byteCount[uc]++;
    }
    var pos = 0, current = 0, run = 0;
    if (count) {
        pos = buf[origPtr];
        current = (pos & 0xff);
        pos >>= 8;
        run = -1;
    }
    count = count;
    var copies, previous, outbyte;
    while(count) {
        count--;
        previous = current;
        pos = buf[pos];
        current = pos & 0xff;
        pos >>= 8;
        if (run++ == 3) {
            copies = current;
            outbyte = previous;
            current = -1;
        } else {
            copies = 1;
            outbyte = current;
        }
        while(copies--) {
            crc = ((crc << 8) ^ this.crcTable[((crc>>24) ^ outbyte) & 0xFF])&0xFFFFFFFF; // crc32
            stream(outbyte);
        }
        if (current != previous) run = 0;
    }

    crc = (crc ^ (-1)) >>> 0;
    if ((crc|0) != (crcblock|0)) message.Error("Error in bzip2: crc32 do not match");
    return false;
}

module.exports = bzip2;

},{"./messagehandler":43}],18:[function(require,module,exports){
// -------------------------------------------------
// --------------------- ATA -----------------------
// -------------------------------------------------

"use strict";

var utils = require('../utils');
var message = require('../messagehandler');

// ata-generic implementation (according to Linux)
// simulation of a hard disk loaded on demand from the webserver in small chunks.
// specification
// ftp://ftp.seagate.com/pub/acrobat/reference/111-1c.pdf

/* use this dts lines
 ata@9e000000  {
                compatible = "ata-generic";
                reg = <0x9e000000 0x100
                       0x9e000100 0xf00>;
                pio-mode = <4>;
                reg-shift = <2>;
                interrupts = <15>;
        };
*/

// ATA command block registers
// 2 is the reg_shift
var ATA_REG_DATA            = 0x00<<2; // data register
var ATA_REG_ERR             = 0x01<<2; // error register, feature register
var ATA_REG_NSECT           = 0x02<<2; // sector count register
var ATA_REG_LBAL            = 0x03<<2; // sector number register
var ATA_REG_LBAM            = 0x04<<2; // cylinder low register
var ATA_REG_LBAH            = 0x05<<2; // cylinder high register
var ATA_REG_DEVICE          = 0x06<<2; // drive/head register
var ATA_REG_STATUS          = 0x07<<2; // status register // command register

var ATA_REG_FEATURE         = ATA_REG_ERR; // and their aliases (writing)
var ATA_REG_CMD             = ATA_REG_STATUS;
var ATA_REG_BYTEL           = ATA_REG_LBAM;
var ATA_REG_BYTEH           = ATA_REG_LBAH;
var ATA_REG_DEVSEL          = ATA_REG_DEVICE;
var ATA_REG_IRQ             = ATA_REG_NSECT;

// device control register
var ATA_DCR_RST = 0x04;	// Software reset   (RST=1, reset)
var ATA_DCR_IEN = 0x02;	// Interrupt Enable (IEN=0, enabled)

// ----- ATA (Alternate) Status Register
var ATA_SR_BSY  = 0x80;  // Busy
var ATA_SR_DRDY = 0x40;  // Device Ready
var ATA_SR_DF   = 0x20;  // Device Fault
var ATA_SR_DSC  = 0x10;  // Device Seek Complete
var ATA_SR_DRQ  = 0x08;  // Data Request
var ATA_SR_COR  = 0x04;  // Corrected data (obsolete)
var ATA_SR_IDX  = 0x02;  //                (obsolete)
var ATA_SR_ERR  = 0x01;  // Error

// constructor
function ATADev(intdev) {
    this.intdev = intdev;
    var buffer = new ArrayBuffer(512);
    this.identifybuffer = new Uint16Array(buffer);

    this.Reset();

    var buffer = new ArrayBuffer(64*1024); // 64 kB
    this.SetBuffer(buffer);    
    
}
ATADev.prototype.Reset = function() {
    this.DCR = 0x8; // fourth bis is always set
    this.DR = 0xA0; // some bits are always set to one
    this.SCR = 0x1;
    this.SNR = 0x1;
    this.SR = ATA_SR_DRDY; // status register
    this.FR = 0x0; // Feature register
    this.ER = 0x1; // Error register
    this.CR = 0x0; // Command register

//this.error = 0x1;
    this.lcyl = 0x0;
    this.hcyl = 0x0;
    this.select = 0xA0;
    this.driveselected = true; // drive no 0

    this.readbuffer = this.identifybuffer;
    this.readbufferindex = 0;
    this.readbuffermax = 256;
}

ATADev.prototype.SetBuffer = function(buffer) {
    this.diskbuffer = new Uint16Array(buffer);
    this.heads = 16;
    this.sectors = 64;
    this.cylinders = buffer.byteLength/(this.heads*this.sectors*512);
    this.nsectors = this.heads*this.sectors*this.cylinders;
    this.BuildIdentifyBuffer(this.identifybuffer);   
}

ATADev.prototype.BuildIdentifyBuffer = function(buffer16)
{
    for(var i=0; i<256; i++) {
        buffer16[i] = 0x0000;
    }

    buffer16[0] = 0x0040;
    buffer16[1] = this.cylinders; // cylinders
    buffer16[3] = this.heads; // heads
    buffer16[4] = 512*this.sectors; // Number of unformatted bytes per track (sectors*512)
    buffer16[5] = 512; // Number of unformatted bytes per sector
    buffer16[6] = this.sectors; // sectors per track

    buffer16[20] = 0x0003; // buffer type
    buffer16[21] = 512; // buffer size in 512 bytes increment
    buffer16[22] = 4; // number of ECC bytes available

    buffer16[27] = 0x6A6F; // jo (model string)
    buffer16[28] = 0x7231; // r1
    buffer16[29] = 0x6B2D; // k-
    buffer16[30] = 0x6469; // di
    buffer16[31] = 0x736B; // sk
    for(var i=32; i<=46; i++) {
        buffer16[i] = 0x2020; // (model string)
    }
    
    buffer16[47] = 0x8000 | 128;
    buffer16[48] = 0x0000;
    buffer16[49] = 1<<9;
    buffer16[51] = 0x200; // PIO data transfer cycle timing mode
    buffer16[52] = 0x200; // DMA data transfer cycle timing mode

    buffer16[54] = this.cylinders;
    buffer16[55] = this.heads;
    buffer16[56] = this.sectors; // sectors per track

    buffer16[57] = (this.nsectors >> 0)&0xFFFF; // number of sectors
    buffer16[58] = (this.nsectors >>16)&0xFFFF;

    buffer16[59] = 0x0000; // multiple sector settings
    //buffer16[59]  = 0x100 | 128;

    buffer16[60] = (this.nsectors >> 0)&0xFFFF; // Total number of user-addressable sectors low
    buffer16[61] = (this.nsectors >>16)&0xFFFF; // Total number of user-addressable sectors high

    buffer16[80] = (1<<1)|(1<<2); // version, support ATA-1 and ATA-2
    buffer16[82] = (1<<14); // Command sets supported. (NOP supported)
    buffer16[83] = (1<<14); // this bit should be set to one
    buffer16[84] = (1<<14); // this bit should be set to one
    buffer16[85] = (1<<14); // Command set/feature enabled (NOP)
    buffer16[86] = 0; // Command set/feature enabled
    buffer16[87] = (1<<14); // Shall be set to one

}

ATADev.prototype.ReadReg8 = function(addr) {
    if (!this.driveselected) {
        return 0xFF;
    }
    switch(addr)
    {
        case ATA_REG_ERR:
            //message.Debug("ATADev: read error register");
            return this.ER;

        case ATA_REG_NSECT:
            //message.Debug("ATADev: read sector count register");
            return this.SNR;

        case ATA_REG_LBAL:
            //message.Debug("ATADev: read sector number register");
            return this.SCR;

        case ATA_REG_LBAM:
            //message.Debug("ATADev: read cylinder low register");
            return this.lcyl;
        
        case ATA_REG_LBAH:
            //message.Debug("ATADev: read cylinder high register");
            return this.hcyl;

        case ATA_REG_DEVICE:
            //message.Debug("ATADev: read drive/head register");
            return this.DR;

        case ATA_REG_STATUS:
            //message.Debug("ATADev: read status register");			
            this.intdev.ClearInterrupt(15);
            return this.SR;

        case 0x100: // device control register, but read as status register
            //message.Debug("ATADev: read alternate status register")
            return this.SR;
            break;

        default:
            message.Debug("ATADev: Error in ReadRegister8: register " + utils.ToHex(addr) + " not supported");
            message.Abort();
            break;
    }    
    return 0x0;
};

ATADev.prototype.GetSector = function()
{
    if (!(this.DR & 0x40)) {
        message.Debug("ATADev: CHS mode not supported");
        message.Abort();
    }
    return ((this.DR&0x0F) << 24) | (this.hcyl << 16) | (this.lcyl << 8) | this.SCR;
}

ATADev.prototype.SetSector = function(sector)
{
    if (!(this.DR & 0x40)) {
        message.Debug("ATADev: CHS mode not supported");
        message.Abort();
    }
    this.SCR = sector & 0xFF;
    this.lcyl = (sector >> 8) & 0xFF;
    this.hcyl = (sector >> 16) & 0xFF;
    this.DR = (this.DR & 0xF0) | ((sector >> 24) & 0x0F);
}

ATADev.prototype.ExecuteCommand = function()
{
    switch(this.CR)
    {
        case 0xEC: // identify device
            this.readbuffer = this.identifybuffer;
            this.readbufferindex = 0;
            this.readbuffermax = 256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            if (!(this.DCR & ATA_DCR_IEN)) {
                this.intdev.RaiseInterrupt(15);
            }
            break;

        case 0x91: // initialize drive parameters
            this.SR = ATA_SR_DRDY | ATA_SR_DSC;
            this.ER = 0x0;
            if (!(this.DCR & ATA_DCR_IEN)) {
                this.intdev.RaiseInterrupt(15);
            }
            break;

        case 0x20: // load sector
        case 0x30: // save sector

            var sector = this.GetSector();
            if (this.SNR == 0) {
                this.SNR = 256;
            }
            //message.Debug("ATADev: Load sector " + utils.ToHex(sector) + ". number of sectors " + utils.ToHex(this.SNR));
            this.readbuffer = this.diskbuffer;
            this.readbufferindex = sector*256;
            this.readbuffermax = this.readbufferindex+256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            this.ER = 0x0;
            if (this.CR == 0x20) {
                if (!(this.DCR & ATA_DCR_IEN)) {
                    this.intdev.RaiseInterrupt(15);
                }
            }
            break;

        case 0xC4: // read multiple sectors
        case 0xC5: // write multiple sectors
            var sector = this.GetSector();
            if (this.SNR == 0) {
                this.SNR = 256;
            }
            //message.Debug("ATADev: Load multiple sector " + utils.ToHex(sector) + ". number of sectors " + utils.ToHex(this.SNR));
            this.readbuffer = this.diskbuffer;
            this.readbufferindex = sector*256;
            this.readbuffermax = this.readbufferindex + 256*this.SNR;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            this.ER = 0x0;
            if (this.CR == 0xC4) {
                if (!(this.DCR & ATA_DCR_IEN)) {
                    this.intdev.RaiseInterrupt(15);
                }
            }

            break;

        default:
            message.Debug("ATADev: Command " + utils.ToHex(this.CR) + " not supported");
            message.Abort();
            break;
    }
}


ATADev.prototype.WriteReg8 = function(addr, x) {
    
    if (addr == ATA_REG_DEVICE) {
        //message.Debug("ATADev: Write drive/head register value: " + utils.ToHex(x));
        this.DR = x;
        //message.Debug("Head " + (x&0xF));
        //message.Debug("Drive No. " + ((x>>4)&1));
        //message.Debug("LBA Mode " + ((x>>6)&1));
        this.driveselected = ((x>>4)&1)?false:true;
        return;
    }

    if (addr == 0x100) { //device control register
        //message.Debug("ATADev: Write CTL register" + " value: " + utils.ToHex(x));

        if (!(x&ATA_DCR_RST) && (this.DCR&ATA_DCR_RST)) { // reset done
            //message.Debug("ATADev: drive reset done");
            this.DR &= 0xF0; // reset head
            this.SR = ATA_SR_DRDY | ATA_SR_DSC;
            this.SCR = 0x1;
            this.SNR = 0x1;
            this.lcyl = 0x0;
            this.hcyl = 0x0;
            this.ER = 0x1;
            this.CR = 0x0;
        } else
        if ((x&ATA_DCR_RST) && !(this.DCR&ATA_DCR_RST)) { // reset
            //message.Debug("ATADev: drive reset");
            this.ER = 0x1; // set diagnostics message
            this.SR = ATA_SR_BSY | ATA_SR_DSC;
        }

        this.DCR = x;
        return;
    }

    if (!this.driveselected) {
        return;
    }

    switch(addr)
    {
        case ATA_REG_FEATURE:
            //message.Debug("ATADev: Write feature register value: " + utils.ToHex(x));
            this.FR = x;
            break;

        case ATA_REG_NSECT:
            //message.Debug("ATADev: Write sector count register value: " + utils.ToHex(x));
            this.SNR = x;
            break;

        case ATA_REG_LBAL:
            //message.Debug("ATADev: Write sector number register value: " + utils.ToHex(x));
            this.SCR = x;
            break;

        case ATA_REG_LBAM:
            //message.Debug("ATADev: Write cylinder low register value: " + utils.ToHex(x));
            this.lcyl = x;
            break;

        case ATA_REG_LBAH:
            //message.Debug("ATADev: Write cylinder high number register value: " + utils.ToHex(x));
            this.hcyl = x;
            break;

        case ATA_REG_CMD:
            //message.Debug("ATADev: Write Command register " + utils.ToHex(x));
            this.CR = x;
            this.ExecuteCommand();
            break;

        default:
            message.Debug("ATADev: Error in WriteRegister8: register " + utils.ToHex(addr) + " not supported (value: " + utils.ToHex(x) + ")");
            message.Abort();    
            break;
    }
};

ATADev.prototype.ReadReg16 = function(addr) {
    if (addr != 0) { // data register
        message.Debug("ATADev: Error in ReadRegister16: register " + utils.ToHex(addr) + " not supported");
        message.Abort();
    }

    var val = utils.Swap16(this.readbuffer[this.readbufferindex]);
    //message.Debug("ATADev: read data register");
    this.readbufferindex++;
    if (this.readbufferindex >= this.readbuffermax) {
        this.SR = ATA_SR_DRDY | ATA_SR_DSC; // maybe no DSC for identify command but it works
        
        if ((this.CR == 0x20) && (this.SNR > 1)) {
            this.SNR--;
            this.SetSector(this.GetSector() + 1);
            this.readbuffermax += 256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            if (!(this.DCR & ATA_DCR_IEN)) {
                this.intdev.RaiseInterrupt(15);
            }
        }

    }
    return val;
};

ATADev.prototype.WriteReg16 = function(addr, x) {
    if (addr != 0) { // data register
        message.Debug("ATADev: Error in WriteRegister16: register " + utils.ToHex(addr) + " not supported");
        message.Abort();
    }
    this.readbuffer[this.readbufferindex] = utils.Swap16(x);
    //message.Debug("ATADev: write data register");
    this.readbufferindex++;
    if (this.readbufferindex >= this.readbuffermax) {
        this.SR = ATA_SR_DRDY | ATA_SR_DSC;
        if (!(this.DCR & ATA_DCR_IEN)) {
            this.intdev.RaiseInterrupt(15);
        }
        if ((this.CR == 0x30) && (this.SNR > 1)) {
            this.SNR--;
            this.SetSector(this.GetSector() + 1);
            this.readbuffermax += 256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
        }
    }
};

ATADev.prototype.ReadReg32 = function(addr) {
    message.Debug("ATADev: Error in ReadRegister32: register " + utils.ToHex(addr) + " not supported");
    this.mesage.Abort();
};

ATADev.prototype.WriteReg32 = function(addr, x) {
    message.Debug("ATADev: Error in WriteRegister32: register " + utils.ToHex(addr) + " not supported");
    message.Abort()
};


module.exports = ATADev;

},{"../messagehandler":43,"../utils":58}],19:[function(require,module,exports){
// -------------------------------------------------
// ----------------- Ethernet ----------------------
// -------------------------------------------------
// Emulation of the OpenCores ethmac ethernet controller.

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

//REGISTER ADDRESSES
var ETHMAC_ADDR_MODER = 0x0;
var ETHMAC_ADDR_INT_SOURCE = 0x4;
var ETHMAC_ADDR_INT_MASK = 0x8;
var ETHMAC_ADDR_IPGT = 0xC;
var ETHMAC_ADDR_IPGR1 = 0x10;
var ETHMAC_ADDR_IPGR2 = 0x14;
var ETHMAC_ADDR_PACKETLEN = 0x18;
var ETHMAC_ADDR_COLLCONF = 0x1C;
var ETHMAC_ADDR_TX_BD_NUM = 0x20;
var ETHMAC_ADDR_CTRLMODER = 0x24;
var ETHMAC_ADDR_MIIMODER = 0x28;
var ETHMAC_ADDR_MIICOMMAND = 0x2C;
var ETHMAC_ADDR_MIIADDRESS = 0x30;
var ETHMAC_ADDR_MIITX_DATA = 0x34;
var ETHMAC_ADDR_MIIRX_DATA = 0x38;
var ETHMAC_ADDR_MIISTATUS = 0x3C;
var ETHMAC_ADDR_MAC_ADDR0 = 0x40;
var ETHMAC_ADDR_MAC_ADDR1 = 0x44;
var ETHMAC_ADDR_ETH_HASH0_ADR = 0x48;
var ETHMAC_ADDR_ETH_HASH1_ADR = 0x4C;
var ETHMAC_ADDR_ETH_TXCTRL = 0x50;

var ETHMAC_ADDR_BD_START = 0x400;
var ETHMAC_ADDR_BD_END = 0x7FF;


var MII_BMCR =           0x00;        /* Basic mode control register */
var MII_BMSR =           0x01;        /* Basic mode status register  */
var MII_PHYSID1 =        0x02;        /* PHYS ID 1                   */
var MII_PHYSID2 =        0x03;        /* PHYS ID 2                   */
var MII_ADVERTISE =      0x04;        /* Advertisement control reg   */
var MII_LPA =            0x05;        /* Link partner ability reg    */
var MII_EXPANSION =      0x06;        /* Expansion register          */
var MII_CTRL1000 =       0x09;        /* 1000BASE-T control          */
var MII_STAT1000 =       0x0a;        /* 1000BASE-T status           */
var MII_ESTATUS =        0x0f;        /* Extended Status */
var MII_DCOUNTER =       0x12;        /* Disconnect counter          */
var MII_FCSCOUNTER =     0x13;        /* False carrier counter       */
var MII_NWAYTEST =       0x14;        /* N-way auto-neg test reg     */
var MII_RERRCOUNTER =    0x15;        /* Receive error counter       */
var MII_SREVISION =      0x16;        /* Silicon revision            */
var MII_RESV1 =          0x17;        /* Reserved...                 */
var MII_LBRERROR =       0x18;        /* Lpback, rx, bypass error    */
var MII_PHYADDR =        0x19;        /* PHY address                 */
var MII_RESV2 =          0x1a;        /* Reserved...                 */
var MII_TPISTATUS =      0x1b;        /* TPI status for 10mbps       */
var MII_NCONFIG =        0x1c;        /* Network interface config    */



//TODO: MODER.LOOPBCK - loopback support
//TODO: Carrier Sense?
//TODO: Huge frames
//TODO: IAM mode
//TODO: MODER.BRO
function EthDev(ram, intdev, mac) {
    "use strict";
    this.ram = ram;
    this.intdev = intdev;
    this.TransmitCallback = function(data){}; // Should call handler to send data asynchronously.


    this.toTxStat = function(val) {
        return {
            LEN:   val >>> 16,
            RD:   (val >>> 15) & 1,
            IRQ:  (val >>> 14) & 1,
            WR:   (val >>> 13) & 1,
            PAD:  (val >>> 12) & 1,
            CRC:  (val >>> 11) & 1,
            UR:   (val >>> 8)  & 1,
            RTRY: (val >>> 4)  & 0xF,
            RL:   (val >>> 3)  & 1,
            LC:   (val >>> 2)  & 1,
            DF:   (val >>> 1)  & 1,
            CS:    val         & 1
        }
    }

    this.fromTxStat = function(stat) {
        var val = (stat.LEN << 16);
        val |=    ((stat.RD   & 1)   << 15);
        val |=    ((stat.IRQ  & 1)   << 14);
        val |=    ((stat.WR   & 1)   << 13);
        val |=    ((stat.PAD  & 1)   << 12);
        val |=    ((stat.CRC  & 1)   << 11);
        val |=    ((stat.UR   & 1)   << 8);
        val |=    ((stat.RTRY & 0xF) << 4);
        val |=    ((stat.RL   & 1)   << 3);
        val |=    ((stat.LC   & 1)   << 2);
        val |=    ((stat.CDF  & 1)   << 1);
        val |=     (stat.CS   & 1);
        return val;
    }

    this.toRxStat = function(val) {
        return {
            LEN:  val >>> 16,
            E:   (val >>> 15) & 1,
            IRQ: (val >>> 14) & 1,
            WR:  (val >>> 13) & 1,
            CF:  (val >>> 8)  & 1,
            M:   (val >>> 7)  & 1,
            OR:  (val >>> 6)  & 1,
            IS:  (val >>> 5)  & 1,
            DN:  (val >>> 4)  & 1,
            TL:  (val >>> 3)  & 1,
            SF:  (val >>> 2)  & 1,
            CRC: (val >>> 1)  & 1,
            LC:   val         & 1
        }
    }

    this.fromRxStat = function(stat) {
        var val = (stat.LEN << 16);
        val |=    ((stat.E   & 1) << 15);
        val |=    ((stat.IRQ & 1) << 14);
        val |=    ((stat.WR  & 1) << 13);
        val |=    ((stat.CF  & 1) << 8);
        val |=    ((stat.M   & 1) << 7);
        val |=    ((stat.OR  & 1) << 6);
        val |=    ((stat.IS  & 1) << 5);
        val |=    ((stat.DN  & 1) << 4);
        val |=    ((stat.TL  & 1) << 3);
        val |=    ((stat.SF  & 1) << 2);
        val |=    ((stat.CRC & 1) << 1);
        val |=     (stat.LC  & 1) ;
        return val;
    }

    this.makeCRCTable = function() {
        var c;
        var crcTable = [];
        for(var n =0; n < 256; n++) {
            c = n;
            for(var k =0; k < 8; k++) {
                c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crcTable[n] = c;
        }
        return crcTable;
    }

    this.crcTable = this.makeCRCTable();

    this.crc32 = function(data, offset, length) {
        var crc = 0 ^ (-1);

        var bytelen = 4;
        if (data instanceof Uint16Array || data instanceof Int16Array) {
            bytelen = 2;
        } else if (data instanceof Uint8Array || data instanceof Int8Array) {
            bytelen = 1;
        }

        if (!length) {
            length = data.length;
        }
        if (!offset) {
            offset = 0;
        }

        var val = 0x0;
        for (var i = offset; i < length; i++ ) {
            //first byte
            val = data[i] & 0xFF;
            crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];

            if (bytelen > 1) {
                //second byte
                val = (data[i] >>> 8) & 0xFF;
                crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];

                if (bytelen > 2) {
                    //third byte
                    val = (data[i] >>> 16) & 0xFF;
                    crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];

                    //fourth byte
                    val = (data[i] >>> 24) & 0xFF;
                    crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];
                }
            }
        }

        return (crc ^ (-1)) >>> 0;
    };

    this.Reset = function () {
        this.MODER = 0xA000;
        this.INT_SOURCE = 0x0;
        this.INT_MASK = 0x0;
        this.IPGT = 0x12;
        this.IPGR1 = 0xC;
        this.IPGR2 = 0x12;
        this.PACKETLEN = 0x400600;
        this.COLLCONF = 0xF003F;
        this.TX_BD_NUM = 0x40;
        this.CTRLMODER = 0x0;
        this.MIIMODER = 0x64;
        this.MIICOMMAND = 0x0;
        this.MIIADDRESS = 0x0;
        this.MIITX_DATA = 0x0;
        this.MIIRX_DATA = 0x22; //default is 0x0
        this.MIISTATUS = 0x0;
        
        this.MAC_ADDR0 |= (Math.floor(Math.random()*256) << 24);
        this.MAC_ADDR0 |= (Math.floor(Math.random()*256) << 16);
        this.MAC_ADDR0 |= (Math.floor(Math.random()*256) << 8);
        this.MAC_ADDR0 |= Math.floor(Math.random()*256);

        this.MAC_ADDR1 |= (((Math.floor(Math.random()*256) << 8) & 0xfe) | 0x02);
        this.MAC_ADDR1 |= Math.floor(Math.random()*256);

        this.ETH_HASH0_ADR = 0x0;
        this.ETH_HASH1_ADR = 0x0;
        this.ETH_TXCTRL = 0x0;

        this.BD = new Uint32Array(256);//128 64bit descriptors
        for(var i=0;i<256;i++) {
            this.BD[i] = 0x0;
        }
         
        this.MIIregs = new Uint16Array(16);
        this.MIIregs[MII_BMCR] = 0x0100; // Full duplex
        // link ok, negotiation complete, 10Mbit and 100Mbit available
        this.MIIregs[MII_BMSR] = 0x4 | 0x20 | 0x800 | 0x1000 | 0x2000 | 0x4000;

        this.MIIregs[MII_PHYSID1] = 0x2000;
        this.MIIregs[MII_PHYSID2] = 0x5c90;
        this.MIIregs[MII_ADVERTISE] = 0x01e1;
	this.MIIregs[MII_PHYADDR] = 0x0;

        // link ok
        // this.MIIregs[MII_LPA] |= 0x01e1;

        this.currRX = (this.TX_BD_NUM << 1);
    };

    this.Receive = function(data_arraybuffer) {
        //check RXEN
        if ((this.MODER & 0x1) == 0) {
            return;
        }
        var data = new Uint8Array(data_arraybuffer);

        //if this is a binary transmission, it's a frame
        var promiscuous = false;
        var match = false;
        var multicast = false;
        
        //MAC detection
        var mac0 = 0x0;
        var mac1 = 0x0;

        mac0 |= (data[2] << 24);
        mac0 |= (data[3] << 16);
        mac0 |= (data[4] << 8);
        mac0 |= data[5];

        mac1 |= (data[0] << 8);
        mac1 |= data[1];

        if (mac0 == this.MAC_ADDR0 && mac1 == this.MAC_ADDR1) {
            match = true;
        }else if (mac1 & (1 << 15)) {
            multicast = true;
        }

        if (this.MODER & (1<<5)) {
            promiscuous = true;
        }

        var i = this.currRX;

        //won't branch if no match/multicast and we're not promiscuous
        if (promiscuous || multicast || match) {
            var err = false;
            //if this BD is ready
            if (this.BD[i] & (1 << 15)) {
                var stat = this.toRxStat(this.BD[i]);

                if (!match && !multicast && promiscuous) {
                    stat.M = 1;
                }
                
                //NOTE: ethoc leaves control frame support disabled
                //leaving these as todo for now.
                //TODO: control frame detection, see pg 31 of SPEC:
                    //TODO: PAUSE frame
                    //TODO: Type/length control frame
                    //TODO: Latch Control Frame
                
                
                //TODO: Dribble Nibble - for now assume frame is proper size
                stat.DN = 0;

                //Too Long, bigger than max packetlen
                if (data.length > (this.PACKETLEN & 0xFFFF)) {
                    //check HUGEN
                    if (this.MODER & (1 << 14)) {
                        //TODO: in this case, how much of the frame do we write?
                        stat.TL = 1;
                    } else {
                        stat.TL = 0;
                        //according to 2.3.5.6 of design doc, we still write
                        //the start of the frame, and don't mark TL bit?
                        //TODO: need to check this behavior
                    }
                } else {
                    stat.TL = 0;
                }
                
                if (stat.DN == 0) {
                    //We don't get a CRC from TAP devices, so just assert this
                    stat.CRC = 0;
                }

                var crc = 0x0;

                crc |= (data[data.length-4] << 24);
                crc |= (data[data.length-3] << 16);
                crc |= (data[data.length-2] << 8);
                crc |= data[data.length-1];

                //write the packet to the memory location
                //TODO: do we want to write on an error, anyway?
                if (!err) {
                    stat.LEN = data.length;

                    var aligned = true;

                    if (stat.LEN > (this.PACKETLEN & 0xFFFF)) {
                        stat.LEN = this.PACKETLEN & 0xFFFF;
                    }

                    var ptr = this.BD[i+1];
                    for(var j=0;j<stat.LEN;j++) {
                        ram.Write8(ptr+j, data[j]);
                    }
                    
                    //add the CRC back into the length field
                    stat.LEN += 4;

                    //mark buffer ready to be read
                    stat.E = 0;
                }

                this.BD[i] = this.fromRxStat(stat);
                //IRQ
                if (stat.IRQ) {
                    if (err) {
                        //RXE interrupt
                        this.INT_SOURCE |= (1 << 3);
                    }
                    //RXB interrupt
                    this.INT_SOURCE |= (1 << 2);

                    if (this.INT_MASK & this.INT_SOURCE) {
                        this.intdev.RaiseInterrupt(0x4);
                    } else {
                        this.intdev.ClearInterrupt(0x4);
                    }

                }
            } else {
                //BUSY interrupt
                this.INT_SOURCE |= (1 << 4);
                if (this.INT_MASK & this.INT_SOURCE) {
                    this.intdev.RaiseInterrupt(0x4);
                } else {
                    this.intdev.ClearInterrupt(0x4);
                }
            }

            //check wrap bit and BD bounds
            if ((this.BD[this.currRX] & (1 << 13)) ||
                (this.currRX + 2) >= this.BD.length) {

                this.currRX = (this.TX_BD_NUM << 1);
            } else {
                this.currRX+=2;
            }
        }
    };

    this.Transmit = function(bd_num) {
        
        //check MODER.TXEN
        if ((this.MODER & (1 << 1)) == 0) {
            return;
        }

        var stat = this.toTxStat(this.BD[bd_num << 1]);
        var ptr = this.BD[(bd_num << 1) + 1];

        //Check RD bit
        if (stat.RD == 0) {
            return;
        }


        //check crc gen for frame size modification
        var frameSize = stat.LEN;
        var crc = false;
        if (stat.CRC || (this.MODER & (1 << 13))) {
            //frameSize += 4;
            //crc = true;
        }

        //check padding for frame size modification
        var pad = false;
        var padlen = 0;
        if (stat.PAD || (this.MODER & (1 << 15))) {
            pad = true;

            if ((this.PACKETLEN >>> 16) > stat.LEN) {
                frameSize = this.PACKETLEN >>> 16;
            }
        }

        //TODO: do we ever need preamble/frame start?
        var frame = new Uint8Array(frameSize);
        
        for(var i=0;i<frame.length;i++) {
            if (i<stat.LEN) {
                frame[i] = ram.Read8(ptr+i);
            } else {
                frame[i] = 0;
            }
        }

        //should only have one 32bit word left to write here
        if (crc) {
            var crcval = 0;
            //if DLYCRCEN
            if (this.MODER & (1 << 12)) {
                crcval = this.crc32(frame, 4, frame.length-4);
            } else {
                crcval = this.crc32(frame, 0, frame.length-4);
            }

            frame[frame.length-1] = (crcval >> 24);
            frame[frame.length-2] = (crcval >> 16) & 0xFF;
            frame[frame.length-3] = (crcval >> 8) & 0xFF;
            frame[frame.length-4] = crcval & 0xFF;
        }

        this.TransmitCallback(frame.buffer);

        //set error bits
        stat.UR = 0;
        stat.RTRY = 0;
        stat.RL = 0;
        stat.LC = 0;
        stat.DF = 0;
        stat.CS = 0;

        stat.RD = 0;

        this.BD[bd_num << 1] = this.fromTxStat(stat);

        this.INT_SOURCE |= 1;

        if (this.INT_MASK & this.INT_SOURCE) {
            this.intdev.RaiseInterrupt(0x4);
        } else {
            this.intdev.ClearInterrupt(0x4);
        }
    };

    this.ReadReg32 = function (addr) {
        var ret = 0x0;
        switch (addr) {
            case ETHMAC_ADDR_MODER:
                ret = this.MODER;
                break;

            case ETHMAC_ADDR_INT_SOURCE:
                ret = this.INT_SOURCE;
                break;

            case ETHMAC_ADDR_INT_MASK:
                ret = this.INT_MASK;
                break;

            case ETHMAC_ADDR_IPGT:
                ret = this.IPGT;
                break;

            case ETHMAC_ADDR_IPGR1:
                ret = this.IPGR1;
                break;

            case ETHMAC_ADDR_IPGR2:
                ret = this.IPGR2;
                break;

            case ETHMAC_ADDR_PACKETLEN:
                ret = this.PACKETLEN;
                break;

            case ETHMAC_ADDR_COLLCONF:
                ret = this.COLLCONF;
                break;

            case ETHMAC_ADDR_TX_BD_NUM:
                ret = this.TX_BD_NUM;
                break;

            case ETHMAC_ADDR_CTRLMODER:
                ret = this.CTRLMODER;
                break;

            case ETHMAC_ADDR_MIIMODER:
                ret = this.MIIMODER;
                break;

            case ETHMAC_ADDR_MIICOMMAND:
                ret = this.MIICOMMAND;
                break;

            case ETHMAC_ADDR_MIIADDRESS:
                ret = this.MIIADDRESS;
                break;

            case ETHMAC_ADDR_MIITX_DATA:
                ret = this.MIITX_DATA;
                break;

            case ETHMAC_ADDR_MIIRX_DATA:
                ret = this.MIIRX_DATA;
                break;

            case ETHMAC_ADDR_MIISTATUS:
                ret = this.MIISTATUS;
                break;

            case ETHMAC_ADDR_MAC_ADDR0:
                ret = this.MAC_ADDR0;
                break;

            case ETHMAC_ADDR_MAC_ADDR1:
                ret = this.MAC_ADDR1;
                break;

            case ETHMAC_ADDR_ETH_HASH0_ADR:
                ret = this.ETH_HASH0_ADR;
                break;

            case ETHMAC_ADDR_ETH_HASH1_ADR:
                ret = this.ETH_HASH1_ADR;
                break;

            case ETHMAC_ADDR_ETH_TXCTRL:
                ret = this.ETH_TXCTRL;
                break;
            default:
                if (addr >= ETHMAC_ADDR_BD_START &&
                    addr <= ETHMAC_ADDR_BD_END) {
                    ret = this.BD[(addr-ETHMAC_ADDR_BD_START)>>>2];
                } else {
                    message.Debug("Attempt to access ethmac register beyond 0x800");
                }
        }
        return ret;
    };

    this.HandleMIICommand = function()
    {
        var fiad = this.MIIADDRESS & 0x1F;
        var rgad = (this.MIIADDRESS >> 8) & 0x1F;
        var phy_addr = 0x0;
        switch(this.MIICOMMAND) {
            case 0:
                break;

            case 1: // scan status
                break;

            case 2: // read status
                if (fiad != phy_addr) {
                    this.MIIRX_DATA = 0xFFFF;
                } else {
                    // message.Debug("MIICOMMAND read" + " " + utils.ToHex(rgad));
                    this.MIIRX_DATA = this.MIIregs[rgad];
                }
                break;

            case 4: // write status
                if (fiad != phy_addr) {
                } else {
                    // message.Debug("MIICOMMAND write" + " " + utils.ToHex(rgad) + " " + utils.ToHex(this.MIITX_DATA));
                    //this.MIIregs[rgad] = this.MIITX_DATA & 0xFFFF;
                }
                break;

            default:
                message.Debug("Error in ethmac: Unknown mii command detected");
                break;
        }

    }



    this.WriteReg32 = function (addr, val) {
        // message.Debug("write ethmac " + utils.ToHex(addr));
        switch (addr) {
            case ETHMAC_ADDR_MODER:
                this.MODER = val;
                break;

            case ETHMAC_ADDR_INT_SOURCE:
                //to clear an interrupt, it must be set in the write
                //otherwise, leave the other bits alone
                this.INT_SOURCE = this.INT_SOURCE & ~val;

                if (this.INT_MASK & this.INT_SOURCE) {
                    this.intdev.RaiseInterrupt(0x4);
                } else {
                    this.intdev.ClearInterrupt(0x4);
                }

                break;

            case ETHMAC_ADDR_INT_MASK:
                this.INT_MASK = val;

                if (this.INT_MASK & this.INT_SOURCE) {
                    this.intdev.RaiseInterrupt(0x4);
                } else {
                    this.intdev.ClearInterrupt(0x4);
                }

                break;

            case ETHMAC_ADDR_IPGT:
                this.IPGT = val;
                break;

            case ETHMAC_ADDR_IPGR1:
                this.IPGR1 = val;
                break;

            case ETHMAC_ADDR_IPGR2:
                this.IPGR2 = val;
                break;

            case ETHMAC_ADDR_PACKETLEN:
                this.PACKETLEN = val;
                break;

            case ETHMAC_ADDR_COLLCONF:
                this.COLLCONF = val;
                break;

            case ETHMAC_ADDR_TX_BD_NUM:
                this.TX_BD_NUM = val;
                this.currRX = (val << 1);
                break;

            case ETHMAC_ADDR_CTRLMODER:
                this.CTRLMODER = val;
                break;

            case ETHMAC_ADDR_MIIMODER:
                this.MIIMODER = val;
                break;

            case ETHMAC_ADDR_MIICOMMAND:
                this.MIICOMMAND = val;
		this.HandleMIICommand();
                break;

            case ETHMAC_ADDR_MIIADDRESS:
                this.MIIADDRESS = val;
                break;

            case ETHMAC_ADDR_MIITX_DATA:
                this.MIITX_DATA = val;
                break;

            case ETHMAC_ADDR_MIIRX_DATA:
                this.MIIRX_DATA = val;
                break;

            case ETHMAC_ADDR_MIISTATUS:
                this.MIISTATUS = val;
                break;

            case ETHMAC_ADDR_MAC_ADDR0:
                this.MAC_ADDR0 = val;
                break;

            case ETHMAC_ADDR_MAC_ADDR1:
                this.MAC_ADDR1 = val;
                break;

            case ETHMAC_ADDR_ETH_HASH0_ADR:
                this.ETH_HASH0_ADR = val;
                break;

            case ETHMAC_ADDR_ETH_HASH1_ADR:
                this.ETH_HASH1_ADR = val;
                break;

            case ETHMAC_ADDR_ETH_TXCTRL:
                this.ETH_TXCTRL = val;
                break;

            default:
                if (addr >= ETHMAC_ADDR_BD_START &&
                    addr <= ETHMAC_ADDR_BD_END) {

                    this.BD[(addr-ETHMAC_ADDR_BD_START)>>>2] = val;

                    //which buffer descriptor?
                    var BD_NUM = (addr - ETHMAC_ADDR_BD_START)>>>3;
                    
                    //make sure this isn't the pointer portion
                    if (((BD_NUM << 3) + ETHMAC_ADDR_BD_START) == addr) {
                        //did we just set the ready/empty bit?
                        if ((val & (1 << 15)) != 0) {
                            //TX, or RX?
                            if (BD_NUM < this.TX_BD_NUM) {
                                //TX BD
                                this.Transmit(BD_NUM);
                            }
                        }
                    }
                } else {
                    message.Debug("Attempt to access ethmac register beyond 0x800");
                }
        }
    };

    this.Reset();
    message.Register("ethmac", this.Receive.bind(this) );

}

module.exports = EthDev;

},{"../messagehandler":43,"../utils":58}],20:[function(require,module,exports){
// -------------------------------------------------
// ---------------- Framebuffer --------------------
// -------------------------------------------------

"use strict";

var utils = require('../utils');
var message = require('../messagehandler');

// constructor
function FBDev(ram) {
    this.ram = ram;
    this.width = 640;
    this.height = 400;
    this.addr = 16000000;
    this.n = (this.width * this.height)>>1;
    this.buffer = new Int32Array(this.n);
    message.Register("GetFB", this.OnGetFB.bind(this) );
    //this.buffer = new Uint8Array(0);
}

FBDev.prototype.Reset = function () {
};


FBDev.prototype.ReadReg32 = function (addr) {
    return 0x0;
};

FBDev.prototype.WriteReg32 = function (addr, value) {

    switch (addr) {
    case 0x14: 
        this.addr = utils.Swap32(value);
        //this.buffer = new Uint8Array(this.ram.mem, this.addr, this.n);
        break;
    default:
        return;
    }
};

FBDev.prototype.OnGetFB = function() {
    message.Send("GetFB", this.GetBuffer() );
}

FBDev.prototype.GetBuffer = function () {
    //return this.buffer;
    var i=0, n = this.buffer.length;
    var data = this.buffer;
    var mem = this.ram.int32mem;
    var addr = this.addr>>2;
   	for (i = 0; i < n; ++i) {
        data[i] = mem[addr+i];
    }
    return this.buffer;
}

module.exports = FBDev;

},{"../messagehandler":43,"../utils":58}],21:[function(require,module,exports){
// -------------------------------------------------
// ---------------------- IRQ ----------------------
// -------------------------------------------------
// Stefan Kristianssons ompic suitable for smp systems
// Just the ipi part

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

// Control register
// +---------+---------+----------+---------+
// | 31      | 30      | 29 .. 16 | 15 .. 0 |
// ----------+---------+----------+----------
// | IRQ ACK | IRQ GEN | DST CORE | DATA    |
// +---------+---------+----------+---------+

// Status register
// +----------+-------------+----------+---------+
// | 31       | 30          | 29 .. 16 | 15 .. 0 |
// -----------+-------------+----------+---------+
// | Reserved | IRQ Pending | SRC CORE | DATA    |
// +----------+-------------+----------+---------+

var OMPIC_IPI_CTRL_IRQ_ACK = (1 << 31);
var OMPIC_IPI_CTRL_IRQ_GEN = (1 << 30);
var OMPIC_IPI_STAT_IRQ_PENDING = (1 << 30);

function IRQDev(intdev) {
    this.intdev = intdev;
    this.regs = new Uint32Array(32*2); // maximum 32 cpus
    this.Reset();
}

IRQDev.prototype.Reset = function() {
    for(var i=0; i<32*2; i++) {
        this.regs[i] = 0x0;
    }
}

IRQDev.prototype.ReadReg32 = function (addr) {
    addr >>= 2;
    if (addr > 32*2) {
        message.Debug("IRQDev: Unknown ReadReg32: " + utils.ToHex(addr));
        return 0x0;
    }
    /*
    var cpuid = addr >> 1;    
    if (addr&1) {
        message.Debug("IRQDev: Read STAT of CPU " + cpuid);
    } else {
        message.Debug("IRQDev: Read CTRL of CPU " + cpuid);
    }
    */
    return this.regs[addr];
}

IRQDev.prototype.WriteReg32 = function (addr, value) {
    addr >>= 2;
    if (addr > 32*2) {
        message.Debug("IRQDev: unknown  WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
        return;
    }

    var cpuid = addr >> 1;
    if (addr&1) {
        message.Debug("Error in IRQDev: Write STAT of CPU " + cpuid +" : " + utils.ToHex(value));
    } else {
        this.regs[addr] = value;
        var irqno = value & 0xFFFF;
        var dstcpu = (value >> 16) & 0x3fff;
        var flags = (value >> 30) & 3;
        /*
        message.Debug("IRQDev: Write CTRL of CPU " + cpuid + " : " +
            " dstcpu=" + dstcpu  +
            " irqno=" + irqno +
            " flags=" + flags
            );
        */

        if (flags & 1) { // irq gen
            if (dstcpu == cpuid) {
                message.Debug("Warning in IRQDev: Try to raise its own IRQ");
            }
            if (this.regs[(dstcpu<<1)+1] & OMPIC_IPI_STAT_IRQ_PENDING) {
                message.Debug("Warning in IRQDev: CPU " + cpuid + " raised irq on cpu " + dstcpu + " without previous acknowledge");
                var h = new Int32Array(this.intdev.heap);
                message.Debug("The pc of cpu " + dstcpu + " is " + utils.ToHex(h[(dstcpu<<15) + 0x124 >> 2]));
                message.Debug("The IEE flag of cpu " + dstcpu + " is " + ( h[(dstcpu<<15) + 0x120 >> 2] & (1<<2)) );
                message.Debug("r9 of cpu " + dstcpu + " is " + utils.ToHex(h[(dstcpu<<15) + (0x9<<2) >> 2]));
            }
            this.regs[(dstcpu<<1)+1] = OMPIC_IPI_STAT_IRQ_PENDING | ((cpuid & 0x3fff) << 16) | irqno;
            this.intdev.RaiseSoftInterrupt(0x1, dstcpu);
        }
        if (flags & 2) { // irq ack
            this.regs[addr+1] &= ~OMPIC_IPI_STAT_IRQ_PENDING;
            this.intdev.ClearSoftInterrupt(0x1, cpuid);
        }

    }
}

module.exports = IRQDev;

},{"../messagehandler":43,"../utils":58}],22:[function(require,module,exports){
// -------------------------------------------------
// ------------------ KEYBOARD ---------------------
// -------------------------------------------------
// Emulating the Opencores Keyboard Controller

"use strict";
var message = require('../messagehandler');

// translation table from Javascript keycodes to Linux keyboard scancodes
// http://lxr.free-electrons.com/source/include/dt-bindings/input/input.h

var kc2kc =
[
// 0
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //
14,     // backspace
15,     // tab

// 10
0,      //
0,      //
0,      //
28,     // enter
0,      //
0,      //
42,     // shift
29,     // ctrl
56,     // alt
119,    // pause/break

// 20
58,     // caps lock
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //
1,      // escape
0,      //
0,      //

// 30
0,      //
0,      //
57,     // space
104,    // page up
109,    // page down
107,    // end
102,    // home
105,    // left arrow
103,    // up arrow
106,    // right arrow

// 40
108,    // down arrow
0,      //
0,      //
0,      //
0,      //
110,    // insert
111,    // delete
0,      //
11,     // 0
2,      // 1

// 50
3,      // 2
4,      // 3
5,      // 4
6,      // 5
7,      // 6
8,      // 7
9,      // 8
10,     // 9
0,      // 
39,      // semi colon

// 60
,      // equal sign
13,      // 
0,      // 
0,      // 
0,      // 
30,     // a
48,     // b
46,     // c
32,     // d
18,     // e

// 70
33,     // f
34,     // g
35,     // h
23,     // i
36,     // j
37,     // k
38,     // l
50,     // m
49,     // n
24,     // o

// 80
25,     // p
16,     // q
19,     // r
31,     // s
20,     // t
22,     // u
47,     // v
17,     // w
45,     // x
21,     // y

// 90
44,     // z
0,    // left window key
0,    // right window key
0,    // select key
0,      // 
0,      // 
82,     // numpad 0
79,     // numpad 1
80,     // numpad 2
81,     // numpad 3

// 100
75,     // numpad 4
76,     // numpad 5
77,     // numpad 6
71,     // numpad 7
72,     // numpad 8
73,     // numpad 9
55,     // multiply
77,     // add
0,      // 
12,     // subtract

// 110
83,     // decimal point
181,    // divide
59,     // F1
60,     // F2
61,     // F3
62,     // F4
63,     // F5
64,     // F6
65,     // F7
66,     // F8

// 120
67,     // F9
68,     // F10
87,     // F11
88,     // F12
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //

// 130
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 140
0,      // 
0,      // 
0,      // 
0,      // 
69,     // num lock
70,     // scroll lock
0,      // 
0,      // 
0,      // 
0,      //

// 150
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 160
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 170
0,      // 
0,      // 
0,      // 
12,     // minus
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 180
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
39,     // semi-colon
13,     // equal sign
51,     // comma
12,     // dash

// 190
52,     // period
53,     // forward slash
40,     // grave accent
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 200
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 210
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
26,     // open bracket

// 220
43,     // back slash
27,     // close bracket
40,     // single quote
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

];



function KeyboardDev(intdev) {
    this.intdev = intdev;
    message.Register("keydown", this.OnKeyDown.bind(this) );
    message.Register("keyup", this.OnKeyUp.bind(this) );
    this.Reset();
}

KeyboardDev.prototype.Reset = function() {
    this.key = 0x0;
    this.fifo = [];
}

KeyboardDev.prototype.OnKeyDown = function(event) {
    this.key = kc2kc[event.keyCode] | 0x0;
    if (this.key == 0) return;
    this.fifo.push(this.key);
    this.intdev.RaiseInterrupt(0x5);
}

KeyboardDev.prototype.OnKeyUp = function(event) {
    this.key = kc2kc[event.keyCode];
    if (this.key == 0) return;
    this.key = this.key | 0x80;
    this.fifo.push(this.key);
    this.intdev.RaiseInterrupt(0x5);
}

KeyboardDev.prototype.ReadReg8 = function (addr) {
    var key = this.fifo.shift();
    if (this.fifo.length == 0) this.intdev.ClearInterrupt(0x5);
    return key;
}

module.exports = KeyboardDev;

},{"../messagehandler":43}],23:[function(require,module,exports){
// -------------------------------------------------
// ---------------------- RTC ----------------------
// -------------------------------------------------
// Real Time Clock emulating the nxp,lpc3220-rtc

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

/*
 * Clock and Power control register offsets
 */
var LPC32XX_RTC_UCOUNT            = 0x00;
var LPC32XX_RTC_DCOUNT            = 0x04;
var LPC32XX_RTC_MATCH0            = 0x08;
var LPC32XX_RTC_MATCH1            = 0x0C;
var LPC32XX_RTC_CTRL              = 0x10;
var LPC32XX_RTC_INTSTAT           = 0x14;
var LPC32XX_RTC_KEY               = 0x18;
var LPC32XX_RTC_SRAM              = 0x80;

function RTCDev(intdev) {
    this.intdev = intdev;
    this.Reset();
}

RTCDev.prototype.Reset = function() {
    this.ctrl = 0x0;
}


RTCDev.prototype.ReadReg32 = function (addr) {
    switch(addr)
    {
        case LPC32XX_RTC_UCOUNT:
            return Math.floor(new Date().getTime()/1000);
            break;

        case LPC32XX_RTC_CTRL:
            return this.ctrl;
            break;

        case LPC32XX_RTC_KEY: 
            return 0xB5C13F27; // the clock is already running
            break;

        case LPC32XX_RTC_MATCH0:
            return 0x0;
            break;

        case  LPC32XX_RTC_INTSTAT:
            return 0x0;
            break;


        default:
            message.Debug("RTC: unknown ReadReg32: " + utils.ToHex(addr));
            return 0x0;
            break;
    }
    return 0x0;
}

RTCDev.prototype.WriteReg32 = function (addr, value) {
    switch(addr)
    {
        case LPC32XX_RTC_CTRL:
            this.ctrl = value;
            break;

        default:
            message.Debug("RTC: unknown  WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
            return;
            break;
    }
}


module.exports = RTCDev;

},{"../messagehandler":43,"../utils":58}],24:[function(require,module,exports){
// -------------------------------------------------
// --------------------- SOUND ---------------------
// -------------------------------------------------

// Emulating my own virtual sound card, using the altered dummy sound device

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

var REG_CTL            = 0x00; // format
var REG_ADDR           = 0x04; // pointer to dma buffer
var REG_PERIODS        = 0x08; // number of perionds
var REG_PERIOD_SIZE    = 0x0C; // size of periods
var REG_OFFSET         = 0x10; // current position in buffer
var REG_RATE           = 0x14; // rate
var REG_CHANNELS       = 0x18; // channels
var REG_FORMAT         = 0x1C; // format

function SoundDev(intdev, ramdev) {
    message.Debug("Start sound");
    this.intdev = intdev;
    this.ramdev = ramdev
    this.Reset();
}

SoundDev.prototype.Reset = function() {
    this.addr = 0x0;
    this.status = 0x0;
    this.periods = 0x0;
    this.period_size = 0x0; // in frames (32 bits)
    this.rate = 22050;
    this.channels = 1;
    this.offset = 0; // frames (32 bits)
    this.playing = false;
    this.nextperiod = 0;
    this.starttime = 0.; // time when the playing started in (in ms)
    this.lasttotalframe = 0; // last (total) frame to which the sound was simulated
}

SoundDev.prototype.GetTimeToNextInterrupt = function() {
    if (!this.playing) return -1;
    return this.nextperiod * 1000. / this.rate;
}

SoundDev.prototype.Progress = function() {
    return;
/*
    if (!this.playing) return;
    var currenttime = utils.GetMilliseconds();

    var totalframes = Math.floor((currenttime - this.starttime) / 1000. * this.rate); // in frames
    var deltaframes = totalframes - this.lasttotalframe;

    if (deltaframes < 16) return; // not worth sending

    var x = new Int8Array(deltaframes);
    var totalperiodbuffer = this.periods*this.period_size;
    for(var i=0; i<deltaframes; i++) {
        x[i] = this.ramdev.sint8mem[this.addr + (((this.offset++)<<1)^3)];
        if (this.offset == totalperiodbuffer) this.offset = 0;
    }

    message.Send("sound", x);

    this.lasttotalframe += deltaframes;
    this.nextperiod -= deltaframes;

    if (this.nextperiod <= 0) { 
        this.intdev.RaiseInterrupt(0x7);
        this.nextperiod += this.period_size;
        //if (this.nextperiod < 0) message.Debug("Error in sound device: Buffer underrun");
    }
*/
}

SoundDev.prototype.Elapsed = function() {
    var x = new Int8Array(this.period_size);
    var totalperiodbuffer = this.periods*this.period_size;
    if (this.format == 1) {
        for(var i=0; i<this.period_size; i++) {
            x[i] = this.ramdev.uint8mem[this.addr + (((this.offset++)<<0)^3)]-128;
            if (this.offset == totalperiodbuffer) this.offset = 0;
        }
    } else {
        for(var i=0; i<this.period_size; i++) {
            x[i] = this.ramdev.sint8mem[this.addr + 1 + (((this.offset++)<<1)^3)];
            if (this.offset == totalperiodbuffer) this.offset = 0;
        }
    }
    message.Send("sound", x);
    
}

SoundDev.prototype.ReadReg32 = function (addr) {
    switch(addr)
    {
        case REG_CTL:
            //if (this.nextperiod > 0)
            this.intdev.ClearInterrupt(0x7);
            this.Elapsed();
            
            return this.playing?1:0;
            break;

        case REG_OFFSET:
            return this.offset; // given in frames
            break; 

        default:
            message.Debug("Sound: unknown ReadReg32: " + utils.ToHex(addr));
            return 0x0;
            break;
    }
    return 0x0;
}

SoundDev.prototype.WriteReg32 = function (addr, value) {
    switch(addr)
    {
        case REG_CTL:
            this.playing = value?true:false;               
            this.nextperiod = this.period_size;
            this.starttime = utils.GetMilliseconds();
            this.lasttotalframe = 0;
            this.offset = 0;
            message.Send("sound.rate", this.rate);
            this.Elapsed();
            /*
            message.Debug("rate: "        + this.rate);
            message.Debug("channels: "    + this.channels);
            message.Debug("periods: "     + this.periods);
            message.Debug("period size: " + this.period_size);
            message.Debug("format: "      + this.format);
            message.Debug("addr: "        + utils.ToHex(this.addr));
            */
            break;

        case REG_ADDR:
            this.addr = value;
            break;

        case REG_PERIODS:
            this.periods = value;
            break;

        case REG_PERIOD_SIZE:
            this.period_size = value; // in frames
            break;

        case REG_RATE:
            this.rate = value; // in frames
            break;

        case REG_CHANNELS:
            this.channels = value;
            break;

        case REG_FORMAT:
            this.format = value;
            break;

        default:
            message.Debug("sound: unknown  WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
            return;
            break;
    }
}

module.exports = SoundDev;

},{"../messagehandler":43,"../utils":58}],25:[function(require,module,exports){
// -------------------------------------------------
// -------------------- Timer ----------------------
// -------------------------------------------------
// Simple Timer running with the CPU frequency (20MHz) used to synchronize the cpu timers
// the syncing is done directly in the cpu, so we can return zero here.

"use strict";

var message = require('../messagehandler');

function TimerDev() {
    this.Reset();
}

TimerDev.prototype.Reset = function() {
    this.sync = 0x0;
}

TimerDev.prototype.ReadReg32 = function (addr) {
    //message.Debug("Timer: Read reg " + addr);
    return this.sync;    
}

TimerDev.prototype.WriteReg32 = function (addr, value) {
    message.Debug("Error in Timer: Write reg " + addr + " : " + value);
}

module.exports = TimerDev;

},{"../messagehandler":43}],26:[function(require,module,exports){
// -------------------------------------------------
// ---------------- TOUCHSCREEN --------------------
// -------------------------------------------------
// Emulating the LPC32xx

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

// controller register offsets
var LPC32XX_TSC_STAT                      = 0x00;
var LPC32XX_TSC_SEL                       = 0x04;
var LPC32XX_TSC_CON                       = 0x08;
var LPC32XX_TSC_FIFO                      = 0x0C;
var LPC32XX_TSC_DTR                       = 0x10;
var LPC32XX_TSC_RTR                       = 0x14;
var LPC32XX_TSC_UTR                       = 0x18;
var LPC32XX_TSC_TTR                       = 0x1C;
var LPC32XX_TSC_DXP                       = 0x20;
var LPC32XX_TSC_MIN_X                     = 0x24;
var LPC32XX_TSC_MAX_X                     = 0x28;
var LPC32XX_TSC_MIN_Y                     = 0x2C;
var LPC32XX_TSC_MAX_Y                     = 0x30;
var LPC32XX_TSC_AUX_UTR                   = 0x34;
var LPC32XX_TSC_AUX_MIN                   = 0x38;
var LPC32XX_TSC_AUX_MAX                   = 0x3C;

var LPC32XX_TSC_ADCCON_AUTO_EN = (1 << 0); // automatic ts event capture
var LPC32XX_TSC_STAT_FIFO_EMPTY = (1 << 7); // fifo is empty; 
var LPC32XX_TSC_FIFO_TS_P_LEVEL = (1 << 31) // touched

function TouchscreenDev(intdev) {
    this.intdev = intdev;
    this.Reset();
    message.Register("tsmousedown", this.onmousedown.bind(this) );
    message.Register("tsmouseup", this.onmouseup.bind(this) );
    message.Register("tsmousemove", this.onmousemove.bind(this) );
}

TouchscreenDev.prototype.Reset = function() {
    this.control = 0x0; // control register
    this.status = LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.ispressed = false;
    this.mousemovecount = 0;
    this.fifo = 0x0;
    this.fifosize = 0x0;
}

TouchscreenDev.prototype.onmousedown = function(event) {
    if (!(this.control & LPC32XX_TSC_ADCCON_AUTO_EN)) return;
    var x = event.x;
    var y = event.y;
    this.status &= ~LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.fifosize = 0x4;
    this.fifo = 0x0;
    this.fifo |= ((0x3FF-x)&0x3FF) << 16;
    this.fifo |= ((0x3FF-y)&0x3FF);
    //this.fifo |= (x) << 16;
    //this.fifo |= (y);
    this.ispressed = true;
    this.intdev.RaiseInterrupt(0x9);
}

TouchscreenDev.prototype.onmousemove = function(event) {
    if (!(this.control & LPC32XX_TSC_ADCCON_AUTO_EN)) return;
    if (!this.ispressed) return;
    this.mousemovecount++;
    if (this.mousemovecount&3) return; // handle mouse move only every fourth time
    var x = event.x;
    var y = event.y;
    this.status &= ~LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.fifosize = 0x4;
    this.fifo = 0x0;
    this.fifo |= ((0x3FF-x)&0x3FF) << 16;
    this.fifo |= ((0x3FF-y)&0x3FF);
    this.intdev.RaiseInterrupt(0x9);
}


TouchscreenDev.prototype.onmouseup = function(event) {
    if (!(this.control & LPC32XX_TSC_ADCCON_AUTO_EN)) return;
    var x = event.x;
    var y = event.y;
    this.status &= ~LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.fifosize = 0x0; // just a button up event
    this.fifo = LPC32XX_TSC_FIFO_TS_P_LEVEL;
    this.ispressed = false;
    this.intdev.RaiseInterrupt(0x9);
}

TouchscreenDev.prototype.ReadReg32 = function (addr) {
    switch(addr)
    {
        case LPC32XX_TSC_CON:
            return this.control;
            break;
        case LPC32XX_TSC_STAT:
            this.intdev.ClearInterrupt(0x9);
            return this.status;
            break;
        case LPC32XX_TSC_FIFO:
            if (this.fifosize <= 0)
                this.status |= LPC32XX_TSC_STAT_FIFO_EMPTY;
            this.fifosize--;
            return this.fifo;
            break;
    }
    // message.Debug("Touchscreen ReadReg32: " + utils.ToHex(addr));
    return 0x0;
}

TouchscreenDev.prototype.WriteReg32 = function (addr, value) {
    switch(addr)
    {
        case LPC32XX_TSC_CON:
            this.control = value;
            return;
            break;
        case LPC32XX_TSC_SEL:
        case LPC32XX_TSC_MIN_X:
        case LPC32XX_TSC_MAX_X:
        case LPC32XX_TSC_MIN_Y:
        case LPC32XX_TSC_MAX_Y:
        case LPC32XX_TSC_AUX_UTR:
        case LPC32XX_TSC_AUX_MIN:
        case LPC32XX_TSC_AUX_MAX:
        case LPC32XX_TSC_RTR:
        case LPC32XX_TSC_DTR:
        case LPC32XX_TSC_TTR:
        case LPC32XX_TSC_DXP:
        case LPC32XX_TSC_UTR:
            return;
        break;

    }
    // message.Debug("Touchscreen WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
    return;
}

module.exports = TouchscreenDev;

},{"../messagehandler":43,"../utils":58}],27:[function(require,module,exports){
// -------------------------------------------------
// -------------------- UART -----------------------
// -------------------------------------------------
// uart16550 compatible
// the driver source is spread in drivers/tty/serial/8250/

// See
// http://www.tldp.org/HOWTO/Serial-HOWTO-18.html
// http://www.lammertbies.nl/comm/info/serial-uart.html
// http://www.freebsd.org/doc/en/articles/serial-uart/

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');
var util = require('util');

// Register offsets
var UART_RXBUF = 0; /* R: Rx buffer, DLAB=0 */
var UART_TXBUF = 0; /* W: Tx buffer, DLAB=0 (also called transmitter hoilding register */
var UART_DLL   = 0; /* R/W: Divisor Latch Low, DLAB=1 */
var UART_DLH   = 1; /* R/W: Divisor Latch High, DLAB=1 */
var UART_IER   = 1; /* R/W: Interrupt Enable Register */
var UART_IIR   = 2; /* R: Interrupt ID Register */
var UART_FCR   = 2; /* W: FIFO Control Register */
var UART_LCR   = 3; /* R/W: Line Control Register */
var UART_MCR   = 4; /* W: Modem Control Register */
var UART_LSR   = 5; /* R: Line Status Register */
var UART_MSR   = 6; /* R: Modem Status Register */
var UART_SCR   = 7; /* R/W: Scratch Register*/

// Line Status register bits
var UART_LSR_DATA_READY        = 0x1;  // data available
var UART_LSR_TX_EMPTY        = 0x20; // TX (THR) buffer is empty
var UART_LSR_TRANSMITTER_EMPTY = 0x40; // TX empty and line is idle

// Interrupt enable register bits
var UART_IER_MSI  = 0x08; /* Modem Status Changed int. */
var UART_IER_BRK  = 0x04; /* Enable Break int. */
var UART_IER_THRI = 0x02; /* Enable Transmitter holding register int. */
var UART_IER_RDI  = 0x01; /* Enable receiver data interrupt */

// Interrupt identification register bits
var UART_IIR_MSI    = 0x00; /* Modem status interrupt (Low priority). Reset by MSR read */
var UART_IIR_NO_INT = 0x01;
var UART_IIR_THRI   = 0x02; /* Transmitter holding register empty. Reset by IIR read or THR write */
var UART_IIR_RDI    = 0x04; /* Receiver data interrupt. Reset by RBR read */
var UART_IIR_RLSI   = 0x06; /* Receiver line status interrupt (High p.). Reset by LSR read */
var UART_IIR_CTI    = 0x0c; /* Character timeout. Reset by RBR read */

// Line control register bits
var UART_LCR_DLAB   = 0x80; /* Divisor latch access bit */

// Modem control register bits
var UART_MCR_DTR = 0x01; /* Data Terminal Ready - Kernel ready to receive */
var UART_MCR_RTS = 0x02; /* Request To Send - Kernel ready to receive */

// Modem status register bits
var UART_MSR_DCD       = 0x80; /* Data Carrier Detect */
var UART_MSR_DSR       = 0x20; /* Data set Ready */
var UART_MSR_DELTA_DSR = 0x2;
var UART_MSR_CTS       = 0x10; /* Clear to Send */
var UART_MSR_DELTA_CTS = 0x1;

// register descriptions for debug mode
var MCR_BIT_DESC = ["DataTerminalReady", "RTS", "AuxOut1", "AuxOut2", "Loopback", "Autoflow"/*16750*/];
var FCR_BIT_DESC = ["FIFO enable", "Reset", "XMIT-FIFO-Reset", "DMA-Mode", "Reserved", "Reserved", "RecrTrig(LSB)", "RecrTrig(MSB)"];
var LCR_BIT_DESC = ["WordLen", "WordLen", "StopBits", "Parity", "EvenParity", "StickParity", "Break", "DivisorLatch"];
var MSR_BIT_DESC = ["DeltaCTS", "DeltaDataSetReady", "DeltaRingIndicator", "DeltaCarrierDetect", "ClearToSend", "DataSetReady", "RingIndicator", "CarrierDetect"];
var LSR_BIT_DESC = ["RxDataAvail", "OverrunErr", "ParityErr", "FrameErr", "BreakSignal", "TxEmpty", "TxEmptyLine", "BadRxFifoData"];
var IER_BIT_DESC = ["RxAvailableI", "TxEmptyI", "BreakI", "MSI"];


// constructor
function UARTDev(id, intdev, intno) {
    this.intno = intno;
    this.intdev = intdev;
    this.id = id;
    //this.verboseuart = true;
    message.Register("tty" + id, this.ReceiveChar.bind(this) );
    this.Reset();
}

UARTDev.prototype.ToBitDescription = function(val, desc) {
    val &= 0xff;
    var result= ("00000000" + val.toString(2)).substr(-8)+ ":"
    for(var i=0; i < desc.length; i++) {
        result += " " + desc[i] + ":" + ((val>>i)&1);
    }
    return result;
}

UARTDev.prototype.Reset = function() {

    this.LCR = 0x3; // Line Control, reset, character has 8 bits
    this.LSR = UART_LSR_TRANSMITTER_EMPTY | UART_LSR_TX_EMPTY; // Transmitter serial register empty and Transmitter buffer register empty
    this.MSR = UART_MSR_DCD | UART_MSR_DSR | UART_MSR_CTS; // modem status register
    this.ints = 0x0; // internal interrupt pending register
    this.IIR = UART_IIR_NO_INT; // Interrupt Identification, no interrupt
    this.IER = 0x0; //Interrupt Enable
    this.DLL = 0x0;
    this.DLH = 0x0;
    this.FCR = 0x0; // FIFO Control;
    this.MCR = 0x0; // Modem Control

    this.rxbuf = new Array(); // receive fifo buffer.
    this.txbuf = new Array(); // transmit fifo buffer.
}

UARTDev.prototype.Step = function() {
    if(this.txbuf.length != 0) {
        message.Send("tty"+this.id, this.txbuf);
        this.txbuf = new Array();
    }
}

// To prevent the character from being overwritten we use a javascript array-based fifo and request a character timeout. 
UARTDev.prototype.ReceiveChar = function(data) {
	//console.log("UART ReceiveChar: " + util.inspect(data));
    data.forEach(function(c) {
        this.rxbuf.push(c&0xFF);
    }.bind(this));
    if (this.rxbuf.length > 0) {
        this.LSR |= UART_LSR_DATA_READY;
        this.ThrowInterrupt(UART_IIR_CTI);
    }
}

UARTDev.prototype.CheckInterrupt = function() {
    if ((this.ints & (1 << UART_IIR_CTI))  && (this.IER & UART_IER_RDI)) {
        this.IIR = UART_IIR_CTI;
        this.intdev.RaiseInterrupt(this.intno);
    } else
    if ((this.ints & (1 << UART_IIR_THRI)) && (this.IER & UART_IER_THRI)) {
        this.IIR = UART_IIR_THRI;
        this.intdev.RaiseInterrupt(this.intno);
    } else
    if ((this.ints & (1 << UART_IIR_MSI))  && (this.IER & UART_IER_MSI)) {
        this.IIR = UART_IIR_MSI;
        this.intdev.RaiseInterrupt(this.intno);
    } else {
        this.IIR = UART_IIR_NO_INT;
        this.intdev.ClearInterrupt(this.intno);
    }
};

UARTDev.prototype.ThrowInterrupt = function(line) {
    this.ints |= (1 << line);
    this.CheckInterrupt();
}

UARTDev.prototype.ClearInterrupt = function(line) {
    this.ints &= ~(1 << line);
    this.CheckInterrupt();
};

UARTDev.prototype.ReadReg8 = function(addr) {

    if (this.LCR & UART_LCR_DLAB) {  // Divisor latch access bit
        switch (addr) {
        case UART_DLL:
            return this.DLL;
            break;

        case UART_DLH:
            return this.DLH;
            break;
        }
    }

    switch (addr) {
    case UART_RXBUF:
        var ret = 0x0; // if the buffer is empty, return 0
        if (this.rxbuf.length > 0) {
            ret = this.rxbuf.shift();
			//console.log("(WORKER) UART_RXBUF retreive: " + (ret & 0xFF) + ", chars remaining: " + this.rxbuf.length);
        }
        if (this.rxbuf.length == 0) {
			//console.log("(WORKER) RXBUF empty, clearing interrupt");
            this.LSR &= ~UART_LSR_DATA_READY;
            this.ClearInterrupt(UART_IIR_CTI);
        }
        return ret & 0xFF;
        break;

    case UART_IER:
        return this.IER & 0x0F;
        break;

    case UART_MSR:
        var ret = this.MSR;
        this.MSR &= 0xF0; // reset lowest 4 "delta" bits
        if (this.verboseuart) message.Debug("Get UART_MSR " + this.ToBitDescription(ret, MSR_BIT_DESC));
        return ret;
        break;

    case UART_IIR:
        {
            // the two top bits (fifo enabled) are always set
            var ret = (this.IIR & 0x0F) | 0xC0;
             
            if (this.IIR == UART_IIR_THRI) {
                this.ClearInterrupt(UART_IIR_THRI);
            }
            
            return ret;
            break;
        }

    case UART_LCR:
        return this.LCR;
        break;

    case UART_LSR:
        // This gets polled many times a second, so logging is commented out
        // if(this.verboseuart) message.Debug("Get UART_LSR " + this.ToBitDescription(this.LSR, LSR_BIT_DESC));
        return this.LSR;
        break;

    default:
        message.Debug("Error in ReadRegister: not supported");
        message.Abort();
        break;
    }
};

UARTDev.prototype.WriteReg8 = function(addr, x) {
    x &= 0xFF;

    if (this.LCR & UART_LCR_DLAB) {
        switch (addr) {
        case UART_DLL:
            this.DLL = x;
            return;
            break;
        case UART_DLH:
            this.DLH = x;
            return;
            break;
        }
    }

    switch (addr) {
    case UART_TXBUF: 
         // we assume here, that the fifo is on

         // In the uart spec we reset UART_IIR_THRI now ...
        this.LSR &= ~UART_LSR_TRANSMITTER_EMPTY;
        //this.LSR &= ~UART_LSR_TX_EMPTY;

        this.txbuf.push(x);
        //message.Debug("send " + x);
        // the data is sent immediately
        this.LSR |= UART_LSR_TRANSMITTER_EMPTY | UART_LSR_TX_EMPTY; // txbuffer is empty immediately
        this.ThrowInterrupt(UART_IIR_THRI);
        break;

    case UART_IER:
        // 2 = 10b ,5=101b, 7=111b
        this.IER = x & 0x0F; // only the first four bits are valid
        //if(this.verboseuart) message.Debug("Set UART_IER " + this.ToBitDescription(x, IER_BIT_DESC));
        // Check immediately if there is a interrupt pending
        this.CheckInterrupt();
        break;

    case UART_FCR:
        if(this.verboseuart) message.Debug("Set UART_FCR " + this.ToBitDescription(x, FCR_BIT_DESC));
        this.FCR = x & 0xC9;
        if (this.FCR & 2) {
			console.log("(WORKER) Clear UART buffer");
            this.ClearInterrupt(UART_IIR_CTI);
            this.rxbuf = new Array(); // clear receive fifo buffer
        }
        if (this.FCR & 4) {
            this.txbuf = new Array(); // clear transmit fifo buffer
        }
        break;

    case UART_LCR:
        if(this.verboseuart)  message.Debug("Set UART_LCR " + this.ToBitDescription(x, LCR_BIT_DESC));
        if ((this.LCR & 3) != 3) {
            message.Debug("Warning in UART: Data word length other than 8 bits are not supported");
        }
        this.LCR = x;
        break;

    case UART_MCR:
        if(this.verboseuart) message.Debug("Set UART_MCR " + this.ToBitDescription(x,MCR_BIT_DESC));
        this.MCR = x;
        break;

    default:
        message.Debug("Error in WriteRegister: not supported");
        message.Abort();
        break;
    }
};


module.exports = UARTDev;

},{"../messagehandler":43,"../utils":58,"util":89}],28:[function(require,module,exports){
// -------------------------------------------------
// ------------------- VIRTIO ----------------------
// -------------------------------------------------
// Implementation of the virtio mmio device and virtio ring
//
// the following documentation were used
// http://wiki.osdev.org/Virtio
// http://lxr.free-electrons.com/source/Documentation/virtual/virtio-spec.txt?v=3.4
// http://swtch.com/plan9port/man/man9/
// http://lxr.free-electrons.com/source/net/9p/error.c?v=3.1
// https://lists.gnu.org/archive/html/qemu-devel/2011-12/msg02712.html
// http://www-numi.fnal.gov/offline_software/srt_public_context/WebDocs/Errors/unix_system_errors.html
// https://github.com/ozaki-r/arm-js/tree/master/js
// the memory layout can be found here: include/uapi/linux/virtio_ring.h

"use strict";

var utils = require('../utils');
var marshall = require('./virtio/marshall');
var message = require('../messagehandler');

var VIRTIO_MAGIC_REG = 0x0;
var VIRTIO_VERSION_REG = 0x4;
var VIRTIO_DEVICE_REG = 0x8;
var VIRTIO_VENDOR_REG = 0xC;
var VIRTIO_HOSTFEATURES_REG = 0x10;
var VIRTIO_HOSTFEATURESSEL_REG = 0x14;
var VIRTIO_GUESTFEATURES_REG = 0x20;
var VIRTIO_GUESTFEATURESSEL_REG = 0x24;
var VIRTIO_GUEST_PAGE_SIZE_REG = 0x28;
var VIRTIO_QUEUESEL_REG = 0x30;
var VIRTIO_QUEUENUMMAX_REG = 0x34;
var VIRTIO_QUEUENUM_REG = 0x38;
var VIRTIO_QUEUEALIGN_REG = 0x3C;
var VIRTIO_QUEUEPFN_REG = 0x40;
var VIRTIO_QUEUE_READY = 0x44;
var VIRTIO_QUEUENOTIFY_REG = 0x50;
var VIRTIO_INTERRUPTSTATUS_REG = 0x60;
var VIRTIO_INTERRUPTACK_REG = 0x64;
var VIRTIO_STATUS_REG = 0x70;
var VIRTIO_QUEUE_DESC_LOW = 0x80;
var VIRTIO_QUEUE_DESC_HIGH = 0x84;
var VIRTIO_QUEUE_AVAIL_LOW = 0x90;
var VIRTIO_QUEUE_AVAIL_HIGH = 0x94;
var VIRTIO_QUEUE_USED_LOW = 0xA0;
var VIRTIO_QUEUE_USED_HIGH = 0xA4;
var VIRTIO_CONFIG_GENERATION = 0xFC;

var VRING_DESC_F_NEXT =      1; /* This marks a buffer as continuing via the next field. */
var VRING_DESC_F_WRITE =     2; /* This marks a buffer as write-only (otherwise read-only). */
var VRING_DESC_F_INDIRECT =  4; /* This means the buffer contains a list of buffer descriptors. */


// non aligned copy
function CopyMemoryToBuffer(from, to, offset, size) {
    for(var i=0; i<size; i++)
        to[i] = from.Read8(offset+i);
}

function CopyBufferToMemory(from, to, offset, size) {
    for(var i=0; i<size; i++)
        to.Write8(offset+i, from[i]);
}

function VirtIODev(intdev, intno, ramdev, device) {
    this.dev = device;
    this.dev.SendReply = this.SendReply.bind(this);
    this.intdev = intdev;
    this.intno = intno;
    this.ramdev = ramdev;

    this.queuenum = new Uint32Array(0x10);
    this.queueready = new Uint32Array(0x10);
    this.queuepfn = new Uint32Array(0x10);
    this.descaddr = new Uint32Array(0x10);
    this.usedaddr = new Uint32Array(0x10);
    this.availaddr = new Uint32Array(0x10);
    this.lastavailidx = new Uint32Array(0x10);

    //this.version = 1;
    this.version = 2; // for Linux > 4.0

    this.Reset();
}

VirtIODev.prototype.Reset = function() {
    this.status = 0x0;
    this.intstatus = 0x0;
    this.pagesize = 0x2000;
    this.align = 0x2000;
    this.availidx = 0x0;
    this.hostfeaturewordselect = 0x0;

    this.queuesel = 0x0;

    for(var i=0; i<0x10; i++) {
        this.queueready[i] = 0x0;
        this.queuenum[i] = 0x10;
        this.queuepfn[i] = 0x0;
        this.descaddr[i] = 0x0;
        this.usedaddr[i] = 0x0;
        this.availaddr[i] = 0x0;
        this.lastavailidx[i] = 0x0;
    }
}

// Ring buffer addresses
VirtIODev.prototype.UpdateAddr = function() {
    if (this.version != 1) return;
    var i = this.queuesel;
    this.descaddr[i] = this.queuepfn[i] * this.pagesize;
    this.availaddr[i] = this.descaddr[i] + this.queuenum[i]*16;
    this.usedaddr[i] = this.availaddr[i] + 2 + 2 + this.queuenum[i]*2 + 2;
    if (this.usedaddr[i] & (this.align-1)) { // padding to next align boundary
        var mask = ~(this.align - 1);
        this.usedaddr[i] = (this.usedaddr[i] & mask) + this.align;
    }
    this.lastavailidx[i] = this.ramdev.Read16Little(this.availaddr[i] + 2);
}

VirtIODev.prototype.ReadReg8 = function (addr) {
    //message.Debug("read8 configspace of int " + this.intno + " : " + (addr-0x100));
    return this.dev.configspace[addr-0x100];
}

VirtIODev.prototype.ReadReg16 = function (addr) {
    //message.Debug("read16 configspace16 of int " + this.intno + " : " + (addr-0x100));
    if (this.ramdev.nativeendian == "little") {
        return (this.dev.configspace[addr-0x100+1]<<8) | (this.dev.configspace[addr-0x100  ]);
    } else
        return (this.dev.configspace[addr-0x100  ]<<8) | (this.dev.configspace[addr-0x100+1]);
}

VirtIODev.prototype.WriteReg8 = function (addr, value) {
    //message.Debug("write8 configspace of int " + this.intno + " : " + (addr-0x100) + " " + value);
    this.dev.WriteConfig(addr-0x100, value);
}

VirtIODev.prototype.ReadReg32 = function (addr) {
    var val = 0x0;
    //message.Debug("VirtIODev: read register of int "  + this.intno + " : " + utils.ToHex(addr));
    if (addr >= 0x100) {
        //message.Debug("read32 configspace of int " + this.intno + " : " + (addr-0x100));
        return (
            (this.dev.configspace[addr-0x100+0]<<24) | 
            (this.dev.configspace[addr-0x100+1]<<16) |
            (this.dev.configspace[addr-0x100+2]<<8) |
            (this.dev.configspace[addr-0x100+3]<<0) );
    }

    switch(addr)
    {
        case VIRTIO_MAGIC_REG:
            val = 0x74726976; // "virt"
            break;

        case VIRTIO_VERSION_REG:
            val = this.version;
            break;

        case VIRTIO_DEVICE_REG:
            val = this.dev.deviceid;
            break;

        case VIRTIO_VENDOR_REG:
            val = 0xFFFFFFFF;
            break;

        case VIRTIO_HOSTFEATURES_REG:
            //message.Debug("virtio: Read hostfeatures register");
            val = 0x0;
            if (this.hostfeaturewordselect == 0) {
                val = this.dev.hostfeature;
            } else
            if (this.hostfeaturewordselect == 1) {
                val = 0x1; // VIRTIO_F_VERSION_1
            }
            break;

        case VIRTIO_QUEUENUMMAX_REG:
            val = this.queuenum[this.queuesel];
            break;

        case VIRTIO_QUEUEPFN_REG:
            val = this.queuepfn[this.queuesel];
            break;

        case VIRTIO_QUEUE_READY:
            val = this.queueready[this.queuesel];
            break;

        case VIRTIO_INTERRUPTSTATUS_REG:
            val = this.intstatus;
            break;

        case VIRTIO_STATUS_REG:
            val = this.status;
            break;

        case VIRTIO_CONFIG_GENERATION:
            val = 0x0;
            break;

        default:
            message.Debug("Error in VirtIODev: Attempt to read register " + utils.ToHex(addr));
            message.Abort();
            break;
    }
    if (this.ramdev.nativeendian == "little") {
        return val;
    } else {
        return utils.Swap32(val);
    }
};

VirtIODev.prototype.GetDescriptor = function(queueidx, index) {

    var addr = this.descaddr[queueidx] + index * 16;
    var buffer = new Uint8Array(16);
    CopyMemoryToBuffer(this.ramdev, buffer, addr, 16);

    var desc = marshall.Unmarshall(["d", "w", "h", "h"], buffer, 0);
    //message.Debug("GetDescriptor: index=" + index + " addr=" + utils.ToHex(desc[1]) + " len=" + desc[2] + " flags=" + desc[3]  + " next=" + desc[4]);

    return {
        addr: desc[0],
        len: desc[1],
        flags: desc[2],
        next: desc[3]
    };
}


VirtIODev.prototype.ConsumeDescriptor = function(queueidx, descindex, desclen) {

    // update used index
    var usedidxaddr = this.usedaddr[queueidx] + 2;
    var index = this.ramdev.Read16Little(usedidxaddr);
    this.ramdev.Write16Little(usedidxaddr, index+1 );

    //message.Debug("used index:" + index + " descindex=" + descindex);

    var usedaddr = this.usedaddr[queueidx] + 4 + (index & (this.queuenum[queueidx]-1)) * 8;
    this.ramdev.Write32Little(usedaddr+0, descindex);
    this.ramdev.Write32Little(usedaddr+4, desclen);
}

VirtIODev.prototype.SendReply = function (queueidx, index) {
    //message.Debug("Send Reply index="+index + " size=" + this.dev.replybuffersize);
    this.ConsumeDescriptor(queueidx, index, this.dev.replybuffersize);

    var availflag = this.ramdev.Read16Little(this.availaddr[queueidx]);

    // no data? So skip the rest
    if (this.dev.replybuffersize == 0) {
        // interrupts disabled?
        //if ((availflag&1) == 0) {
            this.intstatus = 1;
            this.intdev.RaiseInterrupt(this.intno);
        //}
        return;
    }

    var desc = this.GetDescriptor(queueidx, index);
    while ((desc.flags & VRING_DESC_F_WRITE) == 0) {
        if (desc.flags & 1) { // continuing buffer
            desc = this.GetDescriptor(queueidx, desc.next);
        } else {
            message.Debug("Error in virtiodev: Descriptor is not continuing");
            message.Abort();
        }
    }
    
    if ((desc.flags & VRING_DESC_F_WRITE) == 0) {
        message.Debug("Error in virtiodev: Descriptor is not allowed to write");
        message.Abort();
    }

    var offset = 0;
    for(var i=0; i<this.dev.replybuffersize; i++) {
        if (offset >= desc.len) {
            desc = this.GetDescriptor(0, desc.next);
            offset = 0;            
            if ((desc.flags & VRING_DESC_F_WRITE) == 0) {
                message.Debug("Error in virtiodev: Descriptor is not allowed to write");
                message.Abort();
            }
        }
        this.ramdev.Write8(desc.addr+offset, this.dev.replybuffer[i]);
        offset++;
    }

    // interrupts disabled?
    //if ((availflag&1) == 0) {
        this.intstatus = 1;
        this.intdev.RaiseInterrupt(this.intno);
    //}
}


VirtIODev.prototype.GetDescriptorBufferSize = function (queueidx, index) {
    
    var wsize = 0x0;
    var rsize = 0x0;

    var desc = this.GetDescriptor(queueidx, index);

    for(;;) {
        if (desc.flags & VRING_DESC_F_INDIRECT) {
            message.Debug("Error in VirtIO: Indirect descriptors not supported");
            message.Abort();
        }
        if (desc.flags & VRING_DESC_F_WRITE) {
            wsize += desc.len;
        } else {
            rsize += desc.len;
        }
        if ((desc.flags&1) == 0) { // continue?
            break;
        }
        var desc = this.GetDescriptor(queueidx, desc.next);
    }

    return {write: wsize, read: rsize};
}


VirtIODev.prototype.WriteReg32 = function (addr, val) {

    if (this.ramdev.nativeendian == "big") {
        val = utils.Swap32(val);
    }

    //message.Debug("VirtIODev: write register of int "  + this.intno + " : " + utils.ToHex(addr) + " = " + val);

    switch(addr)
    {
        case VIRTIO_GUEST_PAGE_SIZE_REG:
            this.pagesize = val;
            this.UpdateAddr();
            //message.Debug("Guest page size : " + utils.ToHex(val));
            break;

        case VIRTIO_HOSTFEATURESSEL_REG:
            this.hostfeaturewordselect = val;
            //message.Debug("write hostfeaturesel reg : " + utils.ToHex(val));
            break;

        case VIRTIO_GUESTFEATURESSEL_REG:
            //message.Debug("write guestfeaturesel reg : " + utils.ToHex(val));
            break;

        case VIRTIO_GUESTFEATURES_REG:
            //message.Debug("write guestfeatures reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUESEL_REG:
            this.queuesel = val;
            //message.Debug("write queuesel reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUENUM_REG:
            this.queuenum[this.queuesel] = val;
            this.UpdateAddr();
            //message.Debug("write queuenum reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUEALIGN_REG:
            //message.Debug("write queuealign reg : " + utils.ToHex(val));
            this.align = val;
            this.pagesize = val;
            this.UpdateAddr();
            break;

        case VIRTIO_QUEUEPFN_REG:
            this.queuepfn[this.queuesel] = val;
            this.UpdateAddr();
            //message.Debug("write queuepfn reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUENOTIFY_REG:
            var queueidx = val;

            var availidx = this.ramdev.Read16Little(this.availaddr[queueidx] + 2);
            //message.Debug("write queuenotify reg : " + utils.ToHex(queueidx) + " " + availidx);
            
            while(this.lastavailidx[queueidx] != availidx)
            {
                var currentavailidx = this.lastavailidx[queueidx] & (this.queuenum[queueidx]-1);
                var currentdescindex = this.ramdev.Read16Little(this.availaddr[val] + 4 + currentavailidx*2);

                //message.Debug("" + queueidx + " " + availidx + " " + currentavailidx + " " + currentdescindex);

                var size = this.GetDescriptorBufferSize(queueidx, currentdescindex);

                // build stream function
                var offset = 0;
                var desc = this.GetDescriptor(queueidx, currentdescindex);

                var GetByte = 
                (function(queueidx, offset, desc) {
                    return function() {
                        if (offset >= desc.len) {
                            offset = 0;
                            if (desc.flags & 1) { // continuing buffer
                                desc = this.GetDescriptor(queueidx, desc.next);
                            } else {
                                message.Debug("Error in virtiodev: Descriptor is not continuing");
                                message.Abort();
                            }
                        }
                        var x = this.ramdev.Read8(desc.addr + offset);
                        offset++;
                        return x;
                    }.bind(this);
                }.bind(this))(queueidx, offset, desc);

                this.dev.ReceiveRequest(queueidx, currentdescindex, GetByte, size);
                this.lastavailidx[queueidx]++;
                this.lastavailidx[queueidx] &= 0xFFFF;
            }

            break;

        case VIRTIO_QUEUE_READY:
            this.queueready[this.queuesel] = val;
            break;


        case VIRTIO_INTERRUPTACK_REG:
            //message.Debug("write interruptack reg : " + utils.ToHex(val));
            this.intstatus &= ~val;
            this.intdev.ClearInterrupt(this.intno);
            break;

        case VIRTIO_STATUS_REG:
            //message.Debug("write status reg : " + utils.ToHex(val));
            this.status = val;
            switch(this.status) {
                case 0: // reset
                    this.intdev.ClearInterrupt(this.intno);
                    this.intstatus = 0;
                    this.Reset();
                    break;
                case 1: // acknowledge (found the device, valid virtio device)
                    break;
                case 3: //acknoledge + driver (driver present)
                    break;
                case 7: // ??
                    break;
                case 11: //acknowledge + driver + features Ok
                    break;
                case 15: //acknowledge + driver + features Ok + driver_ok (Let's start)
                    break;
                case 131: // acknowledge + driver + failed
                    message.Debug("Error: virtio device initialization failed with status " + this.status);
                    message.Abort();
                case 139: // acknowledge + driver + features Ok + failed
                    message.Debug("Error: virtio device initialization failed with status " + this.status);
                    message.Abort();
                    break;
                default:
                    message.Debug("Error in virtio status register: Unknown status " + this.status);
                    message.Abort();
                    break;
            }
            break;

            case VIRTIO_QUEUE_DESC_LOW:
                this.descaddr[this.queuesel] = val;
                break;

            case VIRTIO_QUEUE_DESC_HIGH:
                break;

            case VIRTIO_QUEUE_AVAIL_LOW:
                this.availaddr[this.queuesel] = val;
                this.lastavailidx[this.queuesel] = this.ramdev.Read16Little(this.availaddr[this.queuesel] + 2);
                break;

            case VIRTIO_QUEUE_AVAIL_HIGH:
                break;

            case VIRTIO_QUEUE_USED_LOW:
                this.usedaddr[this.queuesel] = val;
                break;

            case VIRTIO_QUEUE_USED_HIGH:
                break;


        default:
            message.Debug("Error in VirtIODev: Attempt to write register " + utils.ToHex(addr) + ":" + utils.ToHex(val));
            message.Abort();
            break;
    }

};


module.exports = VirtIODev;

},{"../messagehandler":43,"../utils":58,"./virtio/marshall":35}],29:[function(require,module,exports){
// -------------------------------------------------
// --------------------- 9P ------------------------
// -------------------------------------------------
// Implementation of the 9p filesystem device following the 
// 9P2000.L protocol ( https://code.google.com/p/diod/wiki/protocol )

"use strict";

var marshall = require('./marshall');
var message = require('../../messagehandler');
var utils = require('../../utils');

// TODO
// flush
// lock?
// correct hard links

var S_IFDIR = 0x4000;

var EPERM = 1;       /* Operation not permitted */
var ENOENT = 2;      /* No such file or directory */
var EINVAL = 22;     /* Invalid argument */
var ENOTSUPP = 524;  /* Operation is not supported */
var ENOTEMPTY = 39;  /* Directory not empty */
var EPROTO    = 71   /* Protocol error */

var P9_SETATTR_MODE = 0x00000001;
var P9_SETATTR_UID = 0x00000002;
var P9_SETATTR_GID = 0x00000004;
var P9_SETATTR_SIZE = 0x00000008;
var P9_SETATTR_ATIME = 0x00000010;
var P9_SETATTR_MTIME = 0x00000020;
var P9_SETATTR_CTIME = 0x00000040;
var P9_SETATTR_ATIME_SET = 0x00000080;
var P9_SETATTR_MTIME_SET = 0x00000100;

var P9_STAT_MODE_DIR = 0x80000000;
var P9_STAT_MODE_APPEND = 0x40000000;
var P9_STAT_MODE_EXCL = 0x20000000;
var P9_STAT_MODE_MOUNT = 0x10000000;
var P9_STAT_MODE_AUTH = 0x08000000;
var P9_STAT_MODE_TMP = 0x04000000;
var P9_STAT_MODE_SYMLINK = 0x02000000;
var P9_STAT_MODE_LINK = 0x01000000;
var P9_STAT_MODE_DEVICE = 0x00800000;
var P9_STAT_MODE_NAMED_PIPE = 0x00200000;
var P9_STAT_MODE_SOCKET = 0x00100000;
var P9_STAT_MODE_SETUID = 0x00080000;
var P9_STAT_MODE_SETGID = 0x00040000;
var P9_STAT_MODE_SETVTX = 0x00010000;

var FID_NONE = -1;
var FID_INODE = 1;
var FID_XATTR = 2;

// small 9p device
function Virtio9p(ramdev, filesystem) {
    this.fs = filesystem;
    this.SendReply = function() {};
    this.deviceid = 0x9; // 9p filesystem
    this.hostfeature = 0x1; // mountpoint
    this.configspace = [0x9, 0x0, 0x2F, 0x64, 0x65, 0x76, 0x2F, 0x72, 0x6F, 0x6F, 0x74 ]; // length of string and "/dev/root" string
    this.VERSION = "9P2000.L";
    this.BLOCKSIZE = 8192; // Let's define one page.
    this.msize = 8192; // maximum message size
    this.replybuffer = new Uint8Array(this.msize*2); // Twice the msize to stay on the safe site
    this.replybuffersize = 0;
    this.Reset();
}

Virtio9p.prototype.Createfid = function(inode, type, uid) {
	return {inodeid: inode, type: type, uid: uid};
}

Virtio9p.prototype.Reset = function() {
    this.fids = [];
}


Virtio9p.prototype.BuildReply = function(id, tag, payloadsize) {
    marshall.Marshall(["w", "b", "h"], [payloadsize+7, id+1, tag], this.replybuffer, 0);
    if ((payloadsize+7) >= this.replybuffer.length) {
        message.Debug("Error in 9p: payloadsize exceeds maximum length");
    }
    //for(var i=0; i<payload.length; i++)
    //    this.replybuffer[7+i] = payload[i];
    this.replybuffersize = payloadsize+7;
    return;
}

Virtio9p.prototype.SendError = function (tag, errormsg, errorcode) {
    //var size = marshall.Marshall(["s", "w"], [errormsg, errorcode], this.replybuffer, 7);
    var size = marshall.Marshall(["w"], [errorcode], this.replybuffer, 7);
    this.BuildReply(6, tag, size);
}

Virtio9p.prototype.ReceiveRequest = function (ringidx, index, GetByte) {
    var header = marshall.Unmarshall2(["w", "b", "h"], GetByte);
    var size = header[0];
    var id = header[1];
    var tag = header[2];
    //message.Debug("size:" + size + " id:" + id + " tag:" + tag);

    switch(id)
    {
        case 8: // statfs
            var size = this.fs.GetTotalSize();
            var req = [];
            req[0] = 0x01021997;
            req[1] = this.BLOCKSIZE; // optimal transfer block size
            req[2] = Math.floor(1024*1024*1024/req[1]); // free blocks, let's say 1GB
            req[3] = req[2] - Math.floor(size/req[1]); // free blocks in fs
            req[4] = req[2] - Math.floor(size/req[1]); // free blocks avail to non-superuser
            req[5] = this.fs.inodes.length; // total number of inodes
            req[6] = 1024*1024;
            req[7] = 0; // file system id?
            req[8] = 256; // maximum length of filenames

            var size = marshall.Marshall(["w", "w", "d", "d", "d", "d", "d", "d", "w"], req, this.replybuffer, 7);
            this.BuildReply(id, tag, size);
            this.SendReply(0, index);
            break;

        case 112: // topen
        case 12: // tlopen
            var req = marshall.Unmarshall2(["w", "w"], GetByte);
            var fid = req[0];
            var mode = req[1];
            //message.Debug("[open] fid=" + fid + ", mode=" + mode + ", tag=" + tag);
            var idx = this.fids[fid].inodeid;
            var inode = this.fs.GetInode(idx);
            //message.Debug("file open " + inode.name);
            var ret = this.fs.OpenInode(idx, mode);

            var evfunction = 
                (function(idx, id, tag, index){
                    return function() {
                        var inode = this.fs.GetInode(idx);
                        //message.Debug("file opened " + inode.name + " tag:"+tag);
                        req[0] = inode.qid;
                        req[1] = this.msize - 24;
                        marshall.Marshall(["Q", "w"], req, this.replybuffer, 7);
                        this.BuildReply(id, tag, 13+4);
                        this.SendReply(0, index);
                    }.bind(this);
                }.bind(this))(idx, id, tag, index);

            this.fs.AddEvent(idx, evfunction);
            break;

        case 70: // link (just copying)
            var req = marshall.Unmarshall2(["w", "w", "s"], GetByte);
            var dfid = req[0];
            var fid = req[1];
            var name = req[2];
            //message.Debug("[link] dfid=" + dfid + ", name=" + name);
            var inode = this.fs.CreateInode();
            var inodetarget = this.fs.GetInode(this.fids[fid].inodeid);
            //inode = inodetarget;
            inode.mode = inodetarget.mode;
            inode.size = inodetarget.size;
            inode.symlink = inodetarget.symlink;
            inode.data = new Uint8Array(inode.size);
            for(var i=0; i<inode.size; i++) {
                inode.data[i] = this.fs.ReadByte(inodetarget, i);
            }
            inode.name = name;
            inode.parentid = this.fids[dfid].inodeid;
            this.fs.PushInode(inode);
            
            //inode.uid = inodetarget.uid;
            //inode.gid = inodetarget.gid;
            //inode.mode = inodetarget.mode | S_IFLNK;
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);       
            break;

        case 16: // symlink
            var req = marshall.Unmarshall2(["w", "s", "s", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var symgt = req[2];
            var gid = req[3];
            //message.Debug("[symlink] fid=" + fid + ", name=" + name + ", symgt=" + symgt + ", gid=" + gid); 
            var idx = this.fs.CreateSymlink(name, this.fids[fid].inodeid, symgt);
            var inode = this.fs.GetInode(idx);
            inode.uid = this.fids[fid].uid;
            inode.gid = gid;
            marshall.Marshall(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            this.SendReply(0, index);
            break;

        case 18: // mknod
            var req = marshall.Unmarshall2(["w", "s", "w", "w", "w", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var mode = req[2];
            var major = req[3];
            var minor = req[4];
            var gid = req[5];
            //message.Debug("[mknod] fid=" + fid + ", name=" + name + ", major=" + major + ", minor=" + minor+ "");
            var idx = this.fs.CreateNode(name, this.fids[fid].inodeid, major, minor);
            var inode = this.fs.GetInode(idx);
            inode.mode = mode;
            inode.uid = this.fids[fid].uid;
            inode.gid = gid;
            marshall.Marshall(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            this.SendReply(0, index);
            break;


        case 22: // TREADLINK
            var req = marshall.Unmarshall2(["w"], GetByte);
            var fid = req[0];
            //message.Debug("[readlink] fid=" + fid);
            var inode = this.fs.GetInode(this.fids[fid].inodeid);
            var size = marshall.Marshall(["s"], [inode.symlink], this.replybuffer, 7);
            this.BuildReply(id, tag, size);
            this.SendReply(0, index);
            break;


        case 72: // tmkdir
            var req = marshall.Unmarshall2(["w", "s", "w", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var mode = req[2];
            var gid = req[3];
            //message.Debug("[mkdir] fid=" + fid + ", name=" + name + ", mode=" + mode + ", gid=" + gid); 
            var idx = this.fs.CreateDirectory(name, this.fids[fid].inodeid);
            var inode = this.fs.GetInode(idx);
            inode.mode = mode | S_IFDIR;
            inode.uid = this.fids[fid].uid;
            inode.gid = gid;
            marshall.Marshall(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            this.SendReply(0, index);
            break;

        case 14: // tlcreate
            var req = marshall.Unmarshall2(["w", "s", "w", "w", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var flags = req[2];
            var mode = req[3];
            var gid = req[4];
            //message.Debug("[create] fid=" + fid + ", name=" + name + ", flags=" + flags + ", mode=" + mode + ", gid=" + gid); 
            var idx = this.fs.CreateFile(name, this.fids[fid].inodeid);
            this.fids[fid].inodeid = idx;
            this.fids[fid].type = FID_INODE;
            var inode = this.fs.GetInode(idx);
            inode.uid = this.fids[fid].uid;
            inode.gid = gid;
            inode.mode = mode;
            marshall.Marshall(["Q", "w"], [inode.qid, this.msize - 24], this.replybuffer, 7);
            this.BuildReply(id, tag, 13+4);
            this.SendReply(0, index);
            break;

        case 52: // lock always suceed
            //message.Debug("lock file\n");
            marshall.Marshall(["w"], [0], this.replybuffer, 7);
            this.BuildReply(id, tag, 1);
            this.SendReply(0, index);
            break;

        /*
        case 54: // getlock
            break;        
        */

        case 24: // getattr
            var req = marshall.Unmarshall2(["w", "d"], GetByte);
            var fid = req[0];
            var inode = this.fs.GetInode(this.fids[fid].inodeid);
            //message.Debug("[getattr]: fid=" + fid + " name=" + inode.name + " request mask=" + req[1]);
            req[0] |= 0x1000; // P9_STATS_GEN

            req[0] = req[1]; // request mask
            req[1] = inode.qid;

            req[2] = inode.mode; 
            req[3] = inode.uid; // user id
            req[4] = inode.gid; // group id
            
            req[5] = 0x1; // number of hard links
            req[6] = (inode.major<<8) | (inode.minor); // device id low
            req[7] = inode.size; // size low
            req[8] = this.BLOCKSIZE;
            req[9] = Math.floor(inode.size/512+1);; // blk size low
            req[10] = inode.atime; // atime
            req[11] = 0x0;
            req[12] = inode.mtime; // mtime
            req[13] = 0x0;
            req[14] = inode.ctime; // ctime
            req[15] = 0x0;
            req[16] = 0x0; // btime
            req[17] = 0x0; 
            req[18] = 0x0; // st_gen
            req[19] = 0x0; // data_version
            marshall.Marshall([
            "d", "Q", 
            "w",  
            "w", "w", 
            "d", "d", 
            "d", "d", "d",
            "d", "d", // atime
            "d", "d", // mtime
            "d", "d", // ctime
            "d", "d", // btime
            "d", "d",
            ], req, this.replybuffer, 7);
            this.BuildReply(id, tag, 8 + 13 + 4 + 4+ 4 + 8*15);
            this.SendReply(0, index);
            break;

        case 26: // setattr
            var req = marshall.Unmarshall2(["w", "w", 
                "w", // mode 
                "w", "w", // uid, gid
                "d", // size
                "d", "d", // atime
                "d", "d"] // mtime
            , GetByte);
            var fid = req[0];
            var inode = this.fs.GetInode(this.fids[fid].inodeid);
            //message.Debug("[setattr]: fid=" + fid + " request mask=" + req[1] + " name=" +inode.name);
            if (req[1] & P9_SETATTR_MODE) {
                inode.mode = req[2];
            }
            if (req[1] & P9_SETATTR_UID) {
                inode.uid = req[3];
            }
            if (req[1] & P9_SETATTR_GID) {
                inode.gid = req[4];
            }
            if (req[1] & P9_SETATTR_ATIME_SET) {
                inode.atime = req[6];
            }
            if (req[1] & P9_SETATTR_MTIME_SET) {
                inode.atime = req[8];
            }
            if (req[1] & P9_SETATTR_ATIME) {
                inode.atime = Math.floor((new Date()).getTime()/1000);
            }
            if (req[1] & P9_SETATTR_MTIME) {
                inode.mtime = Math.floor((new Date()).getTime()/1000);
            }
            if (req[1] & P9_SETATTR_CTIME) {
                inode.ctime = Math.floor((new Date()).getTime()/1000);
            }
            if (req[1] & P9_SETATTR_SIZE) {
                this.fs.ChangeSize(this.fids[fid].inodeid, req[5]);
            }
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;

        case 50: // fsync
            var req = marshall.Unmarshall2(["w", "d"], GetByte);
            var fid = req[0];
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;

        case 40: // TREADDIR
        case 116: // read
            var req = marshall.Unmarshall2(["w", "d", "w"], GetByte);
            var fid = req[0];
            var offset = req[1];
            var count = req[2];
            //if (id == 40) message.Debug("[treaddir]: fid=" + fid + " offset=" + offset + " count=" + count);
            //if (id == 116) message.Debug("[read]: fid=" + fid + " offset=" + offset + " count=" + count);
            var inode = this.fs.GetInode(this.fids[fid].inodeid);
            if (this.fids[fid].type == FID_XATTR) {
                if (inode.caps.length < offset+count) count = inode.caps.length - offset;
                for(var i=0; i<count; i++)
                    this.replybuffer[7+4+i] = inode.caps[offset+i];
            } else {
                if (inode.size < offset+count) count = inode.size - offset;
                for(var i=0; i<count; i++)
                    this.replybuffer[7+4+i] = this.fs.ReadByte(inode, offset+i);
            }
            marshall.Marshall(["w"], [count], this.replybuffer, 7);
            this.BuildReply(id, tag, 4 + count);
            this.SendReply(0, index);
            break;

        case 118: // write
            var req = marshall.Unmarshall2(["w", "d", "w"], GetByte);
            var fid = req[0];
            var offset = req[1];
            var count = req[2];
            //message.Debug("[write]: fid=" + fid + " offset=" + offset + " count=" + count);
            this.fs.Write(this.fids[fid].inodeid, offset, count, GetByte);
            marshall.Marshall(["w"], [count], this.replybuffer, 7);
            this.BuildReply(id, tag, 4);
            this.SendReply(0, index);
            break;

        case 74: // RENAMEAT
            var req = marshall.Unmarshall2(["w", "s", "w", "s"], GetByte);
            var olddirfid = req[0];
            var oldname = req[1];
            var newdirfid = req[2];
            var newname = req[3];
            //message.Debug("[renameat]: oldname=" + oldname + " newname=" + newname);
            var ret = this.fs.Rename(this.fids[olddirfid].inodeid, oldname, this.fids[newdirfid].inodeid, newname);
            if (ret == false) {
                this.SendError(tag, "No such file or directory", ENOENT);                   
                this.SendReply(0, index);
                break;
            }
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;

        case 76: // TUNLINKAT
            var req = marshall.Unmarshall2(["w", "s", "w"], GetByte);
            var dirfd = req[0];
            var name = req[1];
            var flags = req[2];
            //message.Debug("[unlink]: dirfd=" + dirfd + " name=" + name + " flags=" + flags);
            var id = this.fs.Search(this.fids[dirfd].inodeid, name);
            if (id == -1) {
                   this.SendError(tag, "No such file or directory", ENOENT);
                   this.SendReply(0, index);
                   break;
            }
            var ret = this.fs.Unlink(id);
            if (!ret) {
                this.SendError(tag, "Directory not empty", ENOTEMPTY);
                this.SendReply(0, index);
                break;
            }
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;

        case 100: // version
            var version = marshall.Unmarshall2(["w", "s"], GetByte);
            //message.Debug("[version]: msize=" + version[0] + " version=" + version[1]);
            this.msize = version[0];
            var size = marshall.Marshall(["w", "s"], [this.msize, this.VERSION], this.replybuffer, 7);
            this.BuildReply(id, tag, size);
            this.SendReply(0, index);
            break;

        case 104: // attach
            // return root directorie's QID
            var req = marshall.Unmarshall2(["w", "w", "s", "s", "w"], GetByte);
            var fid = req[0];
            var uid = req[4];
            //message.Debug("[attach]: fid=" + fid + " afid=" + utils.ToHex(req[1]) + " uname=" + req[2] + " aname=" + req[3] + " uid=" + req[4]);
            this.fids[fid] = this.Createfid(0, FID_INODE, uid);
            var inode = this.fs.GetInode(this.fids[fid].inodeid);
            marshall.Marshall(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            this.SendReply(0, index);
            break;

        case 108: // tflush
            var req = marshall.Unmarshall2(["h"], GetByte);
            var oldtag = req[0];
            //message.Debug("[flush] " + tag);
            //marshall.Marshall(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;


        case 110: // walk
            var req = marshall.Unmarshall2(["w", "w", "h"], GetByte);
            var fid = req[0];
            var nwfid = req[1];
            var nwname = req[2];
            //message.Debug("[walk]: fid=" + req[0] + " nwfid=" + req[1] + " nwname=" + nwname);
            if (nwname == 0) {
                this.fids[nwfid] = this.Createfid(this.fids[fid].inodeid, FID_INODE, this.fids[fid].uid);
                this.fids[nwfid].inodeid = this.fids[fid].inodeid;
                marshall.Marshall(["h"], [0], this.replybuffer, 7);
                this.BuildReply(id, tag, 2);
                this.SendReply(0, index);
                break;
            }
            var wnames = [];
            for(var i=0; i<nwname; i++) {
                wnames.push("s");
            }
            var walk = marshall.Unmarshall2(wnames, GetByte);                        
            var idx = this.fids[fid].inodeid;
            var offset = 7+2;
            var nwidx = 0;
            //message.Debug("walk in dir " + this.fs.inodes[idx].name  + " to :" + walk.toString());
            for(var i=0; i<nwname; i++) {
                idx = this.fs.Search(idx, walk[i]);
                
                if (idx == -1) {
                   //message.Debug("Could not find :" + walk[i]);
                   break;
                }
                offset += marshall.Marshall(["Q"], [this.fs.inodes[idx].qid], this.replybuffer, offset);
                nwidx++;
                //message.Debug(this.fids[nwfid].inodeid);
                this.fids[nwfid] = this.Createfid(idx, FID_INODE, this.fids[fid].uid);
            }
            marshall.Marshall(["h"], [nwidx], this.replybuffer, 7);
            this.BuildReply(id, tag, offset-7);
            this.SendReply(0, index);
            break;

        case 120: // clunk
            var req = marshall.Unmarshall2(["w"], GetByte);
            //message.Debug("[clunk]: fid=" + req[0]);
            
            if (this.fids[req[0]]) 
            if (this.fids[req[0]].inodeid >=  0) {
                this.fs.CloseInode(this.fids[req[0]].inodeid);
                this.fids[req[0]].inodeid = -1;
                this.fids[req[0]].type = FID_NONE;
            }
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;

        case 30: // xattrwalk
            var req = marshall.Unmarshall2(["w", "w", "s"], GetByte);
            var fid = req[0];
            var newfid = req[1];
            var name = req[2];
            //message.Debug("[xattrwalk]: fid=" + req[0] + " newfid=" + req[1] + " name=" + req[2]);
            this.fids[newfid] = this.Createfid(this.fids[fid].inodeid, FID_NONE, this.fids[fid].uid);
            var length = 0;
            if (name == "security.capability") {
                length = this.fs.PrepareCAPs(this.fids[fid].inodeid);
                this.fids[newfid].type = FID_XATTR;
            }
            marshall.Marshall(["d"], [length], this.replybuffer, 7);
            this.BuildReply(id, tag, 8);
            this.SendReply(0, index);
            break; 

        default:
            message.Debug("Error in Virtio9p: Unknown id " + id + " received");
            message.Abort();
            //this.SendError(tag, "Operation i not supported",  ENOTSUPP);
            //this.SendReply(0, index);
            break;
    }

    //consistency checks if there are problems with the filesystem
    //this.fs.Check();
}


module.exports = Virtio9p;

},{"../../messagehandler":43,"../../utils":58,"./marshall":35}],30:[function(require,module,exports){
// -------------------------------------------------
// ------------- Block Virtio Device ---------------
// -------------------------------------------------

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_BLK_T_IN          = 0;
var VIRTIO_BLK_T_OUT         = 1;
var VIRTIO_BLK_T_FLUSH       = 4;
var VIRTIO_BLK_T_FLUSH_OUT   = 5;

var VIRTIO_BLK_S_OK        = 0; 
var VIRTIO_BLK_S_IOERR     = 1;
var VIRTIO_BLK_S_UNSUPP    = 2;

function VirtioBlock(ramdev) {
    this.blocks = 100;
    this.configspace = [
        (this.blocks >> 0)&0xFF,
        (this.blocks >> 8)&0xFF,
        (this.blocks >> 16)&0xFF,
        0x0, 0x0, 0x0, 0x0, 0x0]; // the size in little endian

    this.deviceid = 0x2;
    this.hostfeature = 0x0;
    this.replybuffer = new Uint8Array(0x10000); // there is no size limit
    this.replybuffersize = 0;
    this.buffer = new Uint8Array(this.blocks*512);
    this.Reset();
}

VirtioBlock.prototype.Reset = function() {
}

VirtioBlock.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    //message.Debug("block device request: " + queueidx + " " + index + " " + size.read + " " + size.write);
    var request  = marshall.Unmarshall2(["w", "w", "d"], GetByte);
    var type = request[0];
    var sector = request[2];
    //message.Debug("type: " + type + " sector: " + sector);

    switch(type) {
        case VIRTIO_BLK_T_IN:
            if (size.write > 0x10000) {
                message.Debug("Error in virtioblock: replybuffer too small");
                message.Abort();
            }
            for(var i=0; i<size.write-1; i++) {
                this.replybuffer[i] = this.buffer[sector*512+i];
            }
            this.replybuffersize = size.write;
            this.replybuffer[size.write-1] = VIRTIO_BLK_S_OK;
            this.SendReply(0, index);
            break;

        case VIRTIO_BLK_T_OUT:
            for(var i=0; i<size.read-16; i++) {
                this.buffer[sector*512+i] = GetByte();
            }
            this.replybuffersize = 1;
            this.replybuffer[0] = VIRTIO_BLK_S_OK;
            this.SendReply(0, index);
            break;

        case VIRTIO_BLK_T_FLUSH:
            break;

        case VIRTIO_BLK_T_FLUSH_OUT:
            break;
        
        default:
            message.Debug("Error in VirtioBlock: Unknown request type " + type);
            message.Abort();
            break;
    }

}

module.exports = VirtioBlock;

},{"../../messagehandler":43,"../../utils":58,"./marshall":35}],31:[function(require,module,exports){
// -------------------------------------------------
// ------------ Console Virtio Device --------------
// -------------------------------------------------
// http://docs.oasis-open.org/virtio/virtio/v1.0/csprd01/virtio-v1.0-csprd01.html#x1-1230003

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_CONSOLE_DEVICE_READY     = 0;
var VIRTIO_CONSOLE_PORT_ADD         = 1;
var VIRTIO_CONSOLE_PORT_REMOVE      = 2;
var VIRTIO_CONSOLE_PORT_READY       = 3;
var VIRTIO_CONSOLE_CONSOLE_PORT     = 4;
var VIRTIO_CONSOLE_RESIZE           = 5;
var VIRTIO_CONSOLE_PORT_OPEN        = 6;
var VIRTIO_CONSOLE_PORT_NAME        = 7;

function VirtioConsole(ramdev) {
    this.configspace = [80, 0, 24, 0, 1, 0, 0, 0]; // cols, rows, max_nr_ports
    this.deviceid = 0x3;
    this.hostfeature = 0x0;
    //this.hostfeature = 3; // VIRTIO_CONSOLE_F_MULTIPORT and VIRTIO_CONSOLE_F_SIZE
    //this.hostfeature = 2; // VIRTIO_CONSOLE_F_MULTIPORT

    this.replybuffersize = 0;
    this.replybuffer = new Uint8Array(8);

    //message.Register("virtio.tty" + id + ".transfer", this.ReceiveChar.bind(this) );

    this.Reset();
}

VirtioConsole.prototype.Receive = function(chars) {

}

VirtioConsole.prototype.Reset = function() {
}

VirtioConsole.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    message.Debug("Virtio console request of ringbuffer " + queueidx + " " + index + " " + size.read + " " + size.write)

    if (queueidx == 1) {
        var s = "";
        for(var i=0; i<size.read; i++)
        {
            s = s + String.fromCharCode(GetByte());
        }
        message.Debug("Write: " + s);
        this.replybuffersize = 0;
        this.SendReply(queueidx, index);
    }

    if (queueidx == 0) {


    }

    if (queueidx == 3) {
    var request = marshall.Unmarshall2(["w", "h", "h"], GetByte);
    var id = request[0]; /* Port number */
    var event = request[1]; /* The kind of control event */
    var value = request[2]; /* Extra information for the event */

    message.Debug("virtio console: " + id + " " + event + " " + value);
    switch(event) {
        case VIRTIO_CONSOLE_DEVICE_READY:
            this.replybuffersize = 0;
            this.SendReply(queueidx, index);
            break;
        default:
            message.Debug("Error in virtio console: Unknown event");
            message.Abort();
            break;
    }

    }


}

module.exports = VirtioConsole;

},{"../../messagehandler":43,"../../utils":58,"./marshall":35}],32:[function(require,module,exports){
// -------------------------------------------------
// ------------- Dummy Virtio Device ---------------
// -------------------------------------------------

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');

function VirtioDummy(ramdev) {
    this.configspace = [0x0];
    this.deviceid = 0x0;
    this.hostfeature = 0x0;
    this.Reset();
}

VirtioDummy.prototype.Reset = function() {
}

VirtioDummy.prototype.ReceiveRequest = function (index, GetByte) {
}

module.exports = VirtioDummy;

},{"../../messagehandler":43,"../../utils":58}],33:[function(require,module,exports){
// -------------------------------------------------
// -------------- GPU Virtio Device ----------------
// -------------------------------------------------
//https://github.com/qemu/qemu/blob/master/hw/display/virtio-gpu.c
//https://www.kraxel.org/cgit/linux/commit/?h=virtio-gpu&id=1a9b48b35ab5961488a401276c7c574f7f90763f
//https://www.kraxel.org/blog/
//https://www.kraxel.org/virtio/virtio-v1.0-csprd03-virtio-gpu.html

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_GPU_UNDEFINED = 0;

/* 2d commands */
var VIRTIO_GPU_CMD_GET_DISPLAY_INFO = 0x0100;
var VIRTIO_GPU_CMD_RESOURCE_CREATE_2D = 0x0101;
var VIRTIO_GPU_CMD_RESOURCE_UNREF = 0x0102;
var VIRTIO_GPU_CMD_SET_SCANOUT = 0x0103;
var VIRTIO_GPU_CMD_RESOURCE_FLUSH = 0x0104;
var VIRTIO_GPU_CMD_TRANSFER_TO_HOST_2D = 0x0105;
var VIRTIO_GPU_CMD_RESOURCE_ATTACH_BACKING = 0x0106;
var VIRTIO_GPU_CMD_RESOURCE_DETACH_BACKING = 0x0107;

/* cursor commands */
var VIRTIO_GPU_CMD_UPDATE_CURSOR = 0x0300;
var VIRTIO_GPU_CMD_MOVE_CURSOR = 0x0301;

/* success responses */
var VIRTIO_GPU_RESP_OK_NODATA = 0x1100;
var VIRTIO_GPU_RESP_OK_DISPLAY_INFO = 0x1101;

/* error responses */
var VIRTIO_GPU_RESP_ERR_UNSPEC = 0x1200;
var VIRTIO_GPU_RESP_ERR_OUT_OF_MEMORY = 0x1201;
var VIRTIO_GPU_RESP_ERR_INVALID_SCANOUT_ID = 0x1202;
var VIRTIO_GPU_RESP_ERR_INVALID_RESOURCE_ID = 0x1203;
var VIRTIO_GPU_RESP_ERR_INVALID_CONTEXT_ID = 0x1204;
var VIRTIO_GPU_RESP_ERR_INVALID_PARAMETER = 0x1205;


var VIRTIO_GPU_EVENT_DISPLAY  = (1 << 0);
/*
struct virtio_gpu_config {
	__u32 events_read;
	__u32 events_clear;
	__u32 num_scanouts;
	__u32 reserved;
};
*/

function VirtioGPU(ramdev) {
    // virtio_gpu_config
    this.configspace = [
    0x0, 0x0, 0x0, 0x0, // events_read: signals pending events to the driver. The driver MUST NOT write to this field. 
    0x0, 0x0, 0x0, 0x0, // events_clear: clears pending events in the device. Writing a ’1’ into a bit will clear the corresponding bit in events_read, mimicking write-to-clear behavior.
    0x1, 0x0, 0x0, 0x0, // num_scanouts maximum 16
    0x0, 0x0, 0x0, 0x0, // reserved
    ];

    this.deviceid = 16;
    this.hostfeature = 0x0;

    this.replybuffersize = 0;
    this.replybuffer = new Uint8Array(1024);

    this.Reset();
}

VirtioGPU.prototype.Reset = function() {
    this.resource = new Array();
}

VirtioGPU.prototype.ReplyOk = function(index) {
    marshall.Marshall(["w", "w", "d", "w", "w"], [VIRTIO_GPU_RESP_OK_NODATA, 0,0,0,0], this.replybuffer, 0);
    this.replybuffersize = 24;
    this.SendReply(0, index);
}


VirtioGPU.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    message.Debug("");
    message.Debug("Virtio GPU request of ringbuffer " + queueidx + " " + index + " " + size.read + " " + size.write);

    if (queueidx != 0) {
        message.Debug("Error in virtio gpu: queue no. " + queueidx + " unknown");
        message.Abort();
    }
    
    // virtio_gpu_ctrl_hdr
    var request = marshall.Unmarshall2(["w", "w", "d", "w", "w"], GetByte);
    var type = request[0];
    var ctx_id = request[3]; // not used in 2D mode
    message.Debug(
    "type: " + type + 
    " flags: " + request[1] + 
    " fence: " + request[2] + 
    " ctx_id: " + ctx_id );


    switch(request[0]) {

// --------------------------

        case VIRTIO_GPU_CMD_GET_DISPLAY_INFO:
            // struct virtio_gpu_resp_display_info
            marshall.Marshall(["w", "w", "d", "w", "w"], [VIRTIO_GPU_RESP_OK_DISPLAY_INFO, 0,0,0,0], this.replybuffer, 0);
            for(var i=0; i<24+16*24; i++) {
                this.replybuffersize[i] = 0x0;
            }
            // one display connected with 1024x768 enabled=1
            marshall.Marshall(["w", "w", "w", "w", "w", "w"], [0, 0, 1024, 768, 1, 0], this.replybuffer, 24);
            message.Debug("get display info");
            this.replybuffersize = 24 + 16*(16+8);
            this.SendReply(queueidx, index);
            break;

// --------------------------

        case VIRTIO_GPU_CMD_RESOURCE_CREATE_2D:
            // struct virtio_gpu_resource_create_2d
            var request = marshall.Unmarshall2(["w", "w", "w", "w"], GetByte);
            var resource_id = request[0];
            var width = request[2];
            var height = request[3];
            var format = request[1];
            if (resource_id == 0) {
                message.Debug("Error in virtio gpu: resource_id is 0");
            }
            this.resource[resource_id] = {
                valid: true, 
                width:width, 
                height:height, 
                format:format, 
                addr:0x0, 
                length: 0x0,
                scanout_id: -1};
            message.Debug("create 2d: " + width  + "x" + height + " format: " + format + " resource_id: " + request[0]);
            this.ReplyOk(index);
            break;

        case VIRTIO_GPU_CMD_RESOURCE_UNREF:
            // struct virtio_gpu_resource_unref
            var request = marshall.Unmarshall2(["w"], GetByte);
            var resource_id = request[0];
            
            this.resource[resource_id].valid = false;
            message.Debug("resource unref: resource_id: " + request[0]);
            this.ReplyOk(index);
            break;

// --------------------------

        case VIRTIO_GPU_CMD_RESOURCE_ATTACH_BACKING:
            // struct virtio_gpu_resource_attach_backing
            var request = marshall.Unmarshall2(["w", "w"], GetByte);
            var nr_entries = request[1];
            var resource_id = request[0];
            message.Debug("attach backing: resource_id: " + resource_id + " nr_entries:" + request[1] );
            for(var i=0; i<nr_entries; i++) {
                // struct virtio_gpu_mem_entry
                var request = marshall.Unmarshall2(["d", "w", "w"], GetByte);
                message.Debug("attach backing: addr:" + utils.ToHex(request[0]) + " length: " + request[1]);
                this.resource[resource_id].addr = request[0];
                this.resource[resource_id].length = request[1];
            }
            this.ReplyOk(index);
            break;

        case VIRTIO_GPU_CMD_RESOURCE_DETACH_BACKING:
            // struct virtio_gpu_resource_detach_backing
            var request = marshall.Unmarshall2(["w"], GetByte);
            var resource_id = request[0];
            message.Debug("detach backing: resource_id: " + resource_id);
            this.resource[resource_id].addr = 0x0;
            this.resource[resource_id].length = 0x0;
            this.ReplyOk(index);
            break;

// --------------------------

        case VIRTIO_GPU_CMD_SET_SCANOUT:
            var request = marshall.Unmarshall2(["w", "w", "w", "w", "w", "w"], GetByte);
            var x = request[0];
            var y = request[1];
            var width = request[2];
            var height = request[3];
            var scanout_id = request[4];
            var resource_id = request[5];
            message.Debug("set scanout: x: " + x + " y: " + y + " width: " + width + " height: " + height + " scanout_id: " + scanout_id + " resource_id: " + resource_id);
            if (resource_id != 0)
                this.resource[resource_id].scanout_id = scanout_id;
            this.ReplyOk(index);
            break;

        default:
            message.Debug("Error in virtio gpu: Unknown type " + type);
            message.Abort();
        break;
    }


}

module.exports = VirtioGPU;

},{"../../messagehandler":43,"../../utils":58,"./marshall":35}],34:[function(require,module,exports){
// -------------------------------------------------
// ------------- Input Virtio Device ---------------
// -------------------------------------------------
// https://github.com/torvalds/linux/blob/master/include/uapi/linux/virtio_input.h
// https://github.com/torvalds/linux/blob/master/drivers/virtio/virtio_input.c

// https://lwn.net/Articles/637590/
// http://lxr.free-electrons.com/source/include/uapi/linux/input.h

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_INPUT_CFG_UNSET      = 0x00; 
var VIRTIO_INPUT_CFG_ID_NAME    = 0x01;  
var VIRTIO_INPUT_CFG_ID_SERIAL  = 0x02;  
var VIRTIO_INPUT_CFG_ID_DEVIDS  = 0x03;
var VIRTIO_INPUT_CFG_PROP_BITS  = 0x10;
var VIRTIO_INPUT_CFG_EV_BITS    = 0x11;  
var VIRTIO_INPUT_CFG_ABS_INFO   = 0x12;

var EV_SYN                = 0x00;
var EV_KEY                = 0x01;
var EV_REL                = 0x02;
var EV_ABS                = 0x03;
var EV_MSC                = 0x04;
var EV_SW                 = 0x05;
var EV_LED                = 0x11;
var EV_SND                = 0x12;
var EV_REP                = 0x14;
var EV_FF                 = 0x15;
var EV_PWR                = 0x16;
var EV_FF_STATUS          = 0x17;
var EV_MAX                = 0x1f;
var EV_CNT                = (EV_MAX+1);

function VirtioInput(ramdev) {
    this.configspace = new Uint8Array(256);
    this.deviceid = 18;
    this.hostfeature = 0x0;

    // TODO remove old keyboard driver
    message.Register("virtio.kbd.keydown", this.OnKeyDown.bind(this) );
    message.Register("virtio.kbd.keyup", this.OnKeyUp.bind(this) );
    
    this.replybuffersize = 8;
    this.replybuffer = new Uint8Array(8);

    this.Reset();
}

VirtioInput.prototype.Reset = function() {
    this.receivebufferdesc = new Array();
}


VirtioInput.prototype.OnKeyDown = function(event) {
    if (this.receivebufferdesc.length == 0) return;
    var desc = this.receivebufferdesc[0];
    this.receivebufferdesc.shift();
    this.replybuffersize = 8;
    // type, code and value
    marshall.Marshall(["h", "h", "w"], [EV_KEY, event.keyCode, 1], this.replybuffer, 0);
    this.SendReply(0, desc.idx);

}

VirtioInput.prototype.OnKeyUp = function(event) {
    if (this.receivebufferdesc.length == 0) return;
    var desc = this.receivebufferdesc[0];
    this.receivebufferdesc.shift();
    this.replybuffersize = 8;
    // type, code and value
    marshall.Marshall(["h", "h", "w"], [EV_KEY, event.keyCode, 0], this.replybuffer, 0);
    this.SendReply(0, desc.idx);
}


VirtioInput.prototype.WriteConfig = function (addr, val) {
    this.configspace[addr] = val;
    if (addr != 1) return;
    //message.Debug("virtioinput configtype: " + this.configspace[0x0] + " " + this.configspace[0x1]);
    
    switch(this.configspace[0x0]) {
        case VIRTIO_INPUT_CFG_UNSET:
            break;

        case VIRTIO_INPUT_CFG_ID_NAME:
            this.configspace[2] = 5; // size
            this.configspace[8] = 0x56; // "V"
            this.configspace[9] = 0x4B; // "K"
            this.configspace[10] = 0x42; // "B"
            this.configspace[11] = 0x44; // "D"
            this.configspace[12] = 0;
            break;

        case VIRTIO_INPUT_CFG_ID_SERIAL:
            this.configspace[2] = 0; // size
            this.configspace[8] = 0;
            break;

        case VIRTIO_INPUT_CFG_ID_DEVIDS:
            this.configspace[2] = 0; // size
            break;

        case VIRTIO_INPUT_CFG_PROP_BITS:
            this.configspace[2] = 0;
            break;

        case VIRTIO_INPUT_CFG_EV_BITS:
            switch(this.configspace[1]) {
                case EV_REP:
                    this.configspace[2] = 0;
                    break;

                case EV_KEY:
                    this.configspace[2] = 128/8;
                    this.configspace[8] = 0xFF;
                    this.configspace[9] = 0xFF;
                    this.configspace[10] = 0xFF;
                    this.configspace[11] = 0xFF;
                    this.configspace[12] = 0xFF;
                    this.configspace[13] = 0xFF;
                    this.configspace[14] = 0xFF;
                    this.configspace[15] = 0xFF;
                    this.configspace[16] = 0xFF;
                    this.configspace[17] = 0xFF;
                    this.configspace[18] = 0xFF;
                    this.configspace[19] = 0xFF;
                    this.configspace[20] = 0xFF;
                    this.configspace[21] = 0xFF;
                    this.configspace[22] = 0xFF;
                    this.configspace[22] = 0xFF;
                    break;

                default:
                    this.configspace[2] = 0;
                    break;
            }
            break;

        case VIRTIO_INPUT_CFG_ABS_INFO:
            this.configspace[2] = 0;
            message.Debug("Virtioinput: abs_info not implemented");
            message.Abort();
            break;

        default:
            message.Debug("Error in virtio input: Unknown config");
            message.Abort();
        break;
    }

}

VirtioInput.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    message.Debug("Virtio input request " + queueidx + " " + index + " " + size.read + " " + size.write);

    if (queueidx >= 1) {
        message.Debug("Error in Virtio input: Unsupported queue index");
        message.Abort();
    }

    if (queueidx == 0) {
        // for some reason, some descriptors are sent multiple times. So check and return.
        for(var i=0; i<this.receivebufferdesc.length; i++) {
            if (this.receivebufferdesc[i].idx == index) {
                return;
            }
        }
        this.receivebufferdesc.push({idx: index, size: size});
        return;
    }

}

module.exports = VirtioInput;

},{"../../messagehandler":43,"../../utils":58,"./marshall":35}],35:[function(require,module,exports){
// -------------------------------------------------
// ------------------ Marshall ---------------------
// -------------------------------------------------
// helper functions for virtio and 9p.

var UTF8 = require('../../../lib/utf8');
var message = require('../../messagehandler');

// Inserts data from an array to a byte aligned struct in memory
function Marshall(typelist, input, struct, offset) {
    var item;
    var size = 0;
    for (var i=0; i < typelist.length; i++) {
        item = input[i];
        switch (typelist[i]) {
            case "w":
                struct[offset++] = item & 0xFF;
                struct[offset++] = (item >> 8) & 0xFF;
                struct[offset++] = (item >> 16) & 0xFF;
                struct[offset++] = (item >> 24) & 0xFF;
                size += 4;
                break;
            case "d": // double word
                struct[offset++] = item & 0xFF;
                struct[offset++] = (item >> 8) & 0xFF;
                struct[offset++] = (item >> 16) & 0xFF;
                struct[offset++] = (item >> 24) & 0xFF;
                struct[offset++] = 0x0;
                struct[offset++] = 0x0;
                struct[offset++] = 0x0;
                struct[offset++] = 0x0;
                size += 8;
                break;
            case "h":
                struct[offset++] = item & 0xFF;
                struct[offset++] = item >> 8;
                size += 2;
                break;
            case "b":
                struct[offset++] = item;
                size += 1;
                break;
            case "s":
                var lengthoffset = offset;
                var length = 0;
                struct[offset++] = 0; // set the length later
                struct[offset++] = 0;
                size += 2;
                for (var j in item) {
                    var utf8 = UTF8.UnicodeToUTF8Stream(item.charCodeAt(j));
                    utf8.forEach( function(c) {
                        struct[offset++] = c;
                        size += 1;
                        length++;
                    });
                }
                struct[lengthoffset+0] = length & 0xFF;
                struct[lengthoffset+1] = (length >> 8) & 0xFF;
                break;
            case "Q":
                Marshall(["b", "w", "d"], [item.type, item.version, item.path], struct, offset)
                offset += 13;
                size += 13;
                break;
            default:
                message.Debug("Marshall: Unknown type=" + type[i]);
                break;
        }
    }
    return size;
};


// Extracts data from a byte aligned struct in memory to an array
function Unmarshall(typelist, struct, offset) {
    var output = [];
    for (var i=0; i < typelist.length; i++) {
        switch (typelist[i]) {
            case "w":
                var val = struct[offset++];
                val += struct[offset++] << 8;
                val += struct[offset++] << 16;
                val += (struct[offset++] << 24) >>> 0;
                output.push(val);
                break;
            case "d":
                var val = struct[offset++];
                val += struct[offset++] << 8;
                val += struct[offset++] << 16;
                val += (struct[offset++] << 24) >>> 0;
                offset += 4;
                output.push(val);
                break;
            case "h":
                var val = struct[offset++];
                output.push(val + (struct[offset++] << 8));
                break;
            case "b":
                output.push(struct[offset++]);
                break;
            case "s":
                var len = struct[offset++];
                len += struct[offset++] << 8;
                var str = '';
                var utf8converter = new UTF8.UTF8StreamToUnicode();
                for (var j=0; j < len; j++) {
                    var c = utf8converter.Put(struct[offset++])
                    if (c == -1) continue;
                    str += String.fromCharCode(c);
                }
                output.push(str);
                break;
            default:
                message.Debug("Error in Unmarshall: Unknown type=" + typelist[i]);
                break;
        }
    }
    return output;
};


// Extracts data from a byte aligned struct in memory to an array
function Unmarshall2(typelist, GetByte) {
    var output = [];
    for (var i=0; i < typelist.length; i++) {
        switch (typelist[i]) {
            case "w":
                var val = GetByte();
                val += GetByte() << 8;
                val += GetByte() << 16;
                val += (GetByte() << 24) >>> 0;
                output.push(val);
                break;
            case "d":
                var val = GetByte();
                val += GetByte() << 8;
                val += GetByte() << 16;
                val += (GetByte() << 24) >>> 0;
                GetByte();GetByte();GetByte();GetByte();
                output.push(val);
                break;
            case "h":
                var val = GetByte();
                output.push(val + (GetByte() << 8));
                break;
            case "b":
                output.push(GetByte());
                break;
            case "s":
                var len = GetByte();
                len += GetByte() << 8;
                var str = '';
                var utf8converter = new UTF8.UTF8StreamToUnicode();
                for (var j=0; j < len; j++) {
                    var c = utf8converter.Put(GetByte())
                    if (c == -1) continue;
                    str += String.fromCharCode(c);
                }
                output.push(str);
                break;
            default:
                message.Debug("Error in Unmarshall2: Unknown type=" + typelist[i]);
                break;
        }
    }
    return output;
};


module.exports.Marshall = Marshall;
module.exports.Unmarshall = Unmarshall;
module.exports.Unmarshall2 = Unmarshall2;

},{"../../../lib/utf8":16,"../../messagehandler":43}],36:[function(require,module,exports){
// -------------------------------------------------
// ------------ Network Virtio Device --------------
// -------------------------------------------------

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

function VirtioNET(ramdev) {
    this.configspace = [0x00, 0x0, 0x0, 0x0, 0x0, 0x0]; // mac address
    this.deviceid = 1;
    this.hostfeature = (1<<5); // Device has given MAC address

    this.replybuffer = new Uint8Array(65550); // the maximum size of a TCP or UDP packet, plus the 14 byte ethernet header
    this.replybuffersize = 0;

    // TODO: not all networks addresses are valid
    for(var i=1; i<6; i++) {
        this.configspace[i] = Math.floor(Math.random()*256);
    }

    message.Register("virtio.net.transfer", this.Receive.bind(this) );

    this.Reset();
}

VirtioNET.prototype.Reset = function() {
    this.receivebufferdesc = new Array();
    this.receivebuffer = new Array();
}


VirtioNET.prototype.Receive = function(buffer) {
    //message.Debug("Received packet of size " + buffer.byteLength);
    this.receivebuffer.push(buffer);
    this.HandleReceive();
}

VirtioNET.prototype.HandleReceive = function() {

    if (this.receivebuffer.length == 0) {
        return;
    }

    if (this.receivebufferdesc.length == 0) {
        return;
    }

    var buffer = new Uint8Array(this.receivebuffer[0]);
    var desc = this.receivebufferdesc[0];

    if (buffer.length > desc.size.write) {
        message.Debug("Error in VirtioNET: Received packet is larger than the next receive buffer");
        message.Abort();
    }
    
    this.receivebuffer.shift();
    this.receivebufferdesc.shift();

    // both buffers are valid so copy

    this.replybuffersize = buffer.length + 12;
    marshall.Marshall(["b", "b", "h", "h", "h", "h", "h"], [0, 0, 0, 0, 0, 0, 0], this.replybuffer, 0);
    for(var i=0; i<buffer.length; i++) {
        this.replybuffer[i+12] = buffer[i];
    }
    //this.replybuffersize = desc.size.write;

    //message.Debug("Send packet of size " + buffer.length + " and idx " + desc.idx);
    this.SendReply(0, desc.idx);
}


VirtioNET.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    //message.Debug("Virtio network request of ringbuffer " + queueidx + " " + index + " " + size.read + " " + size.write);

    if (queueidx > 1) {
        message.Debug("Error in VirtioNET: Unsupported ringbuffer");
        message.Abort();
    }

    if (queueidx == 0) {
        // for some reason, some descriptors are sent multiple times. So check and return. 
        for(var i=0; i<this.receivebufferdesc.length; i++) {
            if (this.receivebufferdesc[i].idx == index) {
                return;
            }
        }
        this.receivebufferdesc.push({idx: index, size: size});
        this.HandleReceive();
        return;
    }

    var hdr = marshall.Unmarshall2(["b", "b", "h", "h", "h", "h", "h"], GetByte);
    //message.Debug(hdr);
    var frame = new Uint8Array(size.read - 12);
    for(var i=0; i<size.read-12; i++) {
        frame[i] = GetByte();
    }
    message.Send("ethmac", frame.buffer);

    this.replybuffersize = 0;
    this.SendReply(queueidx, index);
}

module.exports = VirtioNET;

},{"../../messagehandler":43,"../../utils":58,"./marshall":35}],37:[function(require,module,exports){
var message = require('./messagehandler');
var utils = require('./utils');
var marshall = require('./dev/virtio/marshall');

var elf = {};

elf.IsELF = function(buffer) {
    if ((buffer[0] == 0x7F) && 
        (buffer[1] == 0x45) && 
        (buffer[2] == 0x4C) && 
        (buffer[3] == 0x46)) 
        return true;

    return false;
}
    
elf.Extract = function(srcbuffer, destbuffer) {

    var offset = 0;
    var output = [];
    output = marshall.Unmarshall(["w", "b", "b", "b", "b"], srcbuffer, offset);
    var ei_class = output[1];
    if (ei_class != 1) {
        message.Debug("Error reading elf binary: 64-Bit not supported");
        message.Abort();
    }

/*
    output[0] // magic
    output[1] // ei_class  1 -> 32 bit, 2 -> 64 bit
    output[2] // ei_data    1 little end, 2 big end
    output[3] // ei_version  currently always 1
    output[4] // ei_pad      marks beginning of padding
*/

    offset = 0x10;
    output = marshall.Unmarshall(["h", "h", "w", "w", "w", "w"], srcbuffer, offset);
    var e_entry = output[3]; // virtual address of entry point into program
    var e_phoff = output[4]; // offset for program header
    var e_shoff = output[5]; // offset for section header
    //message.Debug("e_entry: " +  utils.ToHex(e_entry));
    //message.Debug("e_phoff: " +  utils.ToHex(e_phoff));
    //message.Debug("e_shoff: " +  utils.ToHex(e_shoff));

    offset = 0x2E;
    output = marshall.Unmarshall(["h", "h", "h"], srcbuffer, offset);
    var e_shentsize = output[0]; // size of each individual entry in section header table
    var e_shnum = output[1]; // number of entries in section header table
    var e_shstrndx = output[2]; // section header string table index
    //message.Debug("e_shentsize: " +  utils.ToHex(e_shnum));
    //message.Debug("e_shnum: " +  utils.ToHex(e_shnum));
    //message.Debug("e_shstrndx: " +  utils.ToHex(e_shstrndx));

    var section_headers = [];

    for (var i = 0; i < e_shnum; i++) {

        offset = e_shoff + i*e_shentsize;
        output = marshall.Unmarshall(["w", "w", "w", "w", "w", "w"], srcbuffer, offset);

        var section = {};
        section.name = output[0];
        section.type = output[1];
        section.flags = output[2];
        section.addr = output[3];
        section.offs = output[4];
        section.size = output[5];
        /*
        message.Debug("" +
		section.name + " " + 
		utils.ToHex(section.addr) + " " + 
		utils.ToHex(section.size));
        */
        section_headers.push(section);
    }

    // copy necessary data into memory
    for (var i = 0; i < section_headers.length; i++) {

        // check for allocate flag (bit #1) and type != 8 (aka NOT NOBITS)
        if ((((section_headers[i].flags >> 1) & 0x1) == 0x1) && (section_headers[i].type != 8)) {
            for (var j = 0; j < section_headers[i].size; j++) {
                destbuffer[section_headers[i].addr + j] = srcbuffer[section_headers[i].offs + j];
            }
        } else 
        if ((((section_headers[i].flags >> 1) & 0x1) == 0x1) && (section_headers.type == 8)) {
            // for .bss, load in zeroes, since it's not actually stored in the elf
            for (var j = 0; j < section_headers[i].size; j++) {
                destbuffer[section_headers[i].addr + j] = 0x0;
            }
        }
    }
}

module.exports = elf;

},{"./dev/virtio/marshall":35,"./messagehandler":43,"./utils":58}],38:[function(require,module,exports){
// -------------------------------------------------
// ----------------- FILESYSTEM---------------------
// -------------------------------------------------
// Implementation of a unix filesystem in memory.

"use strict";

var TAR = require('./tar');
var FSLoader = require('./fsloader');
var utils = require('../utils');
var bzip2 = require('../bzip2');
var marshall = require('../dev/virtio/marshall');
var UTF8 = require('../../lib/utf8');
var message = require('../messagehandler');
var LazyUint8Array = require("./lazyUint8Array");

var S_IRWXUGO = 0x1FF;
var S_IFMT = 0xF000;
var S_IFSOCK = 0xC000;
var S_IFLNK = 0xA000;
var S_IFREG = 0x8000;
var S_IFBLK = 0x6000;
var S_IFDIR = 0x4000;
var S_IFCHR = 0x2000;

//var S_IFIFO  0010000
//var S_ISUID  0004000
//var S_ISGID  0002000
//var S_ISVTX  0001000

var O_RDONLY = 0x0000; // open for reading only 
var O_WRONLY = 0x0001; // open for writing only
var O_RDWR = 0x0002; // open for reading and writing
var O_ACCMODE = 0x0003; // mask for above modes

var STATUS_INVALID = -0x1;
var STATUS_OK = 0x0;
var STATUS_OPEN = 0x1;
var STATUS_ON_SERVER = 0x2;
var STATUS_LOADING = 0x3;
var STATUS_UNLINKED = 0x4;


function FS() {
    this.inodes = [];
    this.events = [];

    this.qidnumber = 0x0;
    this.filesinloadingqueue = 0;
    this.OnLoaded = function() {};

    this.tar = new TAR(this);
    this.fsloader = new FSLoader(this);
    this.userinfo = [];

    this.watchFiles = {};
    this.watchDirectories = {};

    message.Register("LoadFilesystem", this.LoadFilesystem.bind(this) );
    message.Register("MergeFile", this.MergeFile.bind(this) );
    message.Register("DeleteNode", this.DeleteNode.bind(this) );
    message.Register("DeleteDirContents", this.RecursiveDelete.bind(this) );
    message.Register("CreateDirectory", 
        function(newDirPath){
            var ids = this.SearchPath(newDirPath);
            if(ids.id == -1 && ids.parentid != -1)
                this.CreateDirectory(ids.name, ids.parentid);
        }.bind(this)
    );
    message.Register("Rename",
        function(info) {
            var oldNodeInfo = this.SearchPath(info.oldPath);
            var newNodeInfo = this.SearchPath(info.newPath);
            
            // old node DNE or new node has invalid directory path
            if(oldNodeInfo.id == -1 || newNodeInfo.parentid == -1) 
                return;
               
            if(newNodeInfo.id==-1){ //create
                //parent must be directory
                if(((this.inodes[newNodeInfo.parentid].mode)&S_IFMT) != S_IFDIR)
                    return;
                    
                this.Rename(this.inodes[oldNodeInfo.id].parentid, this.inodes[oldNodeInfo.id].name, 
                                newNodeInfo.parentid, newNodeInfo.name);
            }
            else { //overwrite 
                this.Rename(this.inodes[oldNodeInfo.id].parentid, this.inodes[oldNodeInfo.id].name, 
                                this.inodes[newNodeInfo.id].parentid, this.inodes[newNodeInfo.id].name);
            }                
        }.bind(this)
    );
    message.Register("WatchFile",
        function(file) {
            //message.Debug("watching file: " + file.name);
            this.watchFiles[file.name] = true;
        }.bind(this)
    );
    message.Register("WatchDirectory",
        function(file) {
            this.watchDirectories[file.name] = true;
        }.bind(this)
    );
    //message.Debug("registering readfile on worker");
    message.Register("ReadFile",
        function(file) {
            message.Send("ReadFile", (this.ReadFile.bind(this))(file));
        }.bind(this)
    );
    message.Register("tar",
        function(data) {
            message.Send("tar", this.tar.Pack(data));
        }.bind(this)
    );
    message.Register("sync",
        function(data) {
            message.Send("sync", this.tar.Pack(data));
        }.bind(this)
    );

    // root entry
    this.CreateDirectory("", -1);
}


// -----------------------------------------------------
FS.prototype.LoadFilesystem = function(userinfo)
{
    this.userinfo = userinfo;
    this.fsloader.LoadJSON(this.userinfo.basefsURL);
    this.OnLoaded = function() { // the basic filesystem is loaded, so download the rest
        if (this.userinfo.extendedfsURL) {
            this.fsloader.LoadJSON(this.userinfo.extendedfsURL);
        }
        for(var i=0; i<this.userinfo.lazyloadimages.length; i++) {
            this.LoadImage(this.userinfo.lazyloadimages[i]);
        }
    }.bind(this);

}

// -----------------------------------------------------

FS.prototype.AddEvent = function(id, OnEvent) {
    var inode = this.GetInode(id);
    if (inode.status == STATUS_OK) {
        OnEvent();
        return;
    }
    this.events.push({id: id, OnEvent: OnEvent});    
}

FS.prototype.HandleEvent = function(id) {

    if (this.filesinloadingqueue == 0) {
        this.OnLoaded();
        this.OnLoaded = function() {}
    }
    //message.Debug("number of events: " + this.events.length);
    var newevents = [];
    for(var i=0; i<this.events.length; i++) {
        if (this.events[i].id == id) {
            this.events[i].OnEvent();
        } else {
            newevents.push(this.events[i]);
        }
    }
    this.events = newevents;
}


// -----------------------------------------------------
FS.prototype.LoadImage = function(url)
{
    if (!url) return;
    //message.Debug("Load Image " + url);
/*
    if (typeof Worker !== 'undefined') {
        LoadBZIP2Resource(url, 
            function(m){ for(var i=0; i<m.size; i++) this.tar.Unpack(m.data[i]); }.bind(this), 
            function(e){message.Debug("Error: Could not load " + url + ". Skipping.");});
        return;
    }
*/
    utils.LoadBinaryResource(url,
    function(buffer){
        var buffer8 = new Uint8Array(buffer);
        if (buffer.byteLength == 0) return;
        bzip2.simple(buffer8, this.tar.Unpack.bind(this.tar));
    }.bind(this),
    function(error){
        message.Debug("Error: Could not load " + url + ". Skipping.");
    }.bind(this)
    );
}
// -----------------------------------------------------

FS.prototype.CheckEarlyload = function(path)
{
    for(var i=0; i<this.userinfo.earlyload.length; i++) {
        if (this.userinfo.earlyload[i] == path) {
            return true;
        }
    }
    return false;
}


// The filesystem is responsible to add the correct time. This is a hack
// Have to find a better solution.
FS.prototype.AppendDateHack = function(idx) {
    if (this.GetFullPath(idx) != "home/user/.profile") return;
    var inode = this.inodes[idx];
    var date = new Date();
    var datestring = 
        "\ndate -s \"" + 
        date.getUTCFullYear() + 
        "-" + 
        (date.getUTCMonth()+1) + 
        "-" + 
        date.getUTCDate() + 
        " " + 
        date.getUTCHours() +
        ":" + 
        date.getUTCMinutes() +
        ":" + 
        date.getUTCSeconds() +
        "\" &>/dev/null\n";
    var size = inode.size;
    this.ChangeSize(idx, size+datestring.length);
    for(var i=0; i<datestring.length; i++) {
        inode.data[i+size] = datestring.charCodeAt(i); 
    }
}


// Loads the data from a url for a specific inode
FS.prototype.LoadFile = function(idx) {
    var inode = this.inodes[idx];
    if (inode.status != STATUS_ON_SERVER) {
        return;
    }
    inode.status = STATUS_LOADING;
    this.filesinloadingqueue++;

    if (inode.compressed) {
        inode.data = new Uint8Array(inode.size);

        var succfunction = 
        (function(idx){
            return function(buffer){
                var inode = this.GetInode(idx);
                var buffer8 = new Uint8Array(buffer);
                var ofs = 0;
                bzip2.simple(buffer8, function(x){inode.data[ofs++] = x;}.bind(this) );
                inode.status = STATUS_OK;
                this.filesinloadingqueue--;
                this.HandleEvent(idx);
            }.bind(this) 
        }.bind(this))(idx);

        utils.LoadBinaryResource(inode.url + ".bz2", 
        succfunction,
        function(error){throw error;});
        return;
    }

    if (inode.lazy) {
        message.Debug("Using lazy file for " + inode.url);
        inode.data = new LazyUint8Array(inode.url, inode.size);
        var old = inode.size;
        inode.size = inode.data.length;
        if (old != inode.size) message.Warning("Size wrong for lazy loaded file: " + inode.name);
        inode.status = STATUS_OK;
        this.filesinloadingqueue--;
        this.HandleEvent(idx);
        return;
    }

    var succfunction = 
    (function(idx){
        return function(buffer){
            var inode = this.GetInode(idx);
            inode.data = new Uint8Array(buffer);
            if (inode.size != inode.data.length) message.Warning("Size wrong for uncompressed non-lazily loaded file: " + inode.name);
            inode.size = inode.data.length; // correct size if the previous was wrong. 
            inode.status = STATUS_OK;            
            this.filesinloadingqueue--;
            this.HandleEvent(idx);            
        }.bind(this);
    }.bind(this))(idx);

    utils.LoadBinaryResource(inode.url, 
        succfunction,
        function(error){throw error;});

}

// -----------------------------------------------------

FS.prototype.PushInode = function(inode) {
    if (inode.parentid != -1) {
        this.inodes.push(inode);
        this.inodes[inode.parentid].updatedir = true;
        inode.nextid = this.inodes[inode.parentid].firstid;
        this.inodes[inode.parentid].firstid = this.inodes.length-1;
        return;
    } else {
        if (this.inodes.length == 0) { // if root directory
            this.inodes.push(inode);
            return;
        }
    }

    message.Debug("Error in Filesystem: Pushed inode with name = "+ inode.name + " has no parent");
    message.Abort();

}


FS.prototype.CreateInode = function() {
    this.qidnumber++;
    return {
        updatedir : false, // did the directory listing changed?
        parentid: -1,
        firstid : -1, // first file id in directory
        nextid : -1, // next id in directory
        status : 0,
        name : "",
        size : 0x0,
        uid : 0x0,
        gid : 0x0,
        ctime : Math.floor((new Date()).getTime()/1000),
        atime : Math.floor((new Date()).getTime()/1000),
        mtime : Math.floor((new Date()).getTime()/1000),
        major : 0x0,
        minor : 0x0,
        data : new Uint8Array(0),
        symlink : "",
        mode : 0x01ED,
        qid: {type: 0, version: 0, path: this.qidnumber},
        url: "", // url to download the file
        compressed: false
    };
}



FS.prototype.CreateDirectory = function(name, parentid) {
    var x = this.CreateInode();
    x.name = name;
    x.parentid = parentid;
    x.mode = 0x01FF | S_IFDIR;
    x.updatedir = true;
    if (parentid >= 0) {
        x.uid = this.inodes[parentid].uid;
        x.gid = this.inodes[parentid].gid;
        x.mode = (this.inodes[parentid].mode & 0x1FF) | S_IFDIR;
    }
    x.qid.type = S_IFDIR >> 8;
    this.PushInode(x);
    this.NotifyListeners(this.inodes.length-1, 'newdir');
    return this.inodes.length-1;
}

FS.prototype.CreateFile = function(filename, parentid) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    x.qid.type = S_IFREG >> 8;
    x.mode = (this.inodes[parentid].mode & 0x1B6) | S_IFREG;
    this.PushInode(x);
    this.NotifyListeners(this.inodes.length-1, 'newfile');
    return this.inodes.length-1;
}


FS.prototype.CreateNode = function(filename, parentid, major, minor) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.major = major;
    x.minor = minor;
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    x.qid.type = S_IFSOCK >> 8;
    x.mode = (this.inodes[parentid].mode & 0x1B6);
    this.PushInode(x);
    return this.inodes.length-1;
}
     
FS.prototype.CreateSymlink = function(filename, parentid, symlink) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    x.qid.type = S_IFLNK >> 8;
    x.symlink = symlink;
    x.mode = S_IFLNK;
    this.PushInode(x);
    return this.inodes.length-1;
}

FS.prototype.CreateTextFile = function(filename, parentid, str) {
    var id = this.CreateFile(filename, parentid);
    var x = this.inodes[id];
    x.data = new Uint8Array(str.length);
    x.size = str.length;
    for (var j in str) {
        x.data[j] = str.charCodeAt(j);
    }
    return id;
}

FS.prototype.OpenInode = function(id, mode) {
    var inode = this.GetInode(id);
    if ((inode.mode&S_IFMT) == S_IFDIR) {
        this.FillDirectory(id);
    }
    /*
    var type = "";
    switch(inode.mode&S_IFMT) {
        case S_IFREG: type = "File"; break;
        case S_IFBLK: type = "Block Device"; break;
        case S_IFDIR: type = "Directory"; break;
        case S_IFCHR: type = "Character Device"; break;
    }
    */
    //message.Debug("open:" + this.GetFullPath(id) +  " type: " + inode.mode + " status:" + inode.status);
    if (inode.status == STATUS_ON_SERVER) {
        this.LoadFile(id);
        return false;
    }

    if (inode.name == ".profile") {
        this.AppendDateHack(id);
    }

    return true;
}

FS.prototype.CloseInode = function(id) {
    //message.Debug("close: " + this.GetFullPath(id));
    var inode = this.GetInode(id);
    if (inode.status == STATUS_UNLINKED) {
        //message.Debug("Filesystem: Delete unlinked file");
        inode.status == STATUS_INVALID;
        inode.data = new Uint8Array(0);
        inode.size = 0;
    }
}

FS.prototype.Rename = function(olddirid, oldname, newdirid, newname) {
    // message.Debug("Rename " + oldname + " to " + newname);
    if ((olddirid == newdirid) && (oldname == newname)) {
        return true;
    }
    var oldid = this.Search(olddirid, oldname);
    var oldpath = this.GetFullPath(oldid);
    if (oldid == -1) {
        return false;
    }
    var newid = this.Search(newdirid, newname);
    if (newid != -1) {
        this.Unlink(newid);
    }

    var idx = oldid; // idx contains the id which we want to rename
    var inode = this.inodes[idx];

    // remove inode ids
    if (this.inodes[inode.parentid].firstid == idx) {
        this.inodes[inode.parentid].firstid = inode.nextid;
    } else {
        var id = this.FindPreviousID(idx);
        if (id == -1) {
            message.Debug("Error in Filesystem: Cannot find previous id of inode");
            message.Abort();
        }
        this.inodes[id].nextid = inode.nextid;
    }

    inode.parentid = newdirid;
    inode.name = newname;
    inode.qid.version++;

    inode.nextid = this.inodes[inode.parentid].firstid;
    this.inodes[inode.parentid].firstid = idx;

    this.inodes[olddirid].updatedir = true;
    this.inodes[newdirid].updatedir = true;

    this.NotifyListeners(idx, "rename", {oldpath: oldpath});
    
    return true;
}

FS.prototype.Write = function(id, offset, count, GetByte) {
    this.NotifyListeners(id, 'write');
    var inode = this.inodes[id];

    if (inode.data.length < (offset+count)) {
        this.ChangeSize(id, Math.floor(((offset+count)*3)/2) );
        inode.size = offset + count;
    } else
    if (inode.size < (offset+count)) {
        inode.size = offset + count;
    }
    if (inode.data instanceof Uint8Array)
        for(var i=0; i<count; i++)
            inode.data[offset+i] = GetByte();
    else
        for(var i=0; i<count; i++)
            inode.data.Set(offset+i, GetByte());
}

FS.prototype.Search = function(parentid, name) {
    var id = this.inodes[parentid].firstid;
    while(id != -1) {
        if (this.inodes[id].parentid != parentid) { // consistency check
            message.Debug("Error in Filesystem: Found inode with wrong parent id");
        }
        if (this.inodes[id].name == name) return id;
        id = this.inodes[id].nextid;
    }
    return -1;
}

FS.prototype.GetTotalSize = function() {
    var size = 0;
    for(var i=0; i<this.inodes.length; i++) {
        size += this.inodes[i].data.length;
    }
    return size;
}

FS.prototype.GetFullPath = function(idx) {
    var path = "";

    while(idx != 0) {
        path = "/" + this.inodes[idx].name + path;
        idx = this.inodes[idx].parentid;
    }
    return path.substring(1);
}

// no double linked list. So, we need this
FS.prototype.FindPreviousID = function(idx) {
    var inode = this.GetInode(idx);
    var id = this.inodes[inode.parentid].firstid;
    while(id != -1) {
        if (this.inodes[id].nextid == idx) return id;
        id = this.inodes[id].nextid;
    }
    return id;
}

FS.prototype.Unlink = function(idx) {
    this.NotifyListeners(idx, 'delete');
    if (idx == 0) return false; // root node cannot be deleted
    var inode = this.GetInode(idx);
    //message.Debug("Unlink " + inode.name);

    // check if directory is not empty
    if ((inode.mode&S_IFMT) == S_IFDIR) {
       if (inode.firstid != -1) return false;
    }

    // update ids
    if (this.inodes[inode.parentid].firstid == idx) {
        this.inodes[inode.parentid].firstid = inode.nextid;
    } else {
        var id = this.FindPreviousID(idx);
        if (id == -1) {
            message.Debug("Error in Filesystem: Cannot find previous id of inode");
            message.Abort();
        }
        this.inodes[id].nextid = inode.nextid;
    }
    // don't delete the content. The file is still accessible
    this.inodes[inode.parentid].updatedir = true;
    inode.status = STATUS_UNLINKED;
    inode.nextid = -1;
    inode.firstid = -1;
    inode.parentid = -1;
    return true;
}

FS.prototype.GetInode = function(idx)
{
    if (isNaN(idx)) {
        message.Debug("Error in filesystem: id is not a number ");
        return 0;
    }

    if ((idx < 0) || (idx > this.inodes.length)) {
        message.Debug("Error in filesystem: Attempt to get inode with id " + idx);
        return 0;
    }
    return this.inodes[idx];
}

FS.prototype.ChangeSize = function(idx, newsize)
{
    var inode = this.GetInode(idx);
    //message.Debug("change size to: " + newsize);
    if (newsize == inode.size) return;
    var temp = new Uint8Array(newsize);
    inode.size = newsize;
    var size = Math.min(inode.data.length, inode.size);
    for(var i=0; i<size; i++) {
        temp[i] = this.ReadByte(inode, i);
    }
    inode.data = temp;
}

FS.prototype.ReadByte = function(inode, idx) {
    if (inode.data instanceof Uint8Array) {
        return inode.data[idx];
    } else {
        return inode.data.Get(idx);
    }
}

FS.prototype.SearchPath = function(path) {
    //path = path.replace(/\/\//g, "/");
    path = path.replace("//", "/");
    var walk = path.split("/");
    var n = walk.length;
    if (walk[n-1].length == 0) walk.pop();
    if (walk[0].length == 0) walk.shift();
    var n = walk.length;

    var parentid = 0;
    var id = -1;
    for(var i=0; i<n; i++) {
        id = this.Search(parentid, walk[i]);        
        if (id == -1) {
            if (i < n-1) return {id: -1, parentid: -1, name: walk[i]}; // one name of the path cannot be found
            return {id: -1, parentid: parentid, name: walk[i]}; // the last element in the path does not exist, but the parent
        }
        parentid = id;
    }
    return {id: id, parentid: parentid, name: walk[i]};
}
// -----------------------------------------------------

FS.prototype.GetRecursiveList = function(dirid, list) {
    var id = this.inodes[dirid].firstid;
    while(id != -1) {
        list.push(id);
        if ((this.inodes[id].mode&S_IFMT) == S_IFDIR) {
            this.GetRecursiveList(id, list);
        }
        id = this.inodes[id].nextid;
    }
}

FS.prototype.ReadFile = function(file) {
    //message.Debug("Read path:" + file.name);
    var ids = this.SearchPath(file.name);
    if (ids.parentid == -1) return; // not even the path seems to exist
    if (ids.id == -1) {
      return null;
    }
    file.data = this.inodes[ids.id].data;
    file.size = this.inodes[ids.id].size;
    return file;
}

FS.prototype.MergeFile = function(file) {
    message.Debug("Merge path:" + file.name);
    var ids = this.SearchPath(file.name);
    if (ids.parentid == -1) return; // not even the path seems to exist
    if (ids.id == -1) {
        ids.id = this.CreateFile(ids.name, ids.parentid); 
    }
    this.inodes[ids.id].data = file.data;
    this.inodes[ids.id].size = file.data.length;
}


FS.prototype.RecursiveDelete = function(path) {
    var toDelete = []
    var ids = this.SearchPath(path);
    if (ids.parentid == -1 || ids.id == -1) return;
    
    this.GetRecursiveList(ids.id, toDelete);

    for(var i=toDelete.length-1; i>=0; i--)
        this.Unlink(toDelete[i]);

}

FS.prototype.DeleteNode = function(path) {
    var ids = this.SearchPath(path);
    if (ids.parentid == -1 || ids.id == -1) return;
    
    if ((this.inodes[ids.id].mode&S_IFMT) == S_IFREG){
        this.Unlink(ids.id);
        return;
    }
    if ((this.inodes[ids.id].mode&S_IFMT) == S_IFDIR){
        var toDelete = []
        this.GetRecursiveList(ids.id, toDelete);
        for(var i=toDelete.length-1; i>=0; i--)
            this.Unlink(toDelete[i]);
        this.Unlink(ids.id);
        return;
    }
}

FS.prototype.NotifyListeners = function(id, action, info) {
    if(info==undefined)
        info = {};

    var path = this.GetFullPath(id);
    if (this.watchFiles[path] == true && action=='write') {
      message.Send("WatchFileEvent", path);
    }
    for (var directory in this.watchDirectories) {
        if (this.watchDirectories.hasOwnProperty(directory)) {
            var indexOf = path.indexOf(directory)
            if(indexOf == 0 || indexOf == 1)
                message.Send("WatchDirectoryEvent", {path: path, event: action, info: info});         
        }
    }
}


FS.prototype.Check = function() {
    for(var i=1; i<this.inodes.length; i++)
    {
        if (this.inodes[i].status == STATUS_INVALID) continue;
        if (this.inodes[i].nextid == i) {
            message.Debug("Error in filesystem: file points to itself");
            message.Abort();
        }

        var inode = this.GetInode(i);
        if (inode.parentid < 0) {
            message.Debug("Error in filesystem: negative parent id " + i);
        }
        var n = inode.name.length;
        if (n == 0) {
            message.Debug("Error in filesystem: inode with no name and id " + i);
        }

        for (var j in inode.name) {
            var c = inode.name.charCodeAt(j);
            if (c < 32) {
                message.Debug("Error in filesystem: Unallowed char in filename");
            } 
        }
    }

}


FS.prototype.FillDirectory = function(dirid) {
    var inode = this.GetInode(dirid);
    if (!inode.updatedir) return;
    var parentid = inode.parentid;
    if (parentid == -1) parentid = 0; // if root directory point to the root directory

    // first get size
    var size = 0;
    var id = this.inodes[dirid].firstid;
    while(id != -1) {
        size += 13 + 8 + 1 + 2 + UTF8.UTF8Length(this.inodes[id].name);
        id = this.inodes[id].nextid;
    }

    size += 13 + 8 + 1 + 2 + 1; // "." entry
    size += 13 + 8 + 1 + 2 + 2; // ".." entry
    //message.Debug("size of dir entry: " + size);
    inode.data = new Uint8Array(size);
    inode.size = size;

    var offset = 0x0;
    offset += marshall.Marshall(
        ["Q", "d", "b", "s"],
        [this.inodes[dirid].qid, 
        offset+13+8+1+2+1, 
        this.inodes[dirid].mode >> 12, 
        "."],
        inode.data, offset);

    offset += marshall.Marshall(
        ["Q", "d", "b", "s"],
        [this.inodes[parentid].qid,
        offset+13+8+1+2+2, 
        this.inodes[parentid].mode >> 12, 
        ".."],
        inode.data, offset);

    var id = this.inodes[dirid].firstid;
    while(id != -1) {
        offset += marshall.Marshall(
        ["Q", "d", "b", "s"],
        [this.inodes[id].qid,
        offset+13+8+1+2+UTF8.UTF8Length(this.inodes[id].name),
        this.inodes[id].mode >> 12,
        this.inodes[id].name],
        inode.data, offset);
        id = this.inodes[id].nextid;
    }
    inode.updatedir = false;
}


// -----------------------------------------------------

// only support for security.capabilities
// should return a  "struct vfs_cap_data" defined in
// linux/capability for format
// check also:
//   sys/capability.h
//   http://lxr.free-electrons.com/source/security/commoncap.c#L376
//   http://man7.org/linux/man-pages/man7/capabilities.7.html
//   http://man7.org/linux/man-pages/man8/getcap.8.html
//   http://man7.org/linux/man-pages/man3/libcap.3.html
FS.prototype.PrepareCAPs = function(id) {
    var inode = this.GetInode(id);
    if (inode.caps) return inode.caps.length;
    inode.caps = new Uint8Array(12);
    // format is little endian
    // magic_etc (revision=0x01: 12 bytes)
    inode.caps[0]  = 0x00;
    inode.caps[1]  = 0x00;
    inode.caps[2]  = 0x00;
    inode.caps[3]  = 0x01;
    // permitted (full capabilities)
    inode.caps[4]  = 0xFF;
    inode.caps[5]  = 0xFF;
    inode.caps[6]  = 0xFF;
    inode.caps[7]  = 0xFF;
    // inheritable (full capabilities
    inode.caps[8]  = 0xFF;
    inode.caps[9]  = 0xFF;
    inode.caps[10] = 0xFF;
    inode.caps[11] = 0xFF;

    return inode.caps.length;
}


module.exports = FS;

},{"../../lib/utf8":16,"../bzip2":17,"../dev/virtio/marshall":35,"../messagehandler":43,"../utils":58,"./fsloader":39,"./lazyUint8Array":40,"./tar":41}],39:[function(require,module,exports){
// -------------------------------------------------
// ------------- FILESYSTEM LOADER -----------------
// -------------------------------------------------

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

var S_IRWXUGO = 0x1FF;
var S_IFMT = 0xF000;
var S_IFSOCK = 0xC000;
var S_IFLNK = 0xA000;
var S_IFREG = 0x8000;
var S_IFBLK = 0x6000;
var S_IFDIR = 0x4000;
var S_IFCHR = 0x2000;

var STATUS_INVALID = -0x1;
var STATUS_OK = 0x0;
var STATUS_OPEN = 0x1;
var STATUS_ON_SERVER = 0x2;
var STATUS_LOADING = 0x3;
var STATUS_UNLINKED = 0x4;

function FSLoader(filesystem) {
    this.fs = filesystem;
}

FSLoader.prototype.HandleDirContents = function(list, parentid) {
    for (var i in list) {
         var tag = list[i];

         var id = this.fs.Search(parentid, tag.name);
         if (id != -1) {
             if (!tag.path && !tag.size) {
                 if (tag.child) this.HandleDirContents(tag.child, id);
                 continue;
             } else {
                 message.Debug("Overwriting non-directory!");
             }
         }

         var inode = this.fs.CreateInode();
         inode.name = tag.name;
         inode.uid = tag.uid|0;
         inode.gid = tag.gid|0;
         inode.parentid = parentid;
         inode.mode = parseInt(tag.mode, 8);

         if (tag.path) { // link
             inode.mode = S_IFLNK | S_IRWXUGO;
             inode.symlink = tag.path;
             this.fs.PushInode(inode);
         } else if (!tag.size) { // dir
             inode.mode |= S_IFDIR;
             inode.updatedir = true;
             this.fs.PushInode(inode);
             if (tag.child)
                 this.HandleDirContents(tag.child, id != -1 ? id : this.fs.inodes.length-1);
         } else { // file
             if (tag.lazy) inode.lazy = tag.lazy;
             inode.mode |= S_IFREG;
             var idx = this.fs.inodes.length;
             inode.status = STATUS_ON_SERVER;
             inode.compressed = !!tag.c;
             inode.size = tag.size|0;
             this.fs.PushInode(inode);
             var url = this.sysrootdir + (!tag.src?this.fs.GetFullPath(idx):tag.src);
             inode.url = url;
             //message.Debug("Load id=" + (idx) + " " + url);
             if (tag.load || this.fs.CheckEarlyload(this.fs.GetFullPath(idx)) ) {
                 this.fs.LoadFile(idx);
             }
         }
    }
}

FSLoader.prototype.OnJSONLoaded = function(fsxml)
{
    var t = JSON.parse(fsxml);

    this.sysrootdir = t.src;
    if (String(this.sysrootdir) !== this.sysrootdir) message.Debug("No sysroot (src tag)!");
    this.sysrootdir += "/";

    this.HandleDirContents(t.fs, 0);

    message.Debug("processed " + this.fs.inodes.length + " inodes");
    this.fs.Check();
}

FSLoader.prototype.LoadJSON = function(url)
{
    message.Debug("Load filesystem information from " + url);
    utils.LoadTextResource(url, this.OnJSONLoaded.bind(this), function(error){throw error;});
}

module.exports = FSLoader;

},{"../messagehandler":43,"../utils":58}],40:[function(require,module,exports){
"use strict";

var message = require("../messagehandler");

function LazyUint8Array_length_getter() {
    if (!this.lengthKnown) {
        this.CacheLength();
    }
    return this._length;
}

function LazyUint8Array_chunkSize_getter() {
    if (!this.lengthKnown) {
        this.CacheLength();
    }
    return this._chunkSize;
}

function LazyUint8Array(url, fallbackLength) {
    this.fallbackLength = fallbackLength;
    this.overlay = [];
    this.url = url;
    this.lengthKnown = false;
    this.chunks = []; // Loaded chunks. Index is the chunk number
    Object.defineProperty(this, "length", { get: LazyUint8Array_length_getter });
    Object.defineProperty(this, "chunkSize", { get: LazyUint8Array_chunkSize_getter });
}

LazyUint8Array.prototype.Set = function LazyUint8Array_Set(idx, data) {
    if (idx > this.length-1 || idx < 0) {
        return undefined;
    }
    this.overlay[idx] = data;
}

LazyUint8Array.prototype.Get = function LazyUint8Array_Get(idx) {
    if (idx > this.length-1 || idx < 0) {
        return undefined;
    }
    if (typeof(this.overlay[idx]) !== "undefined") return this.overlay[idx];
    var chunkOffset = idx % this.chunkSize;
    var chunkNum = (idx / this.chunkSize)|0;
    return this.GetChunk(chunkNum)[chunkOffset];
}

LazyUint8Array.prototype.DoXHR = function LazyUint8Array_DoXHR(from, to) {
    if (from > to) message.Error("Invalid range (" + from + ", " + to + ") or no bytes requested!");
    if (to > this._length-1) message.Error("Only " + this._length + " bytes available! programmer error!");

    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.url, false);
    if (this._length !== this._chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);

    xhr.responseType = 'arraybuffer';

    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + this.url + ". Status: " + xhr.status);
    return new Uint8Array(xhr.response || []);
}

LazyUint8Array.prototype.GetChunk = function LazyUint8Array_GetChunk(chunkNum) {
    var start = chunkNum * this._chunkSize;
    var end = (chunkNum+1) * this._chunkSize - 1; // including this byte
    end = Math.min(end, this._length-1); // if length-1 is selected, this is the last block
    if (typeof(this.chunks[chunkNum]) === "undefined") {
      this.chunks[chunkNum] = this.DoXHR(start, end);
    }
    return this.chunks[chunkNum];
}

LazyUint8Array.prototype.CacheLength = function LazyUint8Array_CacheLength() {
    // Find length
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', this.url + "?" + new Date().getTime(), false);
    xhr.send(null);

    if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + this.url + ". Status: " + xhr.status);
    this._length = Number(xhr.getResponseHeader("Content-length"));
    if (this._length === 0) {
        message.Warning("Server doesn't return Content-length, even though we have a cache defeating URL query-string appended");
        this._length = this.fallbackLength;
    }

    this._chunkSize = 1024*1024; // Chunk size in bytes

    var header;
    var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
    if (!hasByteServing) this._chunkSize = this._length;

    this.lengthKnown = true;
}

module.exports = LazyUint8Array;

},{"../messagehandler":43}],41:[function(require,module,exports){
// -------------------------------------------------
// -------------------- TAR ------------------------
// -------------------------------------------------
// TAR file support for the filesystem

"use strict";

var message = require('../messagehandler');

var S_IRWXUGO = 0x1FF;
var S_IFMT = 0xF000;
var S_IFSOCK = 0xC000;
var S_IFLNK = 0xA000;
var S_IFREG = 0x8000;
var S_IFBLK = 0x6000;
var S_IFDIR = 0x4000;
var S_IFCHR = 0x2000;

function TAR(filesystem) {
    this.fs = filesystem;
    this.tarbuffer = new Uint8Array(512);
    this.tarbufferofs = 0;
    this.tarmode = 0; // mode = 0: header, mode!=0: file
    this.tarfileoffset = 0;
}

function ReadStringFromBinary(buffer, offset, numBytes) {
    var str = "";
    for(var i=0; i<numBytes; i++) {
        if (buffer[offset+i] < 32) return str; // no special signs
        str = str + String.fromCharCode(buffer[offset+i]); 
    }
    return str;
};

function WriteStringToBinary(str, buffer, offset, numBytes) {
    var n = Math.min(numBytes, str.length+1);
    for(var i=0; i<n; i++) {
        buffer[offset+i] = str.charCodeAt(i);
    }
    buffer[offset+n-1] = 0;
};

// Receives a stream of bytes
TAR.prototype.Unpack = function(x) {
    this.tarbuffer[this.tarbufferofs++] = x;
    if (this.tarbufferofs != 512) return;
    this.tarbufferofs = 0;
 
    if (this.tarmode == 1) {
        var n = Math.min(512, this.tarfilebuffer.length - this.tarfileoffset);
        for(var i=0; i<n; i++) {
            this.tarfilebuffer[this.tarfileoffset++] = this.tarbuffer[i];
        }
        if (this.tarfileoffset >= this.tarfilebuffer.length) this.tarmode = 0; // file finished loading, change mode
        return;
    }

    // tarmode = 0
    var magic = ReadStringFromBinary(this.tarbuffer, 257, 5);
    if (magic != "ustar") return;

    var typeflag = String.fromCharCode(this.tarbuffer[156]);
    var name = ReadStringFromBinary(this.tarbuffer, 0, 100);    
    //message.Debug("name:" + name);
    //TODO: use searchpath function
    var walk = name.split("/");
    var n = walk.length;
    if (walk[n-1].length == 0) walk.pop();
    var n = walk.length;
    //message.Debug("walk:" + walk);

    var parentid = 0;
    var id = -1;
    for(var i=0; i<n-1; i++) {
        id = this.fs.Search(parentid, walk[i]);
        if (id == -1) throw "Error in untar: Could not find inode.";
        parentid = id;
    }
    id = this.fs.Search(parentid, walk[walk.length-1]);

    if (id != -1) return;

    if ((id != -1) && (typeflag != '5')) {
        //throw "Warning: File already exists";
        return; // do not overwrite
    }
    if ((id != -1) && (typeflag == '5')) {
        return;
    }

    var inode = this.fs.CreateInode();
    inode.name = walk[n-1];
    inode.parentid = parentid;
    inode.mode = parseInt(ReadStringFromBinary(this.tarbuffer, 100, 8), 8);
    inode.uid = parseInt(ReadStringFromBinary(this.tarbuffer, 108, 8), 8);
    inode.gid = parseInt(ReadStringFromBinary(this.tarbuffer, 116, 8), 8);
    inode.atime = parseInt(ReadStringFromBinary(this.tarbuffer, 136, 12), 8);
    inode.ctime = this.atime;
    inode.mtime = this.atime;
    var size = parseInt(ReadStringFromBinary(this.tarbuffer, 124, 12), 8);

    switch(typeflag) {
    case "5":
        inode.mode |= S_IFDIR;
        break;

    case "0":
        inode.mode |= S_IFREG;
        inode.data = new Uint8Array(size);
        inode.size = size;
        if (size == 0) break;
        this.tarmode = 1;
        this.tarfileoffset = 0;
        this.tarfilebuffer = inode.data;
        break;

    case "1":
        inode.mode |= S_IFLNK;
        inode.symlink = "/"+ReadStringFromBinary(this.tarbuffer, 157, 100);
        break;

    case "2":
        inode.mode |= S_IFLNK;
        inode.symlink = ReadStringFromBinary(this.tarbuffer, 157, 100);
        break;
    }
    this.fs.PushInode(inode);
}

TAR.prototype.Pack = function(path) {
    message.Debug("tar: " + path);
    var id = this.fs.SearchPath(path).id;
    if (id == -1) return new Uint8Array(0);
    var filelist = [];
    this.fs.GetRecursiveList(id, filelist);
    var size = 0;
    for(var i=0; i<filelist.length; i++) {
        switch(this.fs.inodes[filelist[i]].mode&S_IFMT)
        {
            case S_IFLNK:
            case S_IFDIR:
                size += 512;
               break;
            case S_IFREG:
                size += 512;
                size += this.fs.inodes[filelist[i]].size;
                if (size & 511) {size = size & (~0x1FF); size += 512;}
                break;
        }
    }    
    message.Debug("tar: " + this.fs.GetFullPath(id) + " size: " + size + " files: " + filelist.length);
    message.Debug(filelist);
    
    var buffer = new Uint8Array(size);
    var offset = 0;
    for(var i=0; i<filelist.length; i++) {
        var inode = this.fs.inodes[filelist[i]];
        var type = inode.mode&S_IFMT;
        if ((type != S_IFLNK) && (type != S_IFDIR) && (type != S_IFREG)) continue;
        WriteStringToBinary("ustar  ", buffer, offset+257, 8);
        WriteStringToBinary(this.fs.GetFullPath(filelist[i]), buffer, offset+0, 100);
        WriteStringToBinary("00000000000", buffer, offset+124, 12); // size
        WriteStringToBinary((inode.mode&0xFFF).toString(8), buffer, offset+100, 8); // mode
        WriteStringToBinary(inode.uid.toString(8), buffer, offset+108, 8); // uid
        WriteStringToBinary(inode.gid.toString(8), buffer, offset+116, 8); // gid
        WriteStringToBinary((inode.mtime).toString(8), buffer, offset+136, 12); // mtime        
        //WriteStringToBinary("root", buffer, offset+265, 7);
        //WriteStringToBinary("root", buffer, offset+297, 7); // chksum blank to calculate the checksum
        
        buffer[offset+148+0] = 32; // chksum
        buffer[offset+148+1] = 32;
        buffer[offset+148+2] = 32;
        buffer[offset+148+3] = 32;
        buffer[offset+148+4] = 32;
        buffer[offset+148+5] = 32;
        buffer[offset+148+6] = 32;
        buffer[offset+148+7] = 32;

        switch(type)
        {
            case S_IFLNK:
                buffer[offset+156] = "2".charCodeAt(0);
                WriteStringToBinary(inode.symlink, buffer, offset+157, 100);
                break;

            case S_IFDIR:
                buffer[offset+156] = "5".charCodeAt(0);
                break;

            case S_IFREG:
                buffer[offset+156] = "0".charCodeAt(0);
                WriteStringToBinary(inode.size.toString(8), buffer, offset+124, 12);
                break;
        }
        var chksum = 0;
        for(var j=0; j<512; j++) {
            chksum += buffer[offset + j];
        }
        WriteStringToBinary(chksum.toString(8), buffer, offset+148, 7);
        offset += 512;
        
        if (type == S_IFREG) { // copy the file
            for(var j=0; j<inode.size; j++) {
                buffer[offset++] = inode.data[j];
            }
            if (offset & 511) {offset = offset & (~0x1FF); offset += 512;}
        }
    }
    return buffer;
}

module.exports = TAR;

},{"../messagehandler":43}],42:[function(require,module,exports){
// In case math.imul doesn't exists: 
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

module.exports = Math.imul || function(a, b) {
    var ah  = (a >>> 16) & 0xffff;
    var al = a & 0xffff;
    var bh  = (b >>> 16) & 0xffff;
    var bl = b & 0xffff;
    // the shift by 0 fixes the sign on the high part
    // the final |0 converts the unsigned value into a signed value
    return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)|0);
};

},{}],43:[function(require,module,exports){
// -------------------------------------------------
// ------------- MessageHandler --------------------
// -------------------------------------------------

"use strict";

var run = true;

function Send(command, data) {
    postMessage(
    {
        "command" : command,
        "data" : data
    }
    );
}

function Debug(message) {
    Send("Debug", message);
}

function Abort() {
    Debug("Worker: Abort execution.");
    if (typeof messagemap["PrintOnAbort"] == 'function') {
            messagemap["PrintOnAbort"]();
    }    
    Send("Abort", {});
    run = false;
    throw new Error('Kill worker'); // Don't return
}

function DoError(message) {
    Send("Debug", "Error: " + message);
    Abort();
}

function Warning(message) {
    Send("Debug", "Warning: " + message);
}

var messagemap = new Object();

function Register(message, OnReceive) {
    messagemap[message] = OnReceive;
}

// this is a global object of the worker
onmessage = function(e) {
    if (!run) return; // ignore all messages after an error

    var command = e.data.command;
    if (typeof messagemap[command] == 'function') {
        try {
            messagemap[command](e.data.data);
        } catch (error) {
            Debug("Worker: Unhandled exception in command \"" + command + "\": " + error.message);
            run = false;
        }
        return;
    }
}

Register("Abort", function(){run = false;});

module.exports.Register = Register;
module.exports.Debug = Debug;
module.exports.Error = DoError;
module.exports.Warning = Warning;
module.exports.Abort = Abort;
module.exports.Send = Send;


},{}],44:[function(require,module,exports){
var message = require('../messagehandler');

function FastCPU(stdlib, foreign, heap) {
"use asm";

var floor = stdlib.Math.floor;
var imul = foreign.imul;
var DebugMessage = foreign.DebugMessage;
var abort = foreign.abort;
var Read32 = foreign.Read32;
var Write32 = foreign.Write32;
var Read16 = foreign.Read16;
var Write16 = foreign.Write16;
var Read8 = foreign.Read8;
var Write8 = foreign.Write8;


var ERROR_SETFLAGS_LITTLE_ENDIAN = 0; // "Little endian is not supported"
var ERROR_SETFLAGS_CONTEXT_ID = 1; // "Context ID is not supported"
var ERROR_SETFLAGS_PREFIX = 2; // "exception prefix not supported"
var ERROR_SETFLAGS_DELAY_SLOT = 3; // "delay slot exception not supported"
var ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION = 4; //Error in SetSPR: Direct triggering of interrupt exception not supported?
var ERROR_SETSPR_INTERRUPT_ADDRESS = 5; //Error in SetSPR: interrupt address not supported
var ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS = 6; //"Error in SetSPR: Timer mode other than continuous not supported"
var ERROR_EXCEPTION_UNKNOWN = 7;        // "Error in Exception: exception type not supported"
var ERROR_UNKNOWN = 8;
// special purpose register index

var SPR_UPR = 1; // unit present register
var SPR_SR = 17; // supervision register
var SPR_EEAR_BASE = 48; // exception ea register
var SPR_EPCR_BASE = 32; // exception pc register
var SPR_ESR_BASE = 64; // exception sr register
var SPR_IMMUCFGR = 4; // Instruction MMU Configuration register
var SPR_DMMUCFGR = 3; // Data MMU Configuration register
var SPR_ICCFGR = 6; // Instruction Cache configuration register
var SPR_DCCFGR = 5; // Data Cache Configuration register
var SPR_VR = 0; // Version register

// exception types and addresses
var EXCEPT_ITLBMISS = 0xA00; // instruction translation lookaside buffer miss
var EXCEPT_IPF = 0x400; // instruction page fault
var EXCEPT_RESET = 0x100; // reset the processor
var EXCEPT_DTLBMISS = 0x900; // data translation lookaside buffer miss
var EXCEPT_DPF = 0x300; // instruction page fault
var EXCEPT_BUSERR = 0x200; // wrong memory access
var EXCEPT_TICK = 0x500; // tick counter interrupt
var EXCEPT_INT = 0x800; // interrupt of external devices
var EXCEPT_SYSCALL = 0xC00; // syscall, jump into supervisor mode
var EXCEPT_TRAP = 0xE00; // trap


var r = new stdlib.Int32Array(heap); // registers
var f = new stdlib.Float32Array(heap); // registers

var h = new stdlib.Int32Array(heap);
var b = new stdlib.Uint8Array(heap);
var w = new stdlib.Uint16Array(heap);

var rp = 0x0; // pointer to registers, not used
var ramp = 0x100000;

var group0p = 0x2000; // special purpose registers
var group1p = 0x4000; // data tlb registers
var group2p = 0x6000; // instruction tlb registers

// define variables and initialize

var pc = 0x0;
var ppc = 0;
var ppcorigin = 0;
var pcbase = -4; // helper variable to calculate the real pc
var fence = 0; // the ppc pointer to the next jump or page boundary

var delayedins = 0; // the current instruction is an delayed instruction, one cycle before a jump

var nextpc = 0x0; // pointer to the next instruction after the fence
var jump = 0x0; // in principle the jump variable should contain the same as nextpc.
                // But for delayed ins at page boundaries, this is taken as temporary
                // storage for nextpc
var delayedins_at_page_boundary = 0; //flag


// fast tlb lookup tables, invalidate
var instlblookup = -1;
var read32tlblookup = -1;
var read8stlblookup = -1;
var read8utlblookup = -1;
var read16stlblookup = -1;
var read16utlblookup = -1;
var write32tlblookup = -1;
var write8tlblookup = -1;
var write16tlblookup = -1;

var instlbcheck = -1;
var read32tlbcheck = -1;
var read8stlbcheck = -1;
var read8utlbcheck = -1;
var read16stlbcheck = -1;
var read16utlbcheck = -1;
var write32tlbcheck = -1;
var write8tlbcheck = -1;
var write16tlbcheck = -1;

var EA = -1; // hidden register for atomic lwa and swa operation

var TTMR = 0x0; // Tick timer mode register
var TTCR = 0x0; // Tick timer count register

var PICMR = 0x3; // interrupt controller mode register (use nmi)
var PICSR = 0x0; // interrupt controller set register

// flags
var SR_SM = 1; // supervisor mode
var SR_TEE = 0; // tick timer Exception Enabled
var SR_IEE = 0; // interrupt Exception Enabled
var SR_DCE = 0; // Data Cache Enabled
var SR_ICE = 0; // Instruction Cache Enabled
var SR_DME = 0; // Data MMU Enabled
var SR_IME = 0; // Instruction MMU Enabled
var SR_LEE = 0; // Little Endian Enabled
var SR_CE = 0; // CID Enabled ?
var SR_F = 0; // Flag for l.sf... instructions 
var SR_CY = 0; // Carry Flag
var SR_OV = 0; // Overflow Flag
var SR_OVE = 0; // Overflow Flag Exception
var SR_DSX = 0; // Delay Slot Exception
var SR_EPH = 0; // Exception Prefix High
var SR_FO = 1; // Fixed One, always set
var SR_SUMRA = 0; // SPRS User Mode Read Access, or TRAP exception disable?
var SR_CID = 0x0; //Context ID

var boot_dtlb_misshandler_address = 0x0;
var boot_itlb_misshandler_address = 0x0;
var current_pgd = 0x0;

var raise_interrupt = 0;

var doze = 0x0;


function Init() {
    AnalyzeImage();
    Reset();
}

function Reset() {
    TTMR = 0x0;
    TTCR = 0x0;
    PICMR = 0x3;
    PICSR = 0x0;

    h[group0p+(SPR_IMMUCFGR<<2) >> 2] = 0x18; // 0 ITLB has one way and 64 sets
    h[group0p+(SPR_DMMUCFGR<<2) >> 2] = 0x18; // 0 DTLB has one way and 64 sets
    h[group0p+(SPR_ICCFGR<<2) >> 2] = 0x48;
    h[group0p+(SPR_DCCFGR<<2) >> 2] = 0x48;
    h[group0p+(SPR_VR<<2) >> 2] = 0x12000001;

    // UPR present
    // data mmu present
    // instruction mmu present
    // PIC present (architecture manual seems to be wrong here)
    // Tick timer present
    h[group0p+(SPR_UPR<<2) >> 2] = 0x619;

    ppc = 0;
    ppcorigin = 0;
    pcbase = -4;

    Exception(EXCEPT_RESET, 0x0);
}

function InvalidateTLB() {
    instlblookup = -1;
    read32tlblookup = -1;
    read8stlblookup = -1;
    read8utlblookup = -1;
    read16stlblookup = -1;
    read16utlblookup = -1;
    write32tlblookup = -1;
    write8tlblookup = -1;
    write16tlblookup = -1;
    instlbcheck = -1;
    read32tlbcheck = -1;
    read8stlbcheck = -1;
    read8utlbcheck = -1;
    read16stlbcheck = -1;
    read16utlbcheck = -1;
    write32tlbcheck = -1;
    write8tlbcheck = -1;
    write16tlbcheck = -1;
}


function GetStat() {
    return (pc>>>2)|0;
}

function PutState() {
    pc = h[(0x100 + 0) >> 2] << 2;
    nextpc = h[(0x100 + 4) >> 2] << 2;
    delayedins = h[(0x100 + 8) >> 2]|0;
    TTMR = h[(0x100 + 16) >> 2]|0;
    TTCR = h[(0x100 + 20) >> 2]|0;
    PICMR = h[(0x100 + 24) >> 2]|0;
    PICSR = h[(0x100 + 28) >> 2]|0;
    boot_dtlb_misshandler_address = h[(0x100 + 32) >> 2]|0;
    boot_itlb_misshandler_address = h[(0x100 + 36) >> 2]|0;
    current_pgd = h[(0x100 + 40) >> 2]|0;

    // we have to call the fence
    ppc = 0x0;  
    ppcorigin = 0x0; 
    fence = 0x0;

    if (delayedins|0) { 
    }
    nextpc = pc;    



}

function GetState() {
    // pc is always valid when this function is called
    h[(0x100 + 0) >> 2] = pc >>> 2;

    h[(0x100 + 4) >> 2] = (pc+4) >>> 2;
    if ((ppc|0) == (fence|0)) {
        h[(0x100 + 4) >> 2] = nextpc >>> 2; 
    }
    h[(0x100 + 8) >> 2] = delayedins|0;
    h[(0x100 + 12) >> 2] = 0;
    h[(0x100 + 16) >> 2] = TTMR|0;
    h[(0x100 + 20) >> 2] = TTCR|0;
    h[(0x100 + 24) >> 2] = PICMR|0;
    h[(0x100 + 28) >> 2] = PICSR|0;
    h[(0x100 + 32) >> 2] = boot_dtlb_misshandler_address|0;
    h[(0x100 + 36) >> 2] = boot_itlb_misshandler_address|0;
    h[(0x100 + 40) >> 2] = current_pgd|0;
}

function GetTimeToNextInterrupt() {
    var delta = 0x0;
    if ((TTMR >> 30) == 0) return -1;    
    delta = (TTMR & 0xFFFFFFF) - (TTCR & 0xFFFFFFF) |0;
    if ((delta|0) < 0) {
        delta = delta + 0xFFFFFFF | 0;
    }    
    return delta|0;
}

function ProgressTime(delta) {
    delta = delta|0;
    TTCR = (TTCR + delta)|0;
}

function GetTicks() {
    if ((TTMR >> 30) == 0) return -1;
    return (TTCR & 0xFFFFFFF)|0;
}


function AnalyzeImage() { // get addresses for fast refill
    boot_dtlb_misshandler_address = h[ramp+0x900 >> 2]|0;
    boot_itlb_misshandler_address = h[ramp+0xA00 >> 2]|0;
    current_pgd = ((h[ramp+0x2010 >> 2]&0xFFF)<<16) | (h[ramp+0x2014 >> 2] & 0xFFFF)|0;
}


function SetFlags(x) {
    x = x|0;
    var old_SR_IEE = 0;
    old_SR_IEE = SR_IEE;
    SR_SM = (x & (1 << 0));
    SR_TEE = (x & (1 << 1));
    SR_IEE = (x & (1 << 2));
    SR_DCE = (x & (1 << 3));
    SR_ICE = (x & (1 << 4));
    SR_DME = (x & (1 << 5));
    SR_IME = (x & (1 << 6));
    SR_LEE = (x & (1 << 7));
    SR_CE = (x & (1 << 8));
    SR_F = (x & (1 << 9));
    SR_CY = (x & (1 << 10));
    SR_OV = (x & (1 << 11));
    SR_OVE = (x & (1 << 12));
    SR_DSX = (x & (1 << 13));
    SR_EPH = (x & (1 << 14));
    SR_FO = 1;
    SR_SUMRA = (x & (1 << 16));
    SR_CID = (x >> 28) & 0xF;

    if (SR_LEE) {
        DebugMessage(ERROR_SETFLAGS_LITTLE_ENDIAN|0);
        abort();
    }
    if (SR_CID) {
        DebugMessage(ERROR_SETFLAGS_CONTEXT_ID|0);
        abort();
    }
    if (SR_EPH) {
        DebugMessage(ERROR_SETFLAGS_PREFIX|0);
        abort();
    }
    if (SR_DSX) {
        DebugMessage(ERROR_SETFLAGS_DELAY_SLOT|0);
        abort();
    }
    if (SR_IEE) {
        if ((old_SR_IEE|0) == (0|0)) {
            CheckForInterrupt();
        }
    }
}

function GetFlags() {
    var x = 0x0;
    x = x | (SR_SM ? (1 << 0) : 0);
    x = x | (SR_TEE ? (1 << 1) : 0);
    x = x | (SR_IEE ? (1 << 2) : 0);
    x = x | (SR_DCE ? (1 << 3) : 0);
    x = x | (SR_ICE ? (1 << 4) : 0);
    x = x | (SR_DME ? (1 << 5) : 0);
    x = x | (SR_IME ? (1 << 6) : 0);
    x = x | (SR_LEE ? (1 << 7) : 0);
    x = x | (SR_CE ? (1 << 8) : 0);
    x = x | (SR_F ? (1 << 9) : 0);
    x = x | (SR_CY ? (1 << 10) : 0);
    x = x | (SR_OV ? (1 << 11) : 0);
    x = x | (SR_OVE ? (1 << 12) : 0);
    x = x | (SR_DSX ? (1 << 13) : 0);
    x = x | (SR_EPH ? (1 << 14) : 0);
    x = x | (SR_FO ? (1 << 15) : 0);
    x = x | (SR_SUMRA ? (1 << 16) : 0);
    x = x | (SR_CID << 28);
    return x|0;
}

function CheckForInterrupt() {
    if (!SR_IEE) {
        return;
    }
    if (PICMR & PICSR) {
        raise_interrupt = 1;
    }
}

function RaiseInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
    var lmask = 0;
    lmask = (1 << (line))|0;
    PICSR = PICSR | lmask;
    CheckForInterrupt();
}

function ClearInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
    PICSR = PICSR & (~(1 << line));
}


function SetSPR(idx, x) {
    idx = idx|0;
    x = x|0;
    var address = 0;
    var group = 0;
    address = (idx & 0x7FF);
    group = (idx >> 11) & 0x1F;

    switch (group|0) {
    case 0:
        if ((address|0) == (SPR_SR|0)) {
            SetFlags(x);
        }
        h[group0p+(address<<2) >> 2] = x;
        break;
    case 1:
        // Data MMU
        h[group1p+(address<<2) >> 2] = x;
        break;
    case 2:
        // ins MMU
        h[group2p+(address<<2) >> 2] = x;
        break;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        break;
    case 8:
        doze = 0x1; // doze mode
        break;
    case 9:
        // pic
        switch (address|0) {
        case 0:
            PICMR = x | 0x3; // we use non maskable interrupt here
            // check immediate for interrupt
            if (SR_IEE) {
                if (PICMR & PICSR) {
                    DebugMessage(ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION|0);
                    abort();
                }
            }
            break;
        case 2: // PICSR
            break;
        default:
            DebugMessage(ERROR_SETSPR_INTERRUPT_ADDRESS|0);
            abort();
        }
        break;
    case 10:
        //tick timer
        switch (address|0) {
        case 0:
            TTMR = x|0;
            if (((TTMR >> 30)&3) != 0x3) {
                DebugMessage(ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS|0);
                abort();
            }
            break;
        case 1:
            TTCR = x|0;
            break;
        default:
            //DebugMessage("Error in SetSPR: Tick timer address not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        break;

    default:
        DebugMessage(ERROR_UNKNOWN|0);
        abort();
        break;
    }
};

function GetSPR(idx) {
    idx = idx|0;
    var address = 0;
    var group = 0;
    address = idx & 0x7FF;
    group = (idx >> 11) & 0x1F;
    switch (group|0) {
    case 0:
        if ((address|0) == (SPR_SR|0)) {
            return GetFlags()|0;
        }
        return h[group0p+(address<<2) >> 2]|0;
    case 1:
        return h[group1p+(address<<2) >> 2]|0;
    case 2:
        return h[group2p+(address<<2) >> 2]|0;
    case 8:
        return 0x0;
    case 9:
        // pic
        switch (address|0) {
        case 0:
            return PICMR|0;
        case 2:
            return PICSR|0;
        default:
            //DebugMessage("Error in GetSPR: PIC address unknown");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        break;

    case 10:
        // tick Timer
        switch (address|0) {
        case 0:
            return TTMR|0;
        case 1:
            return TTCR|0; // or clock
        default:
            DebugMessage(ERROR_UNKNOWN|0);
            //DebugMessage("Error in GetSPR: Tick timer address unknown");
            abort();
            break;
        }
        break;
    default:
        DebugMessage(ERROR_UNKNOWN|0);
        //DebugMessage("Error in GetSPR: group unknown");
        abort();
        break;
    }
    return 0|0;
}

function Exception(excepttype, addr) {
    excepttype = excepttype|0;
    addr = addr|0;
    var except_vector = 0;
    except_vector = excepttype | (SR_EPH ? 0xf0000000 : 0x0);

    SetSPR(SPR_EEAR_BASE, addr);
    SetSPR(SPR_ESR_BASE, GetFlags()|0);

    EA = -1;
    SR_OVE = 0;
    SR_SM = 1;
    SR_IEE = 0;
    SR_TEE = 0;
    SR_DME = 0;

    instlblookup = 0;
    read32tlblookup = 0;
    read8stlblookup = 0;
    read8utlblookup = 0;
    read16stlblookup = 0;
    read16utlblookup = 0;
    write32tlblookup = 0;
    write8tlblookup = 0;
    write16tlblookup = 0;
    instlbcheck = 0;
    read32tlbcheck = 0;
    read8utlbcheck = 0;
    read8stlbcheck = 0;
    read16utlbcheck = 0;
    read16stlbcheck = 0;
    write32tlbcheck = 0;
    write8tlbcheck = 0;
    write16tlbcheck = 0;

    fence = ppc|0;
    nextpc = except_vector;

    switch (excepttype|0) {

    case 0x100: // EXCEPT_RESET
        break;

    case 0x300: // EXCEPT_DPF
    case 0x900: // EXCEPT_DTLBMISS
    case 0xE00: // EXCEPT_TRAP
    case 0x200: // EXCEPT_BUSERR
        pc = pcbase + ppc|0;
        SetSPR(SPR_EPCR_BASE, pc - (delayedins ? 4 : 0)|0);
        break;

    case 0xA00: // EXCEPT_ITLBMISS
    case 0x400: // EXCEPT_IPF
    case 0x500: // EXCEPT_TICK
    case 0x800: // EXCEPT_INT
        // per definition, the pc must be valid here
        SetSPR(SPR_EPCR_BASE, pc - (delayedins ? 4 : 0)|0);
        break;

    case 0xC00: // EXCEPT_SYSCALL
        pc = pcbase + ppc|0;
        SetSPR(SPR_EPCR_BASE, pc + 4 - (delayedins ? 4 : 0)|0);
        break;

    default:
        DebugMessage(ERROR_EXCEPTION_UNKNOWN|0);
        abort();
    }
    delayedins = 0;
    SR_IME = 0;
}


// disassembled dtlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
function DTLBRefill(addr, nsets) {
    addr = addr|0;
    nsets = nsets|0;
    var r2 = 0;
    var r3 = 0;
    var r4 = 0;
    var r5 = 0;
    if ((h[ramp+0x900 >> 2]|0) == (boot_dtlb_misshandler_address|0)) {
        Exception(EXCEPT_DTLBMISS, addr);
        return 0|0;
    }
    r2 = addr;
    // get_current_PGD  using r3 and r5 
    r3 = h[ramp+current_pgd >> 2]|0; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3|0;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)

    r3 = h[ramp+r4 >> 2]|0;

    if ((r3|0) == 0) {
        Exception(EXCEPT_DPF, addr);
        return 0|0;
        // abort();
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000;
    // d_pmd_good:

    r4 = h[ramp+r4 >> 2]|0; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4|0;
    r2 = h[ramp+r3 >> 2]|0;

    if ((r2 & 1) == 0) {
        Exception(EXCEPT_DPF, addr);
        return 0|0;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe3fa; // PAGE_MASK | DTLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe3fa;
    //r6 = (group0[SPR_DMMUCFGR] & 0x1C) >>> 0x2;
    //r3 = 1 << r6; // number of DMMU sets
    //r6 = r3 - 1; // mask register
    //r5 &= r6;
    r5 = r5 & (nsets - 1);
    h[group1p+((0x280 | r5)<<2) >> 2] = r4;
    //SPR_DTLBTR_BASE(0)|r5 = r4 // SPR_DTLBTR_BASE = 0x280 * (WAY*0x100)

    // fill DTLBMR register
    r2 = addr;
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[group1p+((0x200 | r5)<<2) >> 2] = r4;
    // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1|0;
}

// disassembled itlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
function ITLBRefill(addr, nsets) {
    addr = addr|0;
    nsets = nsets|0;
    var r2 = 0;
    var r3 = 0;
    var r4 = 0;
    var r5 = 0;
    if ((h[ramp+0xA00 >> 2]|0) == (boot_itlb_misshandler_address|0)) {
        Exception(EXCEPT_ITLBMISS, addr);
        return 0|0;
    }

    r2 = addr;
    // get_current_PGD  using r3 and r5
    r3 = h[ramp+current_pgd >> 2]|0; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3|0;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)
    r3 = h[ramp+r4 >> 2]|0;

    if ((r3|0) == 0) {
        Exception(EXCEPT_IPF, addr);
        return 0|0;
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000; // or 0xffffe3fa ??? PAGE_MASK
    //i_pmd_good:

    r4 = h[ramp+r4 >> 2]|0; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4|0;
    r2 = h[ramp+r3 >> 2]|0;

    if ((r2 & 1) == 0) {
        Exception(EXCEPT_IPF, addr);
        return 0|0;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe03a; // PAGE_MASK | ITLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe03a; // apply the mask
    r3 = r2 & 0x7c0; // PAGE_EXEC, Page_SRE, PAGE_SWE, PAGE_URE, PAGE_UWE

    if ((r3|0) != 0x0) {
        //not itlb_tr_fill....
        //r6 = (group0[SPR_IMMUCFGR] & 0x1C) >>> 0x2;
        //r3 = 1 << r6; // number of DMMU sets
        //r6 = r3 - 1; // mask register
        //r5 &= r6;
        r5 = r5 & (nsets - 1);
        //itlb_tr_fill_workaround:
        r4 = r4 | 0xc0; // SPR_ITLBTR_UXE | ITLBTR_SXE
    }
    // itlb_tr_fill:

    h[group2p + ((0x280 | r5)<<2) >> 2] = r4; // SPR_ITLBTR_BASE(0)|r5 = r4 // SPR_ITLBTR_BASE = 0x280 * (WAY*0x100)

    //fill ITLBMR register
    r2 = addr;
    // r3 = 
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[group2p + ((0x200 | r5)<<2) >> 2] = r4; // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1|0;
}

function DTLBLookup(addr, write) {
    addr = addr|0;
    write = write|0;
    var setindex = 0;
    var tlmbr = 0;
    var tlbtr = 0;
    if (!SR_DME) {
        return addr|0;
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    setindex = (addr >> 13) & 63; // check these values
    tlmbr = h[group1p + ((0x200 | setindex) << 2) >> 2]|0; // match register
     
    if ((tlmbr & 1) == 0) {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64)|0) {
            tlmbr = h[group1p + (0x200 + setindex << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }
    if ((tlmbr >> 19) != (addr >> 19)) {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64)|0) {
            tlmbr = h[group1p + (0x200 + setindex << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }

    /* skipped this check
        // set lru 
        if (tlmbr & 0xC0) {
            DebugMessage("Error: LRU ist not supported");
            abort();
        }
    */
    tlbtr = h[group1p + ((0x280 | setindex)<<2) >> 2]|0; // translate register

    // Test for page fault
    // Skip this to be faster

    // check if supervisor mode
    if (SR_SM) {
        if (!write) {
            if (!(tlbtr & 0x100)) {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        } else {
            if (!(tlbtr & 0x200))
            {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        }
    } else {
        if (!write) {
            if (!(tlbtr & 0x40)) {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        } else {
            if (!(tlbtr & 0x80))
            {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        }
    }
    return ((tlbtr & 0xFFFFE000) | (addr & 0x1FFF))|0;
}


function Step(steps, clockspeed) {
    steps = steps|0;
    clockspeed = clockspeed|0;
    var ins = 0x0;
    var imm = 0x0;
    var i = 0;
    var rindex = 0x0;
    var rA = 0x0,
        rB = 0x0,
        rD = 0x0;
    var vaddr = 0x0; // virtual address
    var paddr = 0x0; // physical address
    
    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var delta = 0x0;

    var dsteps = 0; // small counter

// -----------------------------------------------------

    for(;;) {

        if ((ppc|0) != (fence|0)) {

        ins = h[ppc >> 2]|0;
        ppc = ppc + 4|0;

// --------------------------------------------
        switch ((ins >> 26)&0x3F) {

        case 0x0:
            // j
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x1:
            // jal
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            r[9] = pc + 8|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x3:
            // bnf
            if (SR_F) {
                break;
            }
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x4:
            // bf
            if (!SR_F) {
                continue;
            }
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x5:
            // nop
            continue;

        case 0x6:
            // movhi
            rindex = (ins >> 21) & 0x1F;
            r[rindex << 2 >> 2] = ((ins & 0xFFFF) << 16); // movhi
            continue;

        case 0x8:
            //sys and trap
            if ((ins&0xFFFF0000) == 0x21000000) {
                Exception(EXCEPT_TRAP, h[group0p+SPR_EEAR_BASE >> 2]|0);
            } else {
                Exception(EXCEPT_SYSCALL, h[group0p+SPR_EEAR_BASE >> 2]|0);
            }
            continue;

        case 0x9:
            // rfe
            jump = GetSPR(SPR_EPCR_BASE)|0;
            InvalidateTLB();
            fence = ppc;
            nextpc = jump;
            //pc = jump; // set the correct pc in case of an EXCEPT_INT
            //delayedins = 0;
            SetFlags(GetSPR(SPR_ESR_BASE)|0); // could raise an exception
            continue;

        case 0x11:
            // jr
            jump = r[((ins >> 9) & 0x7C)>>2]|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x12:
            // jalr
            pc = pcbase + ppc|0;
            jump = r[((ins >> 9) & 0x7C)>>2]|0;
            r[9] = pc + 8|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x1B: 
            // lwa
            vaddr = (r[((ins >> 14) & 0x7C) >> 2]|0) + ((ins << 16) >> 16)|0;
            if ((read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read32tlbcheck = vaddr;
                read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read32tlblookup ^ vaddr;
            EA = paddr;
            r[((ins >> 19) & 0x7C)>>2] = (paddr|0)>0?h[ramp+paddr >> 2]|0:Read32(paddr|0)|0;
            continue;

        case 0x21:
            // lwz
            vaddr = (r[((ins >> 14) & 0x7C) >> 2]|0) + ((ins << 16) >> 16)|0;
            if ((read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read32tlbcheck = vaddr;
                read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read32tlblookup ^ vaddr;
            r[((ins >> 19) & 0x7C)>>2] = (paddr|0)>0?h[ramp+paddr >> 2]|0:Read32(paddr|0)|0;
            continue;

        case 0x23:
            // lbz
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read8utlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read8utlbcheck = vaddr;
                read8utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read8utlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] = b[ramp + (paddr ^ 3)|0]|0;
            } else {
                r[((ins >> 19) & 0x7C)>>2] = Read8(paddr|0)|0;
            }
            continue;

        case 0x24:
            // lbs 
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read8stlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read8stlbcheck = vaddr;
                read8stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read8stlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] = (b[ramp + (paddr ^ 3)|0] << 24) >> 24;
            } else {
                r[((ins >> 19) & 0x7C)>>2] = ((Read8(paddr|0)|0) << 24) >> 24;
            }
            continue;

        case 0x25:
            // lhz 
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read16utlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read16utlbcheck = vaddr;
                read16utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read16utlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] = w[ramp + (paddr ^ 2) >> 1];
            } else {
                r[((ins >> 19) & 0x7C)>>2] = (Read16(paddr|0)|0);
            }
            continue;

        case 0x26:
            // lhs
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read16stlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read16stlbcheck = vaddr;
                read16stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read16stlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] =  (w[ramp + (paddr ^ 2) >> 1] << 16) >> 16;
            } else {
                r[((ins >> 19) & 0x7C)>>2] = ((Read16(paddr|0)|0) << 16) >> 16;
            }
            continue;

        case 0x27:
            // addi signed 
            rA = r[((ins >> 14) & 0x7C)>>2]|0;
            r[((ins >> 19) & 0x7C) >> 2] = rA + ((ins << 16) >> 16)|0;
            //rindex = ((ins >> 19) & 0x7C);
            //SR_CY = r[rindex] < rA;
            //SR_OV = (((rA ^ imm ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
            //TODO overflow and carry
            // maybe wrong
            continue;

        case 0x29:
            // andi
            r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] & (ins & 0xFFFF);
            continue;


        case 0x2A:
            // ori
            r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF);
            continue;

        case 0x2B:
            // xori            
            rA = r[((ins >> 14) & 0x7C)>>2]|0;
            r[((ins >> 19) & 0x7C)>>2] = rA ^ ((ins << 16) >> 16);
            continue;

        case 0x2D:
            // mfspr
            r[((ins >> 19) & 0x7C)>>2] = GetSPR(r[((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF))|0;
            continue;

        case 0x2E:
            switch ((ins >> 6) & 0x3) {
            case 0:
                // slli
                r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] << (ins & 0x1F);
                continue;
            case 1:
                // rori
                r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] >>> (ins & 0x1F);
                continue;
            case 2:
                // srai
                r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] >> (ins & 0x1F);
                continue;
            default:
                DebugMessage(ERROR_UNKNOWN|0);
                //DebugMessage("Error: opcode 2E function not implemented");
                abort();
                break;
            }
            break;

        case 0x2F:
            // sf...i
            imm = (ins << 16) >> 16;
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfnei
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) == (imm|0);
                continue;
            case 0x1:
                // sfnei
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) != (imm|0);
                continue;
            case 0x2:
                // sfgtui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) > (imm >>> 0);
                continue;
            case 0x3:
                // sfgeui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) >= (imm >>> 0);
                continue;
            case 0x4:
                // sfltui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) < (imm >>> 0);
                continue;
            case 0x5:
                // sfleui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) <= (imm >>> 0);
                continue;
            case 0xa:
                // sfgtsi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) > (imm|0);
                continue;
            case 0xb:
                // sfgesi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) >= (imm|0);
                continue;
            case 0xc:
                // sfltsi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) < (imm|0);
                continue;
            case 0xd:
                // sflesi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) <= (imm|0);
                continue;
            default:
                //DebugMessage("Error: sf...i not supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >> 10) & 0xF800);
            //pc = pcbase + ppc|0;
            SetSPR(r[((ins >> 14) & 0x7C)>>2] | imm, r[((ins >> 9) & 0x7C)>>2]|0); // can raise an interrupt
            if (doze) { // doze
                doze = 0x0;
                if ((raise_interrupt|0) == 0)
                if (!(TTMR & (1 << 28))) {
                    return steps|0;
                }
            }
            continue;

       case 0x32:
            // floating point
            rA = (ins >> 14) & 0x7C;
            rB = (ins >> 9) & 0x7C;
            rD = (ins >> 19) & 0x7C;

            switch (ins & 0xFF) {
            case 0x0:
                // lf.add.s
                f[rD >> 2] = (+f[rA >> 2]) + (+f[rB >> 2]);
                continue;
            case 0x1:
                // lf.sub.s
                f[rD >> 2] = (+f[rA >> 2]) - (+f[rB >> 2]);
                continue;
            case 0x2:
                // lf.mul.s
                f[rD >> 2] = (+f[rA >> 2]) * (+f[rB >> 2]);
                continue;
            case 0x3:
                // lf.div.s
                f[rD >> 2] = (+f[rA >> 2]) / (+f[rB >> 2]);
                continue;
            case 0x4:
                // lf.itof.s
                f[rD >> 2] = +(r[rA >> 2]|0);
                continue;
            case 0x5:
                // lf.ftoi.s
                r[rD >> 2] = ~~(+floor(+f[rA >> 2]));
                continue;
            case 0x7:
                // lf.madd.s
                f[rD >> 2] = (+f[rD >> 2]) + (+f[rA >> 2]) * (+f[rB >> 2]);
                continue;
            case 0x8:
                // lf.sfeq.s
                SR_F = (+f[rA >> 2]) == (+f[rB >> 2]);
                continue;
            case 0x9:
                // lf.sfne.s
                SR_F = (+f[rA >> 2]) != (+f[rB >> 2]);
                continue;
            case 0xa:
                // lf.sfgt.s
                SR_F = (+f[rA >> 2]) > (+f[rB >> 2]);
                continue;
            case 0xb:
                // lf.sfge.s
                SR_F = (+f[rA >> 2]) >= (+f[rB >> 2]);
                continue;
            case 0xc:
                // lf.sflt.s
                SR_F = (+f[rA >> 2]) < (+f[rB >> 2]);
                continue;
            case 0xd:
                // lf.sfle.s
                SR_F = (+f[rA >> 2]) <= (+f[rB >> 2]);
                continue;
            default:
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x33:
            // swa
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            SR_F = ((paddr|0) == (EA|0))?(1|0):(0|0);
            EA = -1;
            if ((SR_F|0) == 0) {
                break;
            }
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write32(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            continue;

        case 0x35:
            // sw
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write32(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            continue;

        case 0x36:
            // sb
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write8tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write8tlbcheck = vaddr;
                write8tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write8tlblookup ^ vaddr;
            if ((paddr|0) > 0) {
                // consider that the data is saved in little endian
                b[ramp + (paddr ^ 3)|0] = r[((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write8(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            continue;

        case 0x37:
            // sh
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write16tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write16tlbcheck = vaddr;
                write16tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write16tlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                w[ramp + (paddr ^ 2) >> 1] = r[((ins >> 9) & 0x7C)>>2];
            } else {
                Write16(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            continue;

        case 0x38:
            // three operands commands
            rA = r[((ins >> 14) & 0x7C)>>2]|0;
            rB = r[((ins >> 9) & 0x7C)>>2]|0;
            rindex = (ins >> 19) & 0x7C;
            switch (ins & 0x3CF) {
            case 0x0:
                // add signed 
                r[rindex>>2] = rA + rB;
                //SR_CY = r[rindex] < rA;
                //SR_OV = (((rA ^ rB ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
                //TODO overflow and carry
                continue;
            case 0x2:
                // sub signed
                r[rindex>>2] = rA - rB;
                //TODO overflow and carry
                //SR_CY = (rB > rA);
                //SR_OV = (((rA ^ rB) & (rA ^ r[rindex])) & 0x80000000)?true:false;                
                continue;
            case 0x3:
                // and
                r[rindex>>2] = rA & rB;
                continue;
            case 0x4:
                // or
                r[rindex>>2] = rA | rB;
                continue;
            case 0x5:
                // or
                r[rindex>>2] = rA ^ rB;
                continue;
            case 0x8:
                // sll
                r[rindex>>2] = rA << (rB & 0x1F);
                break;
            case 0x48:
                // srl not signed
                r[rindex>>2] = rA >>> (rB & 0x1F);
                continue;
            case 0xf:
                // ff1
                r[rindex>>2] = 0;
                for (i = 0; (i|0) < 32; i=i+1|0) {
                    if (rA & (1 << i)) {
                        r[rindex>>2] = i + 1;
                        break;
                    }
                }
                continue;
            case 0x88:
                // sra signed
                r[rindex>>2] = rA >> (rB & 0x1F);
                // be carefull here and check
                continue;
            case 0x10f:
                // fl1
                r[rindex>>2] = 0;
                for (i = 31; (i|0) >= 0; i=i-1|0) {
                    if (rA & (1 << i)) {
                        r[rindex>>2] = i + 1;
                        break;
                    }
                }
                continue;
            case 0x306:
                // mul signed (specification seems to be wrong)
                r[rindex>>2] = imul(rA|0, rB|0)|0;
                continue;

            case 0x30a:
                // divu (specification seems to be wrong)
                SR_CY = (rB|0) == 0;
                SR_OV = 0;
                if (!SR_CY) {
                    r[rindex>>2] = /*Math.floor*/((rA>>>0) / (rB>>>0));
                }
                continue;

            case 0x309:
                // div (specification seems to be wrong)
                SR_CY = (rB|0) == 0;
                SR_OV = 0;
                if (!SR_CY) {
                    r[rindex>>2] = (rA|0) / (rB|0);
                }
                continue;

            default:
                //DebugMessage("Error: op38 opcode not supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x39:
            // sf....
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfeq
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) == (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            case 0x1:
                // sfne
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) != (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            case 0x2:
                // sfgtu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) > (r[((ins >> 9) & 0x7C)>>2]>>>0));
                continue;
            case 0x3:
                // sfgeu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) >= (r[((ins >> 9) & 0x7C)>>2]>>>0));
                continue;
            case 0x4:
                // sfltu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) < (r[((ins >> 9) & 0x7C)>>2]>>>0));
                continue;
            case 0x5:
                // sfleu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) <= (r[((ins >> 9) & 0x7C)>>2]>>>0));
                continue;
            case 0xa:
                // sfgts
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) > (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            case 0xb:
                // sfges
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) >= (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            case 0xc:
                // sflts
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) < (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            case 0xd:
                // sfles
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) <= (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            default:
                //DebugMessage("Error: sf.... function supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
            }
            break;

        default:
            //DebugMessage("Error: Instruction with opcode " + utils.ToHex(ins >>> 26) + " not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }

        } else { // fence

            pc = nextpc;

            if ((!delayedins_at_page_boundary|0)) {
                delayedins = 0;
            } 

            dsteps = dsteps + ((ppc - ppcorigin) >> 2)|0;

            // do this not so often
            if ((dsteps|0) >= 64)
            if (!(delayedins_at_page_boundary|0)) { // for now. Not sure if we need this

                dsteps = dsteps - 64|0;
                steps = steps - 64|0;
                if ((steps|0) < 0) return 0x0; // return to main loop

                // ---------- TICK ----------
                // timer enabled
                if ((TTMR >> 30) != 0) {
                    delta = (TTMR & 0xFFFFFFF) - (TTCR & 0xFFFFFFF) |0;
                    if ((delta|0) < 0) {
                        delta = delta + 0xFFFFFFF | 0;
                    }
                    TTCR = (TTCR + clockspeed|0);
                    if ((delta|0) < (clockspeed|0)) {
                        // if interrupt enabled
                        if (TTMR & (1 << 29)) {
                            TTMR = TTMR | (1 << 28); // set pending interrupt
                        }
                    }
                }

                // check if pending and check if interrupt must be triggered
                if (TTMR & (1 << 28)) {
                    if (SR_TEE) {
                        Exception(EXCEPT_TICK, h[group0p + (SPR_EEAR_BASE<<2) >> 2]|0);
                        // treat exception directly here
                        pc = nextpc;
                    }
                } else
                if (SR_IEE|0) 
                if (raise_interrupt|0) {
                    raise_interrupt = 0;
                    Exception(EXCEPT_INT, h[group0p + (SPR_EEAR_BASE<<2)>>2]|0);
                    pc = nextpc;
                }
            } // dsteps

            // Get Instruction Fast version
            if ((instlbcheck ^ pc) & 0xFFFFE000) // short check if it is still the correct page
            {
                instlbcheck = pc; // save the new page, lower 11 bits are ignored
                if (!SR_IME) {
                    instlblookup = 0x0;
                } else {
                    setindex = (pc >> 13) & 63; // check this values
                    tlmbr = h[group2p + ((0x200 | setindex) << 2) >> 2]|0;
                    // test if tlmbr is valid
                    if ((tlmbr & 1) == 0) {
                        if (ITLBRefill(pc, 64)|0) {
                            tlmbr = h[group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                        } else {
                            // just make sure he doesn't count this 'continue' as steps
                            ppcorigin = ppc;
                            delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    if ((tlmbr >> 19) != (pc >> 19)) {
                        if (ITLBRefill(pc, 64)|0) {
                            tlmbr = h[group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                        } else {
                            // just make sure he doesn't count this 'continue' as steps
                            ppcorigin = ppc;
                            delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    tlbtr = h[group2p + ((0x280 | setindex) << 2) >> 2]|0;
                    instlblookup = ((tlbtr ^ tlmbr) >> 13) << 13;
                }
            }

            // set pc and set the correcponding physical pc pointer
            //pc = pc;
            ppc = ramp + (instlblookup ^ pc)|0;
            ppcorigin = ppc;
            pcbase = pc - 4 - ppcorigin|0;

            if (delayedins_at_page_boundary|0) {
                delayedins_at_page_boundary = 0;
                fence = ppc + 4|0;
                nextpc = jump;
            } else {
                fence  = ((ppc >> 13) + 1) << 13; // next page
                nextpc = ((pc  >> 13) + 1) << 13;
            }

        } // fence

    }; // main loop

    return steps|0;
}

return {
    Init: Init,
    Reset: Reset,
    InvalidateTLB: InvalidateTLB,
    Step: Step,
    GetFlags: GetFlags,
    SetFlags: SetFlags,
    PutState: PutState,
    GetState: GetState,    
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    GetTicks: GetTicks,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt,
    AnalyzeImage: AnalyzeImage,
    GetStat : GetStat
};

}

module.exports = FastCPU;

},{"../messagehandler":43}],45:[function(require,module,exports){
/* this is a unified, abstract interface (a facade) to the different
 * CPU implementations
 */

"use strict";
var message = require('../messagehandler'); // global variable
var toHex = require('../utils').ToHex;
var imul = require('../imul');

// CPUs
var FastCPU = require('./fastcpu');
var SafeCPU = require('./safecpu');
var SMPCPU = require('./smpcpu');

// The asm.js ("Fast") and SMP cores must be singletons
//  because of Firefox limitations.
var fastcpu = null;
var smpcpu = null;

var stdlib = {
    Int32Array : Int32Array,
    Float32Array : Float32Array,
    Uint8Array : Uint8Array,
    Uint16Array : Uint16Array,
    Math : Math
};

function createCPUSingleton(cpuname, ram, heap, ncores) {
    var foreign = {
        DebugMessage: message.Debug,
        abort : message.Abort,
        imul : Math.imul || imul,
        Read32 : ram.Read32Big.bind(ram),
        Write32 : ram.Write32Big.bind(ram),
        Read16 : ram.Read16Big.bind(ram),
        Write16 : ram.Write16Big.bind(ram),
        Read8 : ram.Read8Big.bind(ram),
        Write8 : ram.Write8Big.bind(ram)
    };
    if (cpuname === 'asm') {
        if (fastcpu === null) {
            fastcpu = FastCPU(stdlib, foreign, heap);
            fastcpu.Init();
        }
        return fastcpu;
    } else if (cpuname === 'smp') {
        if (smpcpu === null) {
            smpcpu = SMPCPU(stdlib, foreign, heap);
            smpcpu.Init(ncores);
        }
        return smpcpu;
    }
}

function createCPU(cpuname, ram, heap, ncores) {
    var cpu = null;

    if (cpuname === "safe") {
        return new SafeCPU(ram);
    }
    if (cpuname === "asm") {
        cpu = createCPUSingleton(cpuname, ram, heap, ncores);
        cpu.Init();
        return cpu;
    }
    if (cpuname === "smp") {
        cpu = createCPUSingleton(cpuname, ram, heap, ncores);
        cpu.Init(ncores);
        return cpu;
    }
    throw new Error("invalid CPU name:" + cpuname);
}

function CPU(cpuname, ram, heap, ncores) {
    this.cpu = createCPU(cpuname, ram, heap, ncores);
    this.name = cpuname;
    this.ncores = ncores;
    this.ram = ram;
    this.heap = heap;
    this.littleendian = false;

    return this;
}

CPU.prototype.switchImplementation = function(cpuname) {
    var oldcpu = this.cpu;
    var oldcpuname = this.name;
    if (oldcpuname == "smp") return;

    this.cpu = createCPU(cpuname, this.ram, this.heap, this.ncores);

    this.cpu.InvalidateTLB(); // reset TLB
    var f = oldcpu.GetFlags();
    this.cpu.SetFlags(f|0);
    var h;
    if (oldcpuname === "asm") {
        h = new Int32Array(this.heap);
        oldcpu.GetState();
        this.cpu.pc = h[(0x40 + 0)];
        this.cpu.nextpc = h[(0x40 + 1)];
        this.cpu.delayedins = h[(0x40 + 2)]?true:false;
        this.cpu.TTMR = h[(0x40 + 4)];
        this.cpu.TTCR = h[(0x40 + 5)];
        this.cpu.PICMR = h[(0x40 + 6)];
        this.cpu.PICSR = h[(0x40 + 7)];
        this.cpu.boot_dtlb_misshandler_address = h[(0x40 + 8)];
        this.cpu.boot_itlb_misshandler_address = h[(0x40 + 9)];
        this.cpu.current_pgd = h[(0x40 + 10)];
    } else if (cpuname === "asm") {
        h = new Int32Array(this.heap);
        h[(0x40 + 0)] = oldcpu.pc;
        h[(0x40 + 1)] = oldcpu.nextpc;
        h[(0x40 + 2)] = oldcpu.delayedins;
        h[(0x40 + 3)] = 0x0;
        h[(0x40 + 4)] = oldcpu.TTMR;
        h[(0x40 + 5)] = oldcpu.TTCR;
        h[(0x40 + 6)] = oldcpu.PICMR;
        h[(0x40 + 7)] = oldcpu.PICSR;
        h[(0x40 + 8)] = oldcpu.boot_dtlb_misshandler_address;
        h[(0x40 + 9)] = oldcpu.boot_itlb_misshandler_address;
        h[(0x40 + 10)] = oldcpu.current_pgd;
        this.cpu.PutState();
    } else {
        this.cpu.pc = oldcpu.pc;
        this.cpu.nextpc = oldcpu.nextpc;
        this.cpu.delayedins = oldcpu.delayedins;
        this.cpu.TTMR = oldcpu.TTMR;
        this.cpu.TTCR = oldcpu.TTCR;
        this.cpu.PICMR = oldcpu.PICMR;
        this.cpu.PICSR = oldcpu.PICSR;
        this.cpu.boot_dtlb_misshandler_address = oldcpu.boot_dtlb_misshandler_address;
        this.cpu.boot_itlb_misshandler_address = oldcpu.itlb_misshandler_address;
        this.cpu.current_pgd = oldcpu.current_pgd;
    }
};

CPU.prototype.toString = function() {
    var r = new Uint32Array(this.heap);
    var str = '';
    str += "Current state of the machine\n";
    //str += "clock: " + toHex(cpu.clock) + "\n";
    str += "PC: " + toHex(this.cpu.pc<<2) + "\n";
    str += "next PC: " + toHex(this.cpu.nextpc<<2) + "\n";
    //str += "ins: " + toHex(cpu.ins) + "\n";
    //str += "main opcode: " + toHex(cpu.ins>>>26) + "\n";
    //str += "sf... opcode: " + toHex((cpu.ins>>>21)&0x1F) + "\n";
    //str += "op38. opcode: " + toHex((cpu.ins>>>0)&0x3CF) + "\n";

    for (var i = 0; i < 32; i += 4) {
        str += "   r" + (i + 0) + ": " +
            toHex(r[i + 0]) + "   r" + (i + 1) + ": " +
            toHex(r[i + 1]) + "   r" + (i + 2) + ": " +
            toHex(r[i + 2]) + "   r" + (i + 3) + ": " +
            toHex(r[i + 3]) + "\n";
    }
    
    if (this.cpu.delayedins) {
        str += "delayed instruction\n";
    }
    if (this.cpu.SR_SM) {
        str += "Supervisor mode\n";
    }
    else {
        str += "User mode\n";
    }
    if (this.cpu.SR_TEE) {
        str += "tick timer exception enabled\n";
    }
    if (this.cpu.SR_IEE) {
        str += "interrupt exception enabled\n";
    }
    if (this.cpu.SR_DME) {
        str += "data mmu enabled\n";
    }
    if (this.cpu.SR_IME) {
        str += "instruction mmu enabled\n";
    }
    if (this.cpu.SR_LEE) {
        str += "little endian enabled\n";
    }
    if (this.cpu.SR_CID) {
        str += "context id enabled\n";
    }
    if (this.cpu.SR_F) {
        str += "flag set\n";
    }
    if (this.cpu.SR_CY) {
        str += "carry set\n";
    }
    if (this.cpu.SR_OV) {
        str += "overflow set\n";
    }
    return str;
};

// forward a couple of methods to the CPU implementation
var forwardedMethods = [
    "Reset", 
    "Step",
    "RaiseInterrupt", 
    "Step",
    "AnalyzeImage",
    "GetTicks",
    "GetTimeToNextInterrupt",
    "ProgressTime", 
    "ClearInterrupt"];
forwardedMethods.forEach(function(m) {
    CPU.prototype[m] = function() {
        return this.cpu[m].apply(this.cpu, arguments);        
    };
});

module.exports = CPU;

},{"../imul":42,"../messagehandler":43,"../utils":58,"./fastcpu":44,"./safecpu":46,"./smpcpu":47}],46:[function(require,module,exports){
// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

// special purpose register index
var SPR_UPR = 1; // unit present register
var SPR_SR = 17; // supervision register
var SPR_EEAR_BASE = 48; // exception ea register
var SPR_EPCR_BASE = 32; // exception pc register
var SPR_ESR_BASE = 64; // exception sr register
var SPR_IMMUCFGR = 4; // Instruction MMU Configuration register
var SPR_DMMUCFGR = 3; // Data MMU Configuration register
var SPR_ICCFGR = 6; // Instruction Cache configuration register
var SPR_DCCFGR = 5; // Data Cache Configuration register
var SPR_VR = 0; // Version register

// exception types and addresses
var EXCEPT_ITLBMISS = 0xA00; // instruction translation lookaside buffer miss
var EXCEPT_IPF = 0x400; // instruction page fault
var EXCEPT_RESET = 0x100; // reset the processor
var EXCEPT_DTLBMISS = 0x900; // data translation lookaside buffer miss
var EXCEPT_DPF = 0x300; // instruction page fault
var EXCEPT_BUSERR = 0x200; // wrong memory access
var EXCEPT_TICK = 0x500; // tick counter interrupt
var EXCEPT_INT = 0x800; // interrupt of external devices
var EXCEPT_SYSCALL = 0xC00; // syscall, jump into supervisor mode
var EXCEPT_TRAP = 0xE00; // syscall, jump into supervisor mode

// constructor
function SafeCPU(ram) {
    this.ram = ram;

    // registers
    // r[32] and r[33] are used to calculate the virtual address and physical address
    // to make sure that they are not transformed accidently into a floating point number
    this.r = new Int32Array(this.ram.heap, 0, 34 << 2);
    this.f = new Float32Array(this.ram.heap, 0, 32 << 2);

    // special purpose registers
    this.group0 = new Int32Array(this.ram.heap, 0x2000, 0x2000);

    // data tlb
    this.group1 = new Int32Array(this.ram.heap, 0x4000, 0x2000);

    // instruction tlb
    this.group2 = new Int32Array(this.ram.heap, 0x6000, 0x2000);

    // define variables and initialize
    this.pc = 0x0; // instruction pointer in multiples of four
    this.nextpc = 0x0; // pointer to next instruction in multiples of four
    //this.ins=0x0; // current instruction to handle

    this.delayedins = false; // the current instruction is an delayed instruction, one cycle before a jump

    this.clock = 0x0;

    this.EA = -1; // hidden register for atomic lwa operation

    this.TTMR = 0x0; // Tick timer mode register
    this.TTCR = 0x0; // Tick timer count register

    this.PICMR = 0x3; // interrupt controller mode register (use nmi)
    this.PICSR = 0x0; // interrupt controller set register

    // flags
    this.SR_SM = true; // supervisor mode
    this.SR_TEE = false; // tick timer Exception Enabled
    this.SR_IEE = false; // interrupt Exception Enabled
    this.SR_DCE = false; // Data Cache Enabled
    this.SR_ICE = false; // Instruction Cache Enabled
    this.SR_DME = false; // Data MMU Enabled
    this.SR_IME = false; // Instruction MMU Enabled
    this.SR_LEE = false; // Little Endian Enabled
    this.SR_CE = false; // CID Enabled ?
    this.SR_F = false; // Flag for l.sf... instructions 
    this.SR_CY = false; // Carry Flag
    this.SR_OV = false; // Overflow Flag
    this.SR_OVE = false; // Overflow Flag Exception
    this.SR_DSX = false; // Delay Slot Exception
    this.SR_EPH = false; // Exception Prefix High
    this.SR_FO = true; // Fixed One, always set
    this.SR_SUMRA = false; // SPRS User Mode Read Access, or TRAP exception disable?
    this.SR_CID = 0x0; //Context ID
    
    this.Reset();
}

SafeCPU.prototype.Reset = function() {
    this.TTMR = 0x0;
    this.TTCR = 0x0;
    this.PICMR = 0x3;
    this.PICSR = 0x0;

    this.group0[SPR_IMMUCFGR] = 0x18; // 0 ITLB has one way and 64 sets
    this.group0[SPR_DMMUCFGR] = 0x18; // 0 DTLB has one way and 64 sets
    this.group0[SPR_ICCFGR] = 0x48;
    this.group0[SPR_DCCFGR] = 0x48;
    this.group0[SPR_VR] = 0x12000001;

    // UPR present
    // data mmu present
    // instruction mmu present
    // PIC present (architecture manual seems to be wrong here)
    // Tick timer present
    this.group0[SPR_UPR] = 0x619;

    this.Exception(EXCEPT_RESET, 0x0); // set pc values
    this.pc = this.nextpc;
    this.nextpc++;
}

SafeCPU.prototype.InvalidateTLB = function() {
}

SafeCPU.prototype.GetTimeToNextInterrupt = function () {

    if ((this.TTMR >> 30) == 0) return -1;
    var delta = (this.TTMR & 0xFFFFFFF) - (this.TTCR & 0xFFFFFFF);
    delta += delta<0?0xFFFFFFF:0x0;
    return delta;
}

SafeCPU.prototype.GetTicks = function () {
    if ((this.TTMR >> 30) == 0) return -1;
    return this.TTCR & 0xFFFFFFF;
}

SafeCPU.prototype.ProgressTime = function (delta) {
    this.TTCR = (this.TTCR + delta) & 0xFFFFFFFF;
}


SafeCPU.prototype.AnalyzeImage = function() // we haveto define these to copy the cpus
{
    this.boot_dtlb_misshandler_address = 0x0;
    this.boot_itlb_misshandler_address = 0x0;
    this.current_pgd = 0x0;

}

SafeCPU.prototype.SetFlags = function (x) {
    this.SR_SM = (x & (1 << 0)) ? true : false;
    this.SR_TEE = (x & (1 << 1)) ? true : false;
    var old_SR_IEE = this.SR_IEE;
    this.SR_IEE = (x & (1 << 2)) ? true : false;
    this.SR_DCE = (x & (1 << 3)) ? true : false;
    this.SR_ICE = (x & (1 << 4)) ? true : false;
    var old_SR_DME = this.SR_DME;
    this.SR_DME = (x & (1 << 5)) ? true : false;
    var old_SR_IME = this.SR_IME;
    this.SR_IME = (x & (1 << 6)) ? true : false;
    this.SR_LEE = (x & (1 << 7)) ? true : false;
    this.SR_CE = (x & (1 << 8)) ? true : false;
    this.SR_F = (x & (1 << 9)) ? true : false;
    this.SR_CY = (x & (1 << 10)) ? true : false;
    this.SR_OV = (x & (1 << 11)) ? true : false;
    this.SR_OVE = (x & (1 << 12)) ? true : false;
    this.SR_DSX = (x & (1 << 13)) ? true : false;
    this.SR_EPH = (x & (1 << 14)) ? true : false;
    this.SR_FO = true;
    this.SR_SUMRA = (x & (1 << 16)) ? true : false;
    this.SR_CID = (x >> 28) & 0xF;
    if (this.SR_LEE) {
        message.Debug("little endian not supported");
        message.Abort();
    }
    if (this.SR_CID) {
        message.Debug("context id not supported");
        message.Abort();
    }
    if (this.SR_EPH) {
        message.Debug("exception prefix not supported");
        message.Abort();
    }
    if (this.SR_DSX) {
        message.Debug("delay slot exception not supported");
        message.Abort();
    }
    if (this.SR_IEE && !old_SR_IEE) {
        this.CheckForInterrupt();
    }
};

SafeCPU.prototype.GetFlags = function () {
    var x = 0x0;
    x |= this.SR_SM ? (1 << 0) : 0;
    x |= this.SR_TEE ? (1 << 1) : 0;
    x |= this.SR_IEE ? (1 << 2) : 0;
    x |= this.SR_DCE ? (1 << 3) : 0;
    x |= this.SR_ICE ? (1 << 4) : 0;
    x |= this.SR_DME ? (1 << 5) : 0;
    x |= this.SR_IME ? (1 << 6) : 0;
    x |= this.SR_LEE ? (1 << 7) : 0;
    x |= this.SR_CE ? (1 << 8) : 0;
    x |= this.SR_F ? (1 << 9) : 0;
    x |= this.SR_CY ? (1 << 10) : 0;
    x |= this.SR_OV ? (1 << 11) : 0;
    x |= this.SR_OVE ? (1 << 12) : 0;
    x |= this.SR_DSX ? (1 << 13) : 0;
    x |= this.SR_EPH ? (1 << 14) : 0;
    x |= this.SR_FO ? (1 << 15) : 0;
    x |= this.SR_SUMRA ? (1 << 16) : 0;
    x |= (this.SR_CID << 28);
    return x;
};

SafeCPU.prototype.CheckForInterrupt = function () {
    if (!this.SR_IEE) {
        return;
    }
    if (this.PICMR & this.PICSR) {
        this.Exception(EXCEPT_INT, this.group0[SPR_EEAR_BASE]);
        this.pc = this.nextpc++;
    }
};

SafeCPU.prototype.RaiseInterrupt = function (line, cpuid) {
    var lmask = 1 << line;
    this.PICSR |= lmask;
    this.CheckForInterrupt();
};

SafeCPU.prototype.ClearInterrupt = function (line, cpuid) {
    this.PICSR &= ~(1 << line);
};

SafeCPU.prototype.SetSPR = function (idx, x) {
    var address = idx & 0x7FF;
    var group = (idx >> 11) & 0x1F;

    switch (group) {
    case 0:
        if (address == SPR_SR) {
            this.SetFlags(x);
        }
        this.group0[address] = x;
        break;
    case 1:
        // Data MMU
        this.group1[address] = x;
        break;
    case 2:
        // ins MMU
        this.group2[address] = x;
        break;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        break;
    case 8:
        break;
    case 9:
        // pic
        switch (address) {
        case 0:
            this.PICMR = x | 0x3; // we use non maskable interrupt here
            // check immediate for interrupt
            if (this.SR_IEE) {
                if (this.PICMR & this.PICSR) {
                    message.Debug("Error in SetSPR: Direct triggering of interrupt exception not supported?");
                    message.Abort();
                }
            }
            break;
        case 2: // PICSR
            break;
        default:
            message.Debug("Error in SetSPR: interrupt address not supported");
            message.Abort();
        }
        break;
    case 10:
        //tick timer
        switch (address) {
        case 0:
            this.TTMR = x;
            if (((this.TTMR >> 30)&3) != 0x3) {
                //message.Debug("Error in SetSPR: Timer mode other than continuous not supported");
                //message.Abort();
            }
            break;
        case 1:
            this.TTCR = x;
            break;
        default:
            message.Debug("Error in SetSPR: Tick timer address not supported");
            message.Abort();
            break;
        }
        break;

    default:
        message.Debug("Error in SetSPR: group " + group + " not found");
        message.Abort();
        break;
    }
};

SafeCPU.prototype.GetSPR = function (idx) {
    var address = idx & 0x7FF;
    var group = (idx >> 11) & 0x1F;

    switch (group) {
    case 0:
        if (address == SPR_SR) {
            return this.GetFlags();
        }
        return this.group0[address];
    case 1:
        return this.group1[address];
    case 2:
        return this.group2[address];
    case 8:
        return 0x0;

    case 9:
        // pic
        switch (address) {
        case 0:
            return this.PICMR;
        case 2:
            return this.PICSR;
        default:
            message.Debug("Error in GetSPR: PIC address unknown");
            message.Abort();
            break;
        }
        break;

    case 10:
        // tick Timer
        switch (address) {
        case 0:
            return this.TTMR;
        case 1:
            return this.TTCR; // or clock
        default:
            message.Debug("Error in GetSPR: Tick timer address unknown");
            message.Abort();
            break;
        }
        break;
    default:
        message.Debug("Error in GetSPR: group " + group +  " unknown");
        message.Abort();
        break;
    }

};

SafeCPU.prototype.Exception = function (excepttype, addr) {
    var except_vector = excepttype | (this.SR_EPH ? 0xf0000000 : 0x0);
    //message.Debug("Info: Raising Exception " + utils.ToHex(excepttype));

    this.SetSPR(SPR_EEAR_BASE, addr);
    this.SetSPR(SPR_ESR_BASE, this.GetFlags());

    this.EA = -1;
    this.SR_OVE = false;
    this.SR_SM = true;
    this.SR_IEE = false;
    this.SR_TEE = false;
    this.SR_DME = false;

    this.nextpc = except_vector>>2;

    switch (excepttype) {
    case EXCEPT_RESET:
        break;

    case EXCEPT_ITLBMISS:
    case EXCEPT_IPF:
    case EXCEPT_DTLBMISS:
    case EXCEPT_DPF:
    case EXCEPT_BUSERR:
    case EXCEPT_TICK:
    case EXCEPT_INT:
    case EXCEPT_TRAP:
        this.SetSPR(SPR_EPCR_BASE, (this.pc<<2) - (this.delayedins ? 4 : 0));
        break;

    case EXCEPT_SYSCALL:
        this.SetSPR(SPR_EPCR_BASE, (this.pc<<2) + 4 - (this.delayedins ? 4 : 0));
        break;
    default:
        message.Debug("Error in Exception: exception type not supported");
        message.Abort();
    }

    // Handle restart mode timer
    if (excepttype == EXCEPT_TICK && (this.TTMR >> 30) == 0x1) {
	this.TTCR = 0;
    }

    this.delayedins = false;
    this.SR_IME = false;
};


SafeCPU.prototype.DTLBLookup = function (addr, write) {
    if (!this.SR_DME) {
        return addr;
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    var setindex = (addr >> 13) & 63;
    var tlmbr = this.group1[0x200 | setindex]; // match register
    if (((tlmbr & 1) == 0) || ((tlmbr >> 19) != (addr >> 19))) {
        this.Exception(EXCEPT_DTLBMISS, addr);
        return -1;
    }
        // set lru 
        if (tlmbr & 0xC0) {
            message.Debug("Error: LRU ist not supported");
            message.Abort();
        }
    
    var tlbtr = this.group1[0x280 | setindex]; // translate register

    // check if supervisor mode
    if (this.SR_SM) {
        if (
            ((!write) && (!(tlbtr & 0x100))) || // check if SRE
            ((write) && (!(tlbtr & 0x200)))     // check if SWE
           ) {
            this.Exception(EXCEPT_DPF, addr);
            return -1;
           }
    } else {
        if (
               ((!write) && (!(tlbtr & 0x40))) || // check if URE
               ((write) && (!(tlbtr & 0x80)))     // check if UWE
           ) {
            this.Exception(EXCEPT_DPF, addr);
            return -1;
           }
    }
    return ((tlbtr & 0xFFFFE000) | (addr & 0x1FFF));
};

// the slow and safe version
SafeCPU.prototype.GetInstruction = function (addr) {
    if (!this.SR_IME) {
        return this.ram.Read32Big(addr);
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64
    
    var setindex = (addr >> 13) & 63;
    setindex &= 63; // number of sets
    var tlmbr = this.group2[0x200 | setindex];

    // test if tlmbr is valid
    if (((tlmbr & 1) == 0) || ((tlmbr >> 19) != (addr >> 19))) {
            this.Exception(EXCEPT_ITLBMISS, this.pc<<2);
            return -1;
    }
    // set lru
    if (tlmbr & 0xC0) {
        message.Debug("Error: LRU ist not supported");
        message.Abort();
    }

    var tlbtr = this.group2[0x280 | setindex];
    //Test for page fault
    // check if supervisor mode
    if (this.SR_SM) {
        // check if user read enable is not set(URE)
        if (!(tlbtr & 0x40)) {
            this.Exception(EXCEPT_IPF, this.pc<<2);
            return -1;
        }
    } else {
        // check if supervisor read enable is not set (SRE)
        if (!(tlbtr & 0x80)) {
            this.Exception(EXCEPT_IPF, this.pc<<2);
            return -1;
        }
    }
    return this.ram.Read32Big((tlbtr & 0xFFFFE000) | (addr & 0x1FFF));
};

SafeCPU.prototype.Step = function (steps, clockspeed) {
    var ins = 0x0;
    var imm = 0x0;
    var i = 0;
    var rindex = 0x0;
    var rA = 0x0,
        rB = 0x0,
        rD = 0x0;

    // local variables could be faster
    var r = this.r;
    var f = this.f;
    var ram = this.ram;
    var int32mem = this.ram.int32mem;
    var group2 = this.group2;

    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var jump = 0x0;
    var delta = 0x0;

   
    do {
        this.clock++;

        // do this not so often
        if (!(steps & 63)) {
            // ---------- TICK ----------
            // timer enabled
            if ((this.TTMR >> 30) != 0) {
                delta = (this.TTMR & 0xFFFFFFF) - (this.TTCR & 0xFFFFFFF);
                delta += delta<0?0xFFFFFFF:0x0;
                this.TTCR = (this.TTCR + clockspeed) & 0xFFFFFFFF;
                if (delta < clockspeed) {
                    // if interrupt enabled
                    if (this.TTMR & (1 << 29)) {
                        this.TTMR |= (1 << 28); // set pending interrupt
                    }
                }
            }

            // check if pending and check if interrupt must be triggered
            if ((this.SR_TEE) && (this.TTMR & (1 << 28))) {
                this.Exception(EXCEPT_TICK, this.group0[SPR_EEAR_BASE]);
                this.pc = this.nextpc++;
            }
        }
        
        ins = this.GetInstruction(this.pc<<2)
        if (ins == -1) {
            this.pc = this.nextpc++;
            continue;
        }

        switch ((ins >> 26)&0x3F) {
        case 0x0:
            // j
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x1:
            // jal
            jump = this.pc + ((ins << 6) >> 6);
            r[9] = (this.nextpc<<2) + 4;
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x3:
            // bnf
            if (this.SR_F) {
                break;
            }
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;
        case 0x4:
            // bf
            if (!this.SR_F) {
                break;
            }
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;
        case 0x5:
            // nop
            break;
        case 0x6:
            // movhi or macrc
            rindex = (ins >> 21) & 0x1F;
            // if 16th bit is set
            if (ins & 0x10000) {
                message.Debug("Error: macrc not supported\n");
                message.Abort();
            } else {
                r[rindex] = ((ins & 0xFFFF) << 16); // movhi
            }
            break;

        case 0x8:
            // sys and trap
            if ((ins&0xFFFF0000) == 0x21000000) {
                message.Debug("Trap at " + utils.ToHex(this.pc<<2));
                this.Exception(EXCEPT_TRAP, this.group0[SPR_EEAR_BASE]);
            } else {
                this.Exception(EXCEPT_SYSCALL, this.group0[SPR_EEAR_BASE]);
            }
            break;

        case 0x9:
            // rfe
            this.nextpc = this.GetSPR(SPR_EPCR_BASE)>>2;
            this.pc = this.nextpc++;
            this.delayedins = false;
            this.SetFlags(this.GetSPR(SPR_ESR_BASE)); // could raise an exception
            continue;

        case 0x11:
            // jr
            jump = r[(ins >> 11) & 0x1F]>>2;
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;
        case 0x12:
            // jalr
            jump = r[(ins >> 11) & 0x1F]>>2;
            r[9] = (this.nextpc<<2) + 4;
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x1B:
            // lwa
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((r[32] & 3) != 0) {
                message.Debug("Error in lwz: no unaligned access allowed");
                abort();
            }
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            this.EA = r[33];
            r[(ins >> 21) & 0x1F] = r[33]>0?ram.int32mem[r[33] >> 2]:ram.Read32Big(r[33]);
            break;


        case 0x21:
            // lwz
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((r[32] & 3) != 0) {
                message.Debug("Error in lwz: no unaligned access allowed");
                abort();
            }
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = r[33]>0?ram.int32mem[r[33] >> 2]:ram.Read32Big(r[33]);
            break;

        case 0x23:
            // lbz
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ram.Read8Big(r[33]);
            break;

        case 0x24:
            // lbs
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ((ram.Read8Big(r[33])) << 24) >> 24;
            break;

        case 0x25:
            // lhz 
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ram.Read16Big(r[33]);
            break;

        case 0x26:
            // lhs
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = (ram.Read16Big(r[33]) << 16) >> 16;
            break;

        case 0x27:
            // addi signed 
            imm = (ins << 16) >> 16;
            rA = r[(ins >> 16) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            r[rindex] = rA + imm;
            this.SR_CY = r[rindex] < rA;
            this.SR_OV = (((rA ^ imm ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
            //TODO overflow and carry
            // maybe wrong
            break;

        case 0x29:
            // andi
            r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] & (ins & 0xFFFF);
            break;


        case 0x2A:
            // ori
            r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] | (ins & 0xFFFF);
            break;

        case 0x2B:
            // xori            
            rA = r[(ins >> 16) & 0x1F];
            r[(ins >> 21) & 0x1F] = rA ^ ((ins << 16) >> 16);
            break;

        case 0x2D:
            // mfspr
            r[(ins >> 21) & 0x1F] = this.GetSPR(r[(ins >> 16) & 0x1F] | (ins & 0xFFFF));
            break;

        case 0x2E:
            switch ((ins >> 6) & 0x3) {
            case 0:
                // slli
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] << (ins & 0x1F);
                break;
            case 1:
                // rori
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] >>> (ins & 0x1F);
                break;
            case 2:
                // srai
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] >> (ins & 0x1F);
                break;
            default:
                message.Debug("Error: opcode 2E function not implemented");
                abort();
                break;
            }
            break;

        case 0x2F:
            // sf...i
            imm = (ins << 16) >> 16;
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfnei
                this.SR_F = (r[(ins >> 16) & 0x1F] == imm) ? true : false;
                break;
            case 0x1:
                // sfnei
                this.SR_F = (r[(ins >> 16) & 0x1F] != imm) ? true : false;
                break;
            case 0x2:
                // sfgtui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) > (imm >>> 0)) ? true : false;
                break;
            case 0x3:
                // sfgeui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) >= (imm >>> 0)) ? true : false;
                break;
            case 0x4:
                // sfltui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) < (imm >>> 0)) ? true : false;
                break;
            case 0x5:
                // sfleui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) <= (imm >>> 0)) ? true : false;
                break;
            case 0xa:
                // sfgtsi
                this.SR_F = (r[(ins >> 16) & 0x1F] > imm) ? true : false;
                break;
            case 0xb:
                // sfgesi
                this.SR_F = (r[(ins >> 16) & 0x1F] >= imm) ? true : false;
                break;
            case 0xc:
                // sfltsi
                this.SR_F = (r[(ins >> 16) & 0x1F] < imm) ? true : false;
                break;
            case 0xd:
                // sflesi
                this.SR_F = (r[(ins >> 16) & 0x1F] <= imm) ? true : false;
                break;
            default:
                message.Debug("Error: sf...i not supported yet");
                abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >> 10) & 0xF800);
            this.pc = this.nextpc++;
            this.delayedins = false;
            this.SetSPR(r[(ins >> 16) & 0x1F] | imm, r[(ins >> 11) & 0x1F]); // could raise an exception
            continue;

       case 0x32:
            // floating point
            rA = (ins >> 16) & 0x1F;
            rB = (ins >> 11) & 0x1F;
            rD = (ins >> 21) & 0x1F;
            switch (ins & 0xFF) {
            case 0x0:
                // lf.add.s
                f[rD] = f[rA] + f[rB];
                break;
            case 0x1:
                // lf.sub.s
                f[rD] = f[rA] - f[rB];
                break;
            case 0x2:
                // lf.mul.s
                f[rD] = f[rA] * f[rB];
                break;
            case 0x3:
                // lf.div.s
                f[rD] = f[rA] / f[rB];
                break;
            case 0x4:
                // lf.itof.s
                f[rD] = r[rA];
                break;
            case 0x5:
                // lf.ftoi.s
                r[rD] = f[rA];
                break;
            case 0x7:
                // lf.madd.s
                f[rD] += f[rA] * f[rB];
                break;
            case 0x8:
                // lf.sfeq.s
                this.SR_F = (f[rA] == f[rB]) ? true : false;
                break;
            case 0x9:
                // lf.sfne.s
                this.SR_F = (f[rA] != f[rB]) ? true : false;
                break;
            case 0xa:
                // lf.sfgt.s
                this.SR_F = (f[rA] > f[rB]) ? true : false;
                break;
            case 0xb:
                // lf.sfge.s
                this.SR_F = (f[rA] >= f[rB]) ? true : false;
                break;
            case 0xc:
                // lf.sflt.s
                this.SR_F = (f[rA] < f[rB]) ? true : false;
                break;
            case 0xd:
                // lf.sfle.s
                this.SR_F = (f[rA] <= f[rB]) ? true : false;
                break;
            default:
                message.Debug("Error: lf. function " + utils.ToHex(ins & 0xFF) + " not supported yet");
                message.Abort();
                break;
            }
            break;

        case 0x33:
            // swa
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            if (r[32] & 0x3) {
                message.Debug("Error in sw: no aligned memory access");
                abort();
            }
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            this.SR_F = (r[33] == this.EA)?true:false;
            this.EA = -1;
            if (this.SR_F == false) {
                break;
            }
            if (r[33] > 0) {
                int32mem[r[33] >> 2] = r[(ins >> 11) & 0x1F];
            } else {
                ram.Write32Big(r[33], r[(ins >> 11) & 0x1F]);
            }
            break;
            
        case 0x35:
            // sw
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            if (r[32] & 0x3) {
                message.Debug("Error in sw: no aligned memory access");
                message.Abort();
            }
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            if (r[33]>0) {
                int32mem[r[33] >> 2] = r[(ins >> 11) & 0x1F];
            } else {
                ram.Write32Big(r[33], r[(ins >> 11) & 0x1F]);
            }
            break;


        case 0x36:
            // sb
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            ram.Write8Big(r[33], r[(ins >> 11) & 0x1F]);
            break;

        case 0x37:
            // sh
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            ram.Write16Big(r[33], r[(ins >> 11) & 0x1F]);
            break;

        case 0x38:
            // three operands commands
            rA = r[(ins >> 16) & 0x1F];
            rB = r[(ins >> 11) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            switch (ins & 0x3CF) {
            case 0x0:
                // add signed 
                r[rindex] = rA + rB;
                this.SR_CY = r[rindex] < rA;
                this.SR_OV = (((rA ^ rB ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
                //TODO overflow and carry
                break;
            case 0x2:
                // sub signed
                r[rindex] = rA - rB;
                //TODO overflow and carry
                this.SR_CY = (rB > rA);
                this.SR_OV = (((rA ^ rB) & (rA ^ r[rindex])) & 0x80000000)?true:false;                
                break;
            case 0x3:
                // and
                r[rindex] = rA & rB;
                break;
            case 0x4:
                // or
                r[rindex] = rA | rB;
                break;
            case 0x5:
                // or
                r[rindex] = rA ^ rB;
                break;
            case 0x8:
                // sll
                r[rindex] = rA << (rB & 0x1F);
                break;
            case 0x48:
                // srl not signed
                r[rindex] = rA >>> (rB & 0x1F);
                break;
            case 0xf:
                // ff1
                r[rindex] = 0;
                for (i = 0; i < 32; i++) {
                    if (rA & (1 << i)) {
                        r[rindex] = i + 1;
                        break;
                    }
                }
                break;
            case 0x88:
                // sra signed
                r[rindex] = rA >> (rB & 0x1F);
                break;
            case 0x10f:
                // fl1
                r[rindex] = 0;
                for (i = 31; i >= 0; i--) {
                    if (rA & (1 << i)) {
                        r[rindex] = i + 1;
                        break;
                    }
                }
                break;
            case 0x306:
                // mul signed (specification seems to be wrong)
                {
                    // this is a hack to do 32 bit signed multiply. Seems to work but needs to be tested. 
                    r[rindex] = utils.int32(rA >> 0) * utils.int32(rB);
                    var rAl = rA & 0xFFFF;
                    var rBl = rB & 0xFFFF;
                    r[rindex] = r[rindex] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
                    var result = Number(utils.int32(rA)) * Number(utils.int32(rB));
                    this.SR_OV = (result < (-2147483647 - 1)) || (result > (2147483647));
                    var uresult = utils.uint32(rA) * utils.uint32(rB);
                    this.SR_CY = (uresult > (4294967295));
                }
                break;
            case 0x30a:
                // divu (specification seems to be wrong)
                this.SR_CY = rB == 0;
                this.SR_OV = false;
                if (!this.SR_CY) {
                    r[rindex] = /*Math.floor*/((rA>>>0) / (rB>>>0));
                }
                break;
            case 0x309:
                // div (specification seems to be wrong)
                this.SR_CY = rB == 0;
                this.SR_OV = false;
                if (!this.SR_CY) {
                    r[rindex] = rA / rB;
                }

                break;
            default:
                message.Debug("Error: op38 opcode not supported yet");
                message.Abort();
                break;
            }
            break;

        case 0x39:
            // sf....
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfeq
                this.SR_F = (r[(ins >> 16) & 0x1F] == r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0x1:
                // sfne
                this.SR_F = (r[(ins >> 16) & 0x1F] != r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0x2:
                // sfgtu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) > (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x3:
                // sfgeu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) >= (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x4:
                // sfltu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) < (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x5:
                // sfleu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) <= (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0xa:
                // sfgts
                this.SR_F = (r[(ins >> 16) & 0x1F] > r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xb:
                // sfges
                this.SR_F = (r[(ins >> 16) & 0x1F] >= r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xc:
                // sflts
                this.SR_F = (r[(ins >> 16) & 0x1F] < r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xd:
                // sfles
                this.SR_F = (r[(ins >> 16) & 0x1F] <= r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            default:
                message.Debug("Error: sf.... function supported yet");
                message.Abort();
            }
            break;

        default:
            message.Debug("Error: Instruction with opcode " + utils.ToHex(ins >>> 26) + " not supported");
            message.Abort();
            break;
        }

        this.pc = this.nextpc++;
        this.delayedins = false;

    } while (--steps); // main loop
    return 0;
};


module.exports = SafeCPU;

},{"../messagehandler":43,"../utils":58}],47:[function(require,module,exports){
var message = require('../messagehandler');

function SMPCPU(stdlib, foreign, heap) {

"use asm";

var floor = stdlib.Math.floor;
var imul = foreign.imul;
var DebugMessage = foreign.DebugMessage;
var abort = foreign.abort;
var Read32 = foreign.Read32;
var Write32 = foreign.Write32;
var Read16 = foreign.Read16;
var Write16 = foreign.Write16;
var Read8 = foreign.Read8;
var Write8 = foreign.Write8;

var ERROR_SETFLAGS_LITTLE_ENDIAN = 0; // "Little endian is not supported"
var ERROR_SETFLAGS_CONTEXT_ID = 1; // "Context ID is not supported"
var ERROR_SETFLAGS_PREFIX = 2; // "exception prefix not supported"
var ERROR_SETFLAGS_DELAY_SLOT = 3; // "delay slot exception not supported"
var ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION = 4; //Error in SetSPR: Direct triggering of interrupt exception not supported?
var ERROR_SETSPR_INTERRUPT_ADDRESS = 5; //Error in SetSPR: interrupt address not supported
var ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS = 6; //"Error in SetSPR: Timer mode other than continuous not supported"
var ERROR_EXCEPTION_UNKNOWN = 7;        // "Error in Exception: exception type not supported"
var ERROR_UNKNOWN = 8;
var ERROR_ALL_CORES_IDLE = 9;

// special purpose register index
var SPR_UPR = 1; // unit present register
var SPR_SR = 17; // supervision register
var SPR_EEAR_BASE = 48; // exception ea register
var SPR_EPCR_BASE = 32; // exception pc register
var SPR_ESR_BASE = 64; // exception sr register
var SPR_IMMUCFGR = 4; // Instruction MMU Configuration register
var SPR_DMMUCFGR = 3; // Data MMU Configuration register
var SPR_ICCFGR = 6; // Instruction Cache configuration register
var SPR_DCCFGR = 5; // Data Cache Configuration register
var SPR_VR = 0; // Version register
var SPR_COREID = 128; // Core ID
var SPR_NUMCORES = 129; // Number of Cores

// exception types and addresses
var EXCEPT_ITLBMISS = 0xA00; // instruction translation lookaside buffer miss
var EXCEPT_IPF = 0x400; // instruction page fault
var EXCEPT_RESET = 0x100; // reset the processor
var EXCEPT_DTLBMISS = 0x900; // data translation lookaside buffer miss
var EXCEPT_DPF = 0x300; // instruction page fault
var EXCEPT_BUSERR = 0x200; // wrong memory access
var EXCEPT_TICK = 0x500; // tick counter interrupt
var EXCEPT_INT = 0x800; // interrupt of external devices
var EXCEPT_SYSCALL = 0xC00; // syscall, jump into supervisor mode
var EXCEPT_TRAP = 0xE00; // trap


var r = new stdlib.Int32Array(heap); // registers
var f = new stdlib.Float32Array(heap); // registers

var h = new stdlib.Int32Array(heap);
var b = new stdlib.Uint8Array(heap);
var w = new stdlib.Uint16Array(heap);

var ncores = 4; // the total number of cores
var ncoresmask = 0xF; // bitfield of actives cores mask
var activebitfield = 0xF; // 1 bit for each core defines if it is active or not

var coreid = 0; // the currently active core.
var corep = 0x0; // the memory pointer to the core related structures

var rp = 0x0; // pointer to registers, not used
var ramp = 0x100000;

var group0p = 0x2000; // special purpose registers
var group1p = 0x4000; // data tlb registers
var group2p = 0x6000; // instruction tlb registers

// define variables and initialize

var pc = 0x0;
var ppc = 0;
var ppcorigin = 0;
var pcbase = -4; // helper variable to calculate the real pc
var fence = 0; // the ppc pointer to the next jump or page boundary

var delayedins = 0; // the current instruction is an delayed instruction, one cycle before a jump

var nextpc = 0x0; // pointer to the next instruction after the fence
var jump = 0x0; // in principle the jump variable should contain the same as nextpc.
                // But for delayed ins at page boundaries, this is taken as temporary
                // storage for nextpc
var delayedins_at_page_boundary = 0; //flag


// fast tlb lookup tables, invalidate
var instlblookup = -1;
var read32tlblookup = -1;
var read8stlblookup = -1;
var read8utlblookup = -1;
var read16stlblookup = -1;
var read16utlblookup = -1;
var write32tlblookup = -1;
var write8tlblookup = -1;
var write16tlblookup = -1;

var instlbcheck = -1;
var read32tlbcheck = -1;
var read8stlbcheck = -1;
var read8utlbcheck = -1;
var read16stlbcheck = -1;
var read16utlbcheck = -1;
var write32tlbcheck = -1;
var write8tlbcheck = -1;
var write16tlbcheck = -1;

var TTMRp = 0x100; // Tick timer mode register
var TTCRp = 0x104; // Tick timer count register

var PICMRp = 0x108; // interrupt controller mode register (use nmi)
var PICSRp = 0x10C; // interrupt controller set register
var raise_interruptp = 0x110;

var linkedaddrp = 0x114; // hidden register for atomic lwa and swa operation (linked address)


// flags
var SR_SM = 1; // supervisor mode
var SR_TEE = 0; // tick timer Exception Enabled
var SR_IEE = 0; // interrupt Exception Enabled
var SR_DCE = 0; // Data Cache Enabled
var SR_ICE = 0; // Instruction Cache Enabled
var SR_DME = 0; // Data MMU Enabled
var SR_IME = 0; // Instruction MMU Enabled
var SR_LEE = 0; // Little Endian Enabled
var SR_CE = 0; // CID Enabled ?
var SR_F = 0; // Flag for l.sf... instructions 
var SR_CY = 0; // Carry Flag
var SR_OV = 0; // Overflow Flag
var SR_OVE = 0; // Overflow Flag Exception
var SR_DSX = 0; // Delay Slot Exception
var SR_EPH = 0; // Exception Prefix High
var SR_FO = 1; // Fixed One, always set
var SR_SUMRA = 0; // SPRS User Mode Read Access, or TRAP exception disable?
var SR_CID = 0x0; //Context ID

var boot_dtlb_misshandler_address = 0x0;
var boot_itlb_misshandler_address = 0x0;
var current_pgd = 0x0;

var snoopbitfield = 0x0; // fot atomic instructions

function Init(_ncores) {
    _ncores = _ncores|0;
    ncores = _ncores|0;
    if ((ncores|0) == 32) 
        ncoresmask = 0xFFFFFFFF; 
    else
        ncoresmask =  (1 << ncores)-1|0;
    AnalyzeImage();
    Reset();
}

function Reset() {
    var i = 0;
    activebitfield = ncoresmask; // all cores are active
    snoopbitfield = 0x0;

    for(i=0; (i|0)<(ncores|0); i=i+1|0) {
        h[corep + TTMRp >>2] = 0x0;
        h[corep + TTCRp >>2] = 0x0;
        h[corep + PICMRp >>2] = 0x3;
        h[corep + PICSRp >>2] = 0x0;

        h[corep + group0p+(SPR_IMMUCFGR<<2) >> 2] = 0x18; // 0 ITLB has one way and 64 sets
        h[corep + group0p+(SPR_DMMUCFGR<<2) >> 2] = 0x18; // 0 DTLB has one way and 64 sets
        h[corep + group0p+(SPR_ICCFGR<<2) >> 2] = 0x0//0x48;
        h[corep + group0p+(SPR_DCCFGR<<2) >> 2] = 0x0//0x48;
        h[corep + group0p+(SPR_VR<<2) >> 2] = 0x12000001;
        h[corep + group0p+(SPR_COREID<<2) >> 2] = coreid|0;
        h[corep + group0p+(SPR_NUMCORES<<2) >> 2] = 2|0;

        // UPR present
        // data mmu present
        // instruction mmu present
        // PIC present (architecture manual seems to be wrong here)
        // Tick timer present
        h[corep + group0p+(SPR_UPR<<2) >> 2] = 0x619;

        ppc = 0;
        ppcorigin = 0;
        pcbase = -4;
        Exception(EXCEPT_RESET, 0x0);

        ChangeCore();
    }
}

function ChangeCore()
{
    var newcoreid = 0;
    var i = 0;
    if ((ncores|0) == 1) return;

    newcoreid = coreid|0;
    if ((activebitfield|0) == 0) {   
         // All cpu are idle. This should never happen in this function.
         DebugMessage(ERROR_ALL_CORES_IDLE|0);
         abort();
     }

    // check if only one bit is set in bitfield
    if ((activebitfield & activebitfield-1) == 0) 
    if (activebitfield & (1<<coreid)) { // ceck if this one bit is the current core
        return; // nothing changed, so just return back
    }

    // find next core
    do {
        newcoreid = newcoreid + 1 | 0;
        if ((newcoreid|0) >= (ncores|0)) newcoreid = 0;
    } while(((activebitfield & (1<<newcoreid))) == 0)

    if ((newcoreid|0) == (coreid|0)) return; // nothing changed, so just return back

    h[corep + 0x120 >>2] = GetFlags()|0;
    h[corep + 0x124 >>2] = pc;
    h[corep + 0x128 >>2] = ppc;
    h[corep + 0x12C >>2] = ppcorigin;
    h[corep + 0x130 >>2] = pcbase;
    h[corep + 0x134 >>2] = fence;
    h[corep + 0x138 >>2] = nextpc;
    h[corep + 0x13C >>2] = jump;
    h[corep + 0x190 >>2] = delayedins;
    h[corep + 0x194 >>2] = delayedins_at_page_boundary;


    h[corep + 0x140 >>2] = instlblookup;
    h[corep + 0x144 >>2] = read32tlblookup;
    h[corep + 0x148 >>2] = read8stlblookup;
    h[corep + 0x14C >>2] = read8utlblookup;
    h[corep + 0x150 >>2] = read16stlblookup;
    h[corep + 0x154 >>2] = read16utlblookup;
    h[corep + 0x158 >>2] = write32tlblookup;
    h[corep + 0x15C >>2] = write8tlblookup;
    h[corep + 0x160 >>2] = write16tlblookup;
    h[corep + 0x164 >>2] = instlbcheck;
    h[corep + 0x168 >>2] = read32tlbcheck;
    h[corep + 0x16C >>2] = read8stlbcheck;
    h[corep + 0x170 >>2] = read8utlbcheck;
    h[corep + 0x174 >>2] = read16stlbcheck;
    h[corep + 0x178 >>2] = read16utlbcheck;
    h[corep + 0x17C >>2] = write32tlbcheck;
    h[corep + 0x180 >>2] = write8tlbcheck;
    h[corep + 0x184 >>2] = write16tlbcheck;

    coreid = newcoreid|0;
    corep = coreid << 15;

    SetFlagsQuiet(h[corep + 0x120 >>2]|0);
    pc          = h[corep + 0x124 >>2]|0;
    ppc         = h[corep + 0x128 >>2]|0;
    ppcorigin   = h[corep + 0x12C >>2]|0;
    pcbase      = h[corep + 0x130 >>2]|0;
    fence       = h[corep + 0x134 >>2]|0;
    nextpc      = h[corep + 0x138 >>2]|0;
    jump        = h[corep + 0x13C >>2]|0;
    delayedins  = h[corep + 0x190 >>2]|0;
    delayedins_at_page_boundary  = h[corep + 0x194 >>2]|0;

    instlblookup     = h[corep + 0x140 >>2]|0;
    read32tlblookup  = h[corep + 0x144 >>2]|0;
    read8stlblookup  = h[corep + 0x148 >>2]|0;
    read8utlblookup  = h[corep + 0x14C >>2]|0;
    read16stlblookup = h[corep + 0x150 >>2]|0;
    read16utlblookup = h[corep + 0x154 >>2]|0;
    write32tlblookup = h[corep + 0x158 >>2]|0;
    write8tlblookup  = h[corep + 0x15C >>2]|0;
    write16tlblookup = h[corep + 0x160 >>2]|0;
    instlbcheck      = h[corep + 0x164 >>2]|0;
    read32tlbcheck   = h[corep + 0x168 >>2]|0;
    read8stlbcheck   = h[corep + 0x16C >>2]|0;
    read8utlbcheck   = h[corep + 0x170 >>2]|0;
    read16stlbcheck  = h[corep + 0x174 >>2]|0;
    read16utlbcheck  = h[corep + 0x178 >>2]|0;
    write32tlbcheck  = h[corep + 0x17C >>2]|0;
    write8tlbcheck   = h[corep + 0x180 >>2]|0;
    write16tlbcheck  = h[corep + 0x184 >>2]|0;
}

function InvalidateTLB() {
    instlblookup = -1;
    read32tlblookup = -1;
    read8stlblookup = -1;
    read8utlblookup = -1;
    read16stlblookup = -1;
    read16utlblookup = -1;
    write32tlblookup = -1;
    write8tlblookup = -1;
    write16tlblookup = -1;
    instlbcheck = -1;
    read32tlbcheck = -1;
    read8stlbcheck = -1;
    read8utlbcheck = -1;
    read16stlbcheck = -1;
    read16utlbcheck = -1;
    write32tlbcheck = -1;
    write8tlbcheck = -1;
    write16tlbcheck = -1;
}

// ------------------------------------------

// SMP cpus cannot be switched.
function PutState() {
}

function GetState() {
}

// ------------------------------------------
// Timer functions

function TimerSetInterruptFlag(coreid) {
    coreid = coreid|0;
    activebitfield = activebitfield | (1 << coreid);
    h[(coreid<<15) + TTMRp >>2] = (h[(coreid<<15) + TTMRp >>2]|0) | (1 << 28);
}

// this function checks also if the interrupt is on. Otherwise the check is useless.
// the timer is running anyhow on smp machines all the time
function TimerIsRunning(coreid) {
    coreid = coreid|0;
    var ret = 0;
    ret = (h[(coreid<<15) + TTMRp >> 2] >> 29)?1:0;
    return ret|0;
}

function TimerGetTicksToNextInterrupt(coreid) {
    coreid = coreid|0;
    var delta = 0;
    delta = (h[(coreid<<15) + TTMRp >>2] & 0xFFFFFFF) - (h[TTCRp >>2] & 0xFFFFFFF) |0;
    if ((delta|0) < 0) delta = delta + 0xFFFFFFF | 0;
    return delta|0;
}

function GetTimeToNextInterrupt() {
    var wait = 0xFFFFFFF;
    var delta = 0x0;
    var i = 0;
    for(i=0; (i|0)<(ncores|0); i = i+1|0) {
        if (!(TimerIsRunning(i)|0)) continue;
        delta = TimerGetTicksToNextInterrupt(i)|0;
        if ((delta|0) < (wait|0)) wait = delta|0;
    }
    return wait|0;
}

function ProgressTime(delta) {
    delta = delta|0;
    var i = 0;
    h[TTCRp >>2] = (h[TTCRp >>2]|0) + delta|0;
/*
    // wake up at least one core
    activebitfield = activebitfield | (1<<coreid);
    // wake up the cores closest to zero
    for(i=0; (i|0)<(ncores|0); i = i+1|0) {
        delta = TimerGetTicksToNextInterrupt(i)|0;
        if ((delta|0) <= 64) {
            activebitfield = activebitfield | (1<<i);
        }
    }
*/
    // wake up all cores
    activebitfield = ncoresmask;
}

function GetTicks() {
    return (h[TTCRp >>2] & 0xFFFFFFF)|0;
}


// ------------------------------------------

function AnalyzeImage() { // get addresses for fast refill
    boot_dtlb_misshandler_address = h[ramp+0x900 >> 2]|0;
    boot_itlb_misshandler_address = h[ramp+0xA00 >> 2]|0;
    current_pgd = ((h[ramp+0x2010 >> 2]&0xFFF)<<16) | (h[ramp+0x2014 >> 2] & 0xFFFF)|0;
}

function SetFlagsQuiet(x) {
    x = x|0;
    SR_SM = (x & (1 << 0));
    SR_TEE = (x & (1 << 1));
    SR_IEE = (x & (1 << 2));
    SR_DCE = (x & (1 << 3));
    SR_ICE = (x & (1 << 4));
    SR_DME = (x & (1 << 5));
    SR_IME = (x & (1 << 6));
    SR_LEE = (x & (1 << 7));
    SR_CE = (x & (1 << 8));
    SR_F = (x & (1 << 9));
    SR_CY = (x & (1 << 10));
    SR_OV = (x & (1 << 11));
    SR_OVE = (x & (1 << 12));
    SR_DSX = (x & (1 << 13));
    SR_EPH = (x & (1 << 14));
    SR_FO = 1;
    SR_SUMRA = (x & (1 << 16));
    SR_CID = (x >> 28) & 0xF;
}

function SetFlags(x) {
    x = x|0;
    var old_SR_IEE = 0;
    old_SR_IEE = SR_IEE;
    SetFlagsQuiet(x);

    if (SR_LEE) {
        DebugMessage(ERROR_SETFLAGS_LITTLE_ENDIAN|0);
        abort();
    }
    if (SR_CID) {
        DebugMessage(ERROR_SETFLAGS_CONTEXT_ID|0);
        abort();
    }
    if (SR_EPH) {
        DebugMessage(ERROR_SETFLAGS_PREFIX|0);
        abort();
    }
    if (SR_DSX) {
        DebugMessage(ERROR_SETFLAGS_DELAY_SLOT|0);
        abort();
    }
    if (SR_IEE) {
        if ((old_SR_IEE|0) == (0|0)) {
            CheckForInterrupt(coreid);
        }
    }
}

function GetFlags() {
    var x = 0x0;
    x = x | (SR_SM ? (1 << 0) : 0);
    x = x | (SR_TEE ? (1 << 1) : 0);
    x = x | (SR_IEE ? (1 << 2) : 0);
    x = x | (SR_DCE ? (1 << 3) : 0);
    x = x | (SR_ICE ? (1 << 4) : 0);
    x = x | (SR_DME ? (1 << 5) : 0);
    x = x | (SR_IME ? (1 << 6) : 0);
    x = x | (SR_LEE ? (1 << 7) : 0);
    x = x | (SR_CE ? (1 << 8) : 0);
    x = x | (SR_F ? (1 << 9) : 0);
    x = x | (SR_CY ? (1 << 10) : 0);
    x = x | (SR_OV ? (1 << 11) : 0);
    x = x | (SR_OVE ? (1 << 12) : 0);
    x = x | (SR_DSX ? (1 << 13) : 0);
    x = x | (SR_EPH ? (1 << 14) : 0);
    x = x | (SR_FO ? (1 << 15) : 0);
    x = x | (SR_SUMRA ? (1 << 16) : 0);
    x = x | (SR_CID << 28);
    return x|0;
}

function CheckForInterrupt(coreid) {
    coreid = coreid|0;
    var flags = 0;
    // save current flags
    h[corep + 0x120 >> 2] = GetFlags()|0;

    flags = h[(coreid<<15) + 0x120 >> 2]|0;
    if (flags & (1<<2)) { // check for SR_IEE
        if (h[(coreid<<15) + PICMRp >> 2] & h[(coreid<<15) + PICSRp >>2]) {
            activebitfield = activebitfield | (1 << coreid);
            h[(coreid<<15) + raise_interruptp >> 2] = 1;
        }
    }
}

function RaiseInterrupt(line, coreid) {
    line = line|0;
    coreid = coreid|0;
    var i = 0;
    var lmask = 0;
    var picp = 0;
    lmask = (1 << line)|0;

    if ((coreid|0) == -1) { // raise all interrupt lines
        for(i=0; (i|0)<(ncores|0); i=i+1|0) {
            picp = (i<<15) + PICSRp | 0;
            h[picp >> 2] = (h[picp >> 2]|0) | lmask;
            CheckForInterrupt(i);
        }
    } else {
        picp = (coreid<<15) + PICSRp | 0;
        h[picp >> 2] = (h[picp >> 2]|0) | lmask;
        CheckForInterrupt(coreid);
    }
}

function ClearInterrupt(line, coreid) {
    line = line|0;
    coreid = coreid|0;
    var i = 0;
    var lmask = 0;
    var picp = 0;
    lmask = (1 << line)|0;
    if ((coreid|0) == -1) { // clear all interrupt lines
        for(i=0; (i|0)<(ncores|0); i=i+1|0) {
            picp = (i<<15) + PICSRp | 0;
            h[picp >> 2] = h[picp >> 2] & (~lmask);
        }
    } else {
        picp = (coreid<<15) + PICSRp | 0;
        h[picp >> 2] = h[picp >> 2] & (~lmask);
    }



}

function SetSPR(idx, x) {
    idx = idx|0;
    x = x|0;
    var address = 0;
    var group = 0;
    address = (idx & 0x7FF);
    group = (idx >> 11) & 0x1F;

    switch (group|0) {
    case 0:
        if ((address|0) == (SPR_SR|0)) {
            SetFlags(x);
        }
        h[corep + group0p+(address<<2) >> 2] = x;
        break;
    case 1:
        // Data MMU
        h[corep + group1p+(address<<2) >> 2] = x;
        break;
    case 2:
        // ins MMU
        h[corep + group2p+(address<<2) >> 2] = x;
        break;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        break;
    case 8:
        activebitfield = activebitfield & (~(1 << coreid));
        break;
    case 9:
        // pic
        switch (address|0) {
        case 0:
            h[corep + PICMRp >>2] = x | 0x3; // the first two interrupts are non maskable
            // check immediately for interrupt
            if (SR_IEE) {
                if (h[corep + PICMRp >>2] & h[corep + PICSRp >>2]) {
                    DebugMessage(ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION|0);
                    abort();
                }
            }
            break;
        case 2: // PICSR
            break;
        default:
            DebugMessage(ERROR_SETSPR_INTERRUPT_ADDRESS|0);
            abort();
        }
        break;
    case 10:
        //tick timer
        switch (address|0) {
        case 0:
            h[corep + TTMRp >> 2] = x|0;
            if (((h[corep + TTMRp >> 2] >> 30)&3) != 0x3) {
                DebugMessage(ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS|0);
                abort();
            }
            break;
        case 1:
            //h[TTCRp >>2] = x|0; // already in sync. Don't allow to change
            break;
        default:
            //DebugMessage("Error in SetSPR: Tick timer address not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        break;

    default:
        DebugMessage(ERROR_UNKNOWN|0);
        abort();
        break;
    }
};

function GetSPR(idx) {
    idx = idx|0;
    var address = 0;
    var group = 0;
    address = idx & 0x7FF;
    group = (idx >> 11) & 0x1F;
    switch (group|0) {
    case 0:
        if ((address|0) == (SPR_SR|0)) {
            return GetFlags()|0;
        }
        return h[corep + group0p+(address<<2) >> 2]|0;
    case 1:
        return h[corep + group1p+(address<<2) >> 2]|0;
    case 2:
        return h[corep + group2p+(address<<2) >> 2]|0;
    case 8:
        return 0x0;
    case 9:
        // pic
        switch (address|0) {
        case 0:
            return h[corep + PICMRp >>2]|0;
        case 2:
            return h[corep + PICSRp >>2]|0;
        default:
            //DebugMessage("Error in GetSPR: PIC address unknown");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        break;

    case 10:
        // tick Timer
        switch (address|0) {
        case 0:
            return h[corep + TTMRp >>2]|0;
        case 1:
            return h[TTCRp >>2]|0;
        default:
            DebugMessage(ERROR_UNKNOWN|0);
            //DebugMessage("Error in GetSPR: Tick timer address unknown");
            abort();
            break;
        }
        break;
    default:
        DebugMessage(ERROR_UNKNOWN|0);
        //DebugMessage("Error in GetSPR: group unknown");
        abort();
        break;
    }
    return 0|0;
}

function Exception(excepttype, addr) {
    excepttype = excepttype|0;
    addr = addr|0;
    var except_vector = 0;
    except_vector = excepttype | (SR_EPH ? 0xf0000000 : 0x0);

    activebitfield = activebitfield | (1 << coreid);

    SetSPR(SPR_EEAR_BASE, addr);
    SetSPR(SPR_ESR_BASE, GetFlags()|0);

    SR_OVE = 0;
    SR_SM = 1;
    SR_IEE = 0;
    SR_TEE = 0;
    SR_DME = 0;

    instlblookup = 0;
    read32tlblookup = 0;
    read8stlblookup = 0;
    read8utlblookup = 0;
    read16stlblookup = 0;
    read16utlblookup = 0;
    write32tlblookup = 0;
    write8tlblookup = 0;
    write16tlblookup = 0;
    instlbcheck = 0;
    read32tlbcheck = 0;
    read8utlbcheck = 0;
    read8stlbcheck = 0;
    read16utlbcheck = 0;
    read16stlbcheck = 0;
    write32tlbcheck = 0;
    write8tlbcheck = 0;
    write16tlbcheck = 0;

    fence = ppc|0;
    nextpc = except_vector;

    switch (excepttype|0) {

    case 0x100: // EXCEPT_RESET
        break;

    case 0x300: // EXCEPT_DPF
    case 0x900: // EXCEPT_DTLBMISS
    case 0xE00: // EXCEPT_TRAP
    case 0x200: // EXCEPT_BUSERR
        pc = pcbase + ppc|0;
        SetSPR(SPR_EPCR_BASE, pc - (delayedins ? 4 : 0)|0);
        break;

    case 0xA00: // EXCEPT_ITLBMISS
    case 0x400: // EXCEPT_IPF
    case 0x500: // EXCEPT_TICK
    case 0x800: // EXCEPT_INT
        // per definition, the pc must be valid here
        SetSPR(SPR_EPCR_BASE, pc - (delayedins ? 4 : 0)|0);
        break;

    case 0xC00: // EXCEPT_SYSCALL
        pc = pcbase + ppc|0;
        SetSPR(SPR_EPCR_BASE, pc + 4 - (delayedins ? 4 : 0)|0);
        break;

    default:
        DebugMessage(ERROR_EXCEPTION_UNKNOWN|0);
        abort();
    }
    delayedins = 0;
    SR_IME = 0;
    h[corep + linkedaddrp >> 2] = -1;
    snoopbitfield = snoopbitfield & (~(1<<coreid));
}


// disassembled dtlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
function DTLBRefill(addr, nsets) {
    addr = addr|0;
    nsets = nsets|0;
    var r2 = 0;
    var r3 = 0;
    var r4 = 0;
    var r5 = 0;
    if ((h[ramp+0x900 >> 2]|0) == (boot_dtlb_misshandler_address|0)) {
        Exception(EXCEPT_DTLBMISS, addr);
        return 0|0;
    }
    r2 = addr;
    // get_current_PGD  using r3 and r5 
    r3 = h[ramp + current_pgd + (coreid<<2) >> 2]|0; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3|0;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)

    r3 = h[ramp+r4 >> 2]|0;

    if ((r3|0) == 0) {
        Exception(EXCEPT_DPF, addr);
        return 0|0;
        // abort();
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000;
    // d_pmd_good:

    r4 = h[ramp+r4 >> 2]|0; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4|0;
    r2 = h[ramp+r3 >> 2]|0;

    if ((r2 & 1) == 0) {
        Exception(EXCEPT_DPF, addr);
        return 0|0;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe3fa; // PAGE_MASK | DTLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe3fa;
    //r6 = (group0[SPR_DMMUCFGR] & 0x1C) >>> 0x2;
    //r3 = 1 << r6; // number of DMMU sets
    //r6 = r3 - 1; // mask register
    //r5 &= r6;
    r5 = r5 & (nsets - 1);
    h[corep + group1p+((0x280 | r5)<<2) >> 2] = r4;
    //SPR_DTLBTR_BASE(0)|r5 = r4 // SPR_DTLBTR_BASE = 0x280 * (WAY*0x100)

    // fill DTLBMR register
    r2 = addr;
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[corep + group1p+((0x200 | r5)<<2) >> 2] = r4;
    // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1|0;
}

// disassembled itlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
function ITLBRefill(addr, nsets) {
    addr = addr|0;
    nsets = nsets|0;
    var r2 = 0;
    var r3 = 0;
    var r4 = 0;
    var r5 = 0;
    if ((h[ramp+0xA00 >> 2]|0) == (boot_itlb_misshandler_address|0)) {
        Exception(EXCEPT_ITLBMISS, addr);
        return 0|0;
    }

    r2 = addr;
    // get_current_PGD  using r3 and r5
    r3 = h[ramp+current_pgd + (coreid<<2) >> 2]|0; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3|0;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)
    r3 = h[ramp+r4 >> 2]|0;

    if ((r3|0) == 0) {
        Exception(EXCEPT_IPF, addr);
        return 0|0;
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000; // or 0xffffe3fa ??? PAGE_MASK
    //i_pmd_good:

    r4 = h[ramp+r4 >> 2]|0; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4|0;
    r2 = h[ramp+r3 >> 2]|0;

    if ((r2 & 1) == 0) {
        Exception(EXCEPT_IPF, addr);
        return 0|0;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe03a; // PAGE_MASK | ITLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe03a; // apply the mask
    r3 = r2 & 0x7c0; // PAGE_EXEC, Page_SRE, PAGE_SWE, PAGE_URE, PAGE_UWE

    if ((r3|0) != 0x0) {
        //not itlb_tr_fill....
        //r6 = (group0[SPR_IMMUCFGR] & 0x1C) >>> 0x2;
        //r3 = 1 << r6; // number of DMMU sets
        //r6 = r3 - 1; // mask register
        //r5 &= r6;
        r5 = r5 & (nsets - 1);
        //itlb_tr_fill_workaround:
        r4 = r4 | 0xc0; // SPR_ITLBTR_UXE | ITLBTR_SXE
    }
    // itlb_tr_fill:

    h[corep + group2p + ((0x280 | r5)<<2) >> 2] = r4; // SPR_ITLBTR_BASE(0)|r5 = r4 // SPR_ITLBTR_BASE = 0x280 * (WAY*0x100)

    //fill ITLBMR register
    r2 = addr;
    // r3 = 
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[corep + group2p + ((0x200 | r5)<<2) >> 2] = r4; // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1|0;
}

function DTLBLookup(addr, write) {
    addr = addr|0;
    write = write|0;
    var setindex = 0;
    var tlmbr = 0;
    var tlbtr = 0;
    if (!SR_DME) {
        return addr|0;
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    setindex = (addr >> 13) & 63; // check these values
    tlmbr = h[corep + group1p + ((0x200 | setindex) << 2) >> 2]|0; // match register
     
    if ((tlmbr & 1) == 0) {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64)|0) {
            tlmbr = h[corep + group1p + (0x200 + setindex << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }
    if ((tlmbr >> 19) != (addr >> 19)) {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64)|0) {
            tlmbr = h[corep + group1p + (0x200 + setindex << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }

    /* skipped this check
        // set lru 
        if (tlmbr & 0xC0) {
            DebugMessage("Error: LRU ist not supported");
            abort();
        }
    */
    tlbtr = h[corep + group1p + ((0x280 | setindex)<<2) >> 2]|0; // translate register

    // Test for page fault
    // Skip this to be faster

    // check if supervisor mode
    if (SR_SM) {
        if (!write) {
            if (!(tlbtr & 0x100)) {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        } else {
            if (!(tlbtr & 0x200))
            {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        }
    } else {
        if (!write) {
            if (!(tlbtr & 0x40)) {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        } else {
            if (!(tlbtr & 0x80))
            {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        }
    }
    return ((tlbtr & 0xFFFFE000) | (addr & 0x1FFF))|0;
}


function Step(steps, clockspeed) {
    steps = steps|0;
    clockspeed = clockspeed|0;
    var ins = 0x0;
    var imm = 0x0;
    var i = 0;
    var rindex = 0x0;
    var rA = 0x0,
        rB = 0x0,
        rD = 0x0;
    var vaddr = 0x0; // virtual address
    var paddr = 0x0; // physical address

    var changecorecounter = 0;

    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var delta = 0x0;

    var dsteps = 0; // small counter

// -----------------------------------------------------
    for(;;) {

        // --------- START FENCE ---------
        if ((ppc|0) == (fence|0)) {
            pc = nextpc;

            if ((!delayedins_at_page_boundary|0)) {
                delayedins = 0;
            }

            dsteps = dsteps - ((ppc - ppcorigin) >> 2)|0;

            // do this not so often
            if ((dsteps|0) <= 0)
            if (!(delayedins_at_page_boundary|0)) { // for now. Not sure if we need this check
                dsteps = dsteps + 64|0;
                steps = steps - 64|0;

                // --------- START TICK ---------
                for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                    if (!(TimerIsRunning(i)|0)) continue;
                    delta = TimerGetTicksToNextInterrupt(i)|0;
                    if ((delta|0) < (clockspeed|0)) {
                        TimerSetInterruptFlag(i);
                    }
                }

                // the timer is always enabled on smp systems
                h[TTCRp >> 2] = ((h[TTCRp >> 2]|0) + clockspeed|0);
                // ---------- END TICK ----------

                if ((steps|0) < 0) return 0x0; // return to main loop
            }

            // check for any interrupts
            // SR_TEE is set or cleared at the same time as SR_IEE in Linux, so skip this check
            if (SR_IEE|0) {
                if (h[corep + TTMRp >> 2] & (1 << 28)) {
                    Exception(EXCEPT_TICK, h[corep + group0p + (SPR_EEAR_BASE<<2) >> 2]|0);
                    // treat exception directly here
                    pc = nextpc;
                } else
                if (h[corep + raise_interruptp >> 2]|0) {
                    h[corep + raise_interruptp >> 2] = 0;
                    Exception(EXCEPT_INT, h[corep + group0p + (SPR_EEAR_BASE<<2) >> 2]|0);
                    // treat exception directly here
                    pc = nextpc;
                }
            }
 //     }

            // Get instruction pointer
            if ((instlbcheck ^ pc) & 0xFFFFE000) // short check if it is still the correct page
            {
                instlbcheck = pc; // save the new page, lower 11 bits are ignored
                if (!SR_IME) {
                    instlblookup = 0x0;
                } else {
                    setindex = (pc >> 13) & 63; // check this values
                    tlmbr = h[corep + group2p + ((0x200 | setindex) << 2) >> 2]|0;
                    // test if tlmbr is valid
                    if ((tlmbr & 1) == 0) {
                        if (ITLBRefill(pc, 64)|0) {
                            tlmbr = h[corep + group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                        } else {
                            // just make sure he doesn't count this 'continue' as steps
                            ppcorigin = ppc;
                            delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    if ((tlmbr >> 19) != (pc >> 19)) {
                        if (ITLBRefill(pc, 64)|0) {
                            tlmbr = h[corep + group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                        } else {
                            // just make sure he doesn't count this 'continue' as steps
                            ppcorigin = ppc;
                            delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    tlbtr = h[corep + group2p + ((0x280 | setindex) << 2) >> 2]|0;
                    instlblookup = ((tlbtr ^ tlmbr) >> 13) << 13;
                }
            }

            // set pc and set the correcponding physical pc pointer
            //pc = pc;
            ppc = ramp + (instlblookup ^ pc)|0;
            ppcorigin = ppc;
            pcbase = pc - 4 - ppcorigin|0;

           if (delayedins_at_page_boundary|0) {
               delayedins_at_page_boundary = 0;
               fence = ppc + 4|0;
               nextpc = jump;
           } else {
               fence  = ((ppc >> 13) + 1) << 13; // next page
               nextpc = ((pc  >> 13) + 1) << 13;
           }

           changecorecounter = changecorecounter + 1|0;
           if ((changecorecounter&7) == 0) {
               ChangeCore();
               continue;
           }

        } 
        // ---------- END FENCE ----------

        ins = h[ppc >> 2]|0;
        ppc = ppc + 4|0;

// --------------------------------------------

        switch ((ins >> 26)&0x3F) {
        case 0x0:
            // j
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x1:
            // jal
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            r[corep + (9<<2) >> 2] = pc + 8|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x3:
            // bnf
            if (SR_F) {
                break;
            }
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x4:
            // bf
            if (!SR_F) {
                break;
            }
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x5:
            // nop
            break;

        case 0x6:
            // movhi
            rindex = (ins >> 21) & 0x1F;
            r[corep + (rindex << 2) >> 2] = ((ins & 0xFFFF) << 16); // movhi
            break;

        case 0x8:
            //sys and trap
            if ((ins&0xFFFF0000) == 0x21000000) {
                Exception(EXCEPT_TRAP, h[corep + group0p+SPR_EEAR_BASE >> 2]|0);
            } else {
                Exception(EXCEPT_SYSCALL, h[corep + group0p+SPR_EEAR_BASE >> 2]|0);
            }
            break;

        case 0x9:
            // rfe
            jump = GetSPR(SPR_EPCR_BASE)|0;
            InvalidateTLB();
            fence = ppc;
            nextpc = jump;
            //pc = jump; // set the correct pc in case of an EXCEPT_INT
            //delayedins = 0;
            SetFlags(GetSPR(SPR_ESR_BASE)|0); // could raise an exception
            break;

        case 0x11:
            // jr
            jump = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x12:
            // jalr
            pc = pcbase + ppc|0;
            jump = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            r[corep + (9<<2) >> 2] = pc + 8|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x1B: 
            // lwa
            vaddr = (r[corep + ((ins >> 14) & 0x7C) >> 2]|0) + ((ins << 16) >> 16)|0;
            if ((read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read32tlbcheck = vaddr;
                read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read32tlblookup ^ vaddr;
            snoopbitfield = snoopbitfield | (1<<coreid);
            h[corep + linkedaddrp >>2] = paddr;
            r[corep + ((ins >> 19) & 0x7C)>>2] = (paddr|0)>0?h[ramp+paddr >> 2]|0:Read32(paddr|0)|0;
            break;

        case 0x21:
            // lwz
            vaddr = (r[corep + ((ins >> 14) & 0x7C) >> 2]|0) + ((ins << 16) >> 16)|0;
            if ((read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read32tlbcheck = vaddr;
                read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read32tlblookup ^ vaddr;
            r[corep + ((ins >> 19) & 0x7C)>>2] = (paddr|0)>0?h[ramp+paddr >> 2]|0:Read32(paddr|0)|0;
            break;

        case 0x23:
            // lbz
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read8utlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read8utlbcheck = vaddr;
                read8utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read8utlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[corep + ((ins >> 19) & 0x7C)>>2] = b[ramp + (paddr ^ 3)|0]|0;
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = Read8(paddr|0)|0;
            }
            break;

        case 0x24:
            // lbs 
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read8stlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read8stlbcheck = vaddr;
                read8stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read8stlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[corep + ((ins >> 19) & 0x7C)>>2] = (b[ramp + (paddr ^ 3)|0] << 24) >> 24;
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = ((Read8(paddr|0)|0) << 24) >> 24;
            }
            break;

        case 0x25:
            // lhz 
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read16utlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read16utlbcheck = vaddr;
                read16utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read16utlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[corep + ((ins >> 19) & 0x7C)>>2] = w[ramp + (paddr ^ 2) >> 1];
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = (Read16(paddr|0)|0);
            }
            break;

        case 0x26:
            // lhs
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read16stlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read16stlbcheck = vaddr;
                read16stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read16stlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[corep + ((ins >> 19) & 0x7C)>>2] =  (w[ramp + (paddr ^ 2) >> 1] << 16) >> 16;
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = ((Read16(paddr|0)|0) << 16) >> 16;
            }
            break;


        case 0x27:
            // addi signed 
            imm = (ins << 16) >> 16;
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            r[corep + ((ins >> 19) & 0x7C) >> 2] = rA + imm|0;
            //rindex = ((ins >> 19) & 0x7C);
            //SR_CY = r[corep + rindex] < rA;
            //SR_OV = (((rA ^ imm ^ -1) & (rA ^ r[corep + rindex])) & 0x80000000)?true:false;
            //TODO overflow and carry
            // maybe wrong
            break;

        case 0x29:
            // andi
            r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] & (ins & 0xFFFF);
            break;


        case 0x2A:
            // ori
            r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF);
            break;

        case 0x2B:
            // xori            
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            r[corep + ((ins >> 19) & 0x7C)>>2] = rA ^ ((ins << 16) >> 16);
            break;

        case 0x2D:
            // mfspr
            r[corep + ((ins >> 19) & 0x7C)>>2] = GetSPR(r[corep + ((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF))|0;
            break;

        case 0x2E:
            switch ((ins >> 6) & 0x3) {
            case 0:
                // slli
                r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] << (ins & 0x1F);
                break;
            case 1:
                // rori
                r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] >>> (ins & 0x1F);
                break;
            case 2:
                // srai
                r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] >> (ins & 0x1F);
                break;
            default:
                DebugMessage(ERROR_UNKNOWN|0);
                //DebugMessage("Error: opcode 2E function not implemented");
                abort();
                break;
            }
            break;

        case 0x2F:
            // sf...i
            imm = (ins << 16) >> 16;
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfnei
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) == (imm|0);
                break;
            case 0x1:
                // sfnei
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) != (imm|0);
                break;
            case 0x2:
                // sfgtui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) > (imm >>> 0);
                break;
            case 0x3:
                // sfgeui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) >= (imm >>> 0);
                break;
            case 0x4:
                // sfltui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) < (imm >>> 0);
                break;
            case 0x5:
                // sfleui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) <= (imm >>> 0);
                break;
            case 0xa:
                // sfgtsi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) > (imm|0);
                break;
            case 0xb:
                // sfgesi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) >= (imm|0);
                break;
            case 0xc:
                // sfltsi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) < (imm|0);
                break;
            case 0xd:
                // sflesi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) <= (imm|0);
                break;
            default:
                //DebugMessage("Error: sf...i not supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >> 10) & 0xF800);
            //pc = pcbase + ppc|0;
            SetSPR(r[corep + ((ins >> 14) & 0x7C)>>2] | imm, r[corep + ((ins >> 9) & 0x7C)>>2]|0); // can raise an interrupt

            if ((activebitfield|0) == 0) { // all cpus are idle
                activebitfield = ncoresmask;
                // first check if there is a timer interrupt pending
                //for(i=0; (i|0)<(ncores|0); i = i+1|0) {
                    if ((h[(coreid<<15) + TTMRp >>2] & (1 << 28))) break;
                //}
                return steps|0;
            } else
            if ((activebitfield & (1<<coreid)) == 0) {  // check if this cpu gone idle and change the core
                ChangeCore();
            }
            break;

       case 0x32:
            // floating point
            rA = (ins >> 14) & 0x7C;
            rB = (ins >> 9) & 0x7C;
            rD = (ins >> 19) & 0x7C;

            switch (ins & 0xFF) {
            case 0x0:
                // lf.add.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) + (+f[corep + rB >> 2]);
                break;
            case 0x1:
                // lf.sub.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) - (+f[corep + rB >> 2]);
                break;
            case 0x2:
                // lf.mul.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) * (+f[corep + rB >> 2]);
                break;
            case 0x3:
                // lf.div.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) / (+f[corep + rB >> 2]);
                break;
            case 0x4:
                // lf.itof.s
                f[corep + rD >> 2] = +(r[corep + rA >> 2]|0);
                break;
            case 0x5:
                // lf.ftoi.s
                r[corep + rD >> 2] = ~~(+floor(+f[corep + rA >> 2]));
                break;
            case 0x7:
                // lf.madd.s
                f[corep + rD >> 2] = (+f[corep + rD >> 2]) + (+f[corep + rA >> 2]) * (+f[corep + rB >> 2]);
                break;
            case 0x8:
                // lf.sfeq.s
                SR_F = (+f[corep + rA >> 2]) == (+f[corep + rB >> 2]);
                break;
            case 0x9:
                // lf.sfne.s
                SR_F = (+f[corep + rA >> 2]) != (+f[corep + rB >> 2]);
                break;
            case 0xa:
                // lf.sfgt.s
                SR_F = (+f[corep + rA >> 2]) > (+f[corep + rB >> 2]);
                break;
            case 0xb:
                // lf.sfge.s
                SR_F = (+f[corep + rA >> 2]) >= (+f[corep + rB >> 2]);
                break;
            case 0xc:
                // lf.sflt.s
                SR_F = (+f[corep + rA >> 2]) < (+f[corep + rB >> 2]);
                break;
            case 0xd:
                // lf.sfle.s
                SR_F = (+f[corep + rA >> 2]) <= (+f[corep + rB >> 2]);
                break;
            default:
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x33:
            // swa
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            SR_F = ((paddr|0) == (h[corep + linkedaddrp >>2]|0))?(1|0):(0|0);
            h[corep + linkedaddrp >>2] = -1;
            snoopbitfield = snoopbitfield & (~(1<<coreid));
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr|0)) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((SR_F|0) == 0) {
                break;
            }
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write32(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x35:
            // sw
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr|0)) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write32(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x36:
            // sb
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write8tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write8tlbcheck = vaddr;
                write8tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write8tlblookup ^ vaddr;
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr&(~3))) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((paddr|0) > 0) {
                // consider that the data is saved in little endian
                b[ramp + (paddr ^ 3)|0] = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write8(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x37:
            // sh
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write16tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write16tlbcheck = vaddr;
                write16tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write16tlblookup ^ vaddr;
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr&(~3))) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((paddr|0) >= 0) {
                w[ramp + (paddr ^ 2) >> 1] = r[corep + ((ins >> 9) & 0x7C)>>2];
            } else {
                Write16(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x38:
            // three operands commands
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            rB = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            rindex = (ins >> 19) & 0x7C;
            switch (ins & 0x3CF) {
            case 0x0:
                // add signed 
                r[corep + rindex>>2] = rA + rB;
                break;
            case 0x2:
                // sub signed
                r[corep + rindex>>2] = rA - rB;
                //TODO overflow and carry
                break;
            case 0x3:
                // and
                r[corep + rindex>>2] = rA & rB;
                break;
            case 0x4:
                // or
                r[corep + rindex>>2] = rA | rB;
                break;
            case 0x5:
                // or
                r[corep + rindex>>2] = rA ^ rB;
                break;
            case 0x8:
                // sll
                r[corep + rindex>>2] = rA << (rB & 0x1F);
                break;
            case 0x48:
                // srl not signed
                r[corep + rindex>>2] = rA >>> (rB & 0x1F);
                break;
            case 0xf:
                // ff1
                r[corep + rindex>>2] = 0;
                for (i = 0; (i|0) < 32; i=i+1|0) {
                    if (rA & (1 << i)) {
                        r[corep + rindex>>2] = i + 1;
                        break;
                    }
                }
                break;
            case 0x88:
                // sra signed
                r[corep + rindex>>2] = rA >> (rB & 0x1F);
                // be carefull here and check
                break;
            case 0x10f:
                // fl1
                r[corep + rindex>>2] = 0;
                for (i = 31; (i|0) >= 0; i=i-1|0) {
                    if (rA & (1 << i)) {
                        r[corep + rindex>>2] = i + 1;
                        break;
                    }
                }
                break;
            case 0x306:
                // mul signed (specification seems to be wrong)
                {                    
                    // this is a hack to do 32 bit signed multiply. Seems to work but needs to be tested. 
                    //r[corep + (rindex<<2)>>2] = (rA >> 0) * (rB >> 0);
                    r[corep + rindex>>2] = imul(rA|0, rB|0)|0;
                    /*
                    var rAl = rA & 0xFFFF;
                    var rBl = rB & 0xFFFF;
                    r[corep + rindex<<2>>2] = r[corep + rindex<<2>>2] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
                    var result = Number(int32(rA)) * Number(int32(rB));
                    SR_OV = (result < (-2147483647 - 1)) || (result > (2147483647));
                    var uresult = uint32(rA) * uint32(rB);
                    SR_CY = (uresult > (4294967295));
                    */
                    
                }
                break;
            case 0x30a:
                // divu (specification seems to be wrong)
                SR_CY = (rB|0) == 0;
                SR_OV = 0;
                if (!SR_CY) {
                    r[corep + rindex>>2] = /*Math.floor*/((rA>>>0) / (rB>>>0));
                }
                break;
            case 0x309:
                // div (specification seems to be wrong)
                SR_CY = (rB|0) == 0;
                SR_OV = 0;
                if (!SR_CY) {
                    r[corep + rindex>>2] = (rA|0) / (rB|0);
                }

                break;
            default:
                //DebugMessage("Error: op38 opcode not supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x39:
            // sf....
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfeq
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) == (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0x1:
                // sfne
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) != (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0x2:
                // sfgtu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) > (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x3:
                // sfgeu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) >= (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x4:
                // sfltu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) < (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x5:
                // sfleu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) <= (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0xa:
                // sfgts
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) > (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xb:
                // sfges
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) >= (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xc:
                // sflts
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) < (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xd:
                // sfles
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) <= (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            default:
                //DebugMessage("Error: sf.... function supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
            }
            break;

        default:
            //DebugMessage("Error: Instruction with opcode " + utils.ToHex(ins >>> 26) + " not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }

    }; // main loop

    return steps|0;
}

return {
    Init: Init,
    Reset: Reset,
    InvalidateTLB: InvalidateTLB,
    Step: Step,
    GetFlags: GetFlags,
    SetFlags: SetFlags,
    PutState: PutState,
    GetState: GetState,    
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    GetTicks: GetTicks,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt,
    AnalyzeImage: AnalyzeImage
};

}


module.exports = SMPCPU;

},{"../messagehandler":43}],48:[function(require,module,exports){
// -------------------------------------------------
// -------------------- RAM ------------------------
// -------------------------------------------------


// The access is assumed to be aligned. The check have to be performed elsewere.
// Consider that the data in Javascript is saved in 32-Bit little endian format
// for big endian emulations we flip each 32-Bit for faster access

// For faster access for the devices we limit the offset of the device to 
// 0xyy000000 where yy is a number between 0x0 and 0xFF

var message = require('./messagehandler');
var utils = require('./utils');

// constructor
function RAM(heap, ramoffset) {
    //use typed arrays
    this.heap = heap;
    this.int32mem = new Int32Array(this.heap, ramoffset);
    this.uint8mem = new Uint8Array(this.heap, ramoffset);
    this.sint8mem = new Int8Array(this.heap, ramoffset);
    this.devices = new Array(0x100);

    // generic functions assume little endian
    this.nativeendian = "little";

    // little endian machine independent
    this.Read32Little = this.Read32LittleTemplate;
    this.Write32Little = this.Write32LittleTemplate;
    this.Read16Little = this.Read16LittleTemplate;
    this.Write16Little = this.Write16LittleTemplate;
    this.Read8Little = this.Read8LittleTemplate;
    this.Write8Little = this.Write8LittleTemplate;

    // machine dependent functions
    this.Read32 = this.Read32LittleTemplate;
    this.Write32 = this.Write32LittleTemplate;
    this.Read16 = this.Read16LittleTemplate;
    this.Write16 = this.Write16LittleTemplate;
    this.Read8 = this.Read8LittleTemplate;
    this.Write8 = this.Write8LittleTemplate;

    // big endian machine independent only used by big endian machines
    this.Read32Big = this.Read32BigTemplate;
    this.Write32Big = this.Write32BigTemplate;
    this.Read16Big = this.Read16BigTemplate;
    this.Write16Big = this.Write16BigTemplate;
    this.Read8Big = this.Read8BigTemplate;
    this.Write8Big = this.Write8BigTemplate;
}

RAM.prototype.AddDevice = function(device, devaddr, devsize) {
    if (devaddr & 0xFFFFFF) {
        message.Debug("Error: The device address not in the allowed memory region");
        message.Abort();
    }
    this.devices[(devaddr>>24)&0xFF] = device;
}

RAM.prototype.Little2Big = function(length) {
    for (var i = 0; i < length >> 2; i++) {
        this.int32mem[i] = utils.Swap32(this.int32mem[i]);
    }
    this.Read32 = this.Read32BigTemplate;
    this.Write32 = this.Write32BigTemplate;
    this.Read16 = this.Read16BigTemplate;
    this.Write16 = this.Write16BigTemplate;
    this.Read8 = this.Read8BigTemplate;
    this.Write8 = this.Write8BigTemplate;

    this.Read32Little = function(addr) { return utils.Swap32(this.Read32BigTemplate(addr)); }.bind(this);
    this.Write32Little = function(addr, x) { this.Write32BigTemplate(addr, utils.Swap32(x)); }.bind(this);
    this.Read16Little = function(addr) { return utils.Swap16(this.Read16BigTemplate(addr)); }.bind(this);
    this.Write16Little = function(addr, x) { this.Write16BigTemplate(addr, utils.Swap16(x)); }.bind(this);
    this.Read8Little = this.Read8BigTemplate.bind(this);
    this.Write8Little = this.Write8BigTemplate.bind(this);

    this.nativeendian = "big";
}

RAM.prototype.Read32BigTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Read32Big: read above upper boundary");
            message.Abort();
        }
        return this.int32mem[addr >> 2];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg32(addr & 0xFFFFFF);
};

RAM.prototype.Read32LittleTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Read32Little: read above upper boundary");
            message.Abort();
        }
        return this.int32mem[addr >> 2];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg32(addr & 0xFFFFFF);
};

RAM.prototype.Write32BigTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Write32Big: write above upper boundary");
            message.Abort();
        }
        this.int32mem[addr >> 2] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg32(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write32LittleTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Write32Little: write above upper boundary");
            message.Abort();
        }
        this.int32mem[addr >> 2] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg32(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Read8BigTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read8Big: read above upper boundary");
            message.Abort();
        }
        return this.uint8mem[addr ^ 3];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg8(addr & 0xFFFFFF);
};

RAM.prototype.Read8LittleTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read8Little: read above upper boundary");
            message.Abort();
        }
        return this.uint8mem[addr];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg8(addr & 0xFFFFFF);
};

RAM.prototype.Write8BigTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Write8Big: write above upper boundary");
            message.Abort();
        }
        this.uint8mem[addr ^ 3] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg8(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write8LittleTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Write8Little: write above upper boundary");
            message.Abort();
        }
        this.uint8mem[addr] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg8(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Read16BigTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read16Big: read above upper boundary");
            message.Abort();
        }
        return (this.uint8mem[(addr ^ 2)+1] << 8) | this.uint8mem[(addr ^ 2)];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg16(addr & 0xFFFFFF);
};

RAM.prototype.Read16LittleTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read16Little: read above upper boundary");
            message.Abort();
        }
        return (this.uint8mem[addr+1] << 8) | this.uint8mem[addr];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg16(addr & 0xFFFFFF);
};

RAM.prototype.Write16BigTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Write16Big: write above upper boundary");
            message.Abort();
        }
        this.uint8mem[(addr ^ 2)+1] = (x >> 8) & 0xFF;
        this.uint8mem[(addr ^ 2)  ] = x & 0xFF;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg16(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write16LittleTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Write16Little: write above upper boundary");
            message.Abort();
        }
        this.uint8mem[addr+1] = (x >> 8) & 0xFF;
        this.uint8mem[addr  ] =  x & 0xFF;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg16(addr & 0xFFFFFF, x|0);
};



module.exports = RAM;

},{"./messagehandler":43,"./utils":58}],49:[function(require,module,exports){

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

var PRV_U = 0x00;
var PRV_S = 0x01;
var PRV_H = 0x02;
var PRV_M = 0x03;

var CSR_MSTATUS   = 0x300;

function Disassemble(ins,r,csr,pc) {

    switch(ins&0x7F) {

        case 0x03:
            //lb,lh,lw,lbu,lhu
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //lb
                    message.Debug("lb - "+ utils.ToHex(ins));
                    break;

                case 0x01:
                    //lh
                    message.Debug("lh - "+ utils.ToHex(ins));
                    break;

                case 0x02:
                    //lw
                    message.Debug("lw - "+ utils.ToHex(ins));
                    break;

                case 0x04:
                    //lbu
                    message.Debug("lbu - "+ utils.ToHex(ins));
                    break;

                case 0x05:
                    //lhu
                    message.Debug("lhu - "+ utils.ToHex(ins));
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x23:
            //sb,sh,sw
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //sb
                    message.Debug("sb - "+ utils.ToHex(ins));
                    break;

                case 0x01:
                    //sh
                    message.Debug("sh - "+ utils.ToHex(ins));
                    break;

                case 0x02:
                    //sw
                    message.Debug("sw - "+ utils.ToHex(ins));
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x13:
            //addi,slti,sltiu,xori,ori,andi,slli,srli,srai
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //addi
                    message.Debug("addi - "+ utils.ToHex(ins));
                    break;

                case 0x02:
                    //slti
                    message.Debug("slti - "+ utils.ToHex(ins));
                    break;

                case 0x03:
                    //sltiu
                    message.Debug("sltiu - "+ utils.ToHex(ins));
                    break;

                case 0x04:
                    //xori
                    message.Debug("xori - "+ utils.ToHex(ins));
                    break;

                case 0x06:
                    //ori
                    message.Debug("ori - "+ utils.ToHex(ins));
                    break;

                case 0x07:
                    //andi
                    message.Debug("andi - "+ utils.ToHex(ins));
                    break;

                case 0x01:
                    //slli
                    message.Debug("slli - "+ utils.ToHex(ins));
                    break;

                case 0x05:
                    if(((ins >> 25) & 0x7F) == 0x00){
                        //srli
                        message.Debug("srli - "+ utils.ToHex(ins));
                    }
                    else if(((ins >> 25) & 0x7F) == 0x20){
                        //srai
                        message.Debug("srai - "+ utils.ToHex(ins));  
                    }
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x33:
            //add,sub,sll,slt,sltu,xor,srl,sra,or,and
            switch((ins >> 25)&0x7F) {
                
                case 0x00:
                    //add,slt,sltu,add,or,xor,sll,srl
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //add
                            message.Debug("add - "+ utils.ToHex(ins));
                            break;

                        case 0x02:
                            //slt
                            message.Debug("slt - "+ utils.ToHex(ins));
                            break;

                        case 0x03:
                            //sltu
                            message.Debug("sltu - "+ utils.ToHex(ins));
                            break;

                        case 0x07:
                            //and
                            message.Debug("and - "+ utils.ToHex(ins));
                            break;

                        case 0x06:
                            //or
                            message.Debug("or - "+ utils.ToHex(ins));
                            break;

                        case 0x04:
                            //xor
                            message.Debug("xor - "+ utils.ToHex(ins));
                            break;

                        case 0x01:
                            //sll
                            message.Debug("sll - "+ utils.ToHex(ins));
                            break;

                        case 0x05:
                            //srl
                            message.Debug("srl - "+ utils.ToHex(ins));
                            break;
                    }
                    break;

                case 0x20:
                    //sub
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //sub
                            message.Debug("sub - "+ utils.ToHex(ins));
                            break;

                        case 0x05:
                            //sra
                            message.Debug("sra - "+ utils.ToHex(ins));
                            break;
                    }
                    break;

                case 0x01:
                    //mul,mulh,mulhsu,mulhu,div,divu,rem,remu
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //mul
                            message.Debug("mul - "+ utils.ToHex(ins));
                            break;

                        case 0x01:
                            //mulh
                            message.Debug("mulh - "+ utils.ToHex(ins));
                            break;

                        case 0x02:
                            //mulhsu
                            message.Debug("mulhsu - "+ utils.ToHex(ins));
                            break;

                        case 0x03:
                            //mulhu
                            message.Debug("mulhu - "+ utils.ToHex(ins));
                            break;

                        case 0x04:
                            //div
                            message.Debug("div - "+ utils.ToHex(ins));
                            break;

                        case 0x05:
                            //divu
                            message.Debug("divu - "+ utils.ToHex(ins));
                            break;

                        case 0x06:
                            //rem
                            message.Debug("rem - "+ utils.ToHex(ins));
                            break;

                        case 0x07:
                            //remu
                            message.Debug("remu - "+ utils.ToHex(ins));
                            break;
                    }
                    break;
               

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x37:
            //lui
            message.Debug("Lui - "+ utils.ToHex(ins));
            break;

        case 0x17:
            //auipc
            message.Debug("auipc - "+ utils.ToHex(ins));
            break;

        case 0x6F:
            //jal
            message.Debug("jal - "+ utils.ToHex(ins));
            break; 

        case 0x67:
            //jalr
            message.Debug("jalr - "+ utils.ToHex(ins));
            break;

        case 0x63:
            //beq,bne,blt,bge,bltu,bgeu
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //beq
                    message.Debug("beq - "+ utils.ToHex(ins));
                    break;

                case 0x01:
                    //bne
                    message.Debug("bne - "+ utils.ToHex(ins));
                    break;

                case 0x04:
                    //blt
                    message.Debug("blt - "+ utils.ToHex(ins));
                    break;

                case 0x05:
                    //bge
                    message.Debug("bge - "+ utils.ToHex(ins));
                    break;

                case 0x06:
                    //bltu
                    message.Debug("bltu - "+ utils.ToHex(ins));
                    break;

                case 0x07:
                    //bgeu
                    message.Debug("bgeu - "+ utils.ToHex(ins));
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x73:
            //csrrw,csrrs,csrrc,csrrwi,csrrsi,csrrci,ecall,eret,ebreak,mrts
            switch((ins >> 12)&0x7) {
                
                case 0x01:
                    //csrrw
                    message.Debug("csrrw - "+ utils.ToHex(ins));
                    break;

                case 0x02:
                    //csrrs
                    message.Debug("csrrs - "+ utils.ToHex(ins));
                    break;

                case 0x03:
                    //csrrc
                    message.Debug("csrrc - "+ utils.ToHex(ins));
                    break;

                case 0x05:
                    //csrrwi
                    message.Debug("csrrwi - "+ utils.ToHex(ins));
                    break;
                    

                case 0x06:
                    //csrrsi
                    message.Debug("csrrsi - "+ utils.ToHex(ins));
                    break;

                case 0x07:
                    //csrrci
                    message.Debug("csrrci - "+ utils.ToHex(ins));
                    break;
                
                case 0x00:
                    //ecall,eret,ebreak,mrts
                    switch((ins >> 20)&0xFFF) {
                        case 0x00:
                            //ecall
                            var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
                            switch(current_privilege_level)
                            {
                                case PRV_U:
                                    message.Debug("ecall PRV_U -"+ utils.ToHex(ins));
                                    break;

                                case PRV_S:
                                    message.Debug("ecall PRV_S -"+ utils.ToHex(ins));
                                    break;

                                case PRV_H:
                                    message.Debug("Not supported ecall PRV_H -"+ utils.ToHex(ins));
                                    break;

                                case PRV_M:
                                    message.Debug("ecall PRV_M -"+ utils.ToHex(ins));
                                    break;
                                
                                default:
                                    message.Debug("Error in ecall: Don't know how to handle privilege level " + current_privilege_level);
                                    break;
                            }
                            break;

                        case 0x001:
                            //ebreak
                            message.Debug("ebreak - "+ utils.ToHex(ins)+" at PC" + utils.ToHex(this.pc));
                            break;

                        case 0x100:
                            //eret
                            var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
                            if(current_privilege_level < PRV_S) {
                                message.Debug("Error in eret: current_privilege_level isn't allowed access");
                                break;   
                            }
                            switch(current_privilege_level)
                            {
                                
                                case PRV_S:
                                    message.Debug("eret PRV_S -"+ utils.ToHex(ins));
                                    break;

                                case PRV_H:
                                    message.Debug("Not supported eret PRV_H -"+ utils.ToHex(ins));
                                    break;

                                case PRV_M:
                                    message.Debug("eret PRV_M -"+ utils.ToHex(ins));
                                    break;
                                
                                default:
                                    message.Debug("Error in eret: Don't know how to handle privilege level " + current_privilege_level);
                                    break;
                            }
                            break;

                        case 0x305:
                            //mrts     
                            if(current_privilege_level != PRV_M) {
                                message.Debug("Error in mrts: current_privilege_level isn't allowed access");
                                break;   
                            }
                            message.Debug("mrts - "+ utils.ToHex(ins));
                            break;

                        case 0x101:
                            //sfence.vm
                            message.Debug("sfence.vm - "+ utils.ToHex(ins));
                            break;

                        default:
                            message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                            break;

                    }
                    break; 

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x07:
            //flw,fld
            switch((ins >> 12)&0x7) {
                
                case 0x02:
                    //flw
                    message.Debug("flw - "+ utils.ToHex(ins));
                    break;

                case 0x03:
                    //fld
                    message.Debug("fld - "+ utils.ToHex(ins));
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x27:
            //fsw,fsd
            switch((ins >> 12)&0x7) {

                case 0x02:
                    //fsw
                    message.Debug("fsw - "+ utils.ToHex(ins));
                    break;

                case 0x03:
                    //fsd
                    message.Debug("fsw - "+ utils.ToHex(ins));
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x53:
            //fadd.s,fsub.s
            switch((ins >> 25)&0x7F) {
                
                case 0x00 :
                    //fadd.s
                    message.Debug("fadd.s - "+ utils.ToHex(ins));
                    break;

                case 0x04:
                    //fsub.s
                    message.Debug("fsub.s - "+ utils.ToHex(ins));
                    break;

                case 0x60:
                    //fcvt.w.s
                    message.Debug("fcvt.w.s - "+ utils.ToHex(ins));
                    break;

                case 0x01 :
                    //fadd.d
                    message.Debug("fadd.d - "+ utils.ToHex(ins));
                    break;

                case 0x05:
                    //fsub.d
                    message.Debug("fsub.d - "+ utils.ToHex(ins));
                    break;

                case 0x61:
                    //fcvt.w.d
                    message.Debug("fcvt.w.s - "+ utils.ToHex(ins));
                    break;

                case 0x78:
                    //fmv.s.x
                    message.Debug("fmv.s.x - "+ utils.ToHex(ins));
                    break;


                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;
            }
            break;

        case 0x2F:
            //amoswap,amoadd,amoxor,amoand,amoor,amomin,amomax,amominu,amomaxu
            switch((ins >> 27)&0x1F) {
                
                case 0x01:
                    //amoswap
                    message.Debug("amoswap - "+ utils.ToHex(ins));
                    break;

                case 0x00:
                    //amoadd
                    message.Debug("amoadd - "+ utils.ToHex(ins));
                    break;

                case 0x04:
                    //amoxor
                    message.Debug("amoxor - "+ utils.ToHex(ins));
                    break;

                case 0x0C:
                    //amoand
                    message.Debug("amoand - "+ utils.ToHex(ins));
                    break;

                case 0x08:
                    //amoor
                    message.Debug("amoor - "+ utils.ToHex(ins));
                    break;

                case 0x10:
                    //amomin
                    message.Debug("amomin - "+ utils.ToHex(ins));
                    break;

               case 0x14:
                    //amomax
                    message.Debug("amomax - "+ utils.ToHex(ins));
                    break;

                case 0x18:
                    //amominu
                    message.Debug("amominu - "+ utils.ToHex(ins));
                    break;

                case 0x1C:
                    //amomaxu
                    message.Debug("amomaxu - "+ utils.ToHex(ins));
                    break;

                case 0x02:
                    //lr.d
                    message.Debug("lr.d - "+ utils.ToHex(ins));
                    break;

                case 0x03:
                    //sc.d
                    message.Debug("sc.d - "+ utils.ToHex(ins));
                    break;

                default:
                    message.Debug("Error in Atomic Memory Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x0F:
            //fence
            message.Debug("fence - "+ utils.ToHex(ins));
            break;

        default:
            message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found at "+utils.ToHex(this.pc));
            break;
    }

    message.Debug(utils.ToHex(pc));
};

module.exports.Disassemble = Disassemble;
},{"../messagehandler":43,"../utils":58}],50:[function(require,module,exports){
// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------
var message = require('../messagehandler');
var utils = require('../utils');
var DebugIns = require('./disassemble');


// constructor
function DynamicCPU(stdlib, foreign, heap) {
"use asm";

var DebugMessage = foreign.DebugMessage;
var abort = foreign.abort;
var Read32 = foreign.Read32;
var Write32 = foreign.Write32;
var Read16 = foreign.Read16;
var Write16 = foreign.Write16;
var Read8 = foreign.Read8;
var Write8 = foreign.Write8;
var ReadDEVCMDToHost = foreign.ReadDEVCMDToHost;
var ReadDEVCMDFromHost = foreign.ReadDEVCMDFromHost;
var WriteDEVCMDToHost = foreign.WriteDEVCMDToHost;
var WriteDEVCMDFromHost = foreign.WriteDEVCMDFromHost;
var ReadToHost = foreign.ReadToHost;
var ReadFromHost = foreign.ReadFromHost;
var WriteToHost = foreign.WriteToHost;
var WriteFromHost = foreign.WriteFromHost;
var IsQueueEmpty = foreign.IsQueueEmpty;
var mul = foreign.mul;
var MathAbs = stdlib.Math.abs;

var ERROR_INCOMPLETE_VMPRIVILEGE = 0;
var ERROR_VMPRIVILEGE = 1;
var ERROR_VMMODE = 2;
var ERROR_SETCSR = 3;
var ERROR_GETCSR = 4;
var ERROR_LOAD_WORD = 5;
var ERROR_STORE_WORD = 6;
var ERROR_INSTRUCTION_NOT_FOUND = 7;
var ERROR_ECALL = 8;
var ERROR_ERET = 9;
var ERROR_ERET_PRIV = 10;
var ERROR_MRTS = 11;
var ERROR_ATOMIC_INSTRUCTION = 12;

var PRV_U = 0x00;
var PRV_S = 0x01;
var PRV_H = 0x02;
var PRV_M = 0x03;

var VM_READ  = 0;
var VM_WRITE = 1;
var VM_FETCH = 2;

var CAUSE_TIMER_INTERRUPT          = 0x80000001;
var CAUSE_HOST_INTERRUPT           = 0x80000002;
var CAUSE_SOFTWARE_INTERRUPT       = 0x80000000;
var CAUSE_INSTRUCTION_ACCESS_FAULT = 0x01;
var CAUSE_ILLEGAL_INSTRUCTION      = 0x02;
var CAUSE_BREAKPOINT               = 0x03;
var CAUSE_LOAD_ACCESS_FAULT        = 0x05;
var CAUSE_STORE_ACCESS_FAULT       = 0x07;
var CAUSE_ENVCALL_UMODE            = 0x08;
var CAUSE_ENVCALL_SMODE            = 0x09;
var CAUSE_ENVCALL_HMODE            = 0x0A;
var CAUSE_ENVCALL_MMODE            = 0x0B;


var CSR_CYCLES = 0x3000;
var CSR_CYCLEW = 0x2400;


var CSR_FFLAGS    = 0x4;
var CSR_FRM       = 0x8;
var CSR_FCSR      = 0xC;

var CSR_SSTATUS   = 0x400;
var CSR_STVEC     = 0x404;
var CSR_SIE       = 0x410;
var CSR_STIMECMP  = 0x484;
var CSR_SSCRATCH  = 0x500;
var CSR_SEPC      = 0x504;
var CSR_SIP       = 0x510;
var CSR_SPTBR     = 0x600;
var CSR_SASID     = 0x604;

var CSR_HEPC      = 0x904;

var CSR_MSTATUS   = 0xC00;
var CSR_MTVEC     = 0xC04;
var CSR_MTDELEG   = 0xC08;
var CSR_MIE       = 0xC10;
var CSR_MTIMECMP  = 0xC84;
var CSR_MTIMECMPH = 0xD84;
var CSR_MEPC      = 0xD04;
var CSR_MSCRATCH  = 0xD00;
var CSR_MCAUSE    = 0xD08;
var CSR_MBADADDR  = 0xD0C;
var CSR_MIP       = 0xD10;
var CSR_MTOHOST_TEMP = 0xD14; // terminal output, temporary for the patched pk.

var CSR_MTIME     = 0x1C04;
var CSR_MTIMEH    = 0x1D04;
var CSR_MRESET    = 0x1E08;
var CSR_SEND_IPI  = 0x1E0C;

var CSR_MTOHOST         = 0x1E00;
var CSR_MFROMHOST       = 0x1E04;
var CSR_MDEVCMDTOHOST   = 0x1E40; // special
var CSR_MDEVCMDFROMHOST = 0x1E44; // special

var CSR_TIMEW     = 0x2404;
var CSR_INSTRETW  = 0x2408;
var CSR_CYCLEHW   = 0x2600;
var CSR_TIMEHW    = 0x2604;
var CSR_INSTRETHW = 0x2608;

var CSR_STIMEW    = 0x2804;
var CSR_STIMEH    = 0x3604;
var CSR_STIMEHW   = 0x2A04;
var CSR_STIME     = 0x3404;
var CSR_SCAUSE    = 0x3508;
var CSR_SBADADDR  = 0x350C;
var CSR_MCPUID    = 0x3C00;
var CSR_MIMPID    = 0x3C04;
var CSR_MHARTID   = 0x3C40;
var CSR_CYCLEH    = 0x3200;
var CSR_TIMEH     = 0x3204;
var CSR_INSTRETH  = 0x3208;

var CSR_TIME      = 0x3004;
var CSR_INSTRET   = 0x3008;
var CSR_STATS     = 0x300;
var CSR_UARCH0    = 0x3300;
var CSR_UARCH1    = 0x3304;
var CSR_UARCH2    = 0x3008;
var CSR_UARCH3    = 0x330C;
var CSR_UARCH4    = 0x3310;
var CSR_UARCH5    = 0x3314;
var CSR_UARCH6    = 0x3318;
var CSR_UARCH7    = 0x331C;
var CSR_UARCH8    = 0x3320;
var CSR_UARCH9    = 0x3324;
var CSR_UARCH10   = 0x3328;
var CSR_UARCH11   = 0x332C;
var CSR_UARCH12   = 0x3330;
var CSR_UARCH13   = 0x33334;
var CSR_UARCH14   = 0x33338;
var CSR_UARCH15   = 0x3333C;

var r = new stdlib.Int32Array(heap); // registers
var rp = 0x00; //Never used

var f = new stdlib.Float64Array(heap); // registers
var fp = 0x80;

var fi = new stdlib.Int32Array(heap); // for copying operations
var fip = 0x80;

var ff = new stdlib.Float32Array(heap); // the zero register is used to convert to single precision
var ffp = 0x00; //Never used

var csr = new stdlib.Int32Array(heap);
var csrp = 0x2000;

var ram = new stdlib.Int32Array(heap);
var ramp = 0x100000;

var ram8 = new stdlib.Int8Array(heap);
var ram16 = new stdlib.Int16Array(heap);

var pc = 0x200;
var pcorigin = 0x200;
var pc_change = 1; //1 implies pc has been changed by an instruction
var ticks = 0;
var amoaddr = 0,amovalue = 0;

var fence = 0x200;
var ppc = 0x200;
var ppcorigin = 0x200;

var instlb_index = -1; //tlb index for pc
var instlb_entry = -1;
var read8tlb_index = -1; //tlb index for lb ins
var read8tlb_entry = -1;
var read8utlb_index = -1; //tlb index for lbu ins
var read8utlb_entry = -1;
var read16tlb_index = -1; //tlb index for lh ins
var read16tlb_entry = -1;
var read16utlb_index = -1; //tlb index for lhu ins
var read16utlb_entry = -1;
var read32tlb_index = -1; //tlb index for lw ins
var read32tlb_entry = -1;
var store8tlb_index = -1; //tlb index for sb ins
var store8tlb_entry = -1;
var store16tlb_index = -1; //tlb index for sh ins
var store16tlb_entry = -1;
var store32tlb_index = -1; //tlb index for sw ins
var store32tlb_entry = -1;

var float_read32tlb_index = -1; //tlb index for flw ins
var float_read32tlb_entry = -1;
var float_read64tlb_index = -1; //tlb index for fld ins
var float_read64tlb_entry = -1;
var float_store32tlb_index = -1; //tlb index for fsw ins
var float_store32tlb_entry = -1;
var float_store64tlb_index = -1; //tlb index for fsd ins
var float_store64tlb_entry = -1;

var queue_status = 0; // 1 means queue is full

function Init() {
    Reset();
}

function Reset() {
    ticks = 0;
    csr[(csrp + CSR_MSTATUS)>>2]  = 0x96; // 1001 0110 - All Interrupts Disabled, FPU disabled 
    csr[(csrp + CSR_MTOHOST)>>2]  =  0x780;
    csr[(csrp + CSR_MCPUID)>>2]   = 0x4112D;
    csr[(csrp + CSR_MIMPID)>>2]   = 0x01;
    csr[(csrp + CSR_MHARTID)>>2]  = 0x00;
    csr[(csrp + CSR_MTVEC)>>2]    = 0x100;
    csr[(csrp + CSR_MIE)>>2]      = 0x00;
    csr[(csrp + CSR_MEPC)>>2]     = 0x00;
    csr[(csrp + CSR_MCAUSE)>>2]   = 0x00;
    csr[(csrp + CSR_MBADADDR)>>2] = 0x00;
    csr[(csrp + CSR_SSTATUS)>>2]  = 0x3010;
    csr[(csrp + CSR_STVEC)>>2]    = 0x00;
    csr[(csrp + CSR_SIE)>>2]      = 0x00;
    csr[(csrp + CSR_TIME)>>2]     = 0x0;
    csr[(csrp + CSR_SPTBR)>>2]    = 0x40000;

    // for atomic load & store instructions
    amoaddr = 0x00; 
    amovalue = 0x00;
}

function GetTimeToNextInterrupt() {
    return 10;
}

function GetTicks() {
    return ticks|0;
}

function ProgressTime(delta) {
    delta = delta|0;
    ticks = ticks + delta|0;
}


function AnalyzeImage() // we haveto define these to copy the cpus
{
}

function CheckForInterrupt() {
};

function RaiseInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
    //DebugMessage("raise int " + line);
    queue_status = 1;
};

function ClearInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
};

function Trap(cause, current_pc) {

    cause = cause|0;
    current_pc = current_pc|0;
    var current_privilege_level = 0;
    var offset = 0x100;
    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    PushPrivilegeStack();
    csr[(csrp + CSR_MEPC)>>2] = current_pc;
    csr[(csrp + CSR_MCAUSE)>>2] = cause;
    pc = (offset + (current_privilege_level << 6))|0;
    fence = ppc;
    pc_change = 1;
    InvalidateTLB();
};

function MemTrap(addr, op) {

    addr = addr|0;
    op = op|0;
    if((op|0) != (VM_FETCH|0)) pc = pcorigin + (ppc-ppcorigin)|0;
    csr[(csrp + CSR_MBADADDR)>>2] = addr;
    switch(op|0) {
        case 0: //VM_READ
            Trap(CAUSE_LOAD_ACCESS_FAULT, pc - 4|0);
            break;

        case 1: //VM_WRITE
            Trap(CAUSE_STORE_ACCESS_FAULT, pc - 4|0);
            break;

        case 2: //VM_FETCH
            Trap(CAUSE_INSTRUCTION_ACCESS_FAULT, pc);
            break;
    }

}



function CheckVMPrivilege(type, op) {

    type = type|0;
    op = op|0;
    var priv = 0;
    priv = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

    switch(type|0) {

        case 2: 
            if ((op|0) == (VM_READ|0)) return 1;
            if (((priv|0) == (PRV_U|0)) & ((op|0) == (VM_FETCH|0))) return 1;
            return 0;
            break;

        case 3: 
            if (!( ((priv|0) == (PRV_S|0)) & ((op|0) == (VM_FETCH|0)) ) ) return 1;
            break;

        case 4:
            if ((op|0) == (VM_READ|0)) return 1;
            return 0;
            break;

        case 5:
            if ((op|0) != (VM_FETCH|0)) return 1;
            break;

        case 6:
            if ((op|0) != (VM_WRITE|0)) return 1;
            break;

        case 7:
            return 1;
            break;

        case 13:
            if (((priv|0) == (PRV_S|0)) & ((op|0) != (VM_FETCH|0))) return 1;
            break;

        case 14:
            if (((priv|0) == (PRV_S|0)) & ((op|0) != (VM_WRITE|0))) return 1;
            break;

        case 15: 
            if ((priv|0) == (PRV_S|0)) return 1;
            break;

    }

    DebugMessage(ERROR_INCOMPLETE_VMPRIVILEGE|0);
    abort();
    return 0;
}


function TranslateVM(addr, op) {

    addr = addr|0;
    op = op|0;
    var vm = 0;
    var current_privilege_level = 0;
    var i = 1; //i = LEVELS -1 and LEVELS = 2 in a 32 bit System

    var offset = 0;
    var page_num = 0;
    var frame_num = 0;
    var type = 0;
    var valid = 0;

    //For Level 2
    var new_sptbr = 0;
    var new_page_num = 0;
    var new_frame_num = 0;
    var new_type = 0;
    var new_valid = 0;
    var ram_index = 0;


    vm = (csr[(csrp + CSR_MSTATUS)>>2] >> 17) & 0x1F;
    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    
    // vm bare mode
    if(((vm|0) == 0) | ((current_privilege_level|0) == (PRV_M|0))) return addr|0;

    // hack, open mmio by direct mapping
    //if ((addr>>>28) == 0x9) return addr;

    // only RV32 supported
    if((vm|0) != 8) {
        DebugMessage(ERROR_VMMODE|0);
        abort();
    }

    // LEVEL 1
    offset = addr & 0xFFF;
    page_num = (addr >>> 22)|0;

    ram_index = (csr[(csrp + CSR_SPTBR)>>2]|0) + (page_num << 2)|0
    frame_num = ram[(ramp + ram_index) >> 2]|0;
    type = ((frame_num >> 1) & 0xF);
    valid = (frame_num & 0x01);

    if ((valid|0) == 0) {
        //DebugMessage("Unsupported valid field " + valid + " or invalid entry in PTE at PC "+utils.ToHex(pc) + " pl:" + current_privilege_level + " addr:" + utils.ToHex(addr) + " op:"+op);
        //abort();
        MemTrap(addr, op);
        return -1;
    }
    if ((type|0) >= 2) {

        if (!(CheckVMPrivilege(type,op)|0)) {
            DebugMessage(ERROR_VMPRIVILEGE|0);
            abort();
        }
/*
        var updated_frame_num = frame_num;
        if(op == VM_READ)
            updated_frame_num = (frame_num | 0x20);
        else if(op == VM_WRITE)
            updated_frame_num = (frame_num | 0x60);
        Write32(csr[CSR_SPTBR] + (page_num << 2),updated_frame_num);
*/
        return (((frame_num >> 10) | ((addr >> 12) & 0x3FF)) << 12) | offset;
    }

    // LEVEL 2
    //DebugMessage("Second level MMU");

    offset = addr & 0xFFF;
    new_sptbr = (frame_num & 0xFFFFFC00) << 2;
    new_page_num = (addr >> 12) & 0x3FF;
    ram_index = (new_sptbr|0) + (new_page_num << 2)|0;
    new_frame_num = ram[(ramp + ram_index) >> 2]|0;
    new_type = ((new_frame_num >> 1) & 0xF);
    new_valid = (new_frame_num & 0x01);
    i = (i - 1)|0;

    if ((new_valid|0) == 0) {
        MemTrap(addr, op);
        return -1;
    }

    if (!(CheckVMPrivilege(new_type, op)|0)) {
        //DebugMessage("Error in TranslateVM: Unhandled trap");
        //abort();
        MemTrap(addr, op);
        return -1;
    }

/*
    var updated_frame_num = new_frame_num;
    if(op == VM_READ)
        updated_frame_num = (new_frame_num | 0x20);
    else if(op == VM_WRITE)
        updated_frame_num = (new_frame_num | 0x60);
    Write32(new_sptbr + (new_page_num << 2),updated_frame_num);
*/

    return ((new_frame_num >> 10) << 12) | offset | 0;
};


function SetCSR(addr,value) {

    addr = addr|0;
    value = value|0;
    var mask = 0;
    var ram_index = 0;
    addr = addr << 2;
    switch(addr|0)
    {
        case 0xC: //CSR_FCSR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1E40: //CSR_MDEVCMDTOHOST
            csr[(csrp + addr)>>2] = value;
            WriteDEVCMDToHost(value|0);
            break;

        case 0x1E44: //CSR_MDEVCMDFROMHOST
            csr[(csrp + addr)>>2] = value;
            WriteDEVCMDFromHost(value|0);
            break;

        case 0x1E00: //CSR_MTOHOST
            csr[(csrp + addr)>>2] =  value;
            WriteToHost(value|0);
            break;

        case 0xD14: //CSR_MTOHOST_TEMP only temporary for the patched pk.
            ram_index = 0x90000000 >> 0;
            ram8[(ramp + ram_index) >> 0] = value|0; 
            if ((value|0) == 0xA) ram8[(ramp + ram_index) >> 0] = 0xD;
            break;

        case 0x1E04: //CSR_MFROMHOST
            csr[(csrp + addr)>>2] = value;
            WriteFromHost(value|0);
            break;

        case 0xC00: //CSR_MSTATUS
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3C00: //CSR_MCPUID
            //csr[addr] = value;
            break;

        case 0x3C04: //CSR_MIMPID
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3C40: //CSR_MHARTID
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xC04: //CSR_MTVEC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD10: //CSR_MIP
            //csr[addr] = value;
            mask = 0x2 | 0x08; //mask = MIP_SSIP | MIP_MSIP
            csr[(csrp + addr)>>2] = (csr[(csrp + addr)>>2] & ~mask) | (value & mask);
            break;

        case 0xC10: //CSR_MIE
            //csr[addr] = value;
            mask = 0x2 | 0x08 | 0x20; //mask = MIP_SSIP | MIP_MSIP | MIP_STIP
            csr[(csrp + addr)>>2] = (csr[(csrp + addr)>>2] & ~mask) | (value & mask);
            break;

        case 0x504: //CSR_SEPC
        case 0xD04: //CSR_MEPC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD08: //CSR_MCAUSE
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3508: //CSR_SCAUSE
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD0C: //CSR_MBADADDR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x350C: //CSR_SBADADDR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x400: //CSR_SSTATUS
            csr[(csrp + CSR_SSTATUS)>>2] = value;
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] & (~0x1F039); 
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x01); //IE0
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x08); //IE1
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x10); //PRV1
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0xF000); //FS,XS
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x10000); //MPRV
            break; 

        case 0x404: //CSR_STVEC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x510: //CSR_SIP
            //csr[addr] = value;
            mask = 0x2; //mask = MIP_SSIP
            csr[(csrp + CSR_MIP)>>2] = (csr[(csrp + CSR_MIP)>>2] & ~mask) | (value & mask);
            break;

        case 0x410: //CSR_SIE
            //csr[addr] = value;
            mask = 0x2 | 0x20; //mask = MIP_SSIP | MIP_STIP
            csr[(csrp + CSR_MIE)>>2] = (csr[(csrp + CSR_MIE)>>2] & ~mask) | (value & mask);
            break;

        case 0xD00: //CSR_MSCRATCH
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x500: //CSR_SSCRATCH
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x2400: //CSR_CYCLEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3000: //CSR_CYCLES
            ticks = value;
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1C04:  //CSR_MTIME
        case 0x3404:  //CSR_STIME
        case 0x2804: //CSR_STIMEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1D04:  //CSR_MTIMEH
        case 0x3604:  //CSR_STIMEH
        case 0x2A04: //CSR_STIMEHW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3004:  //CSR_TIME
        case 0x2404: //CSR_TIMEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xC84: //CSR_MTIMECMP
        case 0x484: //CSR_STIMECMP
            csr[(csrp + CSR_MIP)>>2] = csr[(csrp + CSR_MIP)>>2] & (~(0x20)); //csr[CSR_MIP] &= ~MIP_STIP
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD84: //CSR_MTIMECMPH
        case 0x600: //CSR_SPTBR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x04: //CSR_FRM
        case 0x08: //CSR_FFLAGS
            csr[(csrp + addr)>>2] = value;
            break;

        default:
            csr[(csrp + addr)>>2] = value;
            DebugMessage(ERROR_SETCSR|0);
            abort();
            break;
    }
};

function GetCSR(addr) {

    addr = addr|0;
    var current_privilege_level = 0;
    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    addr = (addr << 2)|0;
    switch(addr|0)
    {
        case 0xC: //CSR_FCSR
            return 0x0;
            break;

        case 0x1E40: //CSR_MDEVCMDTOHOST
            return ReadDEVCMDToHost()|0;
            break;

        case 0x1E44: //CSR_MDEVCMDFROMHOST
            return ReadDEVCMDFromHost()|0;
            break;

        case 0x1E00: //CSR_MTOHOST
            return ReadToHost()|0;
            break;

        case 0xD14: //CSR_MTOHOST_TEMP only temporary for the patched pk.
            return 0x0;
            break;

        case 0x1E04: //CSR_MFROMHOST
            return ReadFromHost()|0;
            break;

        case 0xC00: //CSR_MSTATUS
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C00: //CSR_MCPUID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C04: //CSR_MIMPID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C40: //CSR_MHARTID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xC04: //CSR_MTVEC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xC10: //CSR_MIE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x504: //CSR_SEPC
        case 0xD04: //CSR_MEPC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD08: //CSR_MCAUSE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3508: //CSR_SCAUSE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD0C: //CSR_MBADADDR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x350C: //CSR_SBADADDR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x400: //CSR_SSTATUS
            //if (current_privilege_level == 0) Trap(CAUSE_ILLEGAL_INSTRUCTION);
            csr[(csrp + CSR_SSTATUS)>>2] = 0x00; 
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x01); //IE0
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x08); //IE1
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x10); //PRV1
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0xF000); //FS,XS
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x10000); //MPRV
            return csr[(csrp + CSR_SSTATUS)>>2]|0;
            break;

        case 0x404: //CSR_STVEC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD10: //CSR_MIP
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x510: //CSR_SIP 
            return (csr[(csrp + CSR_MIP)>>2] & (0x2 | 0x20))|0;//(MIP_SSIP | MIP_STIP)
            break;

        case 0x410: //CSR_SIE 
            return (csr[(csrp + CSR_MIE)>>2] & (0x2 | 0x20))|0;//(MIP_SSIP | MIP_STIP)
            break;

        case 0xD00: //CSR_MSCRATCH
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x500: //CSR_SSCRATCH
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x2400: //CSR_CYCLEW
            return ticks|0;
            break;

        case 0x3000: //CSR_CYCLES
            return ticks|0;
            break;

        case 0x1C04:  //CSR_MTIME
        case 0x3404:  //CSR_STIME
        case 0x2804: //CSR_STIMEW
            return ticks|0;
            break;

        case 0x1D04:  //CSR_MTIMEH
        case 0x3604:  //CSR_STIMEH
        case 0x2A04: //CSR_STIMEHW
            return ((ticks) >> 32)|0;
            break;

        case 0x3004:  //CSR_TIME
        case 0x2404: //CSR_TIMEW
            return ticks|0;
            break;

        case 0xC84: //CSR_MTIMECMP
        case 0x484: //CSR_STIMECMP
            return csr[(csrp + addr)>>2]|0;
            break;
        
        case 0xD84: //CSR_MTIMECMPH
        case 0x600: //CSR_SPTBR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x04: //CSR_FRM
        case 0x08: //CSR_FFLAGS
            return csr[(csrp + addr)>>2]|0;
            break;

        default:
            DebugMessage(ERROR_GETCSR|0);
            abort();
            return csr[(csrp + addr)>>2]|0;
            break;
    }

    return 0;
   
};

function IMul(a,b,index) {

    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0,result1 = 0;
    
    var a00 = 0, a16 = 0;
    var b00 = 0, b16 = 0;

    var c00 = 0;
    var c16 = 0;
    var c32 = 0;
    var c48 = 0;

    if (((a >>> 0) < 32767) & ((b >>> 0) < 65536)) {
        result0 = mul(a|0,b|0)|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if((index|0) == 0) return result0|0;
        else return result1|0;
    }

    a00 = a & 0xFFFF;
    a16 = a >>> 16;
    b00 = b & 0xFFFF;

    b16 = b >>> 16;

    c00 = mul(a00|0,b00|0)|0;
    c16 = ((c00 >>> 16) + (mul(a16|0,b00|0)|0))|0;
    c32 = c16 >>> 16;
    c16 = ((c16 & 0xFFFF) + (mul(a00|0,b16|0)|0))|0;
    c32 = (c32 + (c16 >>> 16))|0;
    c48 = c32 >>> 16;
    c32 = ((c32 & 0xFFFF) + (mul(a16|0,b16|0)|0))|0;
    c48 = (c48 + (c32 >>> 16))|0;

    result0 = ((c16 & 0xFFFF) << 16) | (c00 & 0xFFFF);
    result1 = ((c48 & 0xFFFF) << 16) | (c32 & 0xFFFF);
    if((index|0) == 0) return result0|0;
    return result1|0;
};

function UMul(a,b,index) {

    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0,result1 = 0;
    var doNegate = 0;

    if ((a|0) == 0) return 0;
    if ((b|0) == 0) return 0;

    if ((((a|0) >= -32768) & ((a|0) <= 32767)) & (((b|0) >= -32768) & ((b|0) <= 32767))) {
        result0 = mul(a|0,b|0)|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if((index|0) == 0) return result0|0;
        else return result1|0;
    }

    doNegate = ((a|0) < 0) ^ ((b|0) < 0);

    a = MathAbs(a|0)|0;
    b = MathAbs(b|0)|0;
    result0 = IMul(a, b, 0)|0;
    result1 = IMul(a, b, 1)|0;

    if (doNegate) {
        result0 = ~result0;
        result1 = ~result1;
        result0 = (result0 + 1) | 0;
        if ((result0|0) == 0) result1 = (result1 + 1) | 0;
    }

    if((index|0) == 0) return result0|0;
    return result1|0;
};

function SUMul(a,b,index) {

    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0,result1 = 0;
    var doNegate = 0;

    if ((a|0) == 0) return 0;
    if ((b|0) == 0) return 0;

    if ((((a|0) >= -32768) & ((a|0) <= 32767)) & (((b|0) >= -32768) & ((b >>> 0) <= 32767))) {
        result0 = mul(a|0,b|0)|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if((index|0) == 0) return result0|0;
        else return result1|0;
    }

    doNegate = ((a|0) < 0) ^ ((b|0) < 0);

    a = MathAbs(a|0)|0;
    b = MathAbs(b|0)|0;
    result0 = IMul(a, b, 0)|0;
    result1 = IMul(a, b, 1)|0;

    if (doNegate) {
        result0 = ~result0;
        result1 = ~result1;
        result0 = (result0 + 1) | 0;
        if ((result0|0) == 0) result1 = (result1 + 1) | 0;
    }

    if((index|0) == 0) return result0|0;
    return result1|0;
};

function InvalidateTLB(){

    read8tlb_index = -1;
    read8tlb_entry = -1;
    read8utlb_index = -1;
    read8utlb_entry = -1;
    read16tlb_index = -1;
    read16tlb_entry = -1;
    read16utlb_index = -1;
    read16utlb_entry = -1;
    read32tlb_index = -1;
    read32tlb_entry = -1;
    store8tlb_index = -1;
    store8tlb_entry = -1;
    store16tlb_index = -1;
    store16tlb_entry = -1;
    store32tlb_index = -1;
    store32tlb_entry = -1;

    float_read32tlb_index = -1;
    float_read32tlb_entry = -1;
    float_read64tlb_index = -1;
    float_read64tlb_entry = -1;
    float_store32tlb_index = -1;
    float_store32tlb_entry = -1;
    float_store64tlb_index = -1;
    float_store64tlb_entry = -1;

}

function PushPrivilegeStack(){

    var mstatus = 0,privilege_level_stack = 0, new_privilege_level_stack = 0;
    mstatus = csr[(csrp + CSR_MSTATUS)>>2]|0;
    privilege_level_stack =  (mstatus & 0xFFF);
    new_privilege_level_stack = (((privilege_level_stack << 2) | PRV_M) << 1) & 0xFFF;
    csr[(csrp + CSR_MSTATUS)>>2] = (((mstatus >> 12) << 12) + new_privilege_level_stack) & 0xFFFEFFFF; //Last "and" to set mprv(bit 16) to zero
};

function PopPrivilegeStack(){

    var mstatus = 0,privilege_level_stack = 0, new_privilege_level_stack = 0;
    mstatus = csr[(csrp + CSR_MSTATUS)>>2]|0;
    privilege_level_stack =  (mstatus & 0xFFF);
    new_privilege_level_stack = ((privilege_level_stack >>> 3) | ((PRV_U << 1) | 0x1) << 9);
    csr[(csrp + CSR_MSTATUS)>>2] = ((mstatus >> 12) << 12) + new_privilege_level_stack;
};

function Step(steps, clockspeed) {

    steps = steps|0;
    clockspeed = clockspeed|0;
    var imm = 0x00;
    var zimm = 0x00;
    var mult = 0x00;
    var quo = 0x00;
    var rem = 0x00;
    var result = 0x00;
    var rs1 = 0x0;
    var rs2 = 0x0;
    var fs1 = 0.0;
    var fs2 = 0.0;
    var fs3 = 0.0;
    
    var delta = 0;
    var paddr = 0;
    var current_privilege_level = 0;
    var interrupts = 0;
    var ie = 0;
    var ins = 0;
    var dsteps = 64;
    
    for(;;) {
 
    if ((fence|0) != (ppc|0)) {

        ins = ram[ppc >> 2]|0;
        ppc = ppc + 4|0;

        switch(ins&0x7F) {

            case 0x03:
                //lb, lh, lw, lbu, lhu
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        //lb
                        imm = (ins >> 20);
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if(!((read8tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (read8tlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                            if((paddr|0) == -1) continue;

                            read8tlb_index = paddr;
                            read8tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        r[((ins >> 5) & 0x7C) >> 2] = ((ram8[(ramp + paddr) >> 0]) << 24) >> 24;
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x74; //If this ins comes again, it will take the faster route at opcode 0x74
                        continue;

                    case 0x01:
                        //lh
                        imm = (ins >> 20);
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if(!((read16tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (read16tlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                            if((paddr|0) == -1) continue;

                            read16tlb_index = paddr;
                            read16tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        r[((ins >> 5) & 0x7C) >> 2] = ((ram16[(ramp + paddr) >> 1]) << 16) >> 16;
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x75;
                        continue;

                    case 0x02:
                        //lw
                        imm = (ins >> 20);
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if ((rs1+imm) & 3) {
                             DebugMessage(ERROR_LOAD_WORD|0);
                             abort();
                        }
                        if(!((read32tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (read32tlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                            if((paddr|0) == -1) continue;

                            read32tlb_index = paddr;
                            read32tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x76;
                        continue;

                    case 0x04:
                        //lbu
                        imm = (ins >> 20);
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if(!((read8utlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (read8utlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                            if((paddr|0) == -1) continue;

                            read8utlb_index = paddr;
                            read8utlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        r[((ins >> 5) & 0x7C) >> 2] = (ram8[(ramp + paddr) >> 0]) & 0xFF;
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x77;
                        continue;

                    case 0x05:
                        //lhu
                        imm = (ins >> 20);
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if(!((read16utlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (read16utlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                            if((paddr|0) == -1) continue;

                            read16utlb_index = paddr;
                            read16utlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        r[((ins >> 5) & 0x7C) >> 2] = (ram16[(ramp + paddr) >> 1]) & 0xFFFF;
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x78;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x23:
                //sb, sh, sw
                imm = ((ins >> 25) << 5) | ((ins >> 7) & 0x1F);
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        //sb
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if(!((store8tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (store8tlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                            if((paddr|0) == -1) continue;

                            store8tlb_index = paddr;
                            store8tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        ram8[(ramp + paddr) >> 0] = (r[((ins >> 18) & 0x7C) >> 2] & 0xFF);
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x79;
                        continue;

                    case 0x01:
                        //sh
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if(!((store16tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (store16tlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                            if((paddr|0) == -1) continue;

                            store16tlb_index = paddr;
                            store16tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        ram16[(ramp + paddr) >> 1] = (r[((ins >> 18) & 0x7C) >> 2] & 0xFFFF);
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x7A;
                        continue;

                    case 0x02:
                        //sw
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if ((rs1+imm) & 3) {
                             DebugMessage(ERROR_STORE_WORD|0);
                             abort();
                        }
                        if(!((store32tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (store32tlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                            if((paddr|0) == -1) continue;

                            store32tlb_index = paddr;
                            store32tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        ram[(ramp + paddr) >> 2] = r[((ins >> 18) & 0x7C) >> 2]|0;
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x7B;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x13:
                //addi,slti,sltiu,xori,ori,andi,slli,srli,srai
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        //addi
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 + (ins >> 20)|0;
                        continue;

                    case 0x02:
                        //slti
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if((rs1|0) < (ins >> 20)) r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                        else r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        continue;

                    case 0x03:
                        //sltiu
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if((rs1 >>> 0) < ((ins >> 20) >>> 0)) r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                        else r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        continue;

                    case 0x04:
                        //xori
                        imm = (ins >> 20);
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 ^ (ins >> 20);
                        continue;

                    case 0x06:
                        //ori
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 | (ins >> 20);
                        continue;

                    case 0x07:
                        //andi
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 & (ins >> 20);
                        continue;

                    case 0x01:
                        //slli
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 << ((ins >> 20) & 0x1F);
                        continue;

                    case 0x05:
                        if(((ins >> 25) & 0x7F) == 0x00){
                            //srli
                            rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                            r[((ins >> 5) & 0x7C) >> 2] = rs1 >>> ((ins >> 20) & 0x1F);
                        }
                        else if(((ins >> 25) & 0x7F) == 0x20){
                            //srai
                            rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                            r[((ins >> 5) & 0x7C) >> 2] = rs1 >> ((ins >> 20) & 0x1F);
                        }
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x33:
                //add,sub,sll,slt,sltu,xor,srl,sra,or,and
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00:
                        //add,slt,sltu,add,or,xor,sll,srl
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                //add
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 + rs2;
                                continue;

                            case 0x02:
                                //slt
                                if((rs1|0) < (rs2|0)) r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                                else r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                                continue;

                            case 0x03:
                                //sltu
                                if((rs1 >>> 0) < (rs2 >>> 0)) r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                                else r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                                continue;

                            case 0x07:
                                //and
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 & rs2;
                                continue;

                            case 0x06:
                                //or
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 | rs2;
                                continue;

                            case 0x04:
                                //xor
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 ^ rs2;
                                continue;

                            case 0x01:
                                //sll
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 << (rs2 & 0x1F);
                                continue;

                            case 0x05:
                                //srl
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 >>> (rs2 & 0x1F);
                                continue;
                        }
                        continue;

                    case 0x20:
                        //sub, sra
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                //sub
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 - rs2;
                                continue;

                            case 0x05:
                                //sra
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 >> (rs2 & 0x1F);
                                continue;
                        }
                        continue;

                    case 0x01:
                        //mul,mulh,mulhsu,mulhu,div,divu,rem,remu
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                //mul
                                mult = mul(rs1|0,rs2|0)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = mult & 0xFFFFFFFF;
                                continue;

                            case 0x01:
                                //mulh
                                result = UMul(rs1,rs2, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x02:
                                //mulhsu
                                result = SUMul(rs1,rs2>>>0, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x03:
                                //mulhu
                                result = IMul(rs1>>>0, rs2>>>0, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x04:
                                //div
                                if((rs2|0) == 0)
                                    quo = -1;
                                else
                                    quo = ((rs1|0) / (rs2|0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = quo;
                                continue;

                            case 0x05:
                                //divu
                                if((rs2|0) == 0)
                                    quo = 0xFFFFFFFF;
                                else
                                    quo = ((rs1 >>> 0) / (rs2 >>> 0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = quo;
                                continue;

                            case 0x06:
                                //rem
                                if((rs2|0) == 0)
                                    rem = rs1;
                                else
                                    rem = ((rs1|0) % (rs2|0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = rem;
                                continue;

                            case 0x07:
                                //remu
                                if((rs2|0) == 0)
                                    rem = (rs1 >>> 0);
                                else
                                    rem = ((rs1 >>> 0) % (rs2 >>> 0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = rem;
                                continue;
                        }
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x37:
                //lui
                r[((ins >> 5) & 0x7C) >> 2] = (ins & 0xFFFFF000);
                continue;

            case 0x17:
                //auipc
                pc = pcorigin + (ppc-ppcorigin)|0;
                imm = (ins & 0xFFFFF000);
                r[((ins >> 5) & 0x7C) >> 2] = (imm + pc - 4)|0;
                fence = ppc;
                pc_change = 1;
                continue;

            case 0x6F:
                //jal
                pc = pcorigin + (ppc-ppcorigin)|0;
                imm =  (((ins >> 21) & 0x3FF) | (((ins >> 20) & 0x1) << 10) | (((ins >> 12) & 0xFF) << 11) | ((ins >> 31) << 19) ) << 1; 
                r[((ins >> 5) & 0x7C) >> 2] = pc;
                pc = pc + imm - 4|0;
                fence = ppc;
                pc_change = 1;
                r[0] = 0;
                continue; 

            case 0x67:
                //jalr
                pc = pcorigin + (ppc-ppcorigin)|0;
                imm = (ins >> 20);
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                r[((ins >> 5) & 0x7C) >> 2] = pc;
                pc = ((rs1 + imm) & 0xFFFFFFFE)|0;
                fence = ppc;
                pc_change = 1;
                r[0] = 0;
                continue;

            case 0x63:
                //beq, bne, blt, bge, bltu, bgeu
                pc = pcorigin + (ppc-ppcorigin)|0;
                fence = ppc;
                pc_change = 1;
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        //beq
                        if((rs1|0) == (rs2|0)){
                            imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                            pc = pc + imm - 4|0;
                        }
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x68;
                        continue;

                    case 0x01:
                        //bne
                        if((rs1|0) != (rs2|0)){
                            imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                            pc = pc + imm - 4|0;
                        }
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x69;
                        continue;

                    case 0x04:
                        //blt
                        if((rs1|0) < (rs2|0)){
                            imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                            pc = pc + imm - 4|0;
                        }
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x6A;
                        continue;

                    case 0x05:
                        //bge
                        if((rs1|0) >= (rs2|0)){
                            imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                            pc = pc + imm - 4|0;
                        }
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x6B;
                        continue;

                    case 0x06:
                        //bltu
                        if((rs1 >>> 0) < (rs2 >>> 0)){
                            imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                            pc = pc + imm - 4|0;
                        }
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x6C;
                        continue;

                    case 0x07:
                        //bgeu
                        if((rs1 >>> 0) >= (rs2 >>> 0)){
                            imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                            pc = pc + imm - 4|0;
                        }
                        ram[(ppc - 4) >> 2] = ((ins >> 7) << 7) | 0x6D;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x73:
                //csrrw, csrrs, csrrc, csrrwi, csrrsi, csrrci, ecall, eret, ebreak, mrts, wfi
                imm = (ins >>> 20);
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                switch((ins >> 12)&0x7) {
                    
                    case 0x01:
                        //csrrw
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        //if (rindex != ((ins >> 15) & 0x1F))
                        SetCSR(imm, rs1);
                        r[0] = 0;
                        continue;

                    case 0x02:
                        //csrrs
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        SetCSR(imm, (GetCSR(imm)|0) | rs1);
                        r[0] = 0;
                        continue;

                    case 0x03:
                        //csrrc
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        SetCSR(imm, (GetCSR(imm)|0) & (~rs1));
                        r[0] = 0;
                        continue;

                    case 0x05:
                        //csrrwi
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if((zimm|0) != 0) SetCSR(imm, (zimm >> 0));
                        r[0] = 0;
                        continue;
                        
                    case 0x06:
                        //csrrsi
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if((zimm|0) != 0) SetCSR(imm, (GetCSR(imm)|0) | (zimm >> 0));
                        r[0] = 0;
                        continue;

                    case 0x07:
                        //csrrci
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if((zimm|0) != 0) SetCSR(imm, (GetCSR(imm)|0) & ~(zimm >> 0));
                        r[0] = 0;
                        continue;
                    
                    case 0x00:
                        //ecall, eret, ebreak, mrts, wfi
                        current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
                        fence = ppc;
                        switch((ins >> 20)&0xFFF) {
                            case 0x00:
                                //ecall
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                switch(current_privilege_level|0)
                                {
                                    case 0x00: //PRV_U
                                        Trap(CAUSE_ENVCALL_UMODE, pc - 4|0);
                                        break;

                                    case 0x01: //PRV_S
                                        Trap(CAUSE_ENVCALL_SMODE, pc - 4|0);
                                        break;

                                    case 0x02: //PRV_H
                                        Trap(CAUSE_ENVCALL_HMODE, pc - 4|0);
                                        abort();
                                        break;

                                    case 0x03: //PRV_M
                                        Trap(CAUSE_ENVCALL_MMODE, pc - 4|0);
                                        break;
                                    
                                    default:
                                        DebugMessage(ERROR_ECALL|0);
                                        abort();
                                        break;
                                }
                                continue;

                            case 0x001:
                                //ebreak
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                Trap(CAUSE_BREAKPOINT, pc - 4|0);
                                continue;

                            case 0x100:
                                //eret
                                current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                if((current_privilege_level|0) < (PRV_S|0)) {
                                    DebugMessage(ERROR_ERET_PRIV|0);
                                    abort();
                                    break;   
                                }
                                PopPrivilegeStack();

                                switch(current_privilege_level|0)
                                {
                                    
                                    case 0x01: //PRV_S
                                        //DebugMessage("eret PRV_S -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_SEPC)>>2]|0;
                                        break;

                                    case 0x02: //PRV_H
                                        //DebugMessage("Not supported eret PRV_H -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_HEPC)>>2]|0;
                                        abort();
                                        break;

                                    case 0x03: //PRV_M
                                        //DebugMessage("eret PRV_M -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_MEPC)>>2]|0;
                                        break;
                                    
                                    default:
                                        DebugMessage(ERROR_ERET|0);
                                        abort();
                                        break;
                                }
                                pc_change = 1;
                                InvalidateTLB();
                                continue;

                            case 0x102:
                                // wfi
                                continue;

                            case 0x305:
                                //mrts
                                pc = pcorigin + (ppc-ppcorigin)|0;    
                                if((current_privilege_level|0) != (PRV_M|0)) {
                                    DebugMessage(ERROR_MRTS|0);
                                    abort();
                                    break;   
                                }
                                csr[(csrp + CSR_MSTATUS)>>2] = (csr[(csrp + CSR_MSTATUS)>>2] & ~0x6) | 0x02; //Setting the Privilage level to Supervisor
                                csr[(csrp + CSR_SBADADDR)>>2] = csr[(csrp + CSR_MBADADDR)>>2];
                                csr[(csrp + CSR_SCAUSE)>>2] = csr[(csrp + CSR_MCAUSE)>>2];
                                csr[(csrp + CSR_SEPC)>>2] = csr[(csrp + CSR_MEPC)>>2];
                                pc = csr[(csrp + CSR_STVEC)>>2]|0;
                                pc_change = 1;
                                continue;

                            case 0x101:
                                //sfence.vm
                                InvalidateTLB();
                                continue;

                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                abort();
                                break;

                        }
                        continue; 

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x07:
                //flw,fld
                switch((ins >> 12)&0x7) {
                    
                    case 0x02:
                        //flw
                        imm = (ins >> 20);
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if(!((float_read32tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (float_read32tlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                            if((paddr|0) == -1) break;

                            float_read32tlb_index = paddr;
                            float_read32tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        r[0] = ram[(ramp + paddr) >> 2]|0;
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +ff[0];
                        r[0] = 0;
                        continue;

                    case 0x03:
                        //fld
                        imm = (ins >> 20);
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if(!((float_read64tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (float_read64tlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                            if((paddr|0) == -1) continue;

                            float_read64tlb_index = paddr;
                            float_read64tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        fi[(fip + ((((ins >> 7) & 0x1F) + 0) << 2)) >> 2] = ram[(ramp + paddr + 0) >> 2]|0;
                        fi[(fip + ((((ins >> 7) & 0x1F) + 1) << 2)) >> 2] = ram[(ramp + paddr + 4) >> 2]|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;

                }
                continue;

            case 0x27:
                //fsw, fsd
                switch((ins >> 12)&0x7) {

                    case 0x02:
                        //fsw
                        imm = (((ins >> 25) << 5) + ((ins >> 7) & 0x1F))|0;
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        ff[0] = f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3];
                        if(!((float_store32tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (float_store32tlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                            if((paddr|0) == -1) continue;

                            float_store32tlb_index = paddr;
                            float_store32tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x03:
                        //fsd
                        imm = (((ins >> 25) << 5) + ((ins >> 7) & 0x1F))|0;
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        if(!((float_store64tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (float_store64tlb_entry ^ (rs1 + imm|0));
                        else{

                            paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                            if((paddr|0) == -1) continue;

                            float_store64tlb_index = paddr;
                            float_store64tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                        }
                        ram[(ramp + paddr + 0) >> 2] = fi[(fip + ((((ins >> 20) & 0x1F) + 0) << 2)) >> 2]|0;
                        ram[(ramp + paddr + 4) >> 2] = fi[(fip + ((((ins >> 20) & 0x1F) + 1) << 2)) >> 2]|0; 
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;

                }
                continue;

            case 0x53:
                //fadd.s, fsub.s
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00:  //fadd.s
                    case 0x01:  //fadd.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = fs1 + fs2;
                        continue;

                    case 0x04: //fsub.s 
                    case 0x05: //fsub.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = fs1 - fs2;
                        continue;

                    case 0x50:
                    case 0x51:
                        //fcmp.s, fcmp.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        switch((ins >> 12) & 0x7) {
                            case 0x0:
                                //fle
                                if((+fs1) <= (+fs2)) r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            case 0x1:
                                //flt
                                if((+fs1) < (+fs2)) r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            case 0x2:
                                //fle
                                if((+fs1) == (+fs2)) r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                DebugMessage(ins|0);
                                abort();
                                break;
                        }
                        continue;

                    case 0x60:
                        //fcvt.w.s
                        r[((ins >> 5) & 0x7C) >> 2] = (~~+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        continue;

                    case 0x68: //fcvt.s.w
                    case 0x69:
                        //fcvt.d.w
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = (+~~r[(((ins >> 15) & 0x1F) << 2) >> 2]);
                        continue;

                    case 0x08: //fmul.s
                    case 0x09: //fmul.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = (+mul(fs1,fs2));
                        continue;
 
                    case 0x10: // single precision
                    case 0x11: // double precision
                        //fsgnj
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        switch((ins >> 12) & 7) {
                            case 0:
                                //fsgnj.d, also used for fmv.d
                                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = ((+fs2)<(+0))?-(+MathAbs(+fs1)):(+MathAbs(+fs1));
                                continue;
 
                            case 1:
                                //fsgnjn.d
                                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = ((+fs2)<(+0))?+MathAbs(+fs1):-(+MathAbs(+fs1));
                                continue;
 
                            case 3:
                                //fsgnjx.d
                                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = 
                                    ( 
                                    (((+fs2)<(+0)) & ((+fs1)<(+0)) ) | 
                                    (((+fs2)>(+0)) & ((+fs1)>(+0)) )
                                    )?-(+MathAbs(+fs1)):+MathAbs(+fs1);
                                continue;
 
                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                DebugMessage(ins|0);
                                abort();
                        }
                        continue;

                    case 0x61:
                        //fcvt.w.d
                        r[((ins >> 5) & 0x7C) >> 2] = (~~+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        continue;

                    case 0x78:
                        //fmv.s.x
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        r[0] = rs1;
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +ff[0];
                        r[0] = 0;
                        continue;


                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;
                }
                continue;

            case 0x43:
                //fmadd.d,fmadd.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = fs1 * fs2 + fs3;
                continue;
 
            case 0x47:
                //fmsub.d,fmsub.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = fs1 * fs2 - fs3;
                continue;
 
            case 0x4B:
                //fnmadd.d,fnmadd.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = -(fs1 * fs2 + fs3);
                continue;
 
            case 0x4F:
                //fnmsub.d,fnmsub.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = -(fs1 * fs2 - fs3);
                continue;

            case 0x2F:
                //amoswap, amoadd, amoxor, amoand, amoor, amomin, amomax, amominu, amomaxu
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                switch((ins >> 27)&0x1F) {
                    
                    case 0x01:
                        //amoswap
                        paddr = TranslateVM(rs1|0, VM_READ)|0;
                        if((paddr|0) == -1) break;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if((paddr|0) == -1) break;
                        ram[(ramp + paddr) >> 2] = rs2|0;
                        r[0] = 0;
                        continue;

                    case 0x00:
                        //amoadd
                        paddr = TranslateVM(rs1|0, VM_READ)|0;
                        if((paddr|0) == -1) break;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0,VM_WRITE)|0;
                        if((paddr|0) == -1) break;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) + (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x04:
                        //amoxor
                        paddr = TranslateVM(rs1|0, VM_READ)|0;
                        if((paddr|0) == -1) break;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0,VM_WRITE)|0;
                        if((paddr|0) == -1) break;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) ^ (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x0C:
                        //amoand
                        paddr = TranslateVM(rs1|0, VM_READ)|0;
                        if((paddr|0) == -1) break;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0,VM_WRITE)|0;
                        if((paddr|0) == -1) break;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) & (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x08:
                        //amoor
                        paddr = TranslateVM(rs1|0, VM_READ)|0;
                        if((paddr|0) == -1) break;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0,VM_WRITE)|0;
                        if((paddr|0) == -1) break;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) | (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x10:
                        //amomin
                        paddr = TranslateVM(rs1|0, VM_READ)|0;
                        if((paddr|0) == -1) break;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if((rs2 >> 0) > (r[((ins >> 5) & 0x7C) >> 2] >> 0)) r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1|0,VM_WRITE)|0;
                        if((paddr|0) == -1) break;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                   case 0x14:
                        //amomax
                        paddr = TranslateVM(rs1|0,VM_READ)|0;
                        if((paddr|0) == -1) break;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if((rs2 >> 0) < (r[((ins >> 5) & 0x7C) >> 2] >> 0)) r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1|0,VM_WRITE)|0;
                        if((paddr|0) == -1) break;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x18:
                        //amominu
                        paddr = TranslateVM(rs1|0,VM_READ)|0;
                        if((paddr|0) == -1) break;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if((rs2 >>> 0) > (r[((ins >> 5) & 0x7C) >> 2] >>> 0)) r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1|0,VM_WRITE)|0;
                        if((paddr|0) == -1) break;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x1C:
                        //amomaxu
                        paddr = TranslateVM(rs1|0,VM_READ)|0;
                        if((paddr|0) == -1) break;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if((rs2 >>> 0) < (r[((ins >> 5) & 0x7C) >> 2] >>> 0)) r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1|0,VM_WRITE)|0;
                        if((paddr|0) == -1) break;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x02:
                        //lr.d
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        paddr = TranslateVM(rs1|0,VM_READ)|0;
                        if((paddr|0) == -1) break;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        amoaddr = rs1;
                        amovalue = r[((ins >> 5) & 0x7C) >> 2]|0;
                        r[0] = 0;
                        continue;

                    case 0x03:
                        //sc.d
                        rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        if((rs1|0) != (amoaddr|0)) {
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                            continue;
                        }
                        paddr = TranslateVM(rs1, VM_READ)|0;
                        if((paddr|0) == -1) break;
                        if((ram[(ramp + paddr) >> 2]|0) != (amovalue|0)) {
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                            continue;
                        }
                        r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        paddr = TranslateVM(rs1, VM_WRITE)|0;
                        if ((paddr|0) == -1) break;
                        ram[(ramp + paddr) >> 2] = rs2|0;
                        r[0] = 0;
                        continue;

                    default:
                        DebugMessage(ERROR_ATOMIC_INSTRUCTION|0);
                        abort();
                        break;

                }
                continue;

            case 0x0F:
                //fence
                continue;

            //custom opcodes defined to make instructions take the faster route
            case 0x74:
                //lb
                imm = (ins >> 20);
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                if(!((read8tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (read8tlb_entry ^ (rs1 + imm|0));
                else{

                    paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                    if((paddr|0) == -1) continue;

                    read8tlb_index = paddr;
                    read8tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                }
                r[((ins >> 5) & 0x7C) >> 2] = ((ram8[(ramp + paddr) >> 0]) << 24) >> 24;
                continue;

            case 0x75:
                //lh
                imm = (ins >> 20);
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                if(!((read16tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (read16tlb_entry ^ (rs1 + imm|0));
                else{

                    paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                    if((paddr|0) == -1) continue;

                    read16tlb_index = paddr;
                    read16tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                }
                r[((ins >> 5) & 0x7C) >> 2] = ((ram16[(ramp + paddr) >> 1]) << 16) >> 16;
                continue;

            case 0x76:
                //lw
                imm = (ins >> 20);
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                if ((rs1+imm) & 3) {
                     DebugMessage(ERROR_LOAD_WORD|0);
                     abort();
                }
                if(!((read32tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (read32tlb_entry ^ (rs1 + imm|0));
                else{

                    paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                    if((paddr|0) == -1) continue;

                    read32tlb_index = paddr;
                    read32tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                }
                r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                continue;

            case 0x77:
                //lbu
                imm = (ins >> 20);
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                if(!((read8utlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (read8utlb_entry ^ (rs1 + imm|0));
                else{

                    paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                    if((paddr|0) == -1) continue;

                    read8utlb_index = paddr;
                    read8utlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                }
                r[((ins >> 5) & 0x7C) >> 2] = (ram8[(ramp + paddr) >> 0]) & 0xFF;
                continue;

            case 0x78:
                //lhu
                imm = (ins >> 20);
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                if(!((read16utlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (read16utlb_entry ^ (rs1 + imm|0));
                else{

                    paddr = TranslateVM(rs1 + imm|0, VM_READ)|0;
                    if((paddr|0) == -1) continue;

                    read16utlb_index = paddr;
                    read16utlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                }
                r[((ins >> 5) & 0x7C) >> 2] = (ram16[(ramp + paddr) >> 1]) & 0xFFFF;
                continue;

            case 0x79:
                //sb
                imm = ((ins >> 25) << 5) | ((ins >> 7) & 0x1F);
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                if(!((store8tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (store8tlb_entry ^ (rs1 + imm|0));
                else{

                    paddr = TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                    if((paddr|0) == -1) continue;

                    store8tlb_index = paddr;
                    store8tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                }
                ram8[(ramp + paddr) >> 0] = (r[((ins >> 18) & 0x7C) >> 2] & 0xFF);
                continue;

            case 0x7A:
                //sh
                imm = ((ins >> 25) << 5) | ((ins >> 7) & 0x1F);
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                if(!((store16tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (store16tlb_entry ^ (rs1 + imm|0));
                else{

                    paddr = TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                    if((paddr|0) == -1) continue;

                    store16tlb_index = paddr;
                    store16tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                }
                ram16[(ramp + paddr) >> 1] = (r[((ins >> 18) & 0x7C) >> 2] & 0xFFFF);
                continue;

            case 0x7B:
                //sw
                imm = ((ins >> 25) << 5) | ((ins >> 7) & 0x1F);
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                if ((rs1+imm) & 3) {
                     DebugMessage(ERROR_STORE_WORD|0);
                     abort();
                }
                if(!((store32tlb_index ^ (rs1 + imm|0)) & 0xFFFFF000)) paddr = (store32tlb_entry ^ (rs1 + imm|0));
                else{

                    paddr = TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                    if((paddr|0) == -1) continue;

                    store32tlb_index = paddr;
                    store32tlb_entry = ((paddr ^ (rs1 + imm|0)) & 0xFFFFF000);
                }
                ram[(ramp + paddr) >> 2] = r[((ins >> 18) & 0x7C) >> 2]|0;
                continue;

            case 0x68:
                //beq
                pc = pcorigin + (ppc-ppcorigin)|0;
                fence = ppc;
                pc_change = 1;
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                if((rs1|0) == (rs2|0)){
                    imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                    pc = pc + imm - 4|0;
                }
                continue;

            case 0x69:
                //bne
                pc = pcorigin + (ppc-ppcorigin)|0;
                fence = ppc;
                pc_change = 1;
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                if((rs1|0) != (rs2|0)){
                    imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                    pc = pc + imm - 4|0;
                }
                continue;

            case 0x6A:
                //blt
                pc = pcorigin + (ppc-ppcorigin)|0;
                fence = ppc;
                pc_change = 1;
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                if((rs1|0) < (rs2|0)){
                    imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                    pc = pc + imm - 4|0;
                }
                continue;

            case 0x6B:
                //bge
                pc = pcorigin + (ppc-ppcorigin)|0;
                fence = ppc;
                pc_change = 1;
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                if((rs1|0) >= (rs2|0)){
                    imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                    pc = pc + imm - 4|0;
                }
                continue;

            case 0x6C:
                //bltu
                pc = pcorigin + (ppc-ppcorigin)|0;
                fence = ppc;
                pc_change = 1;
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                if((rs1 >>> 0) < (rs2 >>> 0)){
                    imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                    pc = pc + imm - 4|0;
                }
                continue;

            case 0x6D:
                //bgeu
                pc = pcorigin + (ppc-ppcorigin)|0;
                fence = ppc;
                pc_change = 1;
                rs1 = r[(((ins >> 15) & 0x1F) << 2) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                if((rs1 >>> 0) >= (rs2 >>> 0)){
                    imm =  ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                    pc = pc + imm - 4|0;
                }
                continue;


            default:
                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                DebugMessage(ins|0);
                abort();
                break;
        } // end of switch

    } else // fence
    {

            if(!(pc_change|0)) pc = pcorigin + (ppc-ppcorigin)|0;

            dsteps = dsteps - ((ppc-ppcorigin) >> 2)|0;
            if ((dsteps|0) < 0) {

                dsteps = dsteps + 64|0;
                steps =  steps - 64|0;

                if((steps|0) < 0) return 0;

                delta = (csr[(csrp + CSR_MTIMECMP)>>2]|0) - ticks | 0;
                delta = delta + ((delta|0)<0?0xFFFFFFFF:0x0) | 0;
                ticks = ticks + clockspeed| 0;
                if ((delta|0) < (clockspeed|0)) {
                    csr[(csrp + CSR_MIP)>>2] = csr[(csrp + CSR_MIP)>>2] | 0x20;
                }

                // check for interrupts
                current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

                interrupts = csr[(csrp + CSR_MIE)>>2] & csr[(csrp + CSR_MIP)>>2];
                ie = csr[(csrp + CSR_MSTATUS)>>2] & 0x01;

                if (((current_privilege_level|0) < 3) | (((current_privilege_level|0) == 3) & (ie|0))) {
                    if (((interrupts|0) & 0x8)) {
                        Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                        continue;
                    } else
                    if (queue_status|0) {
                        Trap(CAUSE_HOST_INTERRUPT, pc);
                        queue_status = 0;
                        continue;
                    }
                }
                if (((current_privilege_level|0) < 1) | (((current_privilege_level|0) == 1) & (ie|0))) {
                    if (((interrupts|0) & 0x2)) {
                        Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                        continue;
                    } else
                    if (((interrupts|0) & 0x20)) {
                         Trap(CAUSE_TIMER_INTERRUPT, pc);
                         continue;
                    }
                }
            } // dsteps

            // get new instruction pointer
            if ((instlb_index ^ pc) & 0xFFFFF000) {
                ppc = TranslateVM(pc,VM_FETCH)|0;
                if((ppc|0) == -1) {
                    ppc = fence;
                    continue;
                }
                instlb_index = pc;
                instlb_entry = ((ppc ^ pc) & 0xFFFFF000);
            }

            ppc = ramp + (instlb_entry ^ pc)| 0;
            ppcorigin = ppc;
            pcorigin = pc;
            fence  = ((ppc >> 12) + 1) << 12; // next page
            pc_change = 0;

        } // end of fence

    } // main loop

    return 0;
};

return {

    Reset: Reset,
    Init: Init,
    InvalidateTLB: InvalidateTLB,
    Step: Step,
    TranslateVM: TranslateVM,
    GetCSR: GetCSR,
    SetCSR: SetCSR,
    Trap: Trap,
    MemTrap: MemTrap,
    PopPrivilegeStack: PopPrivilegeStack,
    PushPrivilegeStack: PushPrivilegeStack,
    IMul: IMul,
    UMul: UMul,
    SUMul: SUMul,
    CheckVMPrivilege: CheckVMPrivilege,  
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    GetTicks: GetTicks,
    AnalyzeImage: AnalyzeImage,
    CheckForInterrupt: CheckForInterrupt,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt
};

}

module.exports = DynamicCPU;

},{"../messagehandler":43,"../utils":58,"./disassemble":49}],51:[function(require,module,exports){
// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------
var message = require('../messagehandler');
var utils = require('../utils');
var DebugIns = require('./disassemble');


// constructor
function FastCPU(stdlib, foreign, heap) {
"use asm";

var DebugMessage = foreign.DebugMessage;
var abort = foreign.abort;
var Read32 = foreign.Read32;
var Write32 = foreign.Write32;
var Read16 = foreign.Read16;
var Write16 = foreign.Write16;
var Read8 = foreign.Read8;
var Write8 = foreign.Write8;
var ReadDEVCMDToHost = foreign.ReadDEVCMDToHost;
var ReadDEVCMDFromHost = foreign.ReadDEVCMDFromHost;
var WriteDEVCMDToHost = foreign.WriteDEVCMDToHost;
var WriteDEVCMDFromHost = foreign.WriteDEVCMDFromHost;
var ReadToHost = foreign.ReadToHost;
var ReadFromHost = foreign.ReadFromHost;
var WriteToHost = foreign.WriteToHost;
var WriteFromHost = foreign.WriteFromHost;
var imul = foreign.imul;
var MathAbs = stdlib.Math.abs;
var floor = stdlib.Math.floor;

//One of the following error ids are printed to the console in case of an abort()
var ERROR_INCOMPLETE_VMPRIVILEGE = 0;
var ERROR_VMPRIVILEGE            = 1;
var ERROR_VMMODE                 = 2;
var ERROR_SETCSR                 = 3;
var ERROR_GETCSR                 = 4;
var ERROR_LOAD_WORD              = 5;
var ERROR_STORE_WORD             = 6;
var ERROR_INSTRUCTION_NOT_FOUND  = 7;
var ERROR_ECALL                  = 8;
var ERROR_ERET                   = 9;
var ERROR_ERET_PRIV              = 10;
var ERROR_MRTS                   = 11;
var ERROR_ATOMIC_INSTRUCTION     = 12;

//Privilege Modes
var PRV_U = 0x00;
var PRV_S = 0x01;
var PRV_H = 0x02;
var PRV_M = 0x03;

//Various operations on the page table
var VM_READ  = 0;
var VM_WRITE = 1;
var VM_FETCH = 2;

//Various Causes which need to be written to MCAUSE Register in case of a Trap
var CAUSE_TIMER_INTERRUPT          = 0x80000001;
var CAUSE_HOST_INTERRUPT           = 0x80000002;
var CAUSE_SOFTWARE_INTERRUPT       = 0x80000000;
var CAUSE_INSTRUCTION_ACCESS_FAULT = 0x01;
var CAUSE_ILLEGAL_INSTRUCTION      = 0x02;
var CAUSE_BREAKPOINT               = 0x03;
var CAUSE_LOAD_ACCESS_FAULT        = 0x05;
var CAUSE_STORE_ACCESS_FAULT       = 0x07;
var CAUSE_ENVCALL_UMODE            = 0x08;
var CAUSE_ENVCALL_SMODE            = 0x09;
var CAUSE_ENVCALL_HMODE            = 0x0A;
var CAUSE_ENVCALL_MMODE            = 0x0B;

//All CSR addresses have been multiplied for implementing in the asm.js way
var CSR_CYCLES = 0x3000;
var CSR_CYCLEW = 0x2400;


var CSR_FFLAGS    = 0x4;
var CSR_FRM       = 0x8;
var CSR_FCSR      = 0xC;

var CSR_SSTATUS   = 0x400;
var CSR_STVEC     = 0x404;
var CSR_SIE       = 0x410;
var CSR_STIMECMP  = 0x484;
var CSR_SSCRATCH  = 0x500;
var CSR_SEPC      = 0x504;
var CSR_SIP       = 0x510;
var CSR_SPTBR     = 0x600;
var CSR_SASID     = 0x604;

var CSR_HEPC      = 0x904;

var CSR_MSTATUS   = 0xC00;
var CSR_MTVEC     = 0xC04;
var CSR_MTDELEG   = 0xC08;
var CSR_MIE       = 0xC10;
var CSR_MTIMECMP  = 0xC84;
var CSR_MTIMECMPH = 0xD84;
var CSR_MEPC      = 0xD04;
var CSR_MSCRATCH  = 0xD00;
var CSR_MCAUSE    = 0xD08;
var CSR_MBADADDR  = 0xD0C;
var CSR_MIP       = 0xD10;
var CSR_MTOHOST_TEMP = 0xD14; // terminal output, temporary for the patched pk.

var CSR_MTIME     = 0x1C04;
var CSR_MTIMEH    = 0x1D04;
var CSR_MRESET    = 0x1E08;
var CSR_SEND_IPI  = 0x1E0C;

var CSR_MTOHOST         = 0x1E00;
var CSR_MFROMHOST       = 0x1E04;
var CSR_MDEVCMDTOHOST   = 0x1E40; // special
var CSR_MDEVCMDFROMHOST = 0x1E44; // special

var CSR_TIMEW     = 0x2404;
var CSR_INSTRETW  = 0x2408;
var CSR_CYCLEHW   = 0x2600;
var CSR_TIMEHW    = 0x2604;
var CSR_INSTRETHW = 0x2608;

var CSR_STIMEW    = 0x2804;
var CSR_STIMEH    = 0x3604;
var CSR_STIMEHW   = 0x2A04;
var CSR_STIME     = 0x3404;
var CSR_SCAUSE    = 0x3508;
var CSR_SBADADDR  = 0x350C;
var CSR_MCPUID    = 0x3C00;
var CSR_MIMPID    = 0x3C04;
var CSR_MHARTID   = 0x3C40;
var CSR_CYCLEH    = 0x3200;
var CSR_TIMEH     = 0x3204;
var CSR_INSTRETH  = 0x3208;

var CSR_TIME      = 0x3004;
var CSR_INSTRET   = 0x3008;
var CSR_STATS     = 0x300;
var CSR_UARCH0    = 0x3300;
var CSR_UARCH1    = 0x3304;
var CSR_UARCH2    = 0x3008;
var CSR_UARCH3    = 0x330C;
var CSR_UARCH4    = 0x3310;
var CSR_UARCH5    = 0x3314;
var CSR_UARCH6    = 0x3318;
var CSR_UARCH7    = 0x331C;
var CSR_UARCH8    = 0x3320;
var CSR_UARCH9    = 0x3324;
var CSR_UARCH10   = 0x3328;
var CSR_UARCH11   = 0x332C;
var CSR_UARCH12   = 0x3330;
var CSR_UARCH13   = 0x33334;
var CSR_UARCH14   = 0x33338;
var CSR_UARCH15   = 0x3333C;

/*
    Heap Layout
    ===========
    The heap is needed by the asm.js CPU.

    0x0       32 CPU registers
    0x80      Floating Point Registers
    0x2000    CSR Registers
    ------- RAM --------
    0x100000  RAM
*/


var r = new stdlib.Int32Array(heap); // Registers
var rp = 0x00; // Never used

var f = new stdlib.Float64Array(heap); // Registers
var fp = 0x80; // Offset to floating point registers in the Heap

var fi = new stdlib.Int32Array(heap); // For copying operations
var fip = 0x80;

var ff = new stdlib.Float32Array(heap); // The zero register is used to convert to single precision
var ffp = 0x00; // Never used

var csr = new stdlib.Int32Array(heap);
var csrp = 0x2000; // Offset to CSRs in the Heap

var ram = new stdlib.Int32Array(heap);
var ramp = 0x100000; // Offset to Ram in the Heap

var ram8 = new stdlib.Int8Array(heap); // 8 bit view of heap
var ram16 = new stdlib.Int16Array(heap); // 16 bit view of heap

var pc = 0x200; // Virtual PC
var pcorigin = 0x200;
var pc_change = 1; // 1 implies pc has been changed by an instruction
var ticks = 0;
var amoaddr = 0, amovalue = 0;

var fence = 0x200; // Has the next page address in case of normal operation, it is made equal to ppc in insts like branch, jump etc
var ppc = 0x200; // Physical PC
var ppcorigin = 0x200;


// tlb_index contains the virutal address and tlb_entry will have the correponding Phsysical Address
// If the page number of vaddr matches with the tlb_index then we directly read the tlb_entry to get the Physical Frame Number
var instlb_index     = -0x8000; // tlb index for pc
var instlb_entry     = -0x8000;
var read8tlb_index   = -1; // tlb index for lb ins
var read8tlb_entry   = -1;
var read8utlb_index  = -1; // tlb index for lbu ins
var read8utlb_entry  = -1;
var read16tlb_index  = -1; // tlb index for lh ins
var read16tlb_entry  = -1;
var read16utlb_index = -1; // tlb index for lhu ins
var read16utlb_entry = -1;
var read32tlb_index  = -1; // tlb index for lw ins
var read32tlb_entry  = -1;
var store8tlb_index  = -1; // tlb index for sb ins
var store8tlb_entry  = -1;
var store16tlb_index = -1; // tlb index for sh ins
var store16tlb_entry = -1;
var store32tlb_index = -1; // tlb index for sw ins
var store32tlb_entry = -1;

var float_read32tlb_index  = -1; // tlb index for flw ins
var float_read32tlb_entry  = -1;
var float_read64tlb_index  = -1; // tlb index for fld ins
var float_read64tlb_entry  = -1;
var float_store32tlb_index = -1; // tlb index for fsw ins
var float_store32tlb_entry = -1;
var float_store64tlb_index = -1; // tlb index for fsd ins
var float_store64tlb_entry = -1;

var queue_status = 0; // 1 means queue is full

function Init() {
    Reset();
}

function Reset() {
    ticks = 0;
    csr[(csrp + CSR_MSTATUS)>>2]  = 0x96; // 1001 0110 - All Interrupts Disabled, FPU disabled
    csr[(csrp + CSR_MTOHOST)>>2]  = 0x780;
    csr[(csrp + CSR_MCPUID)>>2]   = 0x4112D;
    csr[(csrp + CSR_MIMPID)>>2]   = 0x01;
    csr[(csrp + CSR_MHARTID)>>2]  = 0x00;
    csr[(csrp + CSR_MTVEC)>>2]    = 0x100;
    csr[(csrp + CSR_MIE)>>2]      = 0x00;
    csr[(csrp + CSR_MEPC)>>2]     = 0x00;
    csr[(csrp + CSR_MCAUSE)>>2]   = 0x00;
    csr[(csrp + CSR_MBADADDR)>>2] = 0x00;
    csr[(csrp + CSR_SSTATUS)>>2]  = 0x3010;
    csr[(csrp + CSR_STVEC)>>2]    = 0x00;
    csr[(csrp + CSR_SIE)>>2]      = 0x00;
    csr[(csrp + CSR_TIME)>>2]     = 0x0;
    csr[(csrp + CSR_SPTBR)>>2]    = 0x40000;

    // for atomic load & store instructions
    amoaddr = 0x00;
    amovalue = 0x00;
}

function GetPC() {
    pc = pcorigin + (ppc-ppcorigin)|0;
    return pc|0;
}

function GetTimeToNextInterrupt() {
    var delta = 0x0;
    delta = (csr[(csrp + 0xC84)>> 2]>>>0) - (ticks & 0xFFFFFFFF) |0;
    delta = delta + ((delta|0)<0?0xFFFFFFFF:0x0) | 0;
    return delta|0;
}

function GetTicks() {
    return ticks|0;
}

function ProgressTime(delta) {
    delta = delta|0;
    ticks = ticks + delta|0;
}


function AnalyzeImage() // we haveto define these to copy the cpus
{
}

function CheckForInterrupt() {
};

function RaiseInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
    //DebugMessage("raise int " + line);
    queue_status = 1;
};

function ClearInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
};

function Trap(cause, current_pc) {

    //Store the current_pc, set the mcause register and point PC to the Trap Handler
    cause = cause|0;
    current_pc = current_pc|0;
    var current_privilege_level = 0;
    var offset = 0x100;

    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    PushPrivilegeStack();
    csr[(csrp + CSR_MEPC)>>2] = current_pc;
    csr[(csrp + CSR_MCAUSE)>>2] = cause;
    pc = (offset + (current_privilege_level << 6))|0;
    fence = ppc;
    pc_change = 1;
    InvalidateTLB();
};

function MemTrap(addr, op) {

    addr = addr|0;
    op = op|0;
    if ((op|0) != (VM_FETCH|0)) pc = pcorigin + (ppc-ppcorigin)|0;
    csr[(csrp + CSR_MBADADDR)>>2] = addr;
    switch (op|0) {
        case 0: //VM_READ
            Trap(CAUSE_LOAD_ACCESS_FAULT, pc - 4|0);
            break;

        case 1: //VM_WRITE
            Trap(CAUSE_STORE_ACCESS_FAULT, pc - 4|0);
            break;

        case 2: //VM_FETCH
            Trap(CAUSE_INSTRUCTION_ACCESS_FAULT, pc);
            break;
    }
}


function CheckVMPrivilege(type, op) {

    //Checks if the Privilages of a Page Table Entry are being violated
    type = type|0;
    op = op|0;
    var priv = 0;
    priv = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

    switch (type|0) {

        case 2:
            if ((op|0) == (VM_READ|0)) return 1;
            if (((priv|0) == (PRV_U|0)) & ((op|0) == (VM_FETCH|0))) return 1;
            return 0;
            break;

        case 3:
            if (!( ((priv|0) == (PRV_S|0)) & ((op|0) == (VM_FETCH|0)) ) ) return 1;
            break;

        case 4:
            if ((op|0) == (VM_READ|0)) return 1;
            return 0;
            break;

        case 5:
            if ((op|0) != (VM_FETCH|0)) return 1;
            break;

        case 6:
            if ((op|0) != (VM_WRITE|0)) return 1;
            break;

        case 7:
            return 1;
            break;

       case 11:
            if ((priv|0) == (PRV_S|0)) return 1;
            break;

        case 13:
            if (((priv|0) == (PRV_S|0)) & ((op|0) != (VM_FETCH|0))) return 1;
            break;

        case 14:
            if (((priv|0) == (PRV_S|0)) & ((op|0) != (VM_WRITE|0))) return 1;
            break;

        case 15:
            if ((priv|0) == (PRV_S|0)) return 1;
            break;

    }

    DebugMessage(ERROR_INCOMPLETE_VMPRIVILEGE|0);
    abort();
    return 0;
}


function TranslateVM(addr, op) {

    //Converts Virtual Address to Physical Address
    addr = addr|0;
    op = op|0;
    var vm = 0;
    var current_privilege_level = 0;
    var i = 1; //i = LEVELS -1 and LEVELS = 2 in a 32 bit System

    var offset = 0;
    var page_num = 0;
    var frame_num = 0;
    var type = 0;
    var valid = 0;

    //For Level 2
    var new_sptbr = 0;
    var new_page_num = 0;
    var new_frame_num = 0;
    var new_type = 0;
    var new_valid = 0;
    var ram_index = 0;


    vm = (csr[(csrp + CSR_MSTATUS)>>2] >> 17) & 0x1F;
    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

    // vm bare mode
    if (((vm|0) == 0) | ((current_privilege_level|0) == (PRV_M|0))) return addr|0;

    // hack, open mmio by direct mapping
    //if ((addr>>>28) == 0x9) return addr;

    // only RV32 supported
    if ((vm|0) != 8) {
        DebugMessage(ERROR_VMMODE|0);
        abort();
    }

    // LEVEL 1
    offset = addr & 0xFFF;
    page_num = (addr >>> 22)|0;

    ram_index = (csr[(csrp + CSR_SPTBR)>>2]|0) + (page_num << 2)|0
    frame_num = ram[(ramp + ram_index) >> 2]|0;
    type = ((frame_num >> 1) & 0xF);
    valid = (frame_num & 0x01);

    if ((valid|0) == 0) {
        //DebugMessage("Unsupported valid field " + valid + " or invalid entry in PTE at PC "+utils.ToHex(pc) + " pl:" + current_privilege_level + " addr:" + utils.ToHex(addr) + " op:"+op);
        //abort();
        MemTrap(addr, op);
        return -1;
    }
    if ((type|0) >= 2) {

        if (!(CheckVMPrivilege(type,op)|0)) {
            DebugMessage(ERROR_VMPRIVILEGE|0);
            abort();
        }
/*
        var updated_frame_num = frame_num;
        if (op == VM_READ)
            updated_frame_num = (frame_num | 0x20);
        else if (op == VM_WRITE)
            updated_frame_num = (frame_num | 0x60);
        Write32(csr[CSR_SPTBR] + (page_num << 2),updated_frame_num);
*/
        return (((frame_num >> 10) | ((addr >> 12) & 0x3FF)) << 12) | offset;
    }

    // LEVEL 2
    // DebugMessage("Second level MMU");

    offset = addr & 0xFFF;
    new_sptbr = (frame_num & 0xFFFFFC00) << 2;
    new_page_num = (addr >> 12) & 0x3FF;
    ram_index = (new_sptbr|0) + (new_page_num << 2)|0;
    new_frame_num = ram[(ramp + ram_index) >> 2]|0;
    new_type = ((new_frame_num >> 1) & 0xF);
    new_valid = (new_frame_num & 0x01);
    i = (i - 1)|0;

    if ((new_valid|0) == 0) {
        MemTrap(addr, op);
        return -1;
    }

    if (!(CheckVMPrivilege(new_type, op)|0)) {
        //DebugMessage("Error in TranslateVM: Unhandled trap");
        //abort();
        MemTrap(addr, op);
        return -1;
    }

/*
    var updated_frame_num = new_frame_num;
    if (op == VM_READ)
        updated_frame_num = (new_frame_num | 0x20);
    else if (op == VM_WRITE)
        updated_frame_num = (new_frame_num | 0x60);
    Write32(new_sptbr + (new_page_num << 2),updated_frame_num);
*/

    return ((new_frame_num >> 10) << 12) | offset | 0;
};


function SetCSR(addr,value) {

    // Handles write to CSR Registers appropriately
    addr = addr|0;
    value = value|0;
    var mask = 0;
    var ram_index = 0;
    addr = addr << 2;
    switch (addr|0) {
        case 0xC: // CSR_FCSR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1E40: // CSR_MDEVCMDTOHOST
            csr[(csrp + addr)>>2] = value;
            WriteDEVCMDToHost(value|0);
            break;

        case 0x1E44: // CSR_MDEVCMDFROMHOST
            csr[(csrp + addr)>>2] = value;
            WriteDEVCMDFromHost(value|0);
            break;

        case 0x1E00: // CSR_MTOHOST
            csr[(csrp + addr)>>2] =  value;
            WriteToHost(value|0);
            break;

        case 0xD14: // CSR_MTOHOST_TEMP only temporary for the patched pk.
            ram_index = 0x90000000 >> 0;
            ram8[(ramp + ram_index) >> 0] = value|0;
            if ((value|0) == 0xA) ram8[(ramp + ram_index) >> 0] = 0xD;
            break;

        case 0x1E04: // CSR_MFROMHOST
            csr[(csrp + addr)>>2] = value;
            WriteFromHost(value|0);
            break;

        case 0xC00: // CSR_MSTATUS
            csr[(csrp + addr)>>2] = value;
            InvalidateTLB();
            break;

        case 0x3C00: // CSR_MCPUID
            //csr[addr] = value;
            break;

        case 0x3C04: // CSR_MIMPID
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3C40: // CSR_MHARTID
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xC04: // CSR_MTVEC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD10: // CSR_MIP
            //csr[addr] = value;
            mask = 0x2 | 0x08; //mask = MIP_SSIP | MIP_MSIP
            csr[(csrp + addr)>>2] = (csr[(csrp + addr)>>2] & ~mask) | (value & mask);
            break;

        case 0xC10: // CSR_MIE
            //csr[addr] = value;
            mask = 0x2 | 0x08 | 0x20; //mask = MIP_SSIP | MIP_MSIP | MIP_STIP
            csr[(csrp + addr)>>2] = (csr[(csrp + addr)>>2] & ~mask) | (value & mask);
            break;

        case 0x504: // CSR_SEPC
        case 0xD04: // CSR_MEPC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD08: // CSR_MCAUSE
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3508: // CSR_SCAUSE
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD0C: // CSR_MBADADDR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x350C: // CSR_SBADADDR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x400: // CSR_SSTATUS
            csr[(csrp + CSR_SSTATUS)>>2] = value;
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] & (~0x1F039);
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x01); //IE0
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x08); //IE1
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x10); //PRV1
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0xF000); //FS,XS
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x10000); //MPRV
            break;

        case 0x404: // CSR_STVEC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x510: // CSR_SIP
            //csr[addr] = value;
            mask = 0x2; //mask = MIP_SSIP
            csr[(csrp + CSR_MIP)>>2] = (csr[(csrp + CSR_MIP)>>2] & ~mask) | (value & mask);
            break;

        case 0x410: // CSR_SIE
            //csr[addr] = value;
            mask = 0x2 | 0x20; //mask = MIP_SSIP | MIP_STIP
            csr[(csrp + CSR_MIE)>>2] = (csr[(csrp + CSR_MIE)>>2] & ~mask) | (value & mask);
            break;

        case 0xD00: // CSR_MSCRATCH
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x500: // CSR_SSCRATCH
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x2400: // CSR_CYCLEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3000: // CSR_CYCLES
            ticks = value;
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1C04: // CSR_MTIME
        case 0x3404: // CSR_STIME
        case 0x2804: // CSR_STIMEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1D04: // CSR_MTIMEH
        case 0x3604: // CSR_STIMEH
        case 0x2A04: // CSR_STIMEHW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3004: // CSR_TIME
        case 0x2404: // CSR_TIMEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xC84: // CSR_MTIMECMP
        case 0x484: // CSR_STIMECMP
            csr[(csrp + CSR_MIP)>>2] = csr[(csrp + CSR_MIP)>>2] & (~(0x20)); //csr[CSR_MIP] &= ~MIP_STIP
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD84: // CSR_MTIMECMPH
        case 0x600: // CSR_SPTBR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x04: // CSR_FRM
        case 0x08: // CSR_FFLAGS
            csr[(csrp + addr)>>2] = value;
            break;

        default:
            csr[(csrp + addr)>>2] = value;
            DebugMessage(ERROR_SETCSR|0);
            abort();
            break;
    }
};

function GetCSR(addr) {

    // Handles Read operation on CSR Registers appropriately
    addr = addr|0;
    var current_privilege_level = 0;
    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    addr = (addr << 2)|0;
    switch (addr|0) {
        case 0xC: // CSR_FCSR
            return 0x0;
            break;

        case 0x1E40: // CSR_MDEVCMDTOHOST
            return ReadDEVCMDToHost()|0;
            break;

        case 0x1E44: // CSR_MDEVCMDFROMHOST
            return ReadDEVCMDFromHost()|0;
            break;

        case 0x1E00: // CSR_MTOHOST
            return ReadToHost()|0;
            break;

        case 0xD14: // CSR_MTOHOST_TEMP only temporary for the patched pk.
            return 0x0;
            break;

        case 0x1E04: // CSR_MFROMHOST
            return ReadFromHost()|0;
            break;

        case 0xC00: // CSR_MSTATUS
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C00: // CSR_MCPUID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C04: // CSR_MIMPID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C40: // CSR_MHARTID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xC04: // CSR_MTVEC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xC10: // CSR_MIE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x504: // CSR_SEPC
        case 0xD04: // CSR_MEPC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD08: // CSR_MCAUSE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3508: // CSR_SCAUSE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD0C: // CSR_MBADADDR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x350C: // CSR_SBADADDR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x400: // CSR_SSTATUS
            //if (current_privilege_level == 0) Trap(CAUSE_ILLEGAL_INSTRUCTION);
            csr[(csrp + CSR_SSTATUS)>>2] = 0x00;
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x01); //IE0
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x08); //IE1
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x10); //PRV1
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0xF000); //FS,XS
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x10000); //MPRV
            return csr[(csrp + CSR_SSTATUS)>>2]|0;
            break;

        case 0x404: // CSR_STVEC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD10: // CSR_MIP
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x510: // CSR_SIP
            return (csr[(csrp + CSR_MIP)>>2] & (0x2 | 0x20))|0;//(MIP_SSIP | MIP_STIP)
            break;

        case 0x410: // CSR_SIE
            return (csr[(csrp + CSR_MIE)>>2] & (0x2 | 0x20))|0;//(MIP_SSIP | MIP_STIP)
            break;

        case 0xD00: // CSR_MSCRATCH
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x500: // CSR_SSCRATCH
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x2400: // CSR_CYCLEW
            return ticks|0;
            break;

        case 0x3000: // CSR_CYCLES
            return ticks|0;
            break;

        case 0x1C04: // CSR_MTIME
        case 0x3404: // CSR_STIME
        case 0x2804: // CSR_STIMEW
            return ticks|0;
            break;

        case 0x1D04: // CSR_MTIMEH
        case 0x3604: // CSR_STIMEH
        case 0x2A04: // CSR_STIMEHW
            return ((ticks) >> 32)|0;
            break;

        case 0x3004: // CSR_TIME
        case 0x2404: // CSR_TIMEW
            return ticks|0;
            break;

        case 0xC84: // CSR_MTIMECMP
        case 0x484: // CSR_STIMECMP
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD84: // CSR_MTIMECMPH
        case 0x600: // CSR_SPTBR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x04: // CSR_FRM
        case 0x08: // CSR_FFLAGS
            return csr[(csrp + addr)>>2]|0;
            break;

        default:
            DebugMessage(ERROR_GETCSR|0);
            abort();
            return csr[(csrp + addr)>>2]|0;
            break;
    }

    return 0;

};

function UMul64(a, b, index) {

    // Special Method for 64 Bit Multiplication for Unsigned*Unsigned
    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0, result1 = 0;

    var a00 = 0, a16 = 0;
    var b00 = 0, b16 = 0;

    var c00 = 0;
    var c16 = 0;
    var c32 = 0;
    var c48 = 0;

    if ((a >>> 0) < 32767)
    if ((b >>> 0) < 65536) {
        result0 = imul((a|0),(b|0))|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if ((index|0) == 0) return result0|0;
        return result1|0;
    }

    a00 = a & 0xFFFF;
    a16 = a >>> 16;
    b00 = b & 0xFFFF;
    b16 = b >>> 16;

    c00 = imul((a00|0), (b00|0))|0;
    c16 = (c00 >>> 16) + (imul((a16|0),(b00|0))|0)|0;
    c32 = c16 >>> 16;
    c16 = (c16 & 0xFFFF) + (imul((a00|0),(b16|0))|0)|0;
    c32 = (c32 + (c16 >>> 16))|0;
    c48 = c32 >>> 16;
    c32 = (c32 & 0xFFFF) + (imul((a16|0),(b16|0))|0)|0;
    c48 = (c48 + (c32 >>> 16))|0;

    result0 = ((c16 & 0xFFFF) << 16) | (c00 & 0xFFFF);
    result1 = ((c48 & 0xFFFF) << 16) | (c32 & 0xFFFF);
    if ((index|0) == 0) return result0|0;
    return result1|0;
};

function IMul64(a,b,index) {

    // Special Method for 64 Bit Multiplication for Signed*Signed
    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0, result1 = 0;
    var doNegate = 0;

    if ((a|0) == 0) return 0;
    if ((b|0) == 0) return 0;

    if ((a|0) >= -32768) 
    if ((a|0) <=  32767)  
    if ((b|0) >= -32768)  
    if ((b|0) <=  32767) {
        result0 = imul((a|0),(b|0))|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if ((index|0) == 0) return result0|0;
        return result1|0;
    }

    doNegate = ((a|0) < 0) ^ ((b|0) < 0);

    a = MathAbs(a|0)|0;
    b = MathAbs(b|0)|0;
    result0 = UMul64(a, b, 0)|0;
    result1 = UMul64(a, b, 1)|0;

    if (doNegate) {
        result0 = ~result0;
        result1 = ~result1;
        result0 = (result0 + 1) | 0;
        if ((result0|0) == 0) result1 = (result1 + 1) | 0;
    }

    if ((index|0) == 0) return result0|0;
    return result1|0;
};

function SUMul64(a,b,index) {

    // Special Method for 64 Bit Multiplication for Signed*Unsigned
    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0, result1 = 0;
    var doNegate = 0;

    if ((a|0) == 0) return 0;
    if ((b|0) == 0) return 0;

    if ((a|0) >= -32768)
    if ((a|0) <= 32767) 
    if ((b>>>0) < 65536)  {
        result0 = imul((a|0),(b|0))|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if ((index|0) == 0) return result0|0;
        return result1|0;
    }

    doNegate = ((a|0) < 0);

    a = MathAbs(a|0)|0;
    result0 = UMul64(a, b, 0)|0;
    result1 = UMul64(a, b, 1)|0;

    if (doNegate) {
        result0 = ~result0;
        result1 = ~result1;
        result0 = (result0 + 1) | 0;
        if ((result0|0) == 0) result1 = (result1 + 1) | 0;
    }

    if ((index|0) == 0) return result0|0;
    return result1|0;
};

function InvalidateTLB(){

    // The highest address migh be used by the sbi
    instlb_index     = 0xFFFF0000;
    instlb_entry     = -1;
    read8tlb_index   = 0xFFFF0000;
    read8tlb_entry   = -1;
    read8utlb_index  = 0xFFFF0000;
    read8utlb_entry  = -1;
    read16tlb_index  = 0xFFFF0000;
    read16tlb_entry  = -1;
    read16utlb_index = 0xFFFF0000;
    read16utlb_entry = -1;
    read32tlb_index  = 0xFFFF0000;
    read32tlb_entry  = -1;
    store8tlb_index  = 0xFFFF0000;
    store8tlb_entry  = -1;
    store16tlb_index = 0xFFFF0000;
    store16tlb_entry = -1;
    store32tlb_index = 0xFFFF0000;
    store32tlb_entry = -1;

    float_read32tlb_index  = 0xFFFF0000;
    float_read32tlb_entry  = -1;
    float_read64tlb_index  = 0xFFFF0000;
    float_read64tlb_entry  = -1;
    float_store32tlb_index = 0xFFFF0000;
    float_store32tlb_entry = -1;
    float_store64tlb_index = 0xFFFF0000;
    float_store64tlb_entry = -1;

}

function PushPrivilegeStack(){

    // 0 to 11 bits of mstatus register is considered as the stack.
    // Pushing implies just right shifting the 0 to 11 bits by 3 and then setting PRV[1:0] to Machine
    // Also set MPRV bit in mstatus register to zero
    var mstatus = 0,privilege_level_stack = 0, new_privilege_level_stack = 0;
    mstatus = csr[(csrp + CSR_MSTATUS)>>2]|0;
    privilege_level_stack =  (mstatus & 0xFFF);
    new_privilege_level_stack = (((privilege_level_stack << 2) | PRV_M) << 1) & 0xFFF;
    csr[(csrp + CSR_MSTATUS)>>2] = (((mstatus >> 12) << 12) + new_privilege_level_stack) & 0xFFFEFFFF; //Last "and" to set mprv(bit 16) to zero
};

function PopPrivilegeStack(){

    // 0 to 11 bits of mstatus register is considered as the stack.
    // Pop implies just left shifting the 0 to 11 bits by 3 and then setting PRV3[1:0] to lowest supported privilege mode(User in this case) with IE3 = 1
    // Also set MPRV bit in mstatus register to zero
    var mstatus = 0,privilege_level_stack = 0, new_privilege_level_stack = 0;
    mstatus = csr[(csrp + CSR_MSTATUS)>>2]|0;
    privilege_level_stack =  (mstatus & 0xFFF);
    new_privilege_level_stack = ((privilege_level_stack >>> 3) | ((PRV_U << 1) | 0x1) << 9);
    csr[(csrp + CSR_MSTATUS)>>2] = ((mstatus >> 12) << 12) + new_privilege_level_stack;
    InvalidateTLB();
};

function Step(steps, clockspeed) {

    steps = steps|0;
    clockspeed = clockspeed|0;

    var imm = 0x00;
    var zimm = 0x00;
    var mult = 0x00;
    var quo = 0x00;
    var rem = 0x00;
    var result = 0x00;
    var rs1 = 0x0;
    var rs2 = 0x0;
    var fs1 = 0.0;
    var fs2 = 0.0;
    var fs3 = 0.0;

    var delta = 0;
    var vaddr = 0;
    var paddr = 0;
    var current_privilege_level = 0;
    var interrupts = 0;
    var ie = 0;
    var ins = 0;
    var dsteps = 64;

    for(;;) {

    if ((fence|0) != (ppc|0)) {

        ins = ram[ppc >> 2]|0;
        ppc = ppc + 4|0;

        switch (ins&0x7F) {

            case 0x03:
                // lb, lh, lw, lbu, lhu
                vaddr = (r[((ins >> 13) & 0x7C) >> 2]|0) + (ins >> 20)|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // lb
                        if ((read8tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read8tlb_index = vaddr|0;
                            read8tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read8tlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = ((ram8[(ramp + paddr) >> 0]) << 24) >> 24;
                        continue;

                    case 0x01:
                        // lh
                        if ((read16tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read16tlb_index = vaddr|0;
                            read16tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read16tlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = ((ram16[(ramp + paddr) >> 1]) << 16) >> 16;
                        continue;

                    case 0x02:
                        // lw
                        if (vaddr & 3) {
                             DebugMessage(ERROR_LOAD_WORD|0);
                             abort();
                        }
                        if ((read32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read32tlb_index = vaddr|0;
                            read32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read32tlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        continue;

                    case 0x04:
                        // lbu
                        if ((read8utlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read8utlb_index = vaddr|0;
                            read8utlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read8utlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = (ram8[(ramp + paddr) >> 0]) & 0xFF;
                        continue;

                    case 0x05:
                        // lhu
                        if ((read16utlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read16utlb_index = vaddr|0;
                            read16utlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read16utlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = (ram16[(ramp + paddr) >> 1]) & 0xFFFF;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x23:
                // sb, sh, sw
                vaddr = 
                    (r[((ins >> 13) & 0x7C) >> 2]|0) + 
                    (
                     ((ins >> 25) << 5) | 
                     ((ins >> 7) & 0x1F)
                    )|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // sb
                        if ((store8tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_WRITE)|0;
                            if ((paddr|0) == -1) continue;
                            store8tlb_index = vaddr|0;
                            store8tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = store8tlb_entry ^ vaddr;
                        ram8[(ramp + paddr) >> 0] = (r[((ins >> 18) & 0x7C) >> 2] & 0xFF);
                        continue;

                    case 0x01:
                        // sh
                        if ((store16tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_WRITE)|0;
                            if ((paddr|0) == -1) continue;
                            store16tlb_index = vaddr|0;
                            store16tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = store16tlb_entry ^ vaddr;
                        ram16[(ramp + paddr) >> 1] = (r[((ins >> 18) & 0x7C) >> 2] & 0xFFFF);
                        continue;

                    case 0x02:
                        // sw
                        if (vaddr & 3) {
                             DebugMessage(ERROR_STORE_WORD|0);
                             abort();
                        }
                        if ((store32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_WRITE)|0;
                            if ((paddr|0) == -1) continue;
                            store32tlb_index = vaddr|0;
                            store32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = store32tlb_entry ^ vaddr;
                        ram[(ramp + paddr) >> 2] = r[((ins >> 18) & 0x7C) >> 2]|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x13:
                // addi, slti, sltiu, xori, ori, andi, slli, srli, srai
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // addi
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 + (ins >> 20)|0;
                        continue;

                    case 0x02:
                        // slti
                        if ((rs1|0) < (ins >> 20))
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                        else
                            r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        continue;

                    case 0x03:
                        // sltiu
                        if ((rs1 >>> 0) < ((ins >> 20) >>> 0))
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                        else
                            r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        continue;

                    case 0x04:
                        // xori
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 ^ (ins >> 20);
                        continue;

                    case 0x06:
                        // ori
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 | (ins >> 20);
                        continue;

                    case 0x07:
                        // andi
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 & (ins >> 20);
                        continue;

                    case 0x01:
                        // slli
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 << ((ins >> 20) & 0x1F);
                        continue;

                    case 0x05:
                        if (((ins >> 25) & 0x7F) == 0x00) {
                            // srli
                            r[((ins >> 5) & 0x7C) >> 2] = rs1 >>> ((ins >> 20) & 0x1F);
                        }
                        else if (((ins >> 25) & 0x7F) == 0x20) {
                            // srai
                            r[((ins >> 5) & 0x7C) >> 2] = rs1 >> ((ins >> 20) & 0x1F);
                        }
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x33:
                // add, sub, sll, slt, sltu, xor, srl, sra, or, and
                switch ((ins >> 25)&0x7F) {

                    case 0x00:
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch ((ins >> 12)&0x7) {
                            case 0x00:
                                // add
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 + rs2;
                                continue;

                            case 0x02:
                                // slt
                                if ((rs1|0) < (rs2|0))
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                                continue;

                            case 0x03:
                                // sltu
                                if ((rs1 >>> 0) < (rs2 >>> 0))
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                                continue;

                            case 0x07:
                                // and
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 & rs2;
                                continue;

                            case 0x06:
                                // or
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 | rs2;
                                continue;

                            case 0x04:
                                // xor
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 ^ rs2;
                                continue;

                            case 0x01:
                                // sll
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 << (rs2 & 0x1F);
                                continue;

                            case 0x05:
                                // srl
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 >>> (rs2 & 0x1F);
                                continue;
                        }
                        continue;

                    case 0x20:
                        // sub, sra
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch ((ins >> 12)&0x7) {
                            case 0x00:
                                // sub
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 - rs2;
                                continue;

                            case 0x05:
                                // sra
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 >> (rs2 & 0x1F);
                                continue;
                        }
                        continue;

                    case 0x01:
                        // mul, mulh, mulhsu, mulhu, div, divu, rem, remu
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch ((ins >> 12)&0x7) {
                            case 0x00:
                                // mul
                                result = imul(rs1|0, rs2|0)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x01:
                                // mulh
                                result = IMul64(rs1, rs2, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x02:
                                // mulhsu
                                result = SUMul64(rs1, rs2>>>0, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x03:
                                // mulhu
                                result = UMul64(rs1>>>0, rs2>>>0, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x04:
                                // div
                                if ((rs2|0) == 0)
                                    quo = -1;
                                else
                                    quo = ((rs1|0) / (rs2|0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = quo;
                                continue;

                            case 0x05:
                                //divu
                                if ((rs2|0) == 0)
                                    quo = 0xFFFFFFFF;
                                else
                                    quo = ((rs1 >>> 0) / (rs2 >>> 0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = quo;
                                continue;

                            case 0x06:
                                // rem
                                if ((rs2|0) == 0)
                                    rem = rs1;
                                else
                                    rem = ((rs1|0) % (rs2|0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = rem;
                                continue;

                            case 0x07:
                                // remu
                                if ((rs2|0) == 0)
                                    rem = (rs1 >>> 0);
                                else
                                    rem = ((rs1 >>> 0) % (rs2 >>> 0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = rem;
                                continue;
                        }
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x37:
                // lui
                r[((ins >> 5) & 0x7C) >> 2] = ins & 0xFFFFF000;
                continue;

            case 0x17:
                // auipc
                pc = pcorigin + (ppc-ppcorigin)|0;
                r[((ins >> 5) & 0x7C) >> 2] = (pc + (ins & 0xFFFFF000) - 4)|0;
                continue;

            case 0x6F:
                // jal
                pc = pcorigin + (ppc-ppcorigin)|0;
                r[((ins >> 5) & 0x7C) >> 2] = pc;
                imm =  (
                    ((ins >> 21) & 0x3FF) | 
                    (((ins >> 20) & 0x1) << 10) | 
                    (((ins >> 12) & 0xFF) << 11) | 
                    ((ins >> 31) << 19) ) << 1;
                pc = pc + imm - 4|0;
                fence = ppc;
                pc_change = 1;
                r[0] = 0;
                continue;

            case 0x67:
                // jalr
                pc = pcorigin + (ppc-ppcorigin)|0;
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                r[((ins >> 5) & 0x7C) >> 2] = pc;
                pc = ((rs1 + (ins >> 20)) & 0xFFFFFFFE)|0;
                fence = ppc;
                pc_change = 1;
                r[0] = 0;
                continue;

            case 0x63:
                // beq, bne, blt, bge, bltu, bgeu
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // beq
                        if ((rs1|0) != (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x01:
                        // bne
                        if ((rs1|0) == (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x04:
                        // blt
                        if ((rs1|0) >= (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x05:
                        // bge
                        if ((rs1|0) < (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x06:
                        // bltu
                        if ((rs1 >>> 0) >= (rs2 >>> 0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x07:
                        // bgeu
                        if ((rs1 >>> 0) < (rs2 >>> 0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x73:
                // csrrw, csrrs, csrrc, csrrwi, csrrsi, csrrci, ecall, eret, ebreak, mrts, wfi
                imm = (ins >>> 20);
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                switch ((ins >> 12)&0x7) {

                    case 0x01:
                        // csrrw
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        SetCSR(imm, rs1);
                        r[0] = 0;
                        continue;

                    case 0x02:
                        // csrrs
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        SetCSR(imm, (GetCSR(imm)|0) | rs1);
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // csrrc
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        SetCSR(imm, (GetCSR(imm)|0) & (~rs1));
                        r[0] = 0;
                        continue;

                    case 0x05:
                        // csrrwi
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if ((zimm|0) != 0) SetCSR(imm, (zimm >> 0));
                        r[0] = 0;
                        continue;

                    case 0x06:
                        // csrrsi
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if ((zimm|0) != 0) SetCSR(imm, (GetCSR(imm)|0) | (zimm >> 0));
                        r[0] = 0;
                        continue;

                    case 0x07:
                        // csrrci
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if ((zimm|0) != 0) SetCSR(imm, (GetCSR(imm)|0) & ~(zimm >> 0));
                        r[0] = 0;
                        continue;

                    case 0x00:
                        // ecall, eret, ebreak, mrts, wfi
                        current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
                        fence = ppc;
                        switch ((ins >> 20)&0xFFF) {
                            case 0x00:
                                // ecall
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                switch (current_privilege_level|0) {
                                    case 0x00: // PRV_U
                                        Trap(CAUSE_ENVCALL_UMODE, pc - 4|0);
                                        break;

                                    case 0x01: // PRV_S
                                        Trap(CAUSE_ENVCALL_SMODE, pc - 4|0);
                                        break;

                                    case 0x02: // PRV_H
                                        Trap(CAUSE_ENVCALL_HMODE, pc - 4|0);
                                        abort();
                                        break;

                                    case 0x03: // PRV_M
                                        Trap(CAUSE_ENVCALL_MMODE, pc - 4|0);
                                        break;

                                    default:
                                        DebugMessage(ERROR_ECALL|0);
                                        abort();
                                        break;
                                }
                                continue;

                            case 0x001:
                                // ebreak
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                Trap(CAUSE_BREAKPOINT, pc - 4|0);
                                continue;

                            case 0x100:
                                // eret
                                current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                if ((current_privilege_level|0) < (PRV_S|0)) {
                                    DebugMessage(ERROR_ERET_PRIV|0);
                                    abort();
                                    break;
                                }
                                PopPrivilegeStack();

                                switch (current_privilege_level|0) {

                                    case 0x01: //PRV_S
                                        //DebugMessage("eret PRV_S -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_SEPC)>>2]|0;
                                        break;

                                    case 0x02: //PRV_H
                                        //DebugMessage("Not supported eret PRV_H -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_HEPC)>>2]|0;
                                        abort();
                                        break;

                                    case 0x03: //PRV_M
                                        //DebugMessage("eret PRV_M -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_MEPC)>>2]|0;
                                        break;

                                    default:
                                        DebugMessage(ERROR_ERET|0);
                                        abort();
                                        break;
                                }
                                pc_change = 1;
                                InvalidateTLB();
                                continue;

                            case 0x102:
                                // wfi
                                interrupts = csr[(csrp + CSR_MIE)>>2] & csr[(csrp + CSR_MIP)>>2];
/*
                                if (!interrupts)
                                if ((queue_status|0) == 0)
                                    return steps|0;
                                break;
*/
                                continue;

                            case 0x305:
                                // mrts
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                if ((current_privilege_level|0) != (PRV_M|0)) {
                                    DebugMessage(ERROR_MRTS|0);
                                    abort();
                                    break;
                                }
                                csr[(csrp + CSR_MSTATUS)>>2] = (csr[(csrp + CSR_MSTATUS)>>2] & ~0x6) | 0x02; //Setting the Privilage level to Supervisor
                                csr[(csrp + CSR_SBADADDR)>>2] = csr[(csrp + CSR_MBADADDR)>>2];
                                csr[(csrp + CSR_SCAUSE)>>2] = csr[(csrp + CSR_MCAUSE)>>2];
                                csr[(csrp + CSR_SEPC)>>2] = csr[(csrp + CSR_MEPC)>>2];
                                pc = csr[(csrp + CSR_STVEC)>>2]|0;
                                InvalidateTLB();
                                pc_change = 1;
                                continue;

                            case 0x101:
                                // sfence.vm
                                InvalidateTLB();
                                continue;

                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                abort();
                                break;

                        }
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x07:
                // flw, fld
                vaddr = (r[((ins >> 13) & 0x7C) >> 2]|0) + (ins >> 20)|0;
                switch ((ins >> 12)&0x7) {

                    case 0x02:
                        // flw
                        if ((float_read32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) break;
                            float_read32tlb_index = vaddr|0;
                            float_read32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_read32tlb_entry ^ vaddr;
                        r[0] = ram[(ramp + paddr) >> 2]|0;
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +ff[0];
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // fld
                        if ((float_read64tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            float_read64tlb_index = vaddr|0;
                            float_read64tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_read64tlb_entry ^ vaddr;
                        fi[(fip + (((ins >> 7) & 0x1F) << 3) + 0) >> 2] = ram[(ramp + paddr + 0) >> 2]|0;
                        fi[(fip + (((ins >> 7) & 0x1F) << 3) + 4) >> 2] = ram[(ramp + paddr + 4) >> 2]|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;

                }
                continue;

            case 0x27:
                // fsw, fsd
                vaddr = (r[((ins >> 13) & 0x7C) >> 2]|0) + ((((ins >> 25) << 5) | ((ins >> 7) & 0x1F)))|0;
                switch ((ins >> 12)&0x7) {

                    case 0x02:
                        // fsw
                        ff[0] = +f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3];
                        if ((float_store32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            float_store32tlb_index = vaddr|0;
                            float_store32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_store32tlb_entry ^ vaddr;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // fsd
                        if ((float_store64tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            float_store64tlb_index = vaddr|0;
                            float_store64tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_store64tlb_entry ^ vaddr;
                        ram[(ramp + paddr + 0) >> 2] = fi[(fip + (((ins >> 20) & 0x1F) << 3) + 0) >> 2]|0;
                        ram[(ramp + paddr + 4) >> 2] = fi[(fip + (((ins >> 20) & 0x1F) << 3) + 4) >> 2]|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;

                }
                continue;

            case 0x53:
                // fadd.s, fsub.s
                switch ((ins >> 25)&0x7F) {

                    case 0x00:  //fadd.s
                    case 0x01:  //fadd.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = (+fs1) + (+fs2);
                        continue;

                    case 0x04: //fsub.s
                    case 0x05: //fsub.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = (+fs1) - (+fs2);
                        continue;

                    case 0x50:
                    case 0x51:
                        //fcmp.s, fcmp.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        switch ((ins >> 12) & 0x7) {
                            case 0x0:
                                // fle
                                if ((+fs1) <= (+fs2))
                                    r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            case 0x1:
                                // flt
                                if ((+fs1) < (+fs2))
                                    r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            case 0x2:
                                // feq
                                if ((+fs1) == (+fs2))
                                    r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                DebugMessage(ins|0);
                                abort();
                                break;
                        }
                        continue;

                    case 0x20: // fcvt.s.d
                    case 0x21: // fcvt.d.s
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = 
                            (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        continue;

                    case 0x60:
                        // fcvt.w.s
                        r[((ins >> 5) & 0x7C) >> 2] = ~~floor(+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        continue;

                    case 0x68:
                    case 0x69:
                        // fcvt.s.w, fcvt.d.w
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +(r[((ins >> 13) & 0x7C) >> 2]|0);
                        continue;

                    case 0x08: //fmul.s
                    case 0x09: //fmul.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +(+fs1)*(+fs2);
                        continue;

                    case 0x10: // single precision
                    case 0x11: // double precision
                        // fsgnj
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        switch ((ins >> 12) & 7) {
                            case 0:
                                // fsgnj.d, also used for fmv.d
                                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = ((+fs2)<(+0))?-(+MathAbs(+fs1)):(+MathAbs(+fs1));
                                continue;

                            case 1:
                                // fsgnjn.d
                                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = ((+fs2)<(+0))?+MathAbs(+fs1):-(+MathAbs(+fs1));
                                continue;

                            case 2:
                                // fsgnjx.d

                                if (((+fs1)*(+fs2)) < (+0)) {
                                    f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = -(+MathAbs(+fs1));
                                } else {
                                    f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +(+MathAbs(+fs1));
                                }
                                continue;

                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                DebugMessage(ins|0);
                                abort();
                        }
                        continue;

                    case 0x61:
                        // fcvt.w.d
                        r[((ins >> 5) & 0x7C) >> 2] = (~~+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        continue;

                    case 0x78:
                        // fmv.s.x
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        r[0] = rs1;
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +ff[0];
                        r[0] = 0;
                        continue;


                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;
                }
                continue;

            case 0x43:
                // fmadd.d, fmadd.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = fs1 * fs2 + fs3;
                continue;

            case 0x47:
                // fmsub.d, fmsub.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = fs1 * fs2 - fs3;
                continue;

            case 0x4B:
                // fnmadd.d, fnmadd.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = -(fs1 * fs2 + fs3);
                continue;

            case 0x4F:
                // fnmsub.d, fnmsub.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = -(fs1 * fs2 - fs3);
                continue;

            case 0x2F:
                // amoswap, amoadd, amoxor, amoand, amoor, amomin, amomax, amominu, amomaxu
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                paddr = TranslateVM(rs1|0, VM_READ)|0;
                if ((paddr|0) == -1) continue;
                switch ((ins >> 27)&0x1F) {

                    case 0x01:
                        // amoswap
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        ram[(ramp + paddr) >> 2] = rs2|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        r[0] = 0;
                        continue;

                    case 0x00:
                        // amoadd
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) + (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x04:
                        // amoxor
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) ^ (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x0C:
                        // amoand
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) & (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x08:
                        // amoor
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) | (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x10:
                        // amomin
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >> 0) > (r[((ins >> 5) & 0x7C) >> 2] >> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                   case 0x14:
                        // amomax
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >> 0) < (r[((ins >> 5) & 0x7C) >> 2] >> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x18:
                        // amominu
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >>> 0) > (r[((ins >> 5) & 0x7C) >> 2] >>> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x1C:
                        // amomaxu
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >>> 0) < (r[((ins >> 5) & 0x7C) >> 2] >>> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x02:
                        // lr.d
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        amoaddr = rs1;
                        amovalue = r[((ins >> 5) & 0x7C) >> 2]|0;
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // sc.d
                        if ((rs1|0) != (amoaddr|0)) {
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                            continue;
                        }
                        if ((ram[(ramp + paddr) >> 2]|0) != (amovalue|0)) {
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                            continue;
                        }
                        r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        paddr = TranslateVM(rs1, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = rs2|0;
                        r[0] = 0;
                        continue;

                    default:
                        DebugMessage(ERROR_ATOMIC_INSTRUCTION|0);
                        abort();
                        break;

                }
                continue;

            case 0x0F:
                //fence
                continue;

            case 0x0: // this line removes one assembler instruction (sub) from the main loop
            default:
                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                DebugMessage(ins|0);
                abort();
                break;
        } // end of switch

    } else { // fence

        // pc_change is set to one when pc is calculated in instrctions like branch, jump etc
        if (!(pc_change|0)) pc = pcorigin + (ppc-ppcorigin)|0;

        dsteps = dsteps - ((ppc-ppcorigin) >> 2)|0;
        if ((dsteps|0) < 0) {

            dsteps = dsteps + 64|0;
            steps = steps - 64|0;

            // fence == ppc still valid, so this part will be executed automatically next time
            if ((steps|0) < 0) return 0;

            delta = (csr[(csrp + CSR_MTIMECMP)>>2]|0) - ticks | 0;
            delta = delta + ((delta|0)<0?0xFFFFFFFF:0x0) | 0;
            ticks = ticks + clockspeed|0;

            if ((delta|0) < (clockspeed|0)) {
                csr[(csrp + CSR_MIP)>>2] = csr[(csrp + CSR_MIP)>>2] | 0x20;
            }

            // check for interrupts
            current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

            interrupts = csr[(csrp + CSR_MIE)>>2] & csr[(csrp + CSR_MIP)>>2];
            ie = csr[(csrp + CSR_MSTATUS)>>2] & 0x01;

            if (((current_privilege_level|0) < 3) | (((current_privilege_level|0) == 3) & (ie|0))) {
                if (((interrupts|0) & 0x8)) {
                    Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                    continue;
                } else
                if (queue_status|0) {
                    Trap(CAUSE_HOST_INTERRUPT, pc);
                    queue_status = 0;
                    continue;
                }
            }
            if (((current_privilege_level|0) < 1) | (((current_privilege_level|0) == 1) & (ie|0))) {
                if (((interrupts|0) & 0x2)) {
                    Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                    continue;
                } else
                if (((interrupts|0) & 0x20)) {
                     Trap(CAUSE_TIMER_INTERRUPT, pc);
                     continue;
                }
            }
        } // dsteps

        // get new instruction pointer
        if ((instlb_index ^ pc) & 0xFFFFF000) {
            ppc = TranslateVM(pc|0, VM_FETCH)|0;
            if ((ppc|0) == -1) {
                ppc = fence;
                continue;
            }
            instlb_index = pc;
            instlb_entry = (ppc ^ pc) & 0xFFFFF000;
        }

        ppc = ramp + (instlb_entry ^ pc)| 0;
        ppcorigin = ppc;
        pcorigin = pc;
        fence  = ((ppc >> 12) + 1) << 12; // next page
        pc_change = 0;

    } // end of fence
    } // main loop

    return 0;
};

return {
    Reset: Reset,
    Init: Init,
    InvalidateTLB: InvalidateTLB,
    Step: Step,
    TranslateVM: TranslateVM,
    GetCSR: GetCSR,
    SetCSR: SetCSR,
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    GetTicks: GetTicks,
    GetPC: GetPC,
    AnalyzeImage: AnalyzeImage,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt
};

}

module.exports = FastCPU;

},{"../messagehandler":43,"../utils":58,"./disassemble":49}],52:[function(require,module,exports){
// -------------------------------------------------
// -------------------- HTIF -----------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');
var bzip2 = require('../bzip2');
var syscalls = require('./syscalls');

// -------------------------------------------------

function StringToBytes(str, ram, offset) {
    for(var i=0; i<str.length; i++) {
        ram.Write8(offset+i, str.charCodeAt(i));
    }
    ram.Write8(offset+str.length, 0);
}


// -------------------------------------------------


function HTIFFB(ram, SendFunc) {
    this.ram = ram;
    this.identify = "rfb";
    this.Send = SendFunc;
    this.width = 640;
    this.height = 400;
    this.paddr = 0x0;

    this.Read = function(value) {
        this.width  = (value >>  0)&0xFFFF;
        this.height = (value >> 16)&0xFFFF;
        this.n = (this.width * this.height)>>1;
        this.buffer = new Int32Array(this.n);
        this.Send(3, 0, 1);
    }

    this.Write = function(value) {
        this.paddr = value;
        this.Send(3, 1, 1);
    }

    this.OnGetFB = function() {
        if (this.paddr == 0x0) return;
        message.Send("GetFB", this.GetBuffer() );
    }

    this.GetBuffer = function () {
        var i=0, n = this.buffer.length;
        var data = this.buffer;
        var mem = this.ram.int32mem;
        var addr = this.paddr>>2;
        for (i = 0; i < n; ++i) {
            data[i] = mem[addr+i];
        }
        return this.buffer;
    }

    message.Register("GetFB", this.OnGetFB.bind(this) );
};


// -------------------------------------------------

function HTIFConsole(ram, SendFunc) {
    this.ram = ram;
    this.identify = "bcd";
    this.Send = SendFunc;
    this.charqueue = [];
    this.readpresent = false;

    this.Read = function(value) {
        //message.Debug("Read: " + value);
        //this.Send(1, 0, 1);
        this.readpresent = true;
        if (this.charqueue.length == 0) return;
        this.Send(1, 0, this.charqueue.shift());
        this.readpresent = false;
    }

    this.Write = function(value) {
        this.ram.Write8(0x90000000 >> 0, value);
        if (value == 0xA) this.ram.Write8(0x90000000 >> 0, 0xD);
        this.Send(1, 1, 1);
    }

    this.ReceiveChar = function(c) {
        this.charqueue = this.charqueue.concat(c);

        if (!this.readpresent) return;
        this.Send(1, 0, this.charqueue.shift());
        this.readpresent = false;

    }

    message.Register("htif.term0.Transfer", this.ReceiveChar.bind(this) );

};

// -------------------------------------------------

function HTIFSyscall(ram, SendFunc) {
    this.ram = ram;
    this.Send = SendFunc;
    this.syscallHandler = new syscalls(this.ram);
    this.identify = "syscall_proxy";

    this.Read = function(value) {
        if((value>>>0) > 0x100) {
            this.syscallHandler.HandleSysCall(value);
        } else {
            this.ram.Write8(0x90000000 >> 0, value+0x30);
            message.Debug("return value: " + value);
            message.Abort();
       }
       this.Send(0, 0, 1);
    }

};

// -------------------------------------------------

function HTIFDisk(ram, SendFunc) {
    this.ram = ram;
    this.Send = SendFunc;
    this.buffer = new Uint8Array(1024*1024);
    this.identify = "disk size="+this.buffer.length;
    
    utils.LoadBinaryResourceII("../sys/riscv/ext2fsimage.bz2", 
    function(buffer) {
        this.buffer = new Uint8Array(20*1024*1024);

        var length = 0;
        var buffer8 = new Uint8Array(buffer);
	bzip2.simple(buffer8, function(x){this.buffer[length++] = x;}.bind(this));

        this.identify = "disk size="+this.buffer.length;   
    }.bind(this)
    , false, function(error){throw error;});

    this.Read = function(value) {
        var addr   = this.ram.Read32(value + 0);
        var offset = this.ram.Read32(value + 8);
        var size   = this.ram.Read32(value + 16);
        var tag    = this.ram.Read32(value + 24);
        //message.Debug("" + utils.ToHex(addr) + " " + utils.ToHex(offset) + " " + size + " " + tag);
        for(var i=0; i<size; i++) {
            this.ram.Write8(addr+i, this.buffer[offset+i]);
        }
        this.Send(2, 0, tag);
    }


    this.Write = function(value) {
        var addr   = this.ram.Read32(value + 0);
        var offset = this.ram.Read32(value + 8);
        var size   = this.ram.Read32(value + 16);
        var tag    = this.ram.Read32(value + 24);
        //message.Debug("" + utils.ToHex(addr) + " " + utils.ToHex(offset) + " " + size + " " + tag);
        for(var i=0; i<size; i++) {
            this.buffer[offset+i] = this.ram.Read8(addr+i);
        }
        this.Send(2, 1, tag);
    }
};

// -------------------------------------------------


// constructor
function HTIF(ram, irqdev) {
    this.ram = ram;
    this.irqdev = irqdev;
    
    this.device = [];

    this.device.push( new HTIFSyscall(this.ram, this.Send.bind(this)) ); // dev 0
    this.device.push( new HTIFConsole(this.ram, this.Send.bind(this)) ); // dev 1
    this.device.push( new HTIFDisk   (this.ram, this.Send.bind(this)) ); // dev 2
    this.device.push( new HTIFFB     (this.ram, this.Send.bind(this)) ); // dev 3

    this.devid = 0x0;
    this.cmd = 0x0;

    this.reg_tohost = 0x0;
    this.reg_devcmdfromhost = 0x0;

    this.fromhostqueue = [];
}

HTIF.prototype.Send = function(devid, cmd, data) {
    //message.Debug("Send " + devid + " " + cmd + " " + data);
    this.fromhostqueue.push({
        devid: devid, 
        cmd: cmd, 
        data: data});

    if (this.fromhostqueue.length == 1)
        this.reg_devcmdfromhost =
            (this.fromhostqueue[0].devid << 16) | this.fromhostqueue[0].cmd;

    this.irqdev.RaiseInterrupt(0xF);
}

// -------------------------------------------------

HTIF.prototype.ReadDEVCMDToHost = function() {
    return (this.devid << 16) | this.cmd;
}

HTIF.prototype.WriteDEVCMDToHost = function(value) {
    this.devid = value >>> 16;
    this.cmd = value & 0xFFFF;
}

// -------------------------------------------------

HTIF.prototype.WriteDEVCMDFromHost = function(value) {
    this.reg_devcmdfromhost = value;
    return;
}

HTIF.prototype.ReadDEVCMDFromHost = function() {
    if (this.fromhostqueue.length != 0)
        return this.reg_devcmdfromhost;
    else
        return 0x0;
}

// -------------------------------------------------

HTIF.prototype.ReadToHost = function() {
    return 0; // always immediate response
}

HTIF.prototype.WriteToHost = function(value) {
    this.reg_tohost = value|0;
    this.HandleRequest();
}

// -------------------------------------------------

HTIF.prototype.ReadFromHost = function() {
    //message.Debug("ReadFromHost " + this.fromhostqueue.length);
    if (this.fromhostqueue.length != 0)
        return this.fromhostqueue[0].data; 
    else
        return 0x0;
}

HTIF.prototype.WriteFromHost = function(value) {
    //message.Debug("WriteFromHost: " + value);
    //if (value == 1) message.Abort();
    if ((value == 0) && (this.reg_devcmdfromhost == 0))
    {
        this.fromhostqueue.shift();

        if (this.fromhostqueue.length > 0) {
            this.reg_devcmdfromhost =
                (this.fromhostqueue[0].devid << 16) | this.fromhostqueue[0].cmd;
            this.irqdev.RaiseInterrupt(0xF);
        }
    }
}

// -------------------------------------------------

HTIF.prototype.IsQueueEmpty = function() {
    return (this.fromhostqueue.length == 0)?true:false;
}


HTIF.prototype.HandleRequest = function() {

    //if (this.devid != 1)
    //    message.Debug("dev:" + this.devid + " cmd:" + this.cmd + " " + utils.ToHex(this.reg_tohost));

    if (this.cmd == 255) { // identify
        var pid = this.reg_tohost;

        if (!this.device[this.devid]) {
            this.ram.Write8(pid+0, 0x00);
        } else {
            StringToBytes(this.device[this.devid].identify, this.ram, pid);
        }
        this.Send(this.devid, 255, 1);
        this.reg_tohost = 0;
        return;
    }

    if (this.cmd == 0) { // read

        if (!this.device[this.devid]) {
            message.Debug("Error in HTIF: unknown read from device");
            message.Abort();
        } else {
            this.device[this.devid].Read(this.reg_tohost);
        }
        this.reg_tohost = 0;
        return;
    }

    if (this.cmd == 1) { // write
        
        if (!this.device[this.devid]) {
            message.Debug("Error in HTIF: unknown write from device");
            message.Abort();
        } else {
            this.device[this.devid].Write(this.reg_tohost);
        }
        this.reg_tohost = 0;
        return;
    }

    message.Debug("Error HTIF: unknown request");
    message.Abort();
}			

module.exports = HTIF;

},{"../bzip2":17,"../messagehandler":43,"../utils":58,"./syscalls":55}],53:[function(require,module,exports){
/* this is a unified, abstract interface (a facade) to the different
 * CPU implementations
 */

"use strict";
var message = require('../messagehandler'); // global variable
var utils = require('../utils');
var imul = require('../imul');

// CPUs
var SafeCPU = require('./safecpu');
var FastCPU = require('./fastcpu');
var DynamicCPU = require('./dynamiccpu');

var stdlib = {
    Int32Array : Int32Array,
    Int8Array : Int8Array,
    Int16Array : Int16Array,
    Float32Array : Float32Array,
    Float64Array : Float64Array,
    Uint8Array : Uint8Array,
    Uint16Array : Uint16Array,
    Math : Math
};

function createCPU(cpuname, ram, htif, heap, ncores) {
    var cpu = null;
    var foreign = {
        DebugMessage: message.Debug,
        abort : message.Abort,
        imul : Math.imul || imul,
        MathAbs : Math.abs,
        Read32 : ram.Read32Little.bind(ram),
        Write32 : ram.Write32Little.bind(ram),
        Read16 : ram.Read16Little.bind(ram),
        Write16 : ram.Write16Little.bind(ram),
        Read8 : ram.Read8Little.bind(ram),
        Write8 : ram.Write8Little.bind(ram),
        ReadDEVCMDToHost : htif.ReadDEVCMDToHost.bind(htif),
        ReadDEVCMDFromHost : htif.ReadDEVCMDFromHost.bind(htif),
        WriteDEVCMDToHost : htif.WriteDEVCMDToHost.bind(htif),
        WriteDEVCMDFromHost : htif.WriteDEVCMDFromHost.bind(htif),
        ReadToHost : htif.ReadToHost.bind(htif),
        ReadFromHost : htif.ReadFromHost.bind(htif),
        WriteToHost : htif.WriteToHost.bind(htif),
        WriteFromHost : htif.WriteFromHost.bind(htif),
    };

    if (cpuname === "safe") {
        return new SafeCPU(ram, htif);
    }
    else if (cpuname === "asm") {
        cpu = FastCPU(stdlib, foreign, heap);
        cpu.Init();
        return cpu;
    }
    else if (cpuname === "dynamic") {
        cpu = DynamicCPU(stdlib, foreign, heap);
        cpu.Init();
        return cpu;
    }
    throw new Error("invalid CPU name:" + cpuname);
}

function CPU(cpuname, ram, htif, heap, ncores) {
    this.cpu = createCPU(cpuname, ram, htif, heap, ncores);
    this.name = cpuname;
    this.ncores = ncores;
    this.ram = ram;
    this.heap = heap;
    this.littleendian = true;

    return this;
}

CPU.prototype.switchImplementation = function(cpuname) {
};

CPU.prototype.toString = function() {
    var r = new Int32Array(this.heap, 0x0);
    var csr = new Uint32Array(this.heap, 0x2000);
    var str = '';
    str += "Current state of the machine\n";


    if (this.cpu.pc) {
        str += "PC: " + utils.ToHex(this.cpu.pc) + "\n"; 
    } else {
        str += "PC: " + utils.ToHex(this.cpu.GetPC()) + "\n"; 
    }

    for (var i = 0; i < 32; i += 4) {
        str += "   r" + (i + 0) + ": " +
            utils.ToHex(r[i + 0]) + "   r" + (i + 1) + ": " +
            utils.ToHex(r[i + 1]) + "   r" + (i + 2) + ": " +
            utils.ToHex(r[i + 2]) + "   r" + (i + 3) + ": " +
            utils.ToHex(r[i + 3]) + "\n";
    }
    str += "mstatus: " + utils.ToBin(csr[0x300]) + "\n";
    str += 
        "mcause: " + utils.ToHex(csr[0x342]) + 
        " mbadaddress: " + utils.ToHex(csr[0x343]) + 
        " mepc: " + utils.ToHex(csr[0x341]) + "\n";
    return str;
};

// forward a couple of methods to the CPU implementation
var forwardedMethods = [
    "Reset", 
    "Step",
    "RaiseInterrupt", 
    "Step",
    "AnalyzeImage",
    "GetTicks",
    "GetTimeToNextInterrupt",
    "ProgressTime", 
    "ClearInterrupt"];
forwardedMethods.forEach(function(m) {
    CPU.prototype[m] = function() {
        return this.cpu[m].apply(this.cpu, arguments);        
    };
});

module.exports = CPU;

},{"../imul":42,"../messagehandler":43,"../utils":58,"./dynamiccpu":50,"./fastcpu":51,"./safecpu":54}],54:[function(require,module,exports){
// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');
var DebugIns = require('./disassemble');

var PRV_U = 0x00;
var PRV_S = 0x01;
var PRV_H = 0x02;
var PRV_M = 0x03;

var VM_READ  = 0;
var VM_WRITE = 1;
var VM_FETCH = 2;

var CAUSE_TIMER_INTERRUPT          = (1<<31) | 0x01;
var CAUSE_HOST_INTERRUPT           = (1<<31) | 0x02;
var CAUSE_SOFTWARE_INTERRUPT       = (1<<31) | 0x00;
var CAUSE_INSTRUCTION_ACCESS_FAULT = 0x01;
var CAUSE_ILLEGAL_INSTRUCTION      = 0x02;
var CAUSE_BREAKPOINT               = 0x03;
var CAUSE_LOAD_ACCESS_FAULT        = 0x05;
var CAUSE_STORE_ACCESS_FAULT       = 0x07;
var CAUSE_ENVCALL_UMODE            = 0x08;
var CAUSE_ENVCALL_SMODE            = 0x09;
var CAUSE_ENVCALL_HMODE            = 0x0A;
var CAUSE_ENVCALL_MMODE            = 0x0B;


var CSR_CYCLES = 0xC00;
var CSR_CYCLEW = 0x900;


var CSR_FFLAGS    = 0x1;
var CSR_FRM       = 0x2;
var CSR_FCSR      = 0x3;

var CSR_SSTATUS   = 0x100;
var CSR_STVEC     = 0x101;
var CSR_SIE       = 0x104;
var CSR_STIMECMP  = 0x121;
var CSR_SSCRATCH  = 0x140;
var CSR_SEPC      = 0x141;
var CSR_SIP       = 0x144;
var CSR_SPTBR     = 0x180;
var CSR_SASID     = 0x181;

var CSR_HEPC      = 0x241;

var CSR_MSTATUS   = 0x300;
var CSR_MTVEC     = 0x301;
var CSR_MTDELEG   = 0x302;
var CSR_MIE       = 0x304;
var CSR_MTIMECMP  = 0x321;
var CSR_MTIMECMPH = 0x361;
var CSR_MEPC      = 0x341;
var CSR_MSCRATCH  = 0x340;
var CSR_MCAUSE    = 0x342;
var CSR_MBADADDR  = 0x343;
var CSR_MIP       = 0x344;
var CSR_MTOHOST_TEMP = 0x345; // terminal output, temporary for the patched pk.

var CSR_MTIME     = 0x701;
var CSR_MTIMEH    = 0x741;
var CSR_MRESET    = 0x782;
var CSR_SEND_IPI  = 0x783;

var CSR_MTOHOST         = 0x780;
var CSR_MFROMHOST       = 0x781;
var CSR_MDEVCMDTOHOST   = 0x790; // special
var CSR_MDEVCMDFROMHOST = 0x791; // special

var CSR_TIMEW     = 0x901;
var CSR_INSTRETW  = 0x902;
var CSR_CYCLEHW   = 0x980;
var CSR_TIMEHW    = 0x981;
var CSR_INSTRETHW = 0x982;

var CSR_STIMEW    = 0xA01;
var CSR_STIMEH    = 0xD81;
var CSR_STIMEHW   = 0xA81;
var CSR_STIME     = 0xD01;
var CSR_SCAUSE    = 0xD42;
var CSR_SBADADDR  = 0xD43;
var CSR_MCPUID    = 0xF00;
var CSR_MIMPID    = 0xF01;
var CSR_MHARTID   = 0xF10;
var CSR_CYCLEH    = 0xC80;
var CSR_TIMEH     = 0xC81;
var CSR_INSTRETH  = 0xC82;

var CSR_MCPUID    = 0xF00;
var CSR_MIMPID    = 0xF01;
var CSR_MHARTID   = 0xF10;

var CSR_TIME      = 0xC01;
var CSR_INSTRET   = 0xC02;
var CSR_STATS     = 0xC0;
var CSR_UARCH0    = 0xCC0;
var CSR_UARCH1    = 0xCC1;
var CSR_UARCH2    = 0xCC2;
var CSR_UARCH3    = 0xCC3;
var CSR_UARCH4    = 0xCC4;
var CSR_UARCH5    = 0xCC5;
var CSR_UARCH6    = 0xCC6;
var CSR_UARCH7    = 0xCC7;
var CSR_UARCH8    = 0xCC8;
var CSR_UARCH9    = 0xCC9;
var CSR_UARCH10   = 0xCCA;
var CSR_UARCH11   = 0xCCB;
var CSR_UARCH12   = 0xCCC;
var CSR_UARCH13   = 0xCCCD;
var CSR_UARCH14   = 0xCCCE;
var CSR_UARCH15   = 0xCCCF;

var QUIET_NAN = 0xFFFFFFFF;
var SIGNALLING_NAN = 0x7FFFFFFF;

// constructor
function SafeCPU(ram, htif) {
    message.Debug("Initialize RISCV CPU");

    this.ram = ram;

    this.htif = htif;

    // registers
    this.r = new Int32Array(this.ram.heap, 0, 32);

    this.f = new Float64Array(this.ram.heap, 32<<2, 32); 

    this.fi = new Int32Array(this.ram.heap, 32<<2, 64); // for copying operations
    this.ff = new Float32Array(this.ram.heap, 0, 1); // the zero register is used to convert to single precision

    this.csr = new Int32Array(this.ram.heap, 0x2000, 4096);
    this.pc = 0x200;

    this.Reset();
}

SafeCPU.prototype.Reset = function() {
    this.ticks = 0;
    this.csr[CSR_MSTATUS]  = 0x96; // 1001 0110 - All Interrupts Disabled, FPU disabled 
    this.csr[CSR_MTOHOST]  =  0x780;
    this.csr[CSR_MCPUID]   = 0x4112D;
    this.csr[CSR_MIMPID]   = 0x01;
    this.csr[CSR_MHARTID]  = 0x00;
    this.csr[CSR_MTVEC]    = 0x100;
    this.csr[CSR_MIE]      = 0x00;
    this.csr[CSR_MEPC]     = 0x00;
    this.csr[CSR_MCAUSE]   = 0x00;
    this.csr[CSR_MBADADDR] = 0x00;
    this.csr[CSR_SSTATUS]  = 0x3010;
    this.csr[CSR_STVEC]    = 0x00;
    this.csr[CSR_SIE]      = 0x00;
    this.csr[CSR_TIME]     = 0x0;
    this.csr[CSR_SPTBR]    = 0x40000;

    // for atomic load & store instructions
    this.amoaddr = 0x00; 
    this.amovalue = 0x00;
}

SafeCPU.prototype.InvalidateTLB = function() {
}

SafeCPU.prototype.GetTimeToNextInterrupt = function () {
    var delta = (this.csr[CSR_MTIMECMP]>>>0) - (this.ticks & 0xFFFFFFFF);
    delta = delta + (delta<0?0xFFFFFFFF:0x0) | 0;
    return delta;
}

SafeCPU.prototype.GetTicks = function () {
    return this.ticks;
}

SafeCPU.prototype.ProgressTime = function (delta) {
    this.ticks = this.ticks + delta | 0;
}


SafeCPU.prototype.AnalyzeImage = function() // we haveto define these to copy the cpus
{
}

SafeCPU.prototype.CheckForInterrupt = function () {
};

SafeCPU.prototype.RaiseInterrupt = function (line, cpuid) {
    //message.Debug("raise int " + line);
};

SafeCPU.prototype.ClearInterrupt = function (line, cpuid) {
};

SafeCPU.prototype.Trap = function (cause, current_pc) {

    var current_privilege_level = (this.csr[CSR_MSTATUS] & 0x06) >> 1;
    this.PushPrivilegeStack();
    this.csr[CSR_MEPC] = current_pc;
    this.csr[CSR_MCAUSE] = cause;
    this.pc = (0x100 + 0x40*current_privilege_level)|0;  
};

SafeCPU.prototype.MemTrap = function(addr, op) {
    this.csr[CSR_MBADADDR] = addr;
    switch(op) {
        case VM_READ:
            this.Trap(CAUSE_LOAD_ACCESS_FAULT, this.pc - 4|0);
            break;

        case VM_WRITE:
            this.Trap(CAUSE_STORE_ACCESS_FAULT, this.pc - 4|0);
            break;

        case VM_FETCH:
            this.Trap(CAUSE_INSTRUCTION_ACCESS_FAULT, this.pc);
            break;
    }
}



SafeCPU.prototype.CheckVMPrivilege = function (type, op) {

    var priv = (this.csr[CSR_MSTATUS] & 0x06) >> 1;

    switch(type) {

        case 2: 
            if (op == VM_READ) return true;
            if ((priv == PRV_U) && (op == VM_FETCH)) return true;
            return false;
            break;

        case 3: 
            if (!( (priv == PRV_S) && (op == VM_FETCH) ) ) return true;
            break;

        case 4:
            if (op == VM_READ) return true;
            return false;
            break;

        case 5:
            if (op != VM_FETCH) return true;
            break;

        case 6:
            if (op != VM_WRITE) return true;
            break;

        case 7:
            return true;
            break;

        case 11:
            if (priv == PRV_S) return true;
            return false;
            break;

        case 13:
            if ((priv == PRV_S) && (op != VM_FETCH)) return true;
            break;

        case 14:
            if ((priv == PRV_S) && (op != VM_WRITE)) return true;
            break;

        case 15: 
            if (priv == PRV_S) return true;
            break;

    }

    message.Debug("Inside CheckVMPrivilege for PC "+utils.ToHex(this.pc) + " and type " + type + " and op " + op);
    message.Abort();
    return false;
}


SafeCPU.prototype.TranslateVM = function (addr, op) {
    var vm = (this.csr[CSR_MSTATUS] >> 17) & 0x1F;
    var current_privilege_level = (this.csr[CSR_MSTATUS] & 0x06) >> 1;
    var i = 1; //i = LEVELS -1 and LEVELS = 2 in a 32 bit System

    // vm bare mode
    if (vm == 0 || current_privilege_level == PRV_M) return addr;

    // hack, open mmio by direct mapping
    //if ((addr>>>28) == 0x9) return addr;

    // only RV32 supported
    if(vm != 8) {
        message.Debug("unkown VM Mode " + vm + " at PC " + utils.ToHex(this.pc));
        message.Abort();
    }

    // LEVEL 1
    var offset = addr & 0xFFF;

    var frame_num = this.ram.Read32(this.csr[CSR_SPTBR] + ((addr >>> 22) << 2));
    var type = ((frame_num >> 1) & 0xF);
    var valid = (frame_num & 0x01);

    if (valid == 0) {
        //message.Debug("Unsupported valid field " + valid + " or invalid entry in PTE at PC "+utils.ToHex(this.pc) + " pl:" + current_privilege_level + " addr:" + utils.ToHex(addr) + " op:"+op);
        //message.Abort();
        this.MemTrap(addr, op);
        return -1;
    }

    if (type >= 2) {

        if (!this.CheckVMPrivilege(type,op)) {
            this.MemTrap(addr, op);
            return -1;
            //message.Debug("Error in TranslateVM: Unhandled trap");
            //message.Abort();
        }
/*
        var updated_frame_num = frame_num;
        if(op == VM_READ)
            updated_frame_num = (frame_num | 0x20);
        else if(op == VM_WRITE)
            updated_frame_num = (frame_num | 0x60);
        this.ram.Write32(this.csr[CSR_SPTBR] + (page_num << 2),updated_frame_num);
*/
        return ((frame_num >> 10) << 12) | (addr&0x3FFFFF);
    }

    // LEVEL 2
    //message.Debug("Second level MMU");
    i = i - 1;
    var offset = addr & 0xFFF;
    var new_sptbr = (frame_num & 0xFFFFFC00) << 2;
    var new_page_num = (addr >> 12) & 0x3FF;
    var new_frame_num = this.ram.Read32(new_sptbr + (new_page_num << 2));
    var new_type = ((new_frame_num >> 1) & 0xF);
    var new_valid = (new_frame_num & 0x01);

    if (new_valid == 0) {
        this.MemTrap(addr, op);
        return -1;
    }

    if (!this.CheckVMPrivilege(new_type, op)) {
        //message.Debug("Error in TranslateVM: Unhandled trap");
        //message.Abort();
        this.MemTrap(addr, op);
        return -1;
    }

/*
    var updated_frame_num = new_frame_num;
    if(op == VM_READ)
        updated_frame_num = (new_frame_num | 0x20);
    else if(op == VM_WRITE)
        updated_frame_num = (new_frame_num | 0x60);
    this.ram.Write32(new_sptbr + (new_page_num << 2),updated_frame_num);
*/

    return ((new_frame_num >> 10) << 12) | offset;
};


SafeCPU.prototype.SetCSR = function (addr,value) {

    var csr = this.csr;

    switch(addr)
    {
        case CSR_FCSR:
            csr[addr] = value;
            break;

        case CSR_MDEVCMDTOHOST:
            csr[addr] = value;
            this.htif.WriteDEVCMDToHost(value);
            break;

        case CSR_MDEVCMDFROMHOST:
            csr[addr] = value;
            this.htif.WriteDEVCMDFromHost(value);
            break;

        case CSR_MTOHOST:
            csr[addr] =  value;
            this.htif.WriteToHost(value);
            break;

        case CSR_MTOHOST_TEMP: //only temporary for the patched pk.
            this.ram.Write8(0x90000000 >> 0, value);
            if (value == 0xA) this.ram.Write8(0x90000000 >> 0, 0xD);
            break;

        case CSR_MFROMHOST:
            csr[addr] = value;
            this.htif.WriteFromHost(value);
            break;

        case CSR_MSTATUS:
            csr[addr] = value;
            break;

        case CSR_MCPUID:
            //csr[addr] = value;
            break;

        case CSR_MIMPID:
            csr[addr] = value;
            break;

        case CSR_MHARTID:
            csr[addr] = value;
            break;

        case CSR_MTVEC:
            csr[addr] = value;
            break;

        case CSR_MIP:
            //csr[addr] = value;
            var mask = 0x2 | 0x08; //mask = MIP_SSIP | MIP_MSIP
            csr[CSR_MIP] = (csr[CSR_MIP] & ~mask) | (value & mask);
            break;

        case CSR_MIE:
            //csr[addr] = value;
            var mask = 0x2 | 0x08 | 0x20; //mask = MIP_SSIP | MIP_MSIP | MIP_STIP
            csr[CSR_MIE] = (csr[CSR_MIE] & ~mask) | (value & mask);
            break;

        case CSR_SEPC:
        case CSR_MEPC:
            csr[addr] = value;
            break;

        case CSR_MCAUSE:
            csr[addr] = value;
            break;

        case CSR_SCAUSE:
            csr[addr] = value;
            break;

        case CSR_MBADADDR:
            csr[addr] = value;
            break;

        case CSR_SBADADDR:
            csr[addr] = value;
            break;

        case CSR_SSTATUS:
            csr[addr] = value;
            csr[CSR_MSTATUS] &= ~0x1F039; 
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x01); //IE0
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x08); //IE1
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x10); //PRV1
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0xF000); //FS,XS
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x10000); //MPRV
            break; 

        case CSR_STVEC:
            csr[addr] = value;
            break;

        case CSR_SIP:
            //csr[addr] = value;
            var mask = 0x2; //mask = MIP_SSIP
            csr[CSR_MIP] = (csr[CSR_MIP] & ~mask) | (value & mask);
            break;

        case CSR_SIE:
            //csr[addr] = value;
            var mask = 0x2 | 0x20; //mask = MIP_SSIP | MIP_STIP
            csr[CSR_MIE] = (csr[CSR_MIE] & ~mask) | (value & mask);
            break;

        case CSR_MSCRATCH:
            csr[addr] = value;
            break;

        case CSR_SSCRATCH:
            csr[addr] = value;
            break;

        case CSR_CYCLEW:
            csr[addr] = value;
            break;

        case CSR_CYCLES:
            this.ticks = value;
            csr[addr] = value;
            break;

        case CSR_MTIME:
        case CSR_STIME:
        case CSR_STIMEW:
            csr[addr] = value;
            break;

        case CSR_MTIMEH:
        case CSR_STIMEH:
        case CSR_STIMEHW:
            csr[addr] = value;
            break;

        case CSR_TIME:
        case CSR_TIMEW:
            csr[addr] = value;
            break;

        case CSR_MTIMECMP:
        case CSR_STIMECMP:
            csr[CSR_MIP] &= ~(0x20); //csr[CSR_MIP] &= ~MIP_STIP
            csr[addr] = value;
            break;

        case CSR_MTIMECMPH:
            csr[addr] = value;
            break;

        case CSR_SPTBR:
            csr[addr] = value;
            break;

        case CSR_FRM:
            csr[addr] = value;
            break;

        case CSR_FFLAGS:
            csr[addr] = value;
            break;

        case CSR_FCSR:
            csr[addr] = value;
            break;

        default:
            csr[addr] = value;
            message.Debug("Error in SetCSR: PC "+utils.ToHex(this.pc)+" Address " + utils.ToHex(addr) + " unkown");
            message.Abort();
            break;
    }
};

SafeCPU.prototype.GetCSR = function (addr) {

    var csr = this.csr;
    var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;

    switch(addr)
    {
        case CSR_FCSR:
            return 0x0;
            break;

        case CSR_MDEVCMDTOHOST:
            return this.htif.ReadDEVCMDToHost();
            break;

        case CSR_MDEVCMDFROMHOST:
            return this.htif.ReadDEVCMDFromHost();
            break;

        case CSR_MTOHOST:
            return this.htif.ReadToHost();
            break;

        case CSR_MTOHOST_TEMP: //only temporary for the patched pk.
            return 0x0;
            break;

        case CSR_MFROMHOST:
            return this.htif.ReadFromHost();
            break;

        case CSR_MSTATUS:
            return csr[addr];
            break;

        case CSR_MCPUID:
            return csr[addr];
            break;

        case CSR_MIMPID:
            return csr[addr];
            break;

        case CSR_MHARTID:
            return csr[addr];
            break;

        case CSR_MTVEC:
            return csr[addr];
            break;

        case CSR_MIE:
            return csr[addr];
            break;

        case CSR_SEPC:
        case CSR_MEPC:
            return csr[addr];
            break;

        case CSR_MCAUSE:
            return csr[addr];
            break;

        case CSR_SCAUSE:
            return csr[addr];
            break;

        case CSR_MBADADDR:
            return csr[addr];
            break;

        case CSR_SBADADDR:
            return csr[addr];
            break;

        case CSR_SSTATUS:
            //if (current_privilege_level == 0) this.Trap(CAUSE_ILLEGAL_INSTRUCTION);
            csr[CSR_SSTATUS] = 0x00; 
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x01); //IE0
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x08); //IE1
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x10); //PRV1
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0xF000); //FS,XS
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x10000); //MPRV
            return csr[CSR_SSTATUS];
            break;

        case CSR_STVEC:
            return csr[addr];
            break;

        case CSR_MIP:
            return csr[addr];
            break;

        case CSR_MIE:
            return csr[addr];
            break;

        case CSR_SIP: 
            return csr[CSR_MIP] & (0x2 | 0x20);//(MIP_SSIP | MIP_STIP)
            break;

        case CSR_SIE: 
            return csr[CSR_MIE] & (0x2 | 0x20);//(MIP_SSIP | MIP_STIP)
            break;

        case CSR_MSCRATCH:
            return csr[addr];
            break;

        case CSR_SSCRATCH:
            return csr[addr];
            break;

        case CSR_CYCLEW:
            return this.ticks;
            break;

        case CSR_CYCLES:
            return this.ticks;
            break;

        case CSR_MTIME:
        case CSR_STIME:
        case CSR_STIMEW:
            return this.ticks;
            break;

        case CSR_MTIMEH:
        case CSR_STIMEH:
        case CSR_STIMEHW:
            return (this.ticks) >> 32;
            break;

        case CSR_TIME:
        case CSR_TIMEW:
            return this.ticks;
            break;

        case CSR_MTIMECMP:
        case CSR_STIMECMP:
        case CSR_MTIMECMPH:
            return csr[addr];
            break;

        case CSR_SPTBR:
            return csr[addr];
            break;

        case CSR_FRM:
            return csr[addr];
            break;

        case CSR_FFLAGS:
            return csr[addr];
            break;

        case CSR_FCSR:
            return csr[addr];
            break;

        default:
            message.Debug("Error in GetCSR: PC "+utils.ToHex(this.pc)+" Address " + utils.ToHex(addr) + " unkown");
            message.Abort();
            return csr[addr];
            break;
    }
   
};

SafeCPU.prototype.UMul64 = function (a,b) {

    var result = [0, 0];

    a >>>= 0;
    b >>>= 0;

    if (a < 32767 && b < 65536) {
        result[0] = a * b;
        result[1] = (result[0] < 0) ? -1 : 0;
        return result;
    }

    var a00 = a & 0xFFFF, a16 = a >>> 16;
    var b00 = b & 0xFFFF, b16 = b >>> 16;

    var c00 = a00 * b00;
    var c16 = (c00 >>> 16) + (a16 * b00);
    var c32 = c16 >>> 16;
    c16 = (c16 & 0xFFFF) + (a00 * b16);
    c32 += c16 >>> 16;
    var c48 = c32 >>> 16;
    c32 = (c32 & 0xFFFF) + (a16 * b16);
    c48 += c32 >>> 16;

    result[0] = ((c16 & 0xFFFF) << 16) | (c00 & 0xFFFF);
    result[1] = ((c48 & 0xFFFF) << 16) | (c32 & 0xFFFF);
    return result;
};

SafeCPU.prototype.IMul64 = function (a,b) {

    var result = [0,0];

    if (a == 0) return result[0] = result[1] = 0, result;
    if (b == 0) return result[0] = result[1] = 0, result;

    a |= 0;
    b |= 0;

    if ((a >= -32768 && a <= 32767) && (b >= -32768 && b <= 32767)) {
        result[0] = a * b;
        result[1] = (result[0] < 0) ? -1 : 0;
        return result;
    }

    var doNegate = (a < 0) ^ (b < 0);

    result = this.UMul64(Math.abs(a), Math.abs(b));

    if (doNegate) {
        result[0] = ~result[0];
        result[1] = ~result[1];
        result[0] = (result[0] + 1) | 0;
        if (result[0] == 0) result[1] = (result[1] + 1) | 0;
    }

    return result;
};

SafeCPU.prototype.SUMul64 = function (a,b) {

    var result = [0,0];

    if (a == 0) return result[0] = result[1] = 0, result;
    if (b == 0) return result[0] = result[1] = 0, result;

    a |= 0;
    b >>>= 0;

    if ((a >= -32768 && a <= 32767) && (b < 65536)) {
        result[0] = a * b;
        result[1] = (result[0] < 0) ? -1 : 0;
        return result;
    }

    var doNegate = a < 0;

    result = this.UMul64(Math.abs(a), Math.abs(b));

    if (doNegate) {
        result[0] = ~result[0];
        result[1] = ~result[1];
        result[0] = (result[0] + 1) | 0;
        if (result[0] == 0) result[1] = (result[1] + 1) | 0;
    }

    return result;
};


SafeCPU.prototype.PushPrivilegeStack = function () {

    var csr = this.csr;
    var mstatus = csr[CSR_MSTATUS];
    var privilege_level_stack = mstatus & 0x1FF;
    var new_privilege_level_stack = (((privilege_level_stack << 2) | PRV_M) << 1) & 0x1FF;
    csr[CSR_MSTATUS] = ((mstatus & (~0xFFF)) + new_privilege_level_stack) & 0xFFFEFFFF; //Last "and" to set mprv(bit 16) to zero
};

SafeCPU.prototype.PopPrivilegeStack = function () {

    var csr = this.csr;
    var mstatus = csr[CSR_MSTATUS];
    var privilege_level_stack =  (mstatus & 0x1FF);
    var new_privilege_level_stack = ((privilege_level_stack >>> 3) | ((PRV_U << 1) | 0x1) << 6);
    csr[CSR_MSTATUS] = (mstatus & (~0xFFF)) + new_privilege_level_stack;
};

SafeCPU.prototype.Step = function (steps, clockspeed) {
    var r = this.r;
    var fi = this.fi;
    var ff = this.ff;
    var f = this.f;
    var csr = this.csr;
    var rindex = 0x00;
    var imm = 0x00;
    var imm1 = 0x00;
    var imm2 = 0x00;
    var imm3 = 0x00;
    var imm4 = 0x00;
    var zimm = 0x00;
    var quo = 0x00;
    var rem = 0x00;
    var rs1 = 0x0;
    var rs2 = 0x0;
    var fs1 = 0.0;
    var fs2 = 0.0;
    var fs3 = 0.0;
    var interrupts = 0x0;
    var ie = 0x0;
    var ins = 0x0;
    var paddr = 0x0;

    steps = steps | 0;
    clockspeed = clockspeed | 0;
    var delta = 0;
    
    do {
        r[0] = 0x00;

        var current_privilege_level = (this.csr[CSR_MSTATUS] & 0x06) >> 1;
        
        if (!(steps & 63)) {
            // ---------- TICK ----------
            var delta = csr[CSR_MTIMECMP] - this.ticks | 0;
            delta = delta + (delta<0?0xFFFFFFFF:0x0) | 0;
            this.ticks = this.ticks + clockspeed | 0;
            if (delta < clockspeed) {
                csr[CSR_MIP] = csr[CSR_MIP] | 0x20;
            }

            interrupts = csr[CSR_MIE] & csr[CSR_MIP];
            ie = csr[CSR_MSTATUS] & 0x01;

            if ((current_privilege_level < 3) || ((current_privilege_level == 3) && ie)) {
                if (interrupts & 0x8) {
                    this.Trap(CAUSE_SOFTWARE_INTERRUPT, this.pc);
                    continue;
                } else
                if (!this.htif.IsQueueEmpty()) {
                    this.Trap(CAUSE_HOST_INTERRUPT, this.pc);
                    continue;
                }
            }
            if ((current_privilege_level < 1) || ((current_privilege_level == 1) && ie)) {
                if (interrupts & 0x2) {
                    this.Trap(CAUSE_SOFTWARE_INTERRUPT, this.pc);
                    continue;
                } else
                if (interrupts & 0x20) {
                     this.Trap(CAUSE_TIMER_INTERRUPT, this.pc);
                     continue;
                }
            }
        }


        paddr = this.TranslateVM(this.pc, VM_FETCH);
        if(paddr == -1) {
            continue;
        }

        ins = this.ram.Read32(paddr);
        this.pc = this.pc + 4|0;
        //DebugIns.Disassemble(ins,r,csr,this.pc);

        switch(ins&0x7F) {

            case 0x03:
                // lb, lh, lw, lbu, lhu
                imm = (ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // lb
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = (this.ram.Read8(paddr) << 24) >> 24;
                        break;

                    case 0x01:
                        // lh
                        if (rs1+imm & 1) {
                             message.Debug("Error in lh: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = (this.ram.Read16(paddr) << 16) >> 16;
                        break;

                    case 0x02:
                        // lw
                        if (rs1+imm & 3) {
                             message.Debug("Error in lw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = this.ram.Read32(paddr);
                        break;

                    case 0x04:
                        // lbu
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = this.ram.Read8(paddr) & 0xFF;
                        break;

                    case 0x05:
                        // lhu
                        if (rs1+imm & 1) {
                             message.Debug("Error in lhu: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0 ,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = this.ram.Read16(paddr) & 0xFFFF;
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x23:
                // sb, sh, sw
                imm1 = (ins >> 25);
                imm2 = (ins >> 7) & 0x1F;
                imm = (imm1 << 5) | imm2;
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 20) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // sb
                        paddr = this.TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write8(paddr,(r[rindex] & 0xFF));
                        break;

                    case 0x01:
                        // sh
                        if (rs1+imm & 1) {
                             message.Debug("Error in sh: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write16(paddr,(r[rindex] & 0xFFFF));
                        break;

                    case 0x02:
                        // sw
                        if (rs1+imm & 3) {
                             message.Debug("Error in sw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr,r[rindex]);
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x13:
                // addi, slti, sltiu, xori, ori, andi, slli, srli, srai
                rindex = (ins >> 7) & 0x1F;
                rs1 = r[(ins >> 15) & 0x1F];
                imm = (ins >> 20);
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // addi
                        r[rindex] = rs1 + imm;
                        break;

                    case 0x02:
                        // slti
                        if(rs1 < imm) r[rindex] = 0x01;
                        else r[rindex] = 0x00;
                        break;

                    case 0x03:
                        // sltiu
                        if((rs1>>>0) < (imm>>>0)) r[rindex] = 0x01;
                        else r[rindex] = 0x00;
                        break;

                    case 0x04:
                        // xori
                        r[rindex] = rs1 ^ imm;
                        break;

                    case 0x06:
                        // ori
                        r[rindex] = rs1 | imm;
                        break;

                    case 0x07:
                        // andi
                        r[rindex] = rs1 & imm;
                        break;

                    case 0x01:
                        // slli
                        r[rindex] = rs1 << imm;
                        break;

                    case 0x05:
                        if(((ins >> 25) & 0x7F) == 0x00){
                            // srli
                            r[rindex] = rs1 >>> imm;
                        }
                        else if(((ins >> 25) & 0x7F) == 0x20){
                            // srai
                            r[rindex] = rs1 >> imm;
                        } else {
                            message.Debug("Error in safecpu: Instruction (sra, srl)" + utils.ToHex(ins) + " not found");
                            message.Abort();
                        }
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x33:
                // add, sub, sll, slt, sltu, xor, srl, sra, or, and
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00:
                        // add, slt, sltu, or, xor, sll, srl
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                // add
                                r[rindex] = rs1 + rs2;
                                break;

                            case 0x02:
                                // slt
                                if(rs1 < rs2) r[rindex] = 0x01;
                                else r[rindex] = 0x00;
                                break;

                            case 0x03:
                                // sltu
                                if((rs1>>>0) < (rs2>>>0)) r[rindex] = 0x01;
                                else r[rindex] = 0x00;
                                break;

                            case 0x07:
                                // and
                                r[rindex] = rs1 & rs2;
                                break;

                            case 0x06:
                                // or
                                r[rindex] = rs1 | rs2;
                                break;

                            case 0x04:
                                // xor
                                r[rindex] = rs1 ^ rs2;
                                break;

                            case 0x01:
                                // sll
                                r[rindex] = rs1 << (rs2 & 0x1F);
                                break;

                            case 0x05:
                                // srl
                                r[rindex] = rs1 >>> (rs2 & 0x1F);
                                break;
                        }
                        break;

                    case 0x20:
                        //sub
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                // sub
                                r[rindex] = rs1 - rs2;
                                break;

                            case 0x05:
                                // sra
                                r[rindex] = rs1 >> (rs2 & 0x1F);
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction (sub,sra) " + utils.ToHex(ins) + " not found");
                                message.Abort();
                        }
                        break;

                    case 0x01:
                        // mul, mulh, mulhsu, mulhu, div, divu, rem, remu
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                // mul
                                var result = this.IMul64(rs1, rs2);
                                r[rindex] = result[0];
                                break;

                            case 0x01:
                                // mulh
                                var result = this.IMul64(rs1, rs2);
                                r[rindex] = result[1];
                                break;

                            case 0x02:
                                // mulhsu
                                var result = this.SUMul64(rs1, rs2>>>0);
                                r[rindex] = result[1];
                                break;

                            case 0x03:
                                // mulhu
                                var result = this.UMul64(rs1>>>0, rs2>>>0);
                                r[rindex] = result[1];
                                break;

                            case 0x04:
                                // div
                                if(rs2 == 0)
                                    quo = -1;
                                else
                                    quo = rs1 / rs2;
                                r[rindex] = quo;
                                break;

                            case 0x05:
                                // divu
                                if(rs2 == 0)
                                    quo = 0xFFFFFFFF;
                                else
                                    quo = (rs1 >>> 0) / (rs2 >>> 0);
                                r[rindex] = quo;
                                break;

                            case 0x06:
                                // rem
                                if(rs2 == 0)
                                    rem = rs1;
                                else
                                    rem = rs1 % rs2;
                                r[rindex] = rem;
                                break;

                            case 0x07:
                                // remu
                                if(rs2 == 0)
                                    rem = (rs1 >>> 0);
                                else
                                    rem = (rs1 >>> 0) % (rs2 >>> 0);
                                r[rindex] = rem;
                                break;
                        }
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x37:
                // lui
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = ins & 0xFFFFF000;
                break;

            case 0x17:
                // auipc
                imm = ins & 0xFFFFF000;
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = this.pc + imm - 4|0;
                break;

            case 0x6F:
                // jal
                imm1 = (ins >> 21) & 0x3FF;
                imm2 = ((ins >> 20) & 0x1) << 10;
                imm3 = ((ins >> 12) & 0xFF) << 11;
                imm4 = (ins >> 31) << 19;
                imm =  (imm1 | imm2 | imm3 | imm4 ) << 1; 
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = this.pc;
                this.pc = this.pc + imm - 4|0;
                break; 

            case 0x67:
                // jalr
                imm = ins >> 20;
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = this.pc;
                this.pc = (rs1 + imm) & 0xFFFFFFFE;
                break;

            case 0x63:
                // beq, bne, blt, bge, bltu, bgeu
                imm1 = (ins >> 31) << 11;
                imm2 = ((ins >> 25) & 0x3F) << 4;
                imm3 = (ins >> 8) & 0x0F;
                imm4 = ((ins >> 7) & 0x01) << 10;
                imm =  ((imm1 | imm2 | imm3 | imm4) << 1 );
                rs1 = r[(ins >> 15) & 0x1F];
                rs2 = r[(ins >> 20) & 0x1F];

                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // beq
                        if(rs1 == rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x01:
                        // bne
                        if(rs1 != rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x04:
                        // blt
                        if(rs1 < rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x05:
                        // bge
                        if(rs1 >= rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x06:
                        // bltu
                        if((rs1>>>0) < (rs2>>>0)) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x07:
                        // bgeu
                        if((rs1>>>0) >= (rs2>>>0)) this.pc = this.pc + imm - 4|0;
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x73:
                // csrrw, csrrs, csrrc, csrrwi, csrrsi, csrrci, ecall, eret, ebreak, mrts, wfi
                imm = (ins >>> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x01:
                        // csrrw
                        r[rindex] = this.GetCSR(imm);
                        //if (rindex != ((ins >> 15) & 0x1F))
                        this.SetCSR(imm, rs1);
                        break;

                    case 0x02:
                        // csrrs
                        r[rindex] = this.GetCSR(imm);
                        this.SetCSR(imm, this.GetCSR(imm) | rs1);
                        break;

                    case 0x03:
                        // csrrc
                        r[rindex] = this.GetCSR(imm);
                        this.SetCSR(imm, this.GetCSR(imm) & (~rs1));
                        break;

                    case 0x05:
                        // csrrwi
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) this.SetCSR(imm, (zimm >> 0));
                        break;
                        

                    case 0x06:
                        // csrrsi
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) this.SetCSR(imm, this.GetCSR(imm) | (zimm >> 0));
                        break;

                    case 0x07:
                        // csrrci
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) this.SetCSR(imm, this.GetCSR(imm) & ~(zimm >> 0));
                        break;
                    
                    case 0x00:
                        // ecall, eret, ebreak, mrts, wfi
                        switch((ins >> 20)&0xFFF) {
                            case 0x00:
                                // ecall
                                switch(current_privilege_level)
                                {
                                    case PRV_U:
                                        this.Trap(CAUSE_ENVCALL_UMODE, this.pc - 4|0);
                                        break;

                                    case PRV_S:
                                        this.Trap(CAUSE_ENVCALL_SMODE, this.pc - 4|0);
                                        break;

                                    case PRV_H:
                                        this.Trap(CAUSE_ENVCALL_HMODE, this.pc - 4|0);
                                        this.Abort();
                                        break;

                                    case PRV_M:
                                        this.Trap(CAUSE_ENVCALL_MMODE, this.pc - 4|0);
                                        break;
                                    
                                    default:
                                        message.Debug("Error in ecall: Don't know how to handle privilege level " + current_privilege_level);
                                        message.Abort();
                                        break;
                                }
                                break;

                            case 0x001:
                                // ebreak
                                this.Trap(CAUSE_BREAKPOINT, this.pc - 4|0);
                                break;

                            case 0x100:
                                // eret
                                var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
                                if(current_privilege_level < PRV_S) {
                                    message.Debug("Error in eret: current_privilege_level isn't allowed access");
                                    message.Abort();
                                    break;   
                                }
                                this.PopPrivilegeStack();

                                switch(current_privilege_level)
                                {
                                    case PRV_S:
                                        this.pc = csr[CSR_SEPC]|0;
                                        break;

                                    case PRV_H:
                                        this.pc = csr[CSR_HEPC]|0;
                                        break;

                                    case PRV_M:
                                        this.pc = csr[CSR_MEPC]|0;
                                        break;
                                    
                                    default:
                                        message.Debug("Error in eret: Don't know how to handle privilege level " + current_privilege_level);
                                        message.Abort();
                                        break;
                                }
                                break;

                            case 0x102:
                                // wfi
                                /*
                                interrupts = csr[CSR_MIE] & csr[CSR_MIP];
                                if ((!interrupts) && (this.htif.IsQueueEmpty()))
                                    return steps;
                                */
                                break;

                            case 0x305:
                                // mrts
                                if (current_privilege_level != PRV_M) {
                                    message.Debug("Error in mrts: current_privilege_level isn't allowed access");
                                    message.Abort();
                                    break;   
                                }
                                csr[CSR_MSTATUS] = (csr[CSR_MSTATUS] & ~0x6) | 0x02; //Setting the Privilage level to Supervisor
                                csr[CSR_SBADADDR] = csr[CSR_MBADADDR];
                                csr[CSR_SCAUSE] = csr[CSR_MCAUSE];
                                csr[CSR_SEPC] = csr[CSR_MEPC];
                                this.pc = csr[CSR_STVEC]|0;
                                break;

                            case 0x101:
                                // sfence.vm
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                                message.Abort();
                                break;

                        }
                        break; 

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x07:
                // flw, fld
                imm = (ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = ((ins >> 7) & 0x1F);
                switch((ins >> 12)&0x7) {
                    
                    case 0x02:
                        // flw
                        if (rs1+imm & 3) {
                             message.Debug("Error in flw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0,VM_READ);
                        if(paddr == -1) break;
                        r[0] = this.ram.Read32(paddr);
                        f[rindex] = ff[0];
                        break;

                    case 0x03:
                        // fld
                        if (rs1+imm & 7) {
                             message.Debug("Error in flw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0,VM_READ);
                        if(paddr == -1) break;
                        fi[(rindex<<1) + 0] = this.ram.Read32(paddr+0);
                        fi[(rindex<<1) + 1] = this.ram.Read32(paddr+4);
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x27:
                // fsw, fsd
                imm1 = (ins >> 25);
                imm2 = (ins >> 7) & 0x1F;
                imm = (imm1 << 5) + imm2;
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 20) & 0x1F;
                switch((ins >> 12)&0x7) {

                    case 0x02:
                        // fsw
                        ff[0] = f[rindex];
                        if (rs1+imm & 3) {
                             message.Debug("Error in fsw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x03:
                        // fsd
                        if (rs1+imm & 7) {
                             message.Debug("Error in fsd: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE);
                        if (paddr == -1) break;
                        this.ram.Write32(paddr+0, fi[(rindex<<1) + 0]);
                        this.ram.Write32(paddr+4, fi[(rindex<<1) + 1]);
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x53:
                // fadd, fsub
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00:
                    case 0x01:
                        // fadd.s, fadd.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        f[rindex] = fs1 + fs2;
                        break;

                    case 0x04:
                    case 0x05:
                        // fsub.s, fsub.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        f[rindex] = fs1 - fs2;
                        break;

                    case 0x50:
                    case 0x51:
                        // fcmp.s, fcmp.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        switch((ins >> 12) & 0x7) {
                            case 0x0:
                                if (fs1 <= fs2) r[rindex] = 1;
                                else r[rindex] = 0;
                                break;

                            case 0x1:
                                if (fs1 < fs2) r[rindex] = 1;
                                else r[rindex] = 0;
                                break;

                            case 0x2:
                                if (fs1 == fs2) r[rindex] = 1;
                                else r[rindex] = 0;
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction (fcmp) " + utils.ToHex(ins) + " not found");
                                message.Abort();
                                break;
                        }
                        break;

                    case 0x20: // fcvt.s.d
                    case 0x21: // fcvt.d.s
                        fs1 = f[(ins >> 15) & 0x1F];
                        f[rindex] = fs1;
                        break;

                    case 0x60:
                        //fcvt.w.s
                        r[rindex] = f[(ins >> 15) & 0x1F];
                        break;

                    case 0x61:
                        //fcvt.w.d
                        r[rindex] = f[(ins >> 15) & 0x1F];
                        break;

                    case 0x68:
                        //fcvt.s.w
                        f[rindex] = r[(ins >> 15) & 0x1F];
                        break;

                    case 0x69:
                        //fcvt.d.w
                        f[rindex] = r[(ins >> 15) & 0x1F];
                        break;


                    case 0x08:
                    case 0x09:
                        //fmul.s, fmul.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        f[rindex] = fs1 * fs2;
                        break;

                    case 0x10: // single precision
                    case 0x11: // double precision
                        // fsgnj
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        switch((ins >> 12) & 7) {
                            case 0:
                                // fsgnj.d, also used for fmv.d
                                f[rindex] = (fs2<0)?-Math.abs(fs1):Math.abs(fs1);
                                break;

                            case 1:
                                // fsgnjn.d
                                f[rindex] = (fs2<0)?Math.abs(fs1):-Math.abs(fs1);
                                break;

                            case 2:
                                // fsgnjx.d
                                f[rindex] = ((fs2<0 && fs1<0) || (fs2>0 && fs1>0))?Math.abs(fs1):-Math.abs(fs1);
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction (fsgn) " + utils.ToHex(ins) + " not found");
                                message.Abort();
                        }
                        break;

                    case 0x78:
                        // fmv.s.x
                        rs1 = r[(ins >> 15) & 0x1F];
                        r[0] = rs1;
                        f[rindex] = ff[0]; 
                        break;


                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;
                }
                break;

            case 0x43:
                // fmadd.d, fmadd.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = fs1 * fs2 + fs3;
                break;

            case 0x47:
                // fmsub.d, fmsub.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = fs1 * fs2 - fs3;
                break;

            case 0x4B:
                // fnmadd.d, fnmadd.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = -(fs1 * fs2 + fs3);
                break;

            case 0x4F:
                // fnmsub.d, fnmsub.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = -(fs1 * fs2 - fs3);
                break;

            case 0x2F:
                // amoswap, amoadd, amoxor, amoand, amoor, amomin, amomax, amominu, amomaxu
                rs1 = r[(ins >> 15) & 0x1F];
                rs2 = r[(ins >> 20) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                paddr = this.TranslateVM(rs1|0, VM_READ);
                if (paddr == -1) break;

                switch((ins >> 27)&0x1F) {
                    
                    case 0x01:
                        // amoswap
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, rs2);
                        break;

                    case 0x00:
                        // amoadd
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr,r[rindex] + rs2);
                        break;

                    case 0x04:
                        // amoxor
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr,r[rindex] ^ rs2);
                        break;

                    case 0x0C:
                        // amoand
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[rindex] & rs2);
                        break;

                    case 0x08:
                        // amoor
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[rindex] | rs2);
                        break;

                    case 0x10:
                        // amomin
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >> 0) > (r[rindex] >> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                   case 0x14:
                        // amomax
                        r[rindex] = this.ram.Read32(paddr);
                        if(rs2 < r[rindex]) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x18:
                        // amominu
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >>> 0) > (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x1C:
                        // amomaxu
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >>> 0) < (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x02:
                        // lr.d
                        r[rindex] = this.ram.Read32(paddr);
                        this.amoaddr = rs1;
                        this.amovalue = r[rindex];
                        break;

                    case 0x03:
                        // sc.d
                        if(rs1 != this.amoaddr) {
                            r[rindex] = 0x01;
                            break;
                        }
                        if(this.ram.Read32(paddr) != this.amovalue) {
                            r[rindex] = 0x01;
                            break;
                        }
                        r[rindex] = 0x00;
                        paddr = this.TranslateVM(rs1, VM_WRITE);
                        if (paddr == -1) break;
                        this.ram.Write32(paddr, rs2);
                        break;

                    default:
                        message.Debug("Error in Atomic Memory Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x0F:
                // fence
                break;

            default:
                message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found at "+utils.ToHex(this.pc));
                message.Abort();
                break;
        }

    } while(steps=steps-1|0);

    return 0;
};

module.exports = SafeCPU;

},{"../messagehandler":43,"../utils":58,"./disassemble":49}],55:[function(require,module,exports){
// -------------------------------------------------
// ----------------- SYSCALLS ----------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

var SYS_OPENAT      = 56;
var SYS_CLOSE       = 57;
var SYS_PREAD       = 67;
var SYS_WRITE       = 64;
var SYS_FSTAT       = 80;
var SYS_EXIT        = 93;
var SYS_GETMAINVARS = 2011;

function SysCalls(ram) {

    this.ram = ram;
    this.elf8mem = [];
    this.file_descriptor_table = [];
    this.file_size = []; //file descriptor is the index
    this.file_pointer = []; //file descriptor is the index
    this.file_descriptor_offset = 9;
    this.elf8mem_offset = 0x00;

}

SysCalls.prototype.HandleSysCall = function (addr) {

    addr = addr | 0;
    var ram = this.ram;
    var syscall_id = this.ram.Read32(addr);
    //message.Debug("syscall_id " + syscall_id);
    var argv = ["spike", "-m31", "-p1", "vmlinux"];
    switch(syscall_id){

        case SYS_OPENAT:
            //sys_openat
            var filename_pointer = this.ram.Read32(addr + 16);
            var filename = "";
            for(var i=0,c;;i++){
                c = this.ram.Read8(filename_pointer+i);
                if(c == 0)
                    break;
                else
                    filename += String.fromCharCode(c);
            }
            var url = filename;
            utils.LoadBinaryResourceII("../sys/riscv/" + url, 
                this.OnFileLoaded.bind(this), 
                false, 
                function(error){throw error;}
            );
            this.ram.Write32(addr, this.file_descriptor_offset);
            break;

        case SYS_PREAD:
            //sys_pread
            var file_descriptor = this.ram.Read32(addr + 8);
            var file_address = this.file_descriptor_table[file_descriptor];
            var buffer_address = this.ram.Read32(addr + 16);
            var number_bytes = this.ram.Read32(addr + 24);
            //var file_offset = this.file_pointer[file_descriptor];
            var file_offset = this.ram.Read32(addr + 32);
            var file_length = this.file_size[file_descriptor];
            var i = 0;
            for(var b;i < number_bytes;i++){
                if((i + file_offset) >= file_length) break;
                b = this.elf8mem[file_address + i + file_offset];
                this.ram.Write8(buffer_address + i, b);
            }
            this.file_pointer[file_descriptor] += i;
            this.ram.Write32(addr, i);
            break;

        case SYS_CLOSE:
            //sys_close
            this.ram.Write32(addr, 0);
            break;

        case SYS_FSTAT:
            //sys_fstat
            var file_descriptor = this.ram.Read32(addr + 8);
            var stat_buffer_address = this.ram.Read32(addr + 16);
            this.ram.Write32(stat_buffer_address, 0); //unsigned long   Device. 
            this.ram.Write32(stat_buffer_address + 4, 0); //unsigned long   File serial number
            this.ram.Write16(stat_buffer_address + 8, 0x81FF); //unsigned int    File mode
            this.ram.Write16(stat_buffer_address +10, 0); //unsigned int    Link count
            this.ram.Write16(stat_buffer_address +12, 0); //unsigned int    User ID of the file's owner
            this.ram.Write16(stat_buffer_address +14, 0); //unsigned int    Group ID of the file's group
            this.ram.Write32(stat_buffer_address +16, 0); //unsigned long   Device number, if device
            this.ram.Write32(stat_buffer_address +20, 0); //unsigned long   __pad1
            this.ram.Write32(stat_buffer_address +24, this.file_size[file_descriptor]); //long Size of file, in bytes
            this.ram.Write16(stat_buffer_address +28, 512); //int           Optimal block size for I/O
            this.ram.Write16(stat_buffer_address +30, 0); //int             __pad2
            this.ram.Write32(stat_buffer_address +32, 0); //long            Number 512-byte blocks allocated
            this.ram.Write32(stat_buffer_address +36, 0); //long            Time of last access
            this.ram.Write32(stat_buffer_address +40, 0); //unsigned long   st_atime_nsec
            this.ram.Write32(stat_buffer_address +44, 0); //long            Time of last modification
            this.ram.Write32(stat_buffer_address +48, 0); //unsigned long   st_mtime_nsec
            this.ram.Write32(stat_buffer_address +52, 0); //long            Time of last status change
            this.ram.Write32(stat_buffer_address +56, 0); //unsigned long   st_ctime_nsec
            this.ram.Write16(stat_buffer_address +60, 0); //unsigned int    __unused4
            this.ram.Write16(stat_buffer_address +62, 0); //unsigned int    __unused5
            this.ram.Write32(addr, 1);
            break;

        case SYS_WRITE:
            //sys_write
            var length = this.ram.Read32(addr + 8*3), i =0;
            var string_address = this.ram.Read32(addr + 8*2);
            while(i < length){
                var c = this.ram.Read8(string_address + (i++));
                this.ram.Write8Little(0x90000000 >> 0, c);
                if (c == 0xA) this.ram.Write8(0x90000000 >> 0, 0xD);
            }
            this.ram.Write32(addr, i);
            break;

        case SYS_EXIT:
            //sys_exit
            message.Debug("Program exited with sys_exit for inst at PC "+utils.ToHex(this.pc));
            message.Abort();
            break;

        case SYS_GETMAINVARS:
            //sys_getmainvars
            var address = this.ram.Read32(addr + 8);
            var length = this.ram.Read32(addr + 16);

           // write argc
            this.ram.Write32(address, argv.length);
            // argv[argc] = NULL
            // envp[0] = NULL

            // generate list of pointers to string
            var ofs = argv.length*8 + 8*4; // offset of first string entry
            for(var i=0; i<argv.length; i++) {
                this.ram.Write32(address+8+i*8, address + ofs);
                ofs += argv[i].length+1;
            }

            ofs = argv.length*8 + 8*4;
            for(var i=0; i<argv.length; i++) {
                for (var j=0; j<argv[i].length; j++) {
                    this.ram.Write8(address + ofs, argv[i].charCodeAt(j));
                    ofs++;
                }
                ofs++; // terminating "\0"
            }

            this.ram.Write32(addr, 0);
            break;

        default:
            message.Debug("unkown SysCall "+utils.ToHex(syscall_id)+" at PC "+utils.ToHex(this.pc));
            message.Abort();
           break;
    }

};

SysCalls.prototype.OnFileLoaded = function(buffer) {
    var buffer8 = new Uint8Array(buffer);
    var length = buffer8.length;
message.Debug("On File Loaded " + length);
    for(var i=0; i<length; i++) this.elf8mem[i+this.elf8mem_offset] = buffer8[i];
    this.file_descriptor_table[++this.file_descriptor_offset] = this.elf8mem_offset;
    this.elf8mem_offset += length;
    this.file_size[this.file_descriptor_offset] = length;
    this.file_pointer[this.file_descriptor_offset] = 0;
    
};

module.exports = SysCalls;

},{"../messagehandler":43,"../utils":58}],56:[function(require,module,exports){
// -------------------------------------------------
// ------------------- SYSTEM ----------------------
// -------------------------------------------------

"use strict";
// common
var message = require('./messagehandler'); // global variable
var utils = require('./utils');
var RAM = require('./ram');
var bzip2 = require('./bzip2');
var elf = require('./elf');
var Timer = require('./timer');
var HTIF = require('./riscv/htif');

// CPU
var OR1KCPU = require('./or1k');
var RISCVCPU = require('./riscv');

// Devices
var UARTDev = require('./dev/uart');
var IRQDev = require('./dev/irq');
var TimerDev = require('./dev/timer');
var FBDev = require('./dev/framebuffer');
var EthDev = require('./dev/ethmac');
var ATADev = require('./dev/ata');
var RTCDev = require('./dev/rtc');
var TouchscreenDev = require('./dev/touchscreen');
var KeyboardDev = require('./dev/keyboard');
var SoundDev = require('./dev/sound');
var VirtIODev = require('./dev/virtio');
var Virtio9p = require('./dev/virtio/9p');
var VirtioDummy = require('./dev/virtio/dummy');
var VirtioInput = require('./dev/virtio/input');
var VirtioNET = require('./dev/virtio/net');
var VirtioBlock = require('./dev/virtio/block');
var VirtioGPU = require('./dev/virtio/gpu');
var VirtioConsole = require('./dev/virtio/console');
var FS = require('./filesystem/filesystem');

/* 
    Heap Layout
    ===========
    The heap is needed by the asm.js CPU. 
    For compatibility all CPUs use the same layout
    by using the different views of typed arrays

    ------ Core 1 ------
    0x0     -  0x7F     32 CPU registers 
    0x80    -  0x1FFF   CPU specific, usually unused or temporary data
    0x2000  -  0x3FFF   group 0 (system control and status)
    0x4000  -  0x5FFF   group 1 (data MMU)
    0x6000  -  0x7FFF   group 2 (instruction MMU)
    ------ Core 2 ------
    0x8000  -  0x807F   32 CPU registers
    0x8080  -  0x9FFF   CPU specific, usually unused or temporary data
    0xA000  -  0xBFFF   group 0 (system control and status)
    0xC000  -  0xDFFF   group 1 (data MMU)
    0xE000  -  0xFFFF   group 2 (instruction MMU)
    ------ Core 3 ------
    ...
    ------- RAM --------
    0x100000 -  ...     RAM
*/


var SYSTEM_RUN = 0x1;
var SYSTEM_STOP = 0x2;
var SYSTEM_HALT = 0x3; // Idle

function System() {
    // the Init function is called by the master thread.
    message.Register("LoadAndStart", this.LoadImageAndStart.bind(this) );
    message.Register("execute", this.MainLoop.bind(this));
    message.Register("Init", this.Init.bind(this) );
    message.Register("Reset", this.Reset.bind(this) );
    message.Register("ChangeCore", this.ChangeCPU.bind(this) );
    message.Register("PrintOnAbort", this.PrintState.bind(this) );

    message.Register("GetIPS", function(data) {
        message.Send("GetIPS", this.ips);
        this.ips=0;
    }.bind(this));
}

System.prototype.CreateCPU = function(cpuname, arch) {
    try {
        if (arch == "or1k") {
            this.cpu = new OR1KCPU(cpuname, this.ram, this.heap, this.ncores);
        } else
        if (arch == "riscv") {
            this.cpu = new RISCVCPU(cpuname, this.ram, this.htif, this.heap, this.ncores);
        } else
            throw "Architecture " + arch + " not supported";
    } catch (e) {
        message.Debug("Error: failed to create CPU:" + e);
    }
};


System.prototype.ChangeCPU = function(cpuname) {
    this.cpu.switchImplementation(cpuname);
};

System.prototype.Reset = function() {
    this.status = SYSTEM_STOP;
    
    for(var i=0; i<this.devices.length; i++) {
        this.devices[i].Reset();
    }

    this.ips = 0;
};

System.prototype.Init = function(system) {
    this.status = SYSTEM_STOP;
    this.memorysize = system.memorysize;

    this.ncores = system.ncores;
    if (!system.ncores) system.ncores = 1;

    // this must be a power of two.
    var ramoffset = 0x100000;
    this.heap = new ArrayBuffer(this.memorysize*0x100000); 
    this.memorysize--; // - the lower 1 MB are used for the cpu cores
    this.ram = new RAM(this.heap, ramoffset);

    if (system.arch == "riscv") {
        this.htif = new HTIF(this.ram, this);
    }

    this.CreateCPU(system.cpu, system.arch);

    this.devices = [];
    this.devices.push(this.cpu);

    if (system.arch == "or1k") {

        this.irqdev = new IRQDev(this);
        this.timerdev = new TimerDev();
        this.uartdev0 = new UARTDev(0, this, 0x2);
        this.uartdev1 = new UARTDev(1, this, 0x3);
        this.ethdev = new EthDev(this.ram, this);
        this.ethdev.TransmitCallback = function(data){
            message.Send("ethmac", data);
        };

        this.fbdev = new FBDev(this.ram);
        this.atadev = new ATADev(this);
        this.tsdev = new TouchscreenDev(this);
        this.kbddev = new KeyboardDev(this);
        this.snddev = new SoundDev(this, this.ram);
        this.rtcdev = new RTCDev(this);

        this.filesystem = new FS();
        this.virtio9pdev = new Virtio9p(this.ram, this.filesystem);
        this.virtiodev1 = new VirtIODev(this, 0x6, this.ram, this.virtio9pdev);
        this.virtioinputdev = new VirtioInput(this.ram);
        this.virtionetdev = new VirtioNET(this.ram);
        this.virtioblockdev = new VirtioBlock(this.ram);
        this.virtiodummydev = new VirtioDummy(this.ram);
        this.virtiogpudev = new VirtioGPU(this.ram);
        this.virtioconsoledev = new VirtioConsole(this.ram);
        this.virtiodev2 = new VirtIODev(this, 0xB, this.ram, this.virtiodummydev);
        this.virtiodev3 = new VirtIODev(this, 0xC, this.ram, this.virtiodummydev);

        this.devices.push(this.irqdev);
        this.devices.push(this.timerdev);
        this.devices.push(this.uartdev0);
        this.devices.push(this.uartdev1);
        this.devices.push(this.ethdev);
        this.devices.push(this.fbdev);
        this.devices.push(this.atadev);
        this.devices.push(this.tsdev);
        this.devices.push(this.kbddev);
        this.devices.push(this.snddev);
        this.devices.push(this.rtcdev);
        this.devices.push(this.virtio9pdev);
        this.devices.push(this.virtiodev1);
        this.devices.push(this.virtiodev2);
        this.devices.push(this.virtiodev3);

        this.devices.push(this.virtioinputdev);
        this.devices.push(this.virtionetdev);
        this.devices.push(this.virtioblockdev);
        this.devices.push(this.virtiodummydev);
        this.devices.push(this.virtiogpudev);
        this.devices.push(this.virtioconsoledev);

        this.ram.AddDevice(this.uartdev0,   0x90000000, 0x7);
        this.ram.AddDevice(this.fbdev,      0x91000000, 0x1000);
        this.ram.AddDevice(this.ethdev,     0x92000000, 0x1000);
        this.ram.AddDevice(this.tsdev,      0x93000000, 0x1000);
        this.ram.AddDevice(this.kbddev,     0x94000000, 0x100);
        this.ram.AddDevice(this.uartdev1,   0x96000000, 0x7);
        this.ram.AddDevice(this.virtiodev1, 0x97000000, 0x1000);
        this.ram.AddDevice(this.snddev,     0x98000000, 0x400);
        this.ram.AddDevice(this.rtcdev,     0x99000000, 0x1000);
        this.ram.AddDevice(this.irqdev,     0x9A000000, 0x1000);
        this.ram.AddDevice(this.timerdev,   0x9B000000, 0x1000);
        this.ram.AddDevice(this.virtiodev2, 0x9C000000, 0x1000);
        this.ram.AddDevice(this.virtiodev3, 0x9D000000, 0x1000);
        this.ram.AddDevice(this.atadev,     0x9E000000, 0x1000);
    } else 
    if (system.arch == "riscv") {
        // at the moment the htif interface is part of the CPU initialization.
        // However, it uses uartdev0
        this.uartdev0 = new UARTDev(0, this, 0x2);
        this.devices.push(this.uartdev0);
        this.ram.AddDevice(this.uartdev0,   0x90000000, 0x7);
    }

    this.ips = 0; // external instruction per second counter
    this.idletime = 0; // start time of the idle routine
    this.idlemaxwait = 0; // maximum waiting time in cycles

    // constants
    this.ticksperms = 20000; // 20 MHz
    this.loopspersecond = 100; // main loops per second, to keep the system responsive

    this.timer = new Timer(this.ticksperms, this.loopspersecond);
};

System.prototype.RaiseInterrupt = function(line) {
    //message.Debug("Raise " + line);
    this.cpu.RaiseInterrupt(line, -1); // raise all cores
    if (this.status == SYSTEM_HALT)
    {
        this.status = SYSTEM_RUN;
        clearTimeout(this.idletimeouthandle);
        var delta = (utils.GetMilliseconds() - this.idletime) * this.ticksperms;
        if (delta > this.idlemaxwait) delta = this.idlemaxwait;
        this.cpu.ProgressTime(delta);
        this.MainLoop();
    }
};

System.prototype.ClearInterrupt = function (line) {
    this.cpu.ClearInterrupt(line, -1); // clear all cores
};

System.prototype.RaiseSoftInterrupt = function(line, cpuid) {
    // the cpu cannot be halted when this function is called, so skip this check
    this.cpu.RaiseInterrupt(line, cpuid);
};

System.prototype.ClearSoftInterrupt = function (line, cpuid) {
    this.cpu.ClearInterrupt(line, cpuid);
};

System.prototype.PrintState = function() {
    // Flush the buffer of the terminal
    this.uartdev0 && this.uartdev0.Step();
    this.uartdev1 && this.uartdev1.Step();
    message.Debug(this.cpu.toString());
};

System.prototype.SendStringToTerminal = function(str)
{
    var chars = [];
    for (var i = 0; i < str.length; i++) {
        chars.push(str.charCodeAt(i));
    }
    message.Send("tty0", chars);
};

System.prototype.LoadImageAndStart = function(url) {
    this.SendStringToTerminal("\r================================================================================");

    if (typeof url == 'string') {
        this.SendStringToTerminal("\r\nLoading kernel and hard and basic file system from web server. Please wait ...\r\n");
        utils.LoadBinaryResource(
            url, 
            this.OnKernelLoaded.bind(this), 
            function(error){throw error;}
        );
    } else {
        this.OnKernelLoaded(url);
    }

};

System.prototype.PatchKernel = function(length)
{
    var m = this.ram.uint8mem;
    // set the correct memory size
    for(var i=0; i<length; i++) { // search for the compiled dts file in the kernel
        if (m[i+0] === 0x6d) // find "memory\0"
        if (m[i+1] === 0x65)
        if (m[i+2] === 0x6d)
        if (m[i+3] === 0x6f)
        if (m[i+4] === 0x72)
        if (m[i+5] === 0x79)
        if (m[i+6] === 0x00) 
        if (m[i+24] === 0x01) 
        if (m[i+25] === 0xF0) 
        if (m[i+26] === 0x00) 
        if (m[i+27] === 0x00) {
            m[i+24] = (this.memorysize*0x100000)>>24;
            m[i+25] = (this.memorysize*0x100000)>>16;
            m[i+26] = 0x00;
            m[i+27] = 0x00;
        }
    }
};

System.prototype.OnKernelLoaded = function(buffer) {
    this.SendStringToTerminal("Decompressing kernel...\r\n");
    var buffer8 = new Uint8Array(buffer);
    var length = 0;

    if (elf.IsELF(buffer8)) {
        elf.Extract(buffer8, this.ram.uint8mem);
    } else 
    if (bzip2.IsBZIP2(buffer8)) {
        bzip2.simple(buffer8, function(x){this.ram.uint8mem[length++] = x;}.bind(this));
        if (elf.IsELF(this.ram.uint8mem)) {
            var temp = new Uint8Array(length);
            for(var i=0; i<length; i++) {
                temp[i] = this.ram.uint8mem[i];
            }
            elf.Extract(temp, this.ram.uint8mem);
        }
    } else {
        length = buffer8.length;
        for(var i=0; i<length; i++) this.ram.uint8mem[i] = buffer8[i];
    }
    this.PatchKernel(length);
    if (this.cpu.littleendian == false) {
        this.ram.Little2Big(length);
    }
    message.Debug("Kernel loaded: " + length + " bytes");
    this.SendStringToTerminal("Booting\r\n");
    this.SendStringToTerminal("================================================================================");
    // we can start the boot process already, even if the filesystem is not yet ready

    this.cpu.Reset();
    this.cpu.AnalyzeImage();
    message.Debug("Starting emulation");
    this.status = SYSTEM_RUN;

    message.Send("execute", 0);
};

// the kernel has sent a halt signal, so stop everything until the next interrupt is raised
System.prototype.HandleHalt = function() {
    var delta = this.cpu.GetTimeToNextInterrupt();
    if (delta == -1) return;
        this.idlemaxwait = delta;
        var mswait = Math.floor(delta / this.ticksperms / this.timer.correction + 0.5);
        //message.Debug("wait " + mswait);
        
        if (mswait <= 1) return;
        if (mswait > 1000) message.Debug("Warning: idle for " + mswait + "ms");
        this.idletime = utils.GetMilliseconds();
        this.status = SYSTEM_HALT;
        this.idletimeouthandle = setTimeout(function() {
            if (this.status == SYSTEM_HALT) {
                this.status = SYSTEM_RUN;
                this.cpu.ProgressTime(delta);
                //this.snddev.Progress();
                this.MainLoop();
            }
        }.bind(this), mswait);
};

System.prototype.MainLoop = function() {
    if (this.status != SYSTEM_RUN) return;
    message.Send("execute", 0);

    // execute the cpu loop for "instructionsperloop" instructions.
    var stepsleft = this.cpu.Step(this.timer.instructionsperloop, this.timer.timercyclesperinstruction);
    //message.Debug(stepsleft);
    var totalsteps = this.timer.instructionsperloop - stepsleft;
    totalsteps++; // at least one instruction
    this.ips += totalsteps;

    this.uartdev0 && this.uartdev0.Step();
    this.uartdev1 && this.uartdev1.Step();
    //this.snddev.Progress();

    // stepsleft != 0 indicates CPU idle
    var gotoidle = stepsleft?true:false;

    this.timer.Update(totalsteps, this.cpu.GetTicks(), gotoidle);

    if (gotoidle) {
        this.HandleHalt(); 
    }

    // go to worker thread idle state that onmessage is executed
};

module.exports = System;

},{"./bzip2":17,"./dev/ata":18,"./dev/ethmac":19,"./dev/framebuffer":20,"./dev/irq":21,"./dev/keyboard":22,"./dev/rtc":23,"./dev/sound":24,"./dev/timer":25,"./dev/touchscreen":26,"./dev/uart":27,"./dev/virtio":28,"./dev/virtio/9p":29,"./dev/virtio/block":30,"./dev/virtio/console":31,"./dev/virtio/dummy":32,"./dev/virtio/gpu":33,"./dev/virtio/input":34,"./dev/virtio/net":36,"./elf":37,"./filesystem/filesystem":38,"./messagehandler":43,"./or1k":45,"./ram":48,"./riscv":53,"./riscv/htif":52,"./timer":57,"./utils":58}],57:[function(require,module,exports){
// -------------------------------------------------
// ------------------- TIMER -----------------------
// -------------------------------------------------

// helper function for correct timing

"use strict";

var message = require('./messagehandler'); // global variable
var utils = require('./utils');

function Timer(_ticksperms, _loopspersecond) {
    // constants
    this.ticksperms = _ticksperms;
    this.loopspersecond = _loopspersecond;

    // global synchronization variables
    this.baserealtime = 0.; // real time when the timer was started
    this.realtime = 0.; // time passed in real in ms
    this.lastsystemticks = 0.; // temp variable to calculate the correct systemtime
    this.systemtime = 0. // time passed in the system in ms
    this.correction = 1.; // return value
    this.oldcorrection = 1.;
    this.steps = 0;

    // short time synchronization
    this.nins = 0;
    this.lastlooptime = -1; // last time the loop was executed in ms, without idle in between

    this.ipms = 5000; // initial guess for: 5 MIPS
    this.instructionsperloop = 0;  // return value
    this.timercyclesperinstruction = 10; // return value
    this.UpdateTimings();
}


// nins: instructions executed in last loop
// ticks: The current value of the TTCR register
// gotoidle: bool if the cpu is gone to idle mode
Timer.prototype.Update = function(nins, ticks, gotoidle) {

    this.GlobalUpdate(ticks);
    this.LocalUpdate(nins, gotoidle);
}


Timer.prototype.UpdateTimings = function(_nins, gotoidle) {
    this.instructionsperloop = Math.floor(this.ipms*1000. / this.loopspersecond);
    this.instructionsperloop = this.instructionsperloop<2000?2000:this.instructionsperloop;
    this.instructionsperloop = this.instructionsperloop>4000000?4000000:this.instructionsperloop;

    this.timercyclesperinstruction = Math.floor(this.ticksperms * 64 / this.ipms * this.correction);
    this.timercyclesperinstruction = this.timercyclesperinstruction<=1?1:this.timercyclesperinstruction;
    this.timercyclesperinstruction = this.timercyclesperinstruction>=1000?1000:this.timercyclesperinstruction;
}


Timer.prototype.LocalUpdate = function(_nins, gotoidle) {

    this.nins += _nins;
    if (gotoidle) {
        // reset the whole routine
        this.lastlooptime = -1;
        this.nins = 0;
        return;
    }

    // recalibrate timer
    if (this.lastlooptime < 0) {
        this.lastlooptime = utils.GetMilliseconds();
        this.nins = 0;
        return; // don't calibrate, because we don't have the data
    }
    var delta = utils.GetMilliseconds() - this.lastlooptime;
    if (delta > 50 && this.nins > 2000) // we need statistics for calibration
    {
        this.ipms = this.nins / delta; // ipms (per millisecond) of current run
        this.UpdateTimings();

        //reset the integration parameters
        this.lastlooptime = utils.GetMilliseconds();
        this.nins = 0;
    }    
}


Timer.prototype.GlobalUpdate = function(ticks) {

    // global time handling
    if (ticks < 0) return; // timer hasn't started yet
    
    ticks = ticks / this.ticksperms; // ticks in ms

    // ---------------
    // update realtime
    // ---------------
    if (this.baserealtime <= 0) this.baserealtime = utils.GetMilliseconds();
    this.realtime = utils.GetMilliseconds() - this.baserealtime;
        
    // -----------------
    // update systemtime (time in emulator)
    // -----------------
    if (this.lastsystemticks > ticks) {
        this.systemtime += ticks - this.lastsystemticks + (0x10000000/this.ticksperms);
    } else {
        this.systemtime += ticks - this.lastsystemticks;
    }
    this.lastsystemticks = ticks;

    // -----------------

    var deltaabs = Math.abs(this.systemtime-this.realtime);

    if (deltaabs > 500) {
        // we are too far off, so do a reset of the timers
        this.baserealtime = utils.GetMilliseconds();
        this.systemtime = 0.;
        this.lastsystemticks = 0.;
    }

    // calculate a correction value for the timers
    this.correction = 1.;
    if (this.systemtime > (this.realtime+50)) this.correction = 0.9; // too fast
    if (this.realtime > (this.systemtime+50)) this.correction = 1.1; // too slow
    if (deltaabs > 200) this.correction = this.correction*this.correction;
    if (deltaabs > 400) this.correction = this.correction*this.correction;

    if (this.oldcorrection != this.correction) {
        this.UpdateTimings();
        this.oldcorrection = this.correction;
    }

    //this.steps++;
    //if ((this.steps&63) == 0) message.Debug(this.systemtime-this.realtime);
}


module.exports = Timer;

},{"./messagehandler":43,"./utils":58}],58:[function(require,module,exports){
// -------------------------------------------------
// ------------------ Utils ------------------------
// -------------------------------------------------

function GetMilliseconds() {
    return (new Date()).getTime();
}

// big endian to little endian and vice versa
function Swap32(val) {
    return ((val & 0xFF) << 24) | ((val & 0xFF00) << 8) | ((val >>> 8) & 0xFF00) | ((val >>> 24) & 0xFF);
}

function Swap16(val) {
    return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
}

// cast an integer to a signed integer
function int32(val) {
    return (val >> 0);
}

// cast an integer to a unsigned integer
function uint32(val) {
    return (val >>> 0);
}

function ToHex(x) {
    var val = uint32(x);
    return ("0x" + ("00000000" + val.toString(16)).substr(-8).toUpperCase());
}

function ToBin(x) {
    var val = uint32(x);
    var s = ("00000000000000000000000000000000" + val.toString(2)).substr(-32) + "b";
    return s.replace(/./g, function (v, i) {return ((i&3)==3)?v + " ": v;});
}

function CopyBinary(to, from, size, buffersrc, bufferdest) {
    var i = 0;
    for (i = 0; i < size; i++) {
        bufferdest[to + i] = buffersrc[from + i];
    }
}

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
        var arrayBuffer = req.response;
        if (arrayBuffer) {
            OnSuccess(arrayBuffer);
        } else {
            OnError("Error: No data received from: " + url);
        }
    };
    req.send(null);
}

function LoadBinaryResourceII(url, OnSuccess, NonBlocking, OnError) {
    var req = new XMLHttpRequest();
    // open might fail, when we try to open an unsecure address, when the main page is secure
    try {
        req.open('GET', url, NonBlocking);
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
        var arrayBuffer = req.response;
        if (arrayBuffer) {
            OnSuccess(arrayBuffer);
        } else {
            OnError("Error: No data received from: " + url);
        }
    };
    req.send(null);
}

function LoadTextResource(url, OnSuccess, OnError) {
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    //req.overrideMimeType('text/xml');
    req.onreadystatechange = function () {
        if (req.readyState != 4) {
            return;
        }
        if ((req.status != 200) && (req.status != 0)) {
            OnError("Error: Could not load text file " + url);
            return;
        }
        OnSuccess(req.responseText);
    };
    req.send(null);
}

function DownloadAllAsync(urls, OnSuccess, OnError) {
    var pending = urls.length;
    var result = [];
    if (pending === 0) {
        setTimeout(onsuccess.bind(null, result), 0);
        return;
    }
    urls.forEach(function(url, i)  {
        LoadBinaryResource(
            url, 
            function(buffer) {
                if (result) {
                    result[i] = buffer;
                    pending--;
                    if (pending === 0) {
                        OnSuccess(result);
                    }
                }
            }, 
            function(error) {
                if (result) {
                    result = null;
                    OnError(error);
                }
            }
        );
    });
}

function UploadBinaryResource(url, filename, data, OnSuccess, OnError) {

    var boundary = "xxxxxxxxx";

    var xhr = new XMLHttpRequest();
    xhr.open('post', url, true);
    xhr.setRequestHeader("Content-Type", "multipart/form-data, boundary=" + boundary);
    xhr.setRequestHeader("Content-Length", data.length);
    xhr.onreadystatechange = function () {
        if (req.readyState != 4) {
            return;
        }
        if ((req.status != 200) && (xhr.status != 0)) {
            OnError("Error: Could not upload file " + filename);
            return;
        }
        OnSuccess(this.responseText);
    };

    var bodyheader = "--" + boundary + "\r\n";
    bodyheader += 'Content-Disposition: form-data; name="uploaded"; filename="' + filename + '"\r\n';
    bodyheader += "Content-Type: application/octet-stream\r\n\r\n";

    var bodyfooter = "\r\n";
    bodyfooter += "--" + boundary + "--";

    var newdata = new Uint8Array(data.length + bodyheader.length + bodyfooter.length);
    var offset = 0;
    for(var i=0; i<bodyheader.length; i++)
        newdata[offset++] = bodyheader.charCodeAt(i);

    for(var i=0; i<data.length; i++)
        newdata[offset++] = data[i];


    for(var i=0; i<bodyfooter.length; i++)
        newdata[offset++] = bodyfooter.charCodeAt(i);

    xhr.send(newdata.buffer);
}

/*
function LoadBZIP2Resource(url, OnSuccess, OnError)
{
    var worker = new Worker('bzip2.js');
    worker.onmessage = function(e) {
        OnSuccess(e.data);
    }    
    worker.onerror = function(e) {
        OnError("Error at " + e.filename + ":" + e.lineno + ": " + e.message);
    }
    worker.postMessage(url);    
}
*/


module.exports.GetMilliseconds = GetMilliseconds;
module.exports.Swap32 = Swap32;
module.exports.Swap16 = Swap16;
module.exports.int32 = int32;
module.exports.uint32 = uint32;
module.exports.ToHex = ToHex;
module.exports.ToBin = ToBin;
module.exports.LoadBinaryResource = LoadBinaryResource;
module.exports.LoadBinaryResourceII = LoadBinaryResourceII;
module.exports.LoadTextResource = LoadTextResource;


},{}],59:[function(require,module,exports){
var shared = require('../lib/shared');
var Converter = shared.Converter;
var Buffer = require('buffer').Buffer;

var BufferConverter = new Converter({
	name: '__marshal_buffer',
	typeName: 'Buffer',
	serialize: function(obj) {
		return obj.toString();
	},
	deserialize: function(obj) {
		return new Buffer(obj);
	}
});
shared.AddConverter(BufferConverter);

exports.ReRegister = function() { shared.AddConverter(BufferConverter); };
exports.ReRegister();

},{"../lib/shared":65,"buffer":7}],60:[function(require,module,exports){
/**
 * Converts callbacks into marshallable data
 */

var shared = require('../lib/shared');
var Converter = shared.Converter;

var _callback_counter = 0;
var _callbacks = {};

var _do_not_clear_list = {};
var _do_not_clear = false;

function Callback(cb) {
	this.id = ++_callback_counter;
	this.cb = cb;
	_callbacks[this.id] = this.cb;
	if(_do_not_clear)
		_do_not_clear_list[this.id] = true;
}

exports.Callback = Callback;

var CallbackConverter = new Converter({
	name: '__marshal_callback',
	typeName: 'Function',
	serialize: function(fun) {
		var cb = new Callback(fun);
		return {id: cb.id};
	},
	deserialize: function(obj) {
		var cb = _callbacks[obj.id];
		return cb;
	}
});

exports.CallbackConverter = CallbackConverter;
shared.AddConverter(CallbackConverter);

exports.ReRegister = function() { shared.AddConverter(CallbackConverter); };
exports.ReRegister();

exports.GetCallback = function(id) {
	return _callbacks[id];
};

exports.ClearCallback = function(id) {
	if(!_do_not_clear_list[id])
		delete _callbacks[id];
};

exports.SetDoNotClear = function(should_do_not_clear) {
	_do_not_clear = should_do_not_clear;
};

},{"../lib/shared":65}],61:[function(require,module,exports){
var server = require('./lib/server');
var client = require('./lib/client');
var shared = require('./lib/shared');

exports.Server = server;
exports.Client = client;
exports.Shared = shared;

},{"./lib/client":62,"./lib/server":63,"./lib/shared":65}],62:[function(require,module,exports){
var Buffer = require('buffer').Buffer;
var shared = require('./shared');

var callback = require('../conv/callback');

var client_onmessage = function(event) {
	try {
		var response = JSON.parse(event.data);
		if(response.marshal)
			return handleClientMessage(response.marshal);
	} catch (e) {
		console.log("Error: " + utils.inspect(e));
		console.log(e.stack);
	}
	console.log("Client can't handle: " + event.data);
};
var client_onerror = function(data) {
	console.log("(worker) Error: ", data);
};

function handleClientMessage(response) {
	if(response['callbackResponse']) {
		var id = response['callbackResponse'].id;
		var cb = callback.GetCallback(id);
		if(!cb) {
			console.log("Error, callback " + id + " not found");
			return;
		}
		var ourArgs = [];
		var thierArgs = response['callbackResponse'].args;
		if(thierArgs) {
			for(var i = 0; i < thierArgs.length; i++) {
				var arg = thierArgs[i];
				ourArgs.push(shared.Deserialize(arg));
			}
		} else {
			ourArgs = thierArgs;
		}
		cb.apply(cb, ourArgs);
		shared.ClearCallback(id);
		return;
	} else if(response['marshalResult']) {
		var id = response['marshalResult'].request_id;
		//console.log("Marshal response id: ", id);
		var result = response['marshalResult'].result;
		if(result) {
			result = shared.Deserialize(result);
		}
		var cb = marshalRequestCallbacks[id];
		if(cb) {
			cb.call(cb, result);
			delete marshalRequestCallbacks[id];
		}
		else
			false&&console.log("There was no callback registered (async?)");
		return;
	}
}

var marshalRequestIds = 0;
var marshalRequestCallbacks = {};
function marshalRequest(r) {
	// Parse arguments
	var ourArgs = [];
	for(var i = 0; i < r.arguments.length; i++) {
		var arg = r.arguments[i];
		ourArgs.push(shared.Serialize(arg));
	}
	var oldArgs = r.arguments;
	r.arguments = ourArgs;
	r.request_id = ++marshalRequestIds;
	marshalRequestCallbacks[r.request_id] = r.callback;
	var rSerialized = JSON.stringify({marshal: r});
	r.arguments = oldArgs;
	//console.log("(Client) Serialized request: ", rSerialized);

//console.log("postMessage is", postMessage.toString());
	postMessage(rSerialized);
	//console.log("Back from postMessage");
}

exports.marshalRequest = marshalRequest;
exports.handleClientMessage = handleClientMessage;
exports.enableMessageHandlers = function() {
	onmessage = client_onmessage;
	onerror = client_onerror;
};
exports.client_onmessage = client_onmessage;
exports.client_onerror   = client_onerror;

// Include additional functionality
var timers = require('./timers');

},{"../conv/callback":60,"./shared":65,"./timers":66,"buffer":7}],63:[function(require,module,exports){
(function (global){
var util = require('util');
var shared = require('./shared');
var server_timers = require('./server_timers');

var CallbackConverter = require('../conv/callback').CallbackConverter;

var worker;

function handleMarshalRequest(r)
{
	//console.log("Handle request: ", r);
	var module = r.module;
	if(module == 'global')
		module = global;
	else if(global[module])
		module = global[module];
	else if(module == './server_timers')
		module = server_timers;
	else
		module = require(r.module);
	if(!module || !module[r.function]) {
		throw "marshalRequest: unable to satisfy";
	}
	// Place our own callback args in here
	var ourArgs = [];
	for(var i = 0; i < r.arguments.length; i++) {
		var arg = r.arguments[i];
		ourArgs.push(shared.Deserialize(arg));
	}
	//console.log("Calling " + r.module + "." + r.function + "(" + ourArgs.join(', ') + ")");
	var result;
	try {
		result = module[r.function].apply(module, ourArgs);
	} catch (e) {
		console.log("(SERVER) Error in marshalled call: ", e);
		return;
	}
	//console.log("Result: " + util.inspect(result));
	handleMarshalResult(r, result);
}

function handleMarshalCallback(id, args) {
	var ourArgs = [];
	for(var i = 0; i < args.length; i++) {
		ourArgs.push(shared.Serialize(args[i]));
	}
	var response = {
		callbackResponse: {
			id: id,
			args: ourArgs
		}
	};
	var rSerialized = JSON.stringify({marshal: response});
	//console.log("Posting back: " + rSerialized);
	worker.postMessage(rSerialized);
}

function handleMarshalResult(r, result) {
	var resultObj = result;
	var response = {
		marshalResult: {
			request_id: r.request_id,
			result: shared.Serialize(resultObj)
		}
	};
	//console.log("Attempting to marshal: " + util.inspect(response));
	var rSerialized = JSON.stringify({marshal: response});
	//console.log("Posting back: " + rSerialized);
	worker.postMessage(rSerialized);
}

function CallbackConverterOverride (obj) {
	// Here we create our own function that calls handleMarshalCallback
	return (function(id) {
		return function() {
			//console.log("CallbackConverter(modified).deserialize!");
			var args = Array.prototype.slice.call(arguments);
			handleMarshalCallback(id, args);
		};
	})(obj.id);
};

function Init () {
	// Modify the Callback Converter
	CallbackConverter.deserialize = CallbackConverterOverride;
}

exports.Init = Init;
exports.handleMarshalRequest = handleMarshalRequest;
exports.handleMarshalCallback = handleMarshalCallback;
exports.handleMarshalResult = handleMarshalResult;
exports.CallbackConverterOverride = CallbackConverterOverride;
exports.SetWorker = function(w) {
	worker = w;
};


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../conv/callback":60,"./server_timers":64,"./shared":65,"util":89}],64:[function(require,module,exports){
//var server = require('./server');

var timeout_id = 0;
var timeout_ids = {};

var interval_id = 0;
var interval_ids = {};

exports.setTimeout = function(callback, timeout, args) {
	return (function() {
		var id = ++timeout_id;
		var our_callback = function() {
			console.log("(Server Timers) Timeout triggered: " + id);
			exports.clearTimeout(id);
			callback.apply(this, arguments);
		};
		timeout_ids[id] = setTimeout(our_callback, timeout, args);
		return id;
	})();
};

exports.clearTimeout = function(id) {
	if(!timeout_ids[id]) {
		console.log("(Server Timers) Failed to find timeout to clear: " + id);
		return;
	}
	var timer = timeout_ids[id];
	delete timeout_ids[id];
	console.log("Clearing timeout: " + id);
	return clearTimeout(timer);
};

exports.setInterval = function(callback, timeout, args) {
	var id = ++interval_id;
	interval_ids[id] = setInterval(callback, timeout, args);
	//console.log("Intervals: ", interval_ids);
	return id;
};

exports.clearInterval = function(id) {
	if(!interval_ids[id]) {
		console.log("(Server Timers) Failed to find interval to clear: " + id);
		console.log("Intervals: ", interval_ids);
		return;
	}
	var timer = interval_ids[id];
	delete interval_ids[id];
	//console.log("(Server Timers) Clearing interval " + id);
	return clearInterval(timer);
};

},{}],65:[function(require,module,exports){
/**
 * Shared functions for both server and client.
 */

var registeredConverters = {};

var MARSHAL_TYPE = '__marshal__type';
var MARSHAL_CONTENT = '__marshal__content';

var verbose = false;

function verb(/* arguments */) {
	if(verbose)
		console.log.apply(console, arguments);
}

function Converter (name, typeName, serialize, deserialize) {
	if (typeof name == "object") {
		typeName = name.typeName;
		serialize = name.serialize;
		deserialize = name.deserialize;
		name = name.name;
	}
	this.name = name;
	this.typeName = typeName;
	this.serialize = serialize;
	this.deserialize = deserialize;
}
Converter.prototype.Serialize = function(obj) {
	return this.serialize(obj);
};
Converter.prototype.Deserialize = function(content) {
	return this.deserialize(content);
}

function Serialize (obj) {
	if(obj === null) return null;
	if(obj === undefined) return undefined;

	var typeName = obj.constructor.name;
	verb("(Serialize) typeName: " + typeName);
	if(!registeredConverters[typeName]) {
		// No converter exists
		return obj;
	}
	var result = {};
	result[MARSHAL_TYPE] = typeName;
	result[MARSHAL_CONTENT] = registeredConverters[typeName].Serialize(obj);
	return result;
}

function Deserialize (obj) {
	if(obj === null) return null;
	if(obj === undefined) return undefined;

	var typeName = obj[MARSHAL_TYPE];
	//console.log("Deserialize " + (typeName ? typeName : typeof obj));
	if(!registeredConverters[typeName]) {
		// No converter exists
		return obj;
	}
	return registeredConverters[typeName].Deserialize(obj[MARSHAL_CONTENT]);
}

function AddConverter(converter) {
	if(false&&registeredConverters[converter.typeName]) {
		console.log("WARN: overwriting converter: " + converter.typeName);
	}
	registeredConverters[converter.typeName] = converter;
	verb("Registered converter: " + converter.name);
}

exports.MARSHAL_TYPE = MARSHAL_TYPE;
exports.MARSHAL_CONTENT = MARSHAL_CONTENT;
exports.verbose = function(value) {
	if(value === undefined) return verbose;
	return verbose = value;
};
exports.Converter = Converter;
exports.Serialize = Serialize;
exports.Deserialize = Deserialize;
exports.AddConverter = AddConverter;

var conv_callback = require('../conv/callback');
var conv_buffer   = require('../conv/buffer');

exports.ClearCallback = conv_callback.ClearCallback;

},{"../conv/buffer":59,"../conv/callback":60}],66:[function(require,module,exports){
(function (global){
// Provide marshalled versions of:
//   setTimeout and clearTimeout
//   setInterval and clearInterval.

var shared = require('./shared');
var client = require('./client');
var conv_callback = require('../conv/callback');

var timeout_id = 0;
var timeout_ids = {};
var interval_id = 0;
var interval_ids = {};

var module = './server_timers';
//module = 'global';

console.log("(Client) Setting up timer functions");

if(!global.clearTimeout)
global.clearTimeout = function(id) {
	var real_id = timeout_ids[id];
	if(!id) {
		console.log("(Client) Failed to find timeout to remove: " + id);
		return;
	}
	if(real_id === 'pending') {
		console.log("(Client) Don't have timeout id yet for " + id);
		return;
	}
	delete timeout_ids[id];
	console.log("(Client) Clearing timeout " + id + " (real: " + real_id + ")");
	var request = {
		module: module, function: 'clearTimeout',
		arguments: [our_callback, timeout, args]
	};
	client.marshalRequest( request );
};

if(!global.setTimeout)
global.setTimeout = function(_callback, _timeout, _args) {
	try{
	//console.log("Setting up timeout");
	return (function(callback, timeout, args) {
		var id = ++timeout_id;
		var our_callback = function() {
			console.log("(Client) Timeout calling, clearing id " + id);
			if(!timeout_ids[id] || timeout_ids[id] == 'pending') {
				console.log("(Client) Timeout would have fired, but its removed");
				delete timeout_ids[id];
				return;
			}
			delete timeout_ids[id];
			try {
				callback.apply(this, args);
			} catch (e) {
				console.log("(Client) Error in timeout: ", e);
			}
		};
		var request = {
			module: module, function: 'setTimeout',
			arguments: [our_callback, timeout, args],
			callback: function(real_id) {
				console.log("(Client) got setTimeout id: " + real_id);
				timeout_ids[id] = real_id;
			}
		};
		timeout_ids[id] = 'pending';
		//console.log("marshal: ", request);
		client.marshalRequest( request );
		return id;
	})(_callback, _timeout, _args);
	} catch (e) {
		console.log("setTimeout error", e);
	}
};

if(!global.clearInterval)
global.clearInterval = function(id) {
	var real_id = interval_ids[id];
	if(!id) {
		console.log("(Client) Failed to find timeout to remove: " + id);
		return;
	}
	delete interval_ids[id];
	if(real_id === null) {
		console.log("(Client) Don't have timeout id yet for " + id);
		return;
	}
	var request = {
		module: module, function: 'clearInterval',
		arguments: [id]
	};
	//console.log(request);
	client.marshalRequest( request );
}

if(!global.setInterval)
global.setInterval = function(_callback, _timeout, _args) {
	return (function(callback, timeout, args) {
		var id = ++interval_id;
		var our_callback = function() {
			//console.log("(Client) Interval calling");
			callback.apply(this, args);
		};
		var request = {
			module: module, function: 'setInterval',
			arguments: [our_callback, timeout, args],
			callback: function(real_id) {
				//console.log("(Client) got setInterval id: " + real_id);
				interval_ids[id] = real_id;
			}
		};
		interval_ids[id] = null;
		//console.log("marshal: ", request);
		// Special case: do not clear this callback.
		// Will result in memory leaks, but presently no other way to avoid
		// deleting the callback.
		conv_callback.SetDoNotClear(true);
		client.marshalRequest( request );
		conv_callback.SetDoNotClear(false);
		return id;
	})(_callback, _timeout, _args);
};


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../conv/callback":60,"./client":62,"./shared":65}],67:[function(require,module,exports){
(function (process){
'use strict';

if (!process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = nextTick;
} else {
  module.exports = process.nextTick;
}

function nextTick(fn, arg1, arg2, arg3) {
  if (typeof fn !== 'function') {
    throw new TypeError('"callback" argument must be a function');
  }
  var len = arguments.length;
  var args, i;
  switch (len) {
  case 0:
  case 1:
    return process.nextTick(fn);
  case 2:
    return process.nextTick(function afterTickOne() {
      fn.call(null, arg1);
    });
  case 3:
    return process.nextTick(function afterTickTwo() {
      fn.call(null, arg1, arg2);
    });
  case 4:
    return process.nextTick(function afterTickThree() {
      fn.call(null, arg1, arg2, arg3);
    });
  default:
    args = new Array(len - 1);
    i = 0;
    while (i < args.length) {
      args[i++] = arguments[i];
    }
    return process.nextTick(function afterTick() {
      fn.apply(null, args);
    });
  }
}

}).call(this,require('_process'))
},{"_process":68}],68:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],69:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.4.1 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.4.1',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],70:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],71:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],72:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":70,"./encode":71}],73:[function(require,module,exports){
// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }return keys;
};
/*</replacement>*/

module.exports = Duplex;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

var keys = objectKeys(Writable.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
}

function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false) this.readable = false;

  if (options && options.writable === false) this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  processNextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}
},{"./_stream_readable":75,"./_stream_writable":77,"core-util-is":9,"inherits":13,"process-nextick-args":67}],74:[function(require,module,exports){
// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};
},{"./_stream_transform":76,"core-util-is":9,"inherits":13}],75:[function(require,module,exports){
(function (process){
'use strict';

module.exports = Readable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/

Readable.ReadableState = ReadableState;

/*<replacement>*/
var EE = require('events').EventEmitter;

var EElistenerCount = function (emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/
var Stream;
(function () {
  try {
    Stream = require('st' + 'ream');
  } catch (_) {} finally {
    if (!Stream) Stream = require('events').EventEmitter;
  }
})();
/*</replacement>*/

var Buffer = require('buffer').Buffer;
/*<replacement>*/
var bufferShim = require('buffer-shims');
/*</replacement>*/

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var debugUtil = require('util');
var debug = void 0;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

var hasPrependListener = typeof EE.prototype.prependListener === 'function';

function prependListener(emitter, event, fn) {
  if (hasPrependListener) return emitter.prependListener(event, fn);

  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS. This is here
  // only because this code needs to continue to work with older versions
  // of Node.js that do not include the prependListener() method. The goal
  // is to eventually remove this hack.
  if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
}

var Duplex;
function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~ ~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

var Duplex;
function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable)) return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options && typeof options.read === 'function') this._read = options.read;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;

  if (!state.objectMode && typeof chunk === 'string') {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = bufferShim.from(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function (chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var _e = new Error('stream.unshift() after end event');
      stream.emit('error', _e);
    } else {
      var skipAdd;
      if (state.decoder && !addToFront && !encoding) {
        chunk = state.decoder.write(chunk);
        skipAdd = !state.objectMode && chunk.length === 0;
      }

      if (!addToFront) state.reading = false;

      // Don't add to the buffer if we've decoded to an empty string chunk and
      // we're not in object mode
      if (!skipAdd) {
        // if we want the data now, just emit it.
        if (state.flowing && state.length === 0 && !state.sync) {
          stream.emit('data', chunk);
          stream.read(0);
        } else {
          // update the buffer info.
          state.length += state.objectMode ? 1 : chunk.length;
          if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

          if (state.needReadable) emitReadable(stream);
        }
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}

// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended) return 0;

  if (state.objectMode) return n === 0 ? 0 : 1;

  if (n === null || isNaN(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length) return state.buffer[0].length;else return state.length;
  }

  if (n <= 0) return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else {
      return state.length;
    }
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function (n) {
  debug('read', n);
  var state = this._readableState;
  var nOrig = n;

  if (typeof n !== 'number' || n > 0) state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  }

  if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0) state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read pushed data synchronously, then `reading` will be false,
  // and we need to re-evaluate how much data we can return to the user.
  if (doRead && !state.reading) n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended) state.needReadable = true;

  // If we tried to read() past the EOF, then emit end on the next tick.
  if (nOrig !== n && state.ended && state.length === 0) endReadable(this);

  if (ret !== null) this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}

function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync) processNextTick(emitReadable_, stream);else emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}

// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    processNextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;else len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function (n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted) processNextTick(endFn);else src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }

  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    if (false === ret) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      // => Check whether `dest` is still a piping destination.
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
  }

  // Make sure our error handler is attached before userland ones.
  prependListener(dest, 'error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function () {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}

Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0) return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;

    if (!dest) dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var _i = 0; _i < len; _i++) {
      dests[_i].emit('unpipe', this);
    }return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1) return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function (ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // If listening to data, and it has not explicitly been paused,
  // then call resume to start the flow of data on the next tick.
  if (ev === 'data' && false !== this._readableState.flowing) {
    this.resume();
  }

  if (ev === 'readable' && !this._readableState.endEmitted) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        processNextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    processNextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}

Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  if (state.flowing) {
    do {
      var chunk = stream.read();
    } while (null !== chunk && state.flowing);
  }
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function (stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function (method) {
        return function () {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function (ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};

// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0) return null;

  if (length === 0) ret = null;else if (objectMode) ret = list.shift();else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode) ret = list.join('');else if (list.length === 1) ret = list[0];else ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode) ret = '';else ret = bufferShim.allocUnsafe(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var _buf = list[0];
        var cpy = Math.min(n - c, _buf.length);

        if (stringMode) ret += _buf.slice(0, cpy);else _buf.copy(ret, c, 0, cpy);

        if (cpy < _buf.length) list[0] = _buf.slice(cpy);else list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    processNextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}
}).call(this,require('_process'))
},{"./_stream_duplex":73,"_process":68,"buffer":7,"buffer-shims":6,"core-util-is":9,"events":10,"inherits":13,"isarray":15,"process-nextick-args":67,"string_decoder/":83,"util":4}],76:[function(require,module,exports){
// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);

function TransformState(stream) {
  this.afterTransform = function (er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
  this.writeencoding = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb) return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined) stream.push(data);

  cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}

function Transform(options) {
  if (!(this instanceof Transform)) return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;

    if (typeof options.flush === 'function') this._flush = options.flush;
  }

  this.once('prefinish', function () {
    if (typeof this._flush === 'function') this._flush(function (er) {
      done(stream, er);
    });else done(stream);
  });
}

Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('Not implemented');
};

Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function (n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};

function done(stream, er) {
  if (er) return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length) throw new Error('Calling transform done when ws.length != 0');

  if (ts.transforming) throw new Error('Calling transform done when still transforming');

  return stream.push(null);
}
},{"./_stream_duplex":73,"core-util-is":9,"inherits":13}],77:[function(require,module,exports){
(function (process){
// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

module.exports = Writable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : processNextTick;
/*</replacement>*/

Writable.WritableState = WritableState;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/

/*<replacement>*/
var Stream;
(function () {
  try {
    Stream = require('st' + 'ream');
  } catch (_) {} finally {
    if (!Stream) Stream = require('events').EventEmitter;
  }
})();
/*</replacement>*/

var Buffer = require('buffer').Buffer;
/*<replacement>*/
var bufferShim = require('buffer-shims');
/*</replacement>*/

util.inherits(Writable, Stream);

function nop() {}

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

var Duplex;
function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~ ~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function (er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two
  this.corkedRequestsFree = new CorkedRequest(this);
}

WritableState.prototype.getBuffer = function writableStateGetBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.')
    });
  } catch (_) {}
})();

var Duplex;
function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex)) return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function') this._write = options.write;

    if (typeof options.writev === 'function') this._writev = options.writev;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function () {
  this.emit('error', new Error('Cannot pipe, not readable'));
};

function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  processNextTick(cb, er);
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  var er = false;
  // Always throw error if a null is written
  // if we are not in object mode then throw
  // if it is not a buffer, string, or undefined.
  if (chunk === null) {
    er = new TypeError('May not write null values to stream');
  } else if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  if (er) {
    stream.emit('error', er);
    processNextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk)) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

  if (typeof cb !== 'function') cb = nop;

  if (state.ended) writeAfterEnd(this, cb);else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function () {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function () {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = bufferShim.from(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);

  if (Buffer.isBuffer(chunk)) encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync) processNextTick(cb, er);else cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      /*<replacement>*/
      asyncWrite(afterWrite, stream, state, finished, cb);
      /*</replacement>*/
    } else {
        afterWrite(stream, state, finished, cb);
      }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}

// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;

    var count = 0;
    while (entry) {
      buffer[count] = entry;
      entry = entry.next;
      count += 1;
    }

    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

    // doWrite is almost always async, defer these to save a bit of time
    // as the hot path ends with doWrite
    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null) state.lastBufferedRequest = null;
  }

  state.bufferedRequestCount = 0;
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished) endWritable(this, state, cb);
};

function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else {
      prefinish(stream, state);
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) processNextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
function CorkedRequest(state) {
  var _this = this;

  this.next = null;
  this.entry = null;

  this.finish = function (err) {
    var entry = _this.entry;
    _this.entry = null;
    while (entry) {
      var cb = entry.callback;
      state.pendingcb--;
      cb(err);
      entry = entry.next;
    }
    if (state.corkedRequestsFree) {
      state.corkedRequestsFree.next = _this;
    } else {
      state.corkedRequestsFree = _this;
    }
  };
}
}).call(this,require('_process'))
},{"./_stream_duplex":73,"_process":68,"buffer":7,"buffer-shims":6,"core-util-is":9,"events":10,"inherits":13,"process-nextick-args":67,"util-deprecate":87}],78:[function(require,module,exports){
(function (process){
var Stream = (function (){
  try {
    return require('st' + 'ream'); // hack to fix a circular dependency issue when used with browserify
  } catch(_){}
}());
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = Stream || exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

if (!process.browser && process.env.READABLE_STREAM === 'disable' && Stream) {
  module.exports = Stream;
}

}).call(this,require('_process'))
},{"./lib/_stream_duplex.js":73,"./lib/_stream_passthrough.js":74,"./lib/_stream_readable.js":75,"./lib/_stream_transform.js":76,"./lib/_stream_writable.js":77,"_process":68}],79:[function(require,module,exports){
(function (global){
var ClientRequest = require('./lib/request')
var extend = require('xtend')
var statusCodes = require('builtin-status-codes')
var url = require('url')

var http = exports

http.request = function (opts, cb) {
	if (typeof opts === 'string')
		opts = url.parse(opts)
	else
		opts = extend(opts)

	// Normally, the page is loaded from http or https, so not specifying a protocol
	// will result in a (valid) protocol-relative url. However, this won't work if
	// the protocol is something else, like 'file:'
	var defaultProtocol = global.location.protocol.search(/^https?:$/) === -1 ? 'http:' : ''

	var protocol = opts.protocol || defaultProtocol
	var host = opts.hostname || opts.host
	var port = opts.port
	var path = opts.path || '/'

	// Necessary for IPv6 addresses
	if (host && host.indexOf(':') !== -1)
		host = '[' + host + ']'

	// This may be a relative url. The browser should always be able to interpret it correctly.
	opts.url = (host ? (protocol + '//' + host) : '') + (port ? ':' + port : '') + path
	opts.method = (opts.method || 'GET').toUpperCase()
	opts.headers = opts.headers || {}

	// Also valid opts.auth, opts.mode

	var req = new ClientRequest(opts)
	if (cb)
		req.on('response', cb)
	return req
}

http.get = function get (opts, cb) {
	var req = http.request(opts, cb)
	req.end()
	return req
}

http.Agent = function () {}
http.Agent.defaultMaxSockets = 4

http.STATUS_CODES = statusCodes

http.METHODS = [
	'CHECKOUT',
	'CONNECT',
	'COPY',
	'DELETE',
	'GET',
	'HEAD',
	'LOCK',
	'M-SEARCH',
	'MERGE',
	'MKACTIVITY',
	'MKCOL',
	'MOVE',
	'NOTIFY',
	'OPTIONS',
	'PATCH',
	'POST',
	'PROPFIND',
	'PROPPATCH',
	'PURGE',
	'PUT',
	'REPORT',
	'SEARCH',
	'SUBSCRIBE',
	'TRACE',
	'UNLOCK',
	'UNSUBSCRIBE'
]
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./lib/request":81,"builtin-status-codes":8,"url":85,"xtend":91}],80:[function(require,module,exports){
(function (global){
exports.fetch = isFunction(global.fetch) && isFunction(global.ReadableByteStream)

exports.blobConstructor = false
try {
	new Blob([new ArrayBuffer(1)])
	exports.blobConstructor = true
} catch (e) {}

var xhr = new global.XMLHttpRequest()
// If location.host is empty, e.g. if this page/worker was loaded
// from a Blob, then use example.com to avoid an error
xhr.open('GET', global.location.host ? '/' : 'https://example.com')

function checkTypeSupport (type) {
	try {
		xhr.responseType = type
		return xhr.responseType === type
	} catch (e) {}
	return false
}

// For some strange reason, Safari 7.0 reports typeof global.ArrayBuffer === 'object'.
// Safari 7.1 appears to have fixed this bug.
var haveArrayBuffer = typeof global.ArrayBuffer !== 'undefined'
var haveSlice = haveArrayBuffer && isFunction(global.ArrayBuffer.prototype.slice)

exports.arraybuffer = haveArrayBuffer && checkTypeSupport('arraybuffer')
// These next two tests unavoidably show warnings in Chrome. Since fetch will always
// be used if it's available, just return false for these to avoid the warnings.
exports.msstream = !exports.fetch && haveSlice && checkTypeSupport('ms-stream')
exports.mozchunkedarraybuffer = !exports.fetch && haveArrayBuffer &&
	checkTypeSupport('moz-chunked-arraybuffer')
exports.overrideMimeType = isFunction(xhr.overrideMimeType)
exports.vbArray = isFunction(global.VBArray)

function isFunction (value) {
  return typeof value === 'function'
}

xhr = null // Help gc

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],81:[function(require,module,exports){
(function (process,global,Buffer){
var capability = require('./capability')
var inherits = require('inherits')
var response = require('./response')
var stream = require('readable-stream')
var toArrayBuffer = require('to-arraybuffer')

var IncomingMessage = response.IncomingMessage
var rStates = response.readyStates

function decideMode (preferBinary) {
	if (capability.fetch) {
		return 'fetch'
	} else if (capability.mozchunkedarraybuffer) {
		return 'moz-chunked-arraybuffer'
	} else if (capability.msstream) {
		return 'ms-stream'
	} else if (capability.arraybuffer && preferBinary) {
		return 'arraybuffer'
	} else if (capability.vbArray && preferBinary) {
		return 'text:vbarray'
	} else {
		return 'text'
	}
}

var ClientRequest = module.exports = function (opts) {
	var self = this
	stream.Writable.call(self)

	self._opts = opts
	self._body = []
	self._headers = {}
	if (opts.auth)
		self.setHeader('Authorization', 'Basic ' + new Buffer(opts.auth).toString('base64'))
	Object.keys(opts.headers).forEach(function (name) {
		self.setHeader(name, opts.headers[name])
	})

	var preferBinary
	if (opts.mode === 'prefer-streaming') {
		// If streaming is a high priority but binary compatibility and
		// the accuracy of the 'content-type' header aren't
		preferBinary = false
	} else if (opts.mode === 'allow-wrong-content-type') {
		// If streaming is more important than preserving the 'content-type' header
		preferBinary = !capability.overrideMimeType
	} else if (!opts.mode || opts.mode === 'default' || opts.mode === 'prefer-fast') {
		// Use binary if text streaming may corrupt data or the content-type header, or for speed
		preferBinary = true
	} else {
		throw new Error('Invalid value for opts.mode')
	}
	self._mode = decideMode(preferBinary)

	self.on('finish', function () {
		self._onFinish()
	})
}

inherits(ClientRequest, stream.Writable)

ClientRequest.prototype.setHeader = function (name, value) {
	var self = this
	var lowerName = name.toLowerCase()
	// This check is not necessary, but it prevents warnings from browsers about setting unsafe
	// headers. To be honest I'm not entirely sure hiding these warnings is a good thing, but
	// http-browserify did it, so I will too.
	if (unsafeHeaders.indexOf(lowerName) !== -1)
		return

	self._headers[lowerName] = {
		name: name,
		value: value
	}
}

ClientRequest.prototype.getHeader = function (name) {
	var self = this
	return self._headers[name.toLowerCase()].value
}

ClientRequest.prototype.removeHeader = function (name) {
	var self = this
	delete self._headers[name.toLowerCase()]
}

ClientRequest.prototype._onFinish = function () {
	var self = this

	if (self._destroyed)
		return
	var opts = self._opts

	var headersObj = self._headers
	var body
	if (opts.method === 'POST' || opts.method === 'PUT' || opts.method === 'PATCH') {
		if (capability.blobConstructor) {
			body = new global.Blob(self._body.map(function (buffer) {
				return toArrayBuffer(buffer)
			}), {
				type: (headersObj['content-type'] || {}).value || ''
			})
		} else {
			// get utf8 string
			body = Buffer.concat(self._body).toString()
		}
	}

	if (self._mode === 'fetch') {
		var headers = Object.keys(headersObj).map(function (name) {
			return [headersObj[name].name, headersObj[name].value]
		})

		global.fetch(self._opts.url, {
			method: self._opts.method,
			headers: headers,
			body: body,
			mode: 'cors',
			credentials: opts.withCredentials ? 'include' : 'same-origin'
		}).then(function (response) {
			self._fetchResponse = response
			self._connect()
		}, function (reason) {
			self.emit('error', reason)
		})
	} else {
		var xhr = self._xhr = new global.XMLHttpRequest()
		try {
			xhr.open(self._opts.method, self._opts.url, true)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}

		// Can't set responseType on really old browsers
		if ('responseType' in xhr)
			xhr.responseType = self._mode.split(':')[0]

		if ('withCredentials' in xhr)
			xhr.withCredentials = !!opts.withCredentials

		if (self._mode === 'text' && 'overrideMimeType' in xhr)
			xhr.overrideMimeType('text/plain; charset=x-user-defined')

		Object.keys(headersObj).forEach(function (name) {
			xhr.setRequestHeader(headersObj[name].name, headersObj[name].value)
		})

		self._response = null
		xhr.onreadystatechange = function () {
			switch (xhr.readyState) {
				case rStates.LOADING:
				case rStates.DONE:
					self._onXHRProgress()
					break
			}
		}
		// Necessary for streaming in Firefox, since xhr.response is ONLY defined
		// in onprogress, not in onreadystatechange with xhr.readyState = 3
		if (self._mode === 'moz-chunked-arraybuffer') {
			xhr.onprogress = function () {
				self._onXHRProgress()
			}
		}

		xhr.onerror = function () {
			if (self._destroyed)
				return
			self.emit('error', new Error('XHR error'))
		}

		try {
			xhr.send(body)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}
	}
}

/**
 * Checks if xhr.status is readable and non-zero, indicating no error.
 * Even though the spec says it should be available in readyState 3,
 * accessing it throws an exception in IE8
 */
function statusValid (xhr) {
	try {
		var status = xhr.status
		return (status !== null && status !== 0)
	} catch (e) {
		return false
	}
}

ClientRequest.prototype._onXHRProgress = function () {
	var self = this

	if (!statusValid(self._xhr) || self._destroyed)
		return

	if (!self._response)
		self._connect()

	self._response._onXHRProgress()
}

ClientRequest.prototype._connect = function () {
	var self = this

	if (self._destroyed)
		return

	self._response = new IncomingMessage(self._xhr, self._fetchResponse, self._mode)
	self.emit('response', self._response)
}

ClientRequest.prototype._write = function (chunk, encoding, cb) {
	var self = this

	self._body.push(chunk)
	cb()
}

ClientRequest.prototype.abort = ClientRequest.prototype.destroy = function () {
	var self = this
	self._destroyed = true
	if (self._response)
		self._response._destroyed = true
	if (self._xhr)
		self._xhr.abort()
	// Currently, there isn't a way to truly abort a fetch.
	// If you like bikeshedding, see https://github.com/whatwg/fetch/issues/27
}

ClientRequest.prototype.end = function (data, encoding, cb) {
	var self = this
	if (typeof data === 'function') {
		cb = data
		data = undefined
	}

	stream.Writable.prototype.end.call(self, data, encoding, cb)
}

ClientRequest.prototype.flushHeaders = function () {}
ClientRequest.prototype.setTimeout = function () {}
ClientRequest.prototype.setNoDelay = function () {}
ClientRequest.prototype.setSocketKeepAlive = function () {}

// Taken from http://www.w3.org/TR/XMLHttpRequest/#the-setrequestheader%28%29-method
var unsafeHeaders = [
	'accept-charset',
	'accept-encoding',
	'access-control-request-headers',
	'access-control-request-method',
	'connection',
	'content-length',
	'cookie',
	'cookie2',
	'date',
	'dnt',
	'expect',
	'host',
	'keep-alive',
	'origin',
	'referer',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'user-agent',
	'via'
]

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"./capability":80,"./response":82,"_process":68,"buffer":7,"inherits":13,"readable-stream":78,"to-arraybuffer":84}],82:[function(require,module,exports){
(function (process,global,Buffer){
var capability = require('./capability')
var inherits = require('inherits')
var stream = require('readable-stream')

var rStates = exports.readyStates = {
	UNSENT: 0,
	OPENED: 1,
	HEADERS_RECEIVED: 2,
	LOADING: 3,
	DONE: 4
}

var IncomingMessage = exports.IncomingMessage = function (xhr, response, mode) {
	var self = this
	stream.Readable.call(self)

	self._mode = mode
	self.headers = {}
	self.rawHeaders = []
	self.trailers = {}
	self.rawTrailers = []

	// Fake the 'close' event, but only once 'end' fires
	self.on('end', function () {
		// The nextTick is necessary to prevent the 'request' module from causing an infinite loop
		process.nextTick(function () {
			self.emit('close')
		})
	})

	if (mode === 'fetch') {
		self._fetchResponse = response

		self.url = response.url
		self.statusCode = response.status
		self.statusMessage = response.statusText
		// backwards compatible version of for (<item> of <iterable>):
		// for (var <item>,_i,_it = <iterable>[Symbol.iterator](); <item> = (_i = _it.next()).value,!_i.done;)
		for (var header, _i, _it = response.headers[Symbol.iterator](); header = (_i = _it.next()).value, !_i.done;) {
			self.headers[header[0].toLowerCase()] = header[1]
			self.rawHeaders.push(header[0], header[1])
		}

		// TODO: this doesn't respect backpressure. Once WritableStream is available, this can be fixed
		var reader = response.body.getReader()
		function read () {
			reader.read().then(function (result) {
				if (self._destroyed)
					return
				if (result.done) {
					self.push(null)
					return
				}
				self.push(new Buffer(result.value))
				read()
			})
		}
		read()

	} else {
		self._xhr = xhr
		self._pos = 0

		self.url = xhr.responseURL
		self.statusCode = xhr.status
		self.statusMessage = xhr.statusText
		var headers = xhr.getAllResponseHeaders().split(/\r?\n/)
		headers.forEach(function (header) {
			var matches = header.match(/^([^:]+):\s*(.*)/)
			if (matches) {
				var key = matches[1].toLowerCase()
				if (key === 'set-cookie') {
					if (self.headers[key] === undefined) {
						self.headers[key] = []
					}
					self.headers[key].push(matches[2])
				} else if (self.headers[key] !== undefined) {
					self.headers[key] += ', ' + matches[2]
				} else {
					self.headers[key] = matches[2]
				}
				self.rawHeaders.push(matches[1], matches[2])
			}
		})

		self._charset = 'x-user-defined'
		if (!capability.overrideMimeType) {
			var mimeType = self.rawHeaders['mime-type']
			if (mimeType) {
				var charsetMatch = mimeType.match(/;\s*charset=([^;])(;|$)/)
				if (charsetMatch) {
					self._charset = charsetMatch[1].toLowerCase()
				}
			}
			if (!self._charset)
				self._charset = 'utf-8' // best guess
		}
	}
}

inherits(IncomingMessage, stream.Readable)

IncomingMessage.prototype._read = function () {}

IncomingMessage.prototype._onXHRProgress = function () {
	var self = this

	var xhr = self._xhr

	var response = null
	switch (self._mode) {
		case 'text:vbarray': // For IE9
			if (xhr.readyState !== rStates.DONE)
				break
			try {
				// This fails in IE8
				response = new global.VBArray(xhr.responseBody).toArray()
			} catch (e) {}
			if (response !== null) {
				self.push(new Buffer(response))
				break
			}
			// Falls through in IE8	
		case 'text':
			try { // This will fail when readyState = 3 in IE9. Switch mode and wait for readyState = 4
				response = xhr.responseText
			} catch (e) {
				self._mode = 'text:vbarray'
				break
			}
			if (response.length > self._pos) {
				var newData = response.substr(self._pos)
				if (self._charset === 'x-user-defined') {
					var buffer = new Buffer(newData.length)
					for (var i = 0; i < newData.length; i++)
						buffer[i] = newData.charCodeAt(i) & 0xff

					self.push(buffer)
				} else {
					self.push(newData, self._charset)
				}
				self._pos = response.length
			}
			break
		case 'arraybuffer':
			if (xhr.readyState !== rStates.DONE)
				break
			response = xhr.response
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'moz-chunked-arraybuffer': // take whole
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING || !response)
				break
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'ms-stream':
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING)
				break
			var reader = new global.MSStreamReader()
			reader.onprogress = function () {
				if (reader.result.byteLength > self._pos) {
					self.push(new Buffer(new Uint8Array(reader.result.slice(self._pos))))
					self._pos = reader.result.byteLength
				}
			}
			reader.onload = function () {
				self.push(null)
			}
			// reader.onerror = ??? // TODO: this
			reader.readAsArrayBuffer(response)
			break
	}

	// The ms-stream case handles end separately in reader.onload()
	if (self._xhr.readyState === rStates.DONE && self._mode !== 'ms-stream') {
		self.push(null)
	}
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"./capability":80,"_process":68,"buffer":7,"inherits":13,"readable-stream":78}],83:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":7}],84:[function(require,module,exports){
var Buffer = require('buffer').Buffer

module.exports = function (buf) {
	// If the buffer is backed by a Uint8Array, a faster version will work
	if (buf instanceof Uint8Array) {
		// If the buffer isn't a subarray, return the underlying ArrayBuffer
		if (buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength) {
			return buf.buffer
		} else if (typeof buf.buffer.slice === 'function') {
			// Otherwise we need to get a proper copy
			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
		}
	}

	if (Buffer.isBuffer(buf)) {
		// This is the slow version that will work with any Buffer
		// implementation (even in old browsers)
		var arrayCopy = new Uint8Array(buf.length)
		var len = buf.length
		for (var i = 0; i < len; i++) {
			arrayCopy[i] = buf[i]
		}
		return arrayCopy.buffer
	} else {
		throw new Error('Argument must be a Buffer')
	}
}

},{"buffer":7}],85:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var punycode = require('punycode');
var util = require('./util');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && util.isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!util.isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  // Copy chrome, IE, opera backslash-handling behavior.
  // Back slashes before the query string get converted to forward slashes
  // See: https://code.google.com/p/chromium/issues/detail?id=25916
  var queryIndex = url.indexOf('?'),
      splitter =
          (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
      uSplit = url.split(splitter),
      slashRegex = /\\/g;
  uSplit[0] = uSplit[0].replace(slashRegex, '/');
  url = uSplit.join(splitter);

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    var simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.path = rest;
      this.href = rest;
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
        if (parseQueryString) {
          this.query = querystring.parse(this.search.substr(1));
        } else {
          this.query = this.search.substr(1);
        }
      } else if (parseQueryString) {
        this.search = '';
        this.query = {};
      }
      return this;
    }
  }

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a punycoded representation of "domain".
      // It only converts parts of the domain name that
      // have non-ASCII characters, i.e. it doesn't matter if
      // you call it with a domain that already is ASCII-only.
      this.hostname = punycode.toASCII(this.hostname);
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      if (rest.indexOf(ae) === -1)
        continue;
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (util.isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      util.isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (util.isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  var tkeys = Object.keys(this);
  for (var tk = 0; tk < tkeys.length; tk++) {
    var tkey = tkeys[tk];
    result[tkey] = this[tkey];
  }

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    var rkeys = Object.keys(relative);
    for (var rk = 0; rk < rkeys.length; rk++) {
      var rkey = rkeys[rk];
      if (rkey !== 'protocol')
        result[rkey] = relative[rkey];
    }

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      var keys = Object.keys(relative);
      for (var v = 0; v < keys.length; v++) {
        var k = keys[v];
        result[k] = relative[k];
      }
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!util.isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especially happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host || srcPath.length > 1) &&
      (last === '.' || last === '..') || last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last === '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especially happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

},{"./util":86,"punycode":69,"querystring":72}],86:[function(require,module,exports){
'use strict';

module.exports = {
  isString: function(arg) {
    return typeof(arg) === 'string';
  },
  isObject: function(arg) {
    return typeof(arg) === 'object' && arg !== null;
  },
  isNull: function(arg) {
    return arg === null;
  },
  isNullOrUndefined: function(arg) {
    return arg == null;
  }
};

},{}],87:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],88:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],89:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":88,"_process":68,"inherits":13}],90:[function(require,module,exports){
(function (process,Buffer){
/**
 * Wrapper for built-in http.js to emulate the browser XMLHttpRequest object.
 *
 * This can be used with JS designed for browsers to improve reuse of code and
 * allow the use of existing libraries.
 *
 * Usage: include("XMLHttpRequest.js") and use XMLHttpRequest per W3C specs.
 *
 * @author Dan DeFelippi <dan@driverdan.com>
 * @contributor David Ellis <d.f.ellis@ieee.org>
 * @license MIT
 */

var Url = require("url");
var spawn = require("child_process").spawn;
var fs = require("fs");

exports.XMLHttpRequest = function() {
  "use strict";

  /**
   * Private variables
   */
  var self = this;
  var http = require("http");
  var https = require("https");

  // Holds http.js objects
  var request;
  var response;

  // Request settings
  var settings = {};

  // Disable header blacklist.
  // Not part of XHR specs.
  var disableHeaderCheck = false;

  // Set some default headers
  var defaultHeaders = {
    "User-Agent": "node-XMLHttpRequest",
    "Accept": "*/*",
  };

  var headers = {};
  var headersCase = {};

  // These headers are not user setable.
  // The following are allowed but banned in the spec:
  // * user-agent
  var forbiddenRequestHeaders = [
    "accept-charset",
    "accept-encoding",
    "access-control-request-headers",
    "access-control-request-method",
    "connection",
    "content-length",
    "content-transfer-encoding",
    "cookie",
    "cookie2",
    "date",
    "expect",
    "host",
    "keep-alive",
    "origin",
    "referer",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "via"
  ];

  // These request methods are not allowed
  var forbiddenRequestMethods = [
    "TRACE",
    "TRACK",
    "CONNECT"
  ];

  // Send flag
  var sendFlag = false;
  // Error flag, used when errors occur or abort is called
  var errorFlag = false;

  // Event listeners
  var listeners = {};

  /**
   * Constants
   */

  this.UNSENT = 0;
  this.OPENED = 1;
  this.HEADERS_RECEIVED = 2;
  this.LOADING = 3;
  this.DONE = 4;

  /**
   * Public vars
   */

  // Current state
  this.readyState = this.UNSENT;

  // default ready state change handler in case one is not set or is set late
  this.onreadystatechange = null;

  // Result & response
  this.responseText = "";
  this.responseXML = "";
  this.status = null;
  this.statusText = null;
  
  // Whether cross-site Access-Control requests should be made using
  // credentials such as cookies or authorization headers
  this.withCredentials = false;

  /**
   * Private methods
   */

  /**
   * Check if the specified header is allowed.
   *
   * @param string header Header to validate
   * @return boolean False if not allowed, otherwise true
   */
  var isAllowedHttpHeader = function(header) {
    return disableHeaderCheck || (header && forbiddenRequestHeaders.indexOf(header.toLowerCase()) === -1);
  };

  /**
   * Check if the specified method is allowed.
   *
   * @param string method Request method to validate
   * @return boolean False if not allowed, otherwise true
   */
  var isAllowedHttpMethod = function(method) {
    return (method && forbiddenRequestMethods.indexOf(method) === -1);
  };

  /**
   * Public methods
   */

  /**
   * Open the connection. Currently supports local server requests.
   *
   * @param string method Connection method (eg GET, POST)
   * @param string url URL for the connection.
   * @param boolean async Asynchronous connection. Default is true.
   * @param string user Username for basic authentication (optional)
   * @param string password Password for basic authentication (optional)
   */
  this.open = function(method, url, async, user, password) {
    this.abort();
    errorFlag = false;

    // Check for valid request method
    if (!isAllowedHttpMethod(method)) {
      throw new Error("SecurityError: Request method not allowed");
    }

    settings = {
      "method": method,
      "url": url.toString(),
      "async": (typeof async !== "boolean" ? true : async),
      "user": user || null,
      "password": password || null
    };

    setState(this.OPENED);
  };

  /**
   * Disables or enables isAllowedHttpHeader() check the request. Enabled by default.
   * This does not conform to the W3C spec.
   *
   * @param boolean state Enable or disable header checking.
   */
  this.setDisableHeaderCheck = function(state) {
    disableHeaderCheck = state;
  };

  /**
   * Sets a header for the request or appends the value if one is already set.
   *
   * @param string header Header name
   * @param string value Header value
   */
  this.setRequestHeader = function(header, value) {
    if (this.readyState !== this.OPENED) {
      throw new Error("INVALID_STATE_ERR: setRequestHeader can only be called when state is OPEN");
    }
    if (!isAllowedHttpHeader(header)) {
      console.warn("Refused to set unsafe header \"" + header + "\"");
      return;
    }
    if (sendFlag) {
      throw new Error("INVALID_STATE_ERR: send flag is true");
    }
    header = headersCase[header.toLowerCase()] || header;
    headersCase[header.toLowerCase()] = header;
    headers[header] = headers[header] ? headers[header] + ', ' + value : value;
  };

  /**
   * Gets a header from the server response.
   *
   * @param string header Name of header to get.
   * @return string Text of the header or null if it doesn't exist.
   */
  this.getResponseHeader = function(header) {
    if (typeof header === "string"
      && this.readyState > this.OPENED
      && response
      && response.headers
      && response.headers[header.toLowerCase()]
      && !errorFlag
    ) {
      return response.headers[header.toLowerCase()];
    }

    return null;
  };

  /**
   * Gets all the response headers.
   *
   * @return string A string with all response headers separated by CR+LF
   */
  this.getAllResponseHeaders = function() {
    if (this.readyState < this.HEADERS_RECEIVED || errorFlag) {
      return "";
    }
    var result = "";

    for (var i in response.headers) {
      // Cookie headers are excluded
      if (i !== "set-cookie" && i !== "set-cookie2") {
        result += i + ": " + response.headers[i] + "\r\n";
      }
    }
    return result.substr(0, result.length - 2);
  };

  /**
   * Gets a request header
   *
   * @param string name Name of header to get
   * @return string Returns the request header or empty string if not set
   */
  this.getRequestHeader = function(name) {
    if (typeof name === "string" && headersCase[name.toLowerCase()]) {
      return headers[headersCase[name.toLowerCase()]];
    }

    return "";
  };

  /**
   * Sends the request to the server.
   *
   * @param string data Optional data to send as request body.
   */
  this.send = function(data) {
    if (this.readyState !== this.OPENED) {
      throw new Error("INVALID_STATE_ERR: connection must be opened before send() is called");
    }

    if (sendFlag) {
      throw new Error("INVALID_STATE_ERR: send has already been called");
    }

    var ssl = false, local = false;
    var url = Url.parse(settings.url);
    var host;
    // Determine the server
    switch (url.protocol) {
      case "https:":
        ssl = true;
        // SSL & non-SSL both need host, no break here.
      case "http:":
        host = url.hostname;
        break;

      case "file:":
        local = true;
        break;

      case undefined:
      case null:
      case "":
        host = "localhost";
        break;

      default:
        throw new Error("Protocol not supported.");
    }

    // Load files off the local filesystem (file://)
    if (local) {
      if (settings.method !== "GET") {
        throw new Error("XMLHttpRequest: Only GET method is supported");
      }

      if (settings.async) {
        fs.readFile(url.pathname, "utf8", function(error, data) {
          if (error) {
            self.handleError(error);
          } else {
            self.status = 200;
            self.responseText = data;
            setState(self.DONE);
          }
        });
      } else {
        try {
          this.responseText = fs.readFileSync(url.pathname, "utf8");
          this.status = 200;
          setState(self.DONE);
        } catch(e) {
          this.handleError(e);
        }
      }

      return;
    }

    // Default to port 80. If accessing localhost on another port be sure
    // to use http://localhost:port/path
    var port = url.port || (ssl ? 443 : 80);
    // Add query string if one is used
    var uri = url.pathname + (url.search ? url.search : "");

    // Set the defaults if they haven't been set
    for (var name in defaultHeaders) {
      if (!headersCase[name.toLowerCase()]) {
        headers[name] = defaultHeaders[name];
      }
    }

    // Set the Host header or the server may reject the request
    headers.Host = host;
    if (!((ssl && port === 443) || port === 80)) {
      headers.Host += ":" + url.port;
    }

    // Set Basic Auth if necessary
    if (settings.user) {
      if (typeof settings.password === "undefined") {
        settings.password = "";
      }
      var authBuf = new Buffer(settings.user + ":" + settings.password);
      headers.Authorization = "Basic " + authBuf.toString("base64");
    }

    // Set content length header
    if (settings.method === "GET" || settings.method === "HEAD") {
      data = null;
    } else if (data) {
      headers["Content-Length"] = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);

      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "text/plain;charset=UTF-8";
      }
    } else if (settings.method === "POST") {
      // For a post with no data set Content-Length: 0.
      // This is required by buggy servers that don't meet the specs.
      headers["Content-Length"] = 0;
    }

    var options = {
      host: host,
      port: port,
      path: uri,
      method: settings.method,
      headers: headers,
      agent: false,
      withCredentials: self.withCredentials
    };

    // Reset error flag
    errorFlag = false;

    // Handle async requests
    if (settings.async) {
      // Use the proper protocol
      var doRequest = ssl ? https.request : http.request;

      // Request is being sent, set send flag
      sendFlag = true;

      // As per spec, this is called here for historical reasons.
      self.dispatchEvent("readystatechange");

      // Handler for the response
      var responseHandler = function responseHandler(resp) {
        // Set response var to the response we got back
        // This is so it remains accessable outside this scope
        response = resp;
        // Check for redirect
        // @TODO Prevent looped redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307) {
          // Change URL to the redirect location
          settings.url = response.headers.location;
          var url = Url.parse(settings.url);
          // Set host var in case it's used later
          host = url.hostname;
          // Options for the new request
          var newOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.path,
            method: response.statusCode === 303 ? "GET" : settings.method,
            headers: headers,
            withCredentials: self.withCredentials
          };

          // Issue the new request
          request = doRequest(newOptions, responseHandler).on("error", errorHandler);
          request.end();
          // @TODO Check if an XHR event needs to be fired here
          return;
        }

        response.setEncoding("utf8");

        setState(self.HEADERS_RECEIVED);
        self.status = response.statusCode;

        response.on("data", function(chunk) {
          // Make sure there's some data
          if (chunk) {
            self.responseText += chunk;
          }
          // Don't emit state changes if the connection has been aborted.
          if (sendFlag) {
            setState(self.LOADING);
          }
        });

        response.on("end", function() {
          if (sendFlag) {
            // Discard the end event if the connection has been aborted
            setState(self.DONE);
            sendFlag = false;
          }
        });

        response.on("error", function(error) {
          self.handleError(error);
        });
      };

      // Error handler for the request
      var errorHandler = function errorHandler(error) {
        self.handleError(error);
      };

      // Create the request
      request = doRequest(options, responseHandler).on("error", errorHandler);

      // Node 0.4 and later won't accept empty data. Make sure it's needed.
      if (data) {
        request.write(data);
      }

      request.end();

      self.dispatchEvent("loadstart");
    } else { // Synchronous
      // Create a temporary file for communication with the other Node process
      var contentFile = ".node-xmlhttprequest-content-" + process.pid;
      var syncFile = ".node-xmlhttprequest-sync-" + process.pid;
      fs.writeFileSync(syncFile, "", "utf8");
      // The async request the other Node process executes
      var execString = "var http = require('http'), https = require('https'), fs = require('fs');"
        + "var doRequest = http" + (ssl ? "s" : "") + ".request;"
        + "var options = " + JSON.stringify(options) + ";"
        + "var responseText = '';"
        + "var req = doRequest(options, function(response) {"
        + "response.setEncoding('utf8');"
        + "response.on('data', function(chunk) {"
        + "  responseText += chunk;"
        + "});"
        + "response.on('end', function() {"
        + "fs.writeFileSync('" + contentFile + "', JSON.stringify({err: null, data: {statusCode: response.statusCode, headers: response.headers, text: responseText}}), 'utf8');"
        + "fs.unlinkSync('" + syncFile + "');"
        + "});"
        + "response.on('error', function(error) {"
        + "fs.writeFileSync('" + contentFile + "', JSON.stringify({err: error}), 'utf8');"
        + "fs.unlinkSync('" + syncFile + "');"
        + "});"
        + "}).on('error', function(error) {"
        + "fs.writeFileSync('" + contentFile + "', JSON.stringify({err: error}), 'utf8');"
        + "fs.unlinkSync('" + syncFile + "');"
        + "});"
        + (data ? "req.write('" + JSON.stringify(data).slice(1,-1).replace(/'/g, "\\'") + "');":"")
        + "req.end();";
      // Start the other Node Process, executing this string
      var syncProc = spawn(process.argv[0], ["-e", execString]);
      while(fs.existsSync(syncFile)) {
        // Wait while the sync file is empty
      }
      var resp = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
      // Kill the child process once the file has data
      syncProc.stdin.end();
      // Remove the temporary file
      fs.unlinkSync(contentFile);

      if (resp.err) {
        self.handleError(resp.err);
      } else {
        response = resp.data;
        self.status = resp.data.statusCode;
        self.responseText = resp.data.text;
        setState(self.DONE);
      }
    }
  };

  /**
   * Called when an error is encountered to deal with it.
   */
  this.handleError = function(error) {
    this.status = 0;
    this.statusText = error;
    this.responseText = error.stack;
    errorFlag = true;
    setState(this.DONE);
    this.dispatchEvent('error');
  };

  /**
   * Aborts a request.
   */
  this.abort = function() {
    if (request) {
      request.abort();
      request = null;
    }

    headers = defaultHeaders;
    this.status = 0;
    this.responseText = "";
    this.responseXML = "";

    errorFlag = true;

    if (this.readyState !== this.UNSENT
        && (this.readyState !== this.OPENED || sendFlag)
        && this.readyState !== this.DONE) {
      sendFlag = false;
      setState(this.DONE);
    }
    this.readyState = this.UNSENT;
    this.dispatchEvent('abort');
  };

  /**
   * Adds an event listener. Preferred method of binding to events.
   */
  this.addEventListener = function(event, callback) {
    if (!(event in listeners)) {
      listeners[event] = [];
    }
    // Currently allows duplicate callbacks. Should it?
    listeners[event].push(callback);
  };

  /**
   * Remove an event callback that has already been bound.
   * Only works on the matching funciton, cannot be a copy.
   */
  this.removeEventListener = function(event, callback) {
    if (event in listeners) {
      // Filter will return a new array with the callback removed
      listeners[event] = listeners[event].filter(function(ev) {
        return ev !== callback;
      });
    }
  };

  /**
   * Dispatch any events, including both "on" methods and events attached using addEventListener.
   */
  this.dispatchEvent = function(event) {
    if (typeof self["on" + event] === "function") {
      self["on" + event]();
    }
    if (event in listeners) {
      for (var i = 0, len = listeners[event].length; i < len; i++) {
        listeners[event][i].call(self);
      }
    }
  };

  /**
   * Changes readyState and calls onreadystatechange.
   *
   * @param int state New state
   */
  var setState = function(state) {
    if (state == self.LOADING || self.readyState !== state) {
      self.readyState = state;

      if (settings.async || self.readyState < self.OPENED || self.readyState === self.DONE) {
        self.dispatchEvent("readystatechange");
      }

      if (self.readyState === self.DONE && !errorFlag) {
        self.dispatchEvent("load");
        // @TODO figure out InspectorInstrumentation::didLoadXHR(cookie)
        self.dispatchEvent("loadend");
      }
    }
  };
};

}).call(this,require('_process'),require("buffer").Buffer)
},{"_process":68,"buffer":7,"child_process":5,"fs":5,"http":79,"https":11,"url":85}],91:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}]},{},[1,2]);
