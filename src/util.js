

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