# `n$` - local.js service wrapper to jQuery

Uses HTTPL requests to stream jQuery RPC operations between VM environments. The common use-case is to run the nQuery server on a page, then use the nQuery client in a Web Worker or RTC peer to remotely manipulate the DOM. Uses region-sandboxing and function whitelisting to control what clients can access in the DOM.

Depends on jquery and local.js.

**In progress - the access control is unfinished. Going to take some time to get it secure. Handle with the appropriate ten-foot poles.**

## Examples

From a page constructing the nQuery server:

```javascript
var nQueryService = new nQuery.Server();
local.spawnWorker('myworker.js', nQueryService);
// ^ incoming requests by myworker.js will be handled by nQueryService

var regionPath = nQueryService.addRegion('#worker-content');
console.log(regionPath); // "/regions/1"
nQueryService.removeRegion(regionPath);

regionPath = nQueryService.addRegion('#worker-content', { token: 1251098671093850 });
console.log(regionPath); // "/regions/1?token=1251098671093850"
// regions with access tokens will forbid requests without the correct token query param
```

From a worker that's calling out to an nQuery server:

```javascript
var n$ = new nQuery.Client('httpl://host.page/regions/1');
// -or-
var n$ = new nQuery.Client('httpl://host.page/regions/1?token=1251098671093850');

// Traversal and manipulation
n$('div')
  .eq(3)
  .html('<p class="foo">Hello, world</p>')
  .css('background', 'red');

// Reading return values with the optional callback
n$('.foo').css('background', function(bgs) {
  console.log(bgs); // ['red']
});
n$('.foo').css('background', 'green', function(numAffected) {
  console.log(numAffected); // 1
});

// Persistant transactions
var num_updates = 0;
var $foo = n$('.foo', { persist: true });
var interval = setInterval(function() {
	// Do a "clock" output for five seconds, then close the transaction
	$foo.text(''+new Date());
	if (++num_updates == 5) {
		clearInterval(interval);
		$foo.closeTxn();
	}
}, 1000);

// Events
n$('.foo')
	.on('click', function(e) {
		console.log(e); /* =>
		{
			altKey: false
			bubbles: true
			button: 0
			cancelable: true
			clientX: 94
			clientY: 330
			ctrlKey: false
			data: undefined
			eventPhase: 3
			metaKey: false
			offsetX: 94
			offsetY: 330
			pageX: 94
			pageY: 330
			screenX: 94
			screenY: 415
			shiftKey: false
			timeStamp: 1388267407725
			type: "click"
			which: 1
		} ^ notice that unpassable references such as `target` are not included
		*/
	}, function(eventStreamURI) {
		console.log(eventStreamURI); // "httpl://host.page/regions/1/evt/1?token=...."
		n$.off(eventStreamURI); // stop listening
	});
```

## How It Works

Networked access to the document enables workers and WebRTC peers to share control of the GUI via messaging rather than entering the GUI thread.

The jQuery API uses chains of ordered operations, which means the ops can't be sent individually as requests (seperate requests have no delivery-order guarantees). Instead, the ops are streamed in the request body. Ending a request closes the transaction and releases any related state (eg the traversal position). For instance:

```
// This jQuery command
$('li').eq(2).css('background-color', 'red');

// Translates to
POST /regions/1
Content-Type: application/json-stream
['find', 'li']
['eq', 2]
['css', 'background-color', 'red']

// Which receives
200 OK
Content-Type: application/json-stream
5
1
1
```

The response entity includes a stream of direct or representative return values. Traversals are an example of representative returns; they get back the numeric length of the set created by the traversal (rather than the set itself, which contains non-transferrable references to DOM elements). The return values are written to the response stream as the operations are run, so persistant transactions (requests) can be used to make continuous updates.


## Event Listening

Event registration works like other operations, but it generates a new SSE event-stream resource to send the events. The return value, then, is the URI of that event stream.

```
// This request
POST /regions/1
Content-Type: application/json-stream
['find', '.foo a']
['on', 'click']

// Receives
200 OK
Content-Type: application/json-stream
1
"/regions/1/evt/1"
```

The `n$` client auto-subscribes to the URI with the given cb parameter.

```javascript
// The example above, rewritten:
n$('.foo a').on('click', function(e) { console.log(e); /* => { ... } */ });
```

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