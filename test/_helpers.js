
// test runner helpers

var done;
var startTime;
function printSuccess(res) {
	// Object.defineProperty(res, 'serializeHeaders', { value: undefined });
	delete res.serializeHeaders; // for some reason, doctest wont respect enumerable: false
	print('success');
	print(res);
	return res;
}
function printError(res) {
	delete res.serializeHeaders; // for some reason, doctest wont respect enumerable: false
	print('error');
	print(res);
	throw res;
}
function finishTest() {
	console.log('Test Duration:', Date.now() - startTime, 'ms');
	done = true;
}
function printSuccessAndFinish(res) { printSuccess(res); finishTest(); }
function printErrorAndFinish(err) { print('error'); print(err); finishTest(); }