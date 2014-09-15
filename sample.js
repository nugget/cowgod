#!/usr/bin/nodejs

var PlugBotAPI  = require('./plugbotapi');

var creds = {
	email: 'cowgod@macnugget.org',
	password: 'BivvUm9Xh(t)n2JW'
};

console.log('connecting to plug');
var plugbotapi = new PlugBotAPI(creds);
var room = 'pit-of-no-shame';

console.log('joinging community');
plugbotapi.connect(room);

plugbotapi.on('roomJoin', function() {
	console.log("Connected!");

	plugbotapi.chat('Hello World');

	plugbotapi.getUsers(function(users) {
      console.log("Number of users in the room: " + users.length);
    });

    plugbotapi.hasPermission('52a648c496fba57878e8f809', 'API.ROLE.NONE', function(result) {
      console.log("permission: ", result);
    });
});

// A few sample events
plugbotapi.on('chat', function(data) {
	console.log("got chat: ", data);
});

plugbotapi.on('djAdvance', function(data) {
	console.log("dj advance: ", data);
});

plugbotapi.on('voteUpdate', function(data) {
	console.log("vote update: ", data);
});
