# Networked GUI Access: the DOM Web API and `n$` Library

## Overview

Networked access to the document enables workers and WebRTC peers to share control of the GUI via messaging rather than entering the GUI thread. This access is managed by the DOM Web API, a service interface over jQuery. Its goal is to mirror the experience of jQuery (semantically, pragmatically) without hiding the details of the network (particularly latency, which manifests as async) so that neither control nor robustness are sacrificed.

jQuery API uses chains of ordered operations, which means the ops can't be sent individually as requests (seperate requests have no delivery-order guarantees). Instead, the ops must be streamed in the request body, which is an ordered transaction. Ending a request closes the transaction and releases any related state (eg the traversal position). For instance:

```
// This example
$('li', myarea).eq(2).css('background-color', 'red');

// Translates to
POST /myarea
Content-Type: application/json-stream
['$', 'li']
['eq', 2]
['css', 'background-color', 'red']

// Which receives
200 OK
Content-Type: application/json-stream
5
1
undefined
```

The response entity includes a stream of direct or representative return values. Traversals are an example of representative returns; they get back the numeric length of the set created by the traversal (rather than the set itself, which contains non-transferrable references to DOM elements). The return values are written to the response stream as the operations are run, so long-running transactions (requests) can be used to make continuous updates.

```javascript
// An example of continuously-streamed operations:
var clockInterval;
var clockReq = new local.Request({ method: 'POST', url: 'httpl://dom/myarea', headers: { 'Content-Type': 'application/json-stream' }, stream: true });
var clockResPromise = local.dispatch(clockReq);

clockReq.write(['$', '#my_clock']);
clockInterval = setInterval(function() { clockReq.write(['html', getTime()]); }, 1000);

clockResPromise.then(function(clockRes) {
	var nchunk = 0;
	clockRes.on('data', function(chunk) {
		// Did the first op (the selector) succeed (find the element)?
		if (nchunk === 0 && chunk == '0') {
			// Failure, abort
			clearInterval(clockInterval);
			clockReq.end();
		}
		nchunk++;
	});
});
```

Even in the simpler, non-streaming case, this code has a lot of boilerplate which can be hidden behind a jQuery-like API called `n$`. The network exchange - sending the requests and deferring for responses - will be simplified, but not abstracted away: the `write` function flushes the queue of operations into the stream, and the `end` function does a write and closes the request.

```javascript
// The 'li' example above, rewritten:
n$('li').eq(2).css('background-color', 'red').end();

// The clock example above, rewritten:
var clockInterval;
var $clock = n$('#my_clock').write(function(numMyClocks) {
	// This cb is called with the return values as arguments
	if (numMyClocks == 0) {
		clearInterval(clockInterval);
		$clock.end();
	}
});
clockInterval = setInterval(function() {
	$clock.html(getTime()).write();
}, 1000);
```


## Event Listening

Events are a key function of UIs. Their registration is handled in op transactions, as in the case of manipulations and traversals. Their response value, however, is a URI representing the [SSE](en.wikipedia.org/wiki/Server-sent_events) event-stream which will receive the events. It's up to the consumer to subscribe afterward. In the standard network API, this process is:

```javascript
// An example of registering event-listeners
var body = [
	['$', '.foo a'],
	['on', 'click']
];
local.dispatch({ method: 'POST', body: body, url: 'httpl://dom/myarea', headers: { 'Content-Type': 'application/json-stream' }})
	.then(function(res) {
		var nElements = res.body[0];
		var eventsUri = res.body[1];
		local.subscribe(eventsUri).on('click', function(e) {
			console.log(e.data); // { ... }
		});
	});
```

The `n$` API abstracts this into a single call:

```javascript
// The example above, rewritten:
n$('.foo a')
	.on('click', function(e) { console.log(e.data); /* => { ... } */ })
	.end();
```

The listener can managed by its URI:

```javascript
// The example above, with unregistration after 5 seconds:
n$('.foo a')
	.on('click', function(e) { console.log(e.data); /* => { ... } */ })
	.end(function(nEls, listenerUri) {
		setTimeout(function() {
			n$.off(listenerUri);
		}, 5000);
	});
```

Or by traversal context:

```javascript
// The example above, with unregistration after 5 seconds, rewritten:
n$('.foo a')
	.on('click', function(e) { console.log(e.data); /* => { ... } */ })
	.end();
setTimeout(function() {
	n$('.foo a').off('click').end();
}, 5000);
```


## Security / Mediated Access

Robust and usable access-control is another key requirement of GIDE. The most unique experiences of a networked GUI will emerge from cooperative resource-management between programs (drawing entities on a game canvas, adding features to an editor, etc). However, creating an effective universal policy would be too complex for GIDE to implement. Instead, this requirement is "punted."

DOM Web API's access controls are course-grained: Web consumers have their access constrained within specific nodes, and there is no means to mediate shared access by multiple consumers to a single node, or to control the capabilites of any consumer. This is instead relegated to userland (workers and peers) in which programs can offer high-level access to the GUI and implement access controls according to the program's domain. The userland services act as effective proxies to the DOM Web API. This can result in finer-grained DOM Manager (DM) programs, if the users need them.

Specifics of how the user will configure access control between userland programs will be explained in another document.


## application/json-stream

This media type is a set of newline-delimited (`\r\n`) JSON strings.


## Supported jQuery Operations

### manip

add
addClass
after
append
appendTo
attr
before
contents
css
data
detach
empty
hasClass
height
hide
html
index
innerHeight
innerWidth
insertAfter
insertBefore
offset
outerHeight
outerWidth
position
prepend
prependTo
prop
remove
removeAttr
removeClass
removeData
removeProp
replaceAll
replaceWith
scrollLeft
scrollTop
serialize
serializeArray
show
text
toggle
toggleClass
unwrap
val
width
wrap
wrapAll
wrapInner


### traversal

$
addBack
andSelf
children
clone
closest
die
end
eq
filter
find
first
has
hover
is
last
next
nextAll
nextUntil
not
offsetParent
parent
parents
parentsUntil
prev
prevAll
prevUntil
slice
siblings


### events

delegate
off
on
one
trigger
triggerHandler
unbind
undelegate


## Unsupported ops


### general

ajax*
animate
clearQueue
delay
dequeue
each
fadeIn
fadeOut
fadeTo
fadeToggle
finish
get
live
load
map
promise
pushStack
queue
ready
slideDown
slideToggle
slideUp
stop
toArray
unload

### event sugars

blur
change
click
dblclick
error
focus
focusin
focusout
keydown
keypress
keyup
mousedown
mouseenter
mouseleave
mousemove
mouseout
mouseover
mouseup
resize
scroll
select
submit