#!/usr/bin/nodejs

var PlugBotAPI  = require('./plugbotapi');

var creds = {
	email: 'cowgod@macnugget.org',
	password: 'BivvUm9Xh(t)n2JW'
};

var bot = new PlugBotAPI(creds);

bot.connect('pit-of-no-shame'); 

var cookies = bot.cookies;
// then set the cookies before connecting:
//bot.cookies = loadCookies(); // or something - just set the same cookies you accessed above here
//bot.connect(.....);

bot.on('chat', function(data) {
	console.log("got chat: ", data);
});
