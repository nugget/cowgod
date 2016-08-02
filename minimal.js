#!/usr/bin/env node

var PlugAPI = require('plugapi');

var settings = require('./settings_cowgod.js');

new PlugAPI({
	email: settings.email,
	password: settings.password
}, function(err, bot) {
    if (!err) {
        bot.connect('pit-of-no-shame'); // The part after https://plug.dj

        bot.on('roomJoin', function(room) {
            console.log("Joined " + room);
        });

    } else {
        console.log('Error initializing plugAPI: ' + err);
    }
});
