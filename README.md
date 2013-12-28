# `n$` - local.js service wrapper to jQuery

Uses HTTPL requests to stream jQuery RPC operations between VM environments. The common use-case is to run the nQuery server on a page, then use the nQuery client in a Worker or RTC peer to remotely manipulate the DOM. Uses region-sandboxing and function whitelisting to control what clients can access.

Depends on jquery and local.js.

**In progress - the access control is unfinished. Handle with the appropriate ten-foot poles.**

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
console.log(regionPath); // "/regions/2?token=1251098671093850"
// regions with access tokens will forbid requests without the correct token query param
```

From myworker.js:

```javascript
var n$ = new nQuery.Client('httpl://host.page/regions/1');
// -or-
var n$ = new nQuery.Client('httpl://host.page/regions/2?token=1251098671093850');

// Traversal and manipulation
n$('div')
  .eq(3)
  .html('<p class="foo">Hello, world</p>')
  .css('background', 'red');

// Reading return values with the optional callback
n$('.foo').css('background', 'green', function(numAffected) {
  console.log(numAffected); // 1
});
n$('.foo').css('background', function(bgs) {
  console.log(bgs); // ['green']
});

// Events
n$('.foo').on('click', onClick, function(eventStreamURI) {
	console.log(eventStreamURI); // "httpl://host.page/regions/2/evt/1?token=...."
	n$.off(eventStreamURI); // stop listening
});
function onClick(e) {
	console.log(e); /* =>
	{
		altKey: false
		bubbles: true
		button: 0
		...
		type: "click"
		which: 1
	} */
	// note that unpassable references such as `target` are not included
}
```

## How It Works

Operations are serialized and streamed through the request body, which the server reads and checks against a whitelist before executing. Traversals are checked to make sure they remain within the allowed region. Return values of the operations are serialized into the response body.

The request stream's lifetime is considered a transaction which maintains a traversal position. Ending the request closes the transaction and releases that state.

```
// This jQuery command
$('li').eq(2).css('background-color', 'red');

// Translates to
POST /regions/1
Content-Type: application/json-stream
["find", "li"]
["eq", 2]
["css", "background-color", "red"]

// Which receives
200 OK
Content-Type: application/json-stream
5
1
1
```

The response stream includes direct or representative return values. Traversals are an example of representative returns: they get back the numeric length of the set created by the traversal (rather than the set itself, which contains non-transferrable references). The return values are written to the response stream as the operations are run.

Persistant transactions (requests) can be used to make continuous updates.

```javascript
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
```

By default, however, where `persist` is false, the transaction is automatically closed on next tick.

## Event Listening

Event registration works like other operations, but it generates a new SSE event-stream resource to send the events. The return value, then, is the URI of that event stream.

```
// This request
POST /regions/1
Content-Type: application/json-stream
["find", ".foo a"]
["on", "click"]

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

This media type is a set of CLRF-delimited (`\r\n`) JSON strings. It's used to serialize the operations and return values.

## API

todo


## Whitelisted Operations

This list is still being evaluated.

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


## Blacklisted ops


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