#!/usr/bin/env node

var fs = require('fs');
var util = require('util');
var argv = require('optimist').argv;
var sys = require('sys');
var exec = require('child_process').exec;
var argv = require('optimist').argv;

if (typeof argv.nick === 'undefined') {
	console.log('Need a -nick name!');
	process.exit(1);
} else {
	var myname = argv.nick;
	var settings = require('./settings_'+myname+'.js');
}       
logger('! My Name Is '+myname+' headed for '+settings.plug_room);

var PlugAPI  = require('plugapi');
var UPDATECODE = 'fe940c';

// var bot = new PlugAPI(settings.plug_auth);
// bot.connect(settings.plug_room);
//

PlugAPI.getAuth({
    username: 'cowgodpit',
    password: 'GDe4AxX9quIEkwjhSrMf'
}, function(err, auth) {
    if(err) {
        logger("An error occurred: " + err);
        return;
    }
	logger('getAuth seems to have worked with '+auth);

    var bot = new PlugAPI(auth, UPDATECODE);
	logger('connecting to '+settings.plug_room);
    bot.connect(settings.plug_room);

    bot.on('roomJoin', function(data) {
		logger('roomJoin');
		util.log(util.inspect(data));
    });

	bot.on('chat', function(data) {
		logger('chat');
		util.log(util.inspect(data));
	});

	bot.on('emote', function(data) {
		logger('chat');
		util.log(util.inspect(data));
	});

	bot.on('close', function(data) {
		logger('close');
		util.log(util.inspect(data));
	});

	bot.on('error', function(data) {
		logger('error');
		util.log(util.inspect(data));
	});

	bot.on('userJoin', function(data) {
		logger('userJoin');
		util.log(util.inspect(data));
	});

	bot.on('userLeave', function(data) {
		logger('userLeave');
		util.log(util.inspect(data));
	});

	bot.on('djAdvance', function(data) {
		logger('djAdvance');
		util.log(util.inspect(data));
		bot.chat('Woot!');
		bot.woot();
	});

});

logger('! Hi Hi');

function logger(buf) {
	var d=new Date();
	var hh=d.getHours();
	var mm=d.getMinutes();
	if(mm < 10) {
		mm = '0'+mm;
	}
	if(hh < 10) {
		hh = '0'+hh;
	}
	if (typeof log_chat === 'undefined') {
	} else {
		log_chat.write('['+d+'] ');
		log_chat.write(buf+'\n');
	}
	console.log('['+hh+':'+mm+'] '+buf);
}

