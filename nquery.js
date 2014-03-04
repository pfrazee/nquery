;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"./util":4,"./whitelists":5}],2:[function(require,module,exports){
var env;
if (typeof window != 'undefined') {
	env = window;
} else if (typeof self != 'undefined') {
	env = self;
} else {
	throw "nQuery does not support this runtime environment";
}

env.nQuery = {
	Server: require('./server'),
	client: require('./client')
};
},{"./client":1,"./server":3}],3:[function(require,module,exports){
/*
httpl://nquery

n$ - the nQuery service, a web interface to jQuery

:TODO: access control and region sandboxes
:TODO: events
*/

var whitelists = require('./whitelists');
var util = require('./util');

function Server(cfg) {
	local.Server.call(this, cfg);
	this.regions = {};
	this.nregions = 0;
}
Server.prototype = Object.create(local.Server.prototype);
module.exports = Server;

// Region management
// -

Server.prototype.addRegion = function($el, opts) {
	opts = opts || {};
	var id = this.nregions;
	var region = {
		id: id,
		path: '/regions/'+id,
		$el: $el.eq(0),
		token: opts.token
	};
	if (region.$el.length === 0) {
		throw new Error('Region not found');
	}
	this.regions[region.path] = region;
	this.nregions++;
	return region.path + (opts.token ? ('?token='+opts.token) : '');
};

Server.prototype.removeRegion = function(path) {
	if (path in this.regions) {
		delete this.regions[path];
	}
};


// Request handling
// -

Server.prototype.handleLocalRequest = function(req, res) {
	// Export index
	res.headers['link'] = [
		{ href: '/', rel: 'service', title: 'nQuery DOM Service' },
		{ href: '/regions', rel: 'collection', id: 'regions', title: 'DOM Regions' }
	];
	for (var path in this.regions) {
		var rel = 'item';
		if (path == req.path) { rel += ' self'; }
		res.headers['link'].push({ href: path+'{?token}', rel: rel, id: this.regions[path].id, title: 'Region #'+this.regions[path].id });
	}

	// Route
	if (req.path == '/') {
		res.headers['link'][0].rel += ' self';
		return serveRoot.call(this, req, res);
	}
	if (req.path == '/regions') {
		res.headers['link'][0].rel += ' up';
		res.headers['link'][1].rel += ' self';
		return serveRegions.call(this, req, res);
	}
	var region = this.regions[req.path];
	if (region) {
		res.headers['link'][1].rel += ' up';
		return serveRegion.call(this, region, req, res);
	}
	return res.writeHead(404, 'Not Found').end();
};

function serveRoot(req, res) {
	if (req.method == 'HEAD') return res.writeHead(204).end();
	res.writeHead(405, 'Unsupported Method').end();
}

function serveRegions(req, res) {
	if (req.method == 'HEAD') return res.writeHead(204).end();
	res.writeHead(405, 'Unsupported Method').end();
}

function serveRegion(region, req, res) {
	if (req.method == 'POST') return POSTregion.call(this, region, req, res);
	res.writeHead(405, 'Unsupported Method').end();
}

function POSTregion(region, req, res) {
	// Validate request
	if (req.headers['content-type'] != 'application/json-stream') {
		return res.writeHead(415, 'Unsupported Media Type - must be application/json-stream').end();
	}
	if (region.token && req.query.token != region.token) {
		return res.writeHead(403, 'Forbidden').end();
	}

	var $node = region.$el;
	res.writeHead(200, 'OK', { 'Content-Type': 'application/json-stream' });
	util.onJsonObject(req, function(params) {
		// Validate object
		if (!Array.isArray(params)) {
			res.write(JSON.stringify({error: 'All json stream objects must be arrays.'}));
			return res.end();
		}

		// Validate command
		var cmd = params.shift();
		var cmd_is_traversal = (whitelists.traverse.indexOf(cmd) !== -1);
		var cmd_is_manip = (whitelists.manip.indexOf(cmd) !== -1);
		var cmd_is_event = (whitelists.events.indexOf(cmd) !== -1);
		if (!cmd_is_traversal && !cmd_is_manip && !cmd_is_event) {
			res.write(JSON.stringify({error: 'The "'+cmd+'" operation is not supported by nQuery, even if it is a valid jQuery function.'}));
			return res.end();
		}

		// Execute command
		var retval;
		try { retval = $node[cmd].apply($node, params); }
		catch (e) {
			res.write(JSON.stringify({error: 'Exception.', exception: e}));
			return res.end();
		}

		// Update context
		if (cmd_is_traversal) {
			// :TODO: validate new location
			$node = retval;
		}
		if (cmd_is_event) {
			// :TODO:
		}

		// Write return value
		if (typeof retval == 'object') {
			retval = $node.length;
		}
		res.write(JSON.stringify(retval)+'\r\n');
	});
	req.on('end', function() {
		res.end();
	});
}
},{"./util":4,"./whitelists":5}],4:[function(require,module,exports){


// Parses the json stream and emits objects as they are received
function onJsonObject(req, emitCb) {
	var buffer = '', delimIndex, json, obj;
	req.on('data', function(chunk) {
		// Add any data we've buffered from past events
		chunk = buffer + chunk;
		// Step through each object
		while ((delimIndex = chunk.indexOf('\r\n')) !== -1) {
			json = chunk.slice(0, delimIndex);
			try {
				obj = JSON.parse(json);
			} catch (e) {
				console.warn('Failed to parse json-stream chunk', e, chunk);
				obj = null;
			}
			if (obj) emitCb(obj);
			chunk = chunk.slice(delimIndex+2);
		}
		// Hold onto any leftovers
		buffer = chunk;
		// Clear the request's buffer
		req.body = '';
	});
}

module.exports = {
	onJsonObject: onJsonObject
};
},{}],5:[function(require,module,exports){
// Functions which may be called remotely with nQuery
// - also used to categorize some behaviors
module.exports = {
	manip: [
		'add',
		'addClass',
		'after',
		'append',
		'appendTo',
		'attr',
		'before',
		'contents',
		'css',
		'data',
		'detach',
		'empty',
		'hasClass',
		'height',
		'hide',
		'html',
		'index',
		'innerHeight',
		'innerWidth',
		'insertAfter',
		'insertBefore',
		'offset',
		'outerHeight',
		'outerWidth',
		'position',
		'prepend',
		'prependTo',
		'prop',
		'remove',
		'removeAttr',
		'removeClass',
		'removeData',
		'removeProp',
		'replaceAll',
		'replaceWith',
		'scrollLeft',
		'scrollTop',
		'serialize',
		'serializeArray',
		'show',
		'text',
		'toggle',
		'toggleClass',
		'unwrap',
		'val',
		'width',
		'wrap',
		'wrapAll',
		'wrapInner'
	],
	traverse: [
		'addBack',
		'andSelf',
		'children',
		'clone',
		'closest',
		'die',
		'end',
		'eq',
		'filter',
		'find',
		'first',
		'has',
		'hover',
		'is',
		'last',
		'next',
		'nextAll',
		'nextUntil',
		'not',
		'offsetParent',
		'parent',
		'parents',
		'parentsUntil',
		'prev',
		'prevAll',
		'prevUntil',
		'slice',
		'siblings'
	],
	events: [
		'delegate',
		'off',
		'on',
		'one',
		'trigger',
		'triggerHandler',
		'unbind',
		'undelegate'
	]
};
},{}]},{},[2])
;