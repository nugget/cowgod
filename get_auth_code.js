#!/usr/bin/env node

var argv = require('optimist').argv;

var PlugAPI  = require('plugapi');

if (typeof argv.username === 'undefined' || typeof argv.password === 'undefined') {
	console.log('Usage: get_auth_code.js --username TWITTER_USERNAME --password TWITTER_PASSWORD');
	process.exit(1);
} else {
	PlugAPI.getAuth({
		username: argv.username,
		password: argv.password,
	}, function(err, auth) {
	    if(err) {
			console.log('An error occurred: ' + err);
	        process.exit(2);
		} else {
			console.log('Authenticated successfully!');
			console.log('auth code: '+auth);
		}
	});
}
