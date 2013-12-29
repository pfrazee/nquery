/*
n$ client

:TODO: events
*/

var whitelists = require('./whitelists');
var util = require('./util');

function client(url) {
	return function(selector, opts) {
		opts = opts || {};
		var tx = new nQueryTransaction(new local.Request({ method: 'POST', url: url, Content_Type: 'application/json-stream', stream: true }));
		if (selector) {
			tx.find(selector);
		}
		if (!opts.persist) {
			local.util.nextTick(function() {
				tx.closeTxn();
			});
		}
		return tx;
	};
}
module.exports = client;

function nQueryTransaction(req) {
	var self = this;
	this.req = req;
	this.closed = false;
	this.nwrites = 0;
	this.nreads = 0;
	this.read_cbs = {}; // a map of [num_read] -> { since:, cb: }

	// Send the requests and hook into the response stream
	this.responsePromise = local.dispatch(req);
	this.responsePromise.always(function(res) {
		if (res.status != 200) {
			console.error('Failed to make nQuery request', res);
		}
		util.onJsonObject(res, function(obj) {
			self.nreads++;

			// If there are any callbacks waiting for this point in the transaction, fire them now
			if (self.read_cbs[self.nreads]) {
				self.read_cbs[self.nreads].forEach(function(item) {
					item.cb.call(undefined, obj);
				});
				delete self.read_cbs[self.nreads];
			}
		});
	});
}

// Stores a callback to be called when nreads == current nwrites
function readreturn(cb) {
	if (cb && typeof cb == 'function') {
		this.read_cbs[this.nwrites] = (this.read_cbs[this.nwrites] || []).concat({ since: this.nreads, cb: cb });
	}
	return this;
}

// Sends the operation into the transaction to be handled
function writeop(op) {
	if (this.closed) {
		throw new Error("n$ transaction closed, unable to write operation");
	}
	var cb = (typeof op[op.length - 1] == 'function') ? op.pop() : null;
	this.req.write(JSON.stringify(op) + '\r\n');
	this.nwrites++;
	if (cb) readreturn.call(this, cb);
	return this;
}

// Closes the transaction
nQueryTransaction.prototype.closeTxn = function() {
	this.req.end();
	this.closed = true;
	return this;
};

whitelists.manip.forEach(function(fn) {
	nQueryTransaction.prototype[fn] = function() {
		var args = Array.prototype.slice.call(arguments);
		writeop.call(this, [fn].concat(args));
		return this;
	};
});
whitelists.traverse.forEach(function(fn) {
	nQueryTransaction.prototype[fn] = function() {
		var args = Array.prototype.slice.call(arguments);
		writeop.call(this, [fn].concat(args));
		return this;
	};
});
// :TODO: events