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

var log_tsv  = fs.createWriteStream(settings.log_tsv,  {'flags': 'a'});

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
		logger_tsv([ 'event','roomJoin','nickname',data.user.profile.username,'plug_user_id',data.user.profile.id,'djPoints',data.user.profile.djPoints,'fans',data.user.profile.fans,'listenerPoints',data.user.profile.listenerPoints,'avatarID',data.user.profile.avatarid ]);
		util.log(util.inspect(data));
    });

	bot.on('chat', function(data) {
		logger('chat');
		logger_tsv([ 'event','chat','nickname',data.from,'room',data.room,'plug_user_id',data.fromID,'message',data.message,'type',data.type ]);
		util.log(util.inspect(data));
	});

	bot.on('emote', function(data) {
		logger('emote');
		logger_tsv([ 'event','chat','nickname',data.from,'room',data.room,'plug_user_id',data.fromID,'message',data.message,'type',data.type ]);
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
		logger_tsv( [ 'event','djAdvance','plug_user_id',data.currentDJ,'playlistID',data.playlistID,'song',data.media.author,'title',data.media.title,'duration',data.media.duration,'media_id',data.media.id,'media_cid',data.media.cid,'media_format',data.media.format ]);
		lag_vote();
	});

function do_vote (vote) {
	bot.chat('Woot!');
	bot.woot();
}

function lag_vote (vote) {
	waitms = parseInt(Math.random() * 20000)+500;
	logger('- will vote '+vote+' in '+waitms+' ms');
	setTimeout(function(){ do_vote(vote); }, waitms);
}


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

function logger_tsv(larray) {
if (typeof log_tsv === 'undefined') {
} else {
	var d = Math.round(new Date().getTime() / 1000.0);

	log_tsv.write('clock\t'+d);
	log_tsv.write('\t');
	log_tsv.write(larray.join('\t'));
	log_tsv.write('\n');
}
																	}

