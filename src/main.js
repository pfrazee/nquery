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