#!/usr/bin/nodejs

var PlugBotAPI = require('plugbotapi');

PlugBotAPI.getAuth({
  username: 'flightaware', // twitter username
  password: 'WFz4wed7zJ' // twitter password
}, function(err, auth) {

  console.log('auth code is '+auth);

  var plugbotapi = new PlugBotAPI(auth);
  var room = 'pit-of-no-shame';

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
});
