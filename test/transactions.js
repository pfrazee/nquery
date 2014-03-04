var nQueryService = new nQuery.Server();
local.addServer('nquery', nQueryService);
var region1path = nQueryService.addRegion($('#region1'));
var n$ = nQuery.client('httpl://nquery'+region1path);

// html()

done = false;
startTime = Date.now();
n$().html('<p class="foo">Hello, world</p>', print).html(printSuccessAndFinish);
wait(function () { return done; });

/* =>
1
success
<p class="foo">Hello, world</p>
*/

// find(), css()

done = false;
startTime = Date.now();
n$('.foo').css('background-color', 'rgb(255, 0, 0)', print).css('background-color', printSuccessAndFinish);
wait(function () { return done; });

/* =>
1
success
rgb(255, 0, 0)
*/