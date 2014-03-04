var region2path = nQueryService.addRegion($('#region2'), { token: 12345 });
var n$ = nQuery.client('httpl://nquery'+region2path);

// with good token

done = false;
startTime = Date.now();
n$().html('<p class="foo">Hello, world</p>', print).html(printSuccessAndFinish);
wait(function () { return done; });

/* =>
1
success
<p class="foo">Hello, world</p>
*/

// with bad token

var n$ = nQuery.client('httpl://nquery'+region2path+'6789');
done = false;
startTime = Date.now();
var txn = n$('.foo').css('background-color', 'rgb(255, 0, 0)');
txn.responsePromise.always(printSuccessAndFinish);
wait(function () { return done; });

/* =>
success
{
  body: "",
  headers: {
    link: "</>; rel=\"service\"; title=\"nQuery DOM Service\", </regions>; rel=\"collection up\"; id=\"regions\"; title=\"DOM Regions\", </regions/0{?token}>; rel=\"item\"; id=\"0\"; title=\"Region #0\", </regions/1{?token}>; rel=\"item self\"; id=\"1\"; title=\"Region #1\""
  },
  reason: "Forbidden",
  status: 403
}
*/

// with no token

var n$ = nQuery.client('httpl://nquery'+region2path.replace(/(\?.*)/, ''));
done = false;
startTime = Date.now();
var txn = n$('.foo').css('background-color', 'rgb(255, 0, 0)');
txn.responsePromise.always(printSuccessAndFinish);
wait(function () { return done; });

/* =>
success
{
  body: "",
  headers: {
    link: "</>; rel=\"service\"; title=\"nQuery DOM Service\", </regions>; rel=\"collection up\"; id=\"regions\"; title=\"DOM Regions\", </regions/0{?token}>; rel=\"item\"; id=\"0\"; title=\"Region #0\", </regions/1{?token}>; rel=\"item self\"; id=\"1\"; title=\"Region #1\""
  },
  reason: "Forbidden",
  status: 403
}
*/