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