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

var usernames = new Object();

var PlugAPI  = require('plugapi');
var UPDATECODE = 'fe940c';

var log_tsv  = fs.createWriteStream(settings.log_tsv,  {'flags': 'a'});

// var bot = new PlugAPI(settings.plug_auth);
// bot.connect(settings.plug_room);
//

var bot = new PlugAPI(settings.plug_auth, UPDATECODE);
logger('connecting to '+settings.plug_room);
bot.connect(settings.plug_room);

bot.on('roomJoin', function(data) {
	logger('roomJoin');
	logger_tsv([ 'event','roomJoin','nickname',data.user.profile.username,'plug_user_id',data.user.profile.id,'djPoints',data.user.profile.djPoints,'fans',data.user.profile.fans,'listenerPoints',data.user.profile.listenerPoints,'avatarID',data.user.profile.avatarid ]);
	util.log(util.inspect(data));
	remember_user(data.user.profile.id,data.user.profile.username);
});

bot.on('chat', function(data) {
	log_chat(data);
	remember_user(data.fromID,data.from);
});

bot.on('emote', function(data) {
	log_chat(data);
	remember_user(data.fromID,data.from);
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
	log_join(data);
	remember_user(data.id,data.username);
});

bot.on('userLeave', function(data) {
	log_part(data);
});

bot.on('djUpdate', function(data) {
	logger('djUpdate');
	util.log(util.inspect(data));
});

bot.on('curateUpdate', function(data) {
	// this is like a TT snag
	log_curate(data);
});

bot.on('voteUpdate', function(data) {
	log_vote(data);
});

bot.on('userUpdate', function(data) {
	logger('userUpdate');
	util.log(util.inspect(data));
});

bot.on('djAdvance', function(data) {
	log_play(data);
	if (data.media.author !== 'undefined') {
		lag_vote();
	}
});

function do_vote (vote) {
	// bot.chat('Woot!');
	logger(' I am wooting');
	bot.woot();
}

function lag_vote (vote) {
	waitms = parseInt(Math.random() * 20000)+500;
	logger('- will vote '+vote+' in '+waitms+' ms');
	setTimeout(function(){ do_vote(vote); }, waitms);
}

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

function log_chat(data) {
	if (data.type == 'message') {
		logger('<'+data.from+'> '+data.message);
	} else if (data.type == 'emote') {
		logger('* '+data.from+' '+data.message);
	} else {
		logger('chat (unknown type)');
		util.log(util.inspect(data));
	}
	logger_tsv([ 'event','chat','nickname',data.from,'room',data.room,'plug_user_id',data.fromID,'message',data.message,'type',data.type ]);
}

function log_vote(data) {
	if (data.vote == 1) {
		logger(id_to_name(data.id)+' wooted');
	} else {
		logger('vote (unknown type)');
		util.log(util.inspect(data));
	}
	logger_tsv([ 'event','vote','vote',data.vote,'plug_user_id',data.id ]);
}

function log_join(data) {
	logger(data.username+' joined the room');
	logger_tsv([ 'event','join','nickname',data.username,'plug_user_id',data.id,'status',data.status,'fans',data.fans,'listenerPoints',data.listenerPoints,'avatarID',data.avatarID,'djPoints',data.djPoints,'permission',data.permission ]);
}

function log_part(data) {
	logger(id_to_name(data.id)+' left the room');
	logger_tsv([ 'event','part','plug_user_id',data.id ]);
}

function log_curate(data) {
	logger(id_to_name(data.id)+' snagged this song');
	logger_tsv([ 'event','snag','plug_user_id',data.id ]);
}

function log_play(data) {
	logger(id_to_name(data.currentDJ)+' is playing '+data.media.title+' by '+data.media.author);
	if (data.media.author !== 'undefined') {
		logger_tsv( [ 'event','djAdvance','plug_user_id',data.currentDJ,'playlistID',data.playlistID,'song',data.media.author,'title',data.media.title,'duration',data.media.duration,'media_id',data.media.id,'media_cid',data.media.cid,'media_format',data.media.format ]);
	}
}

function remember_user(id,name) {
	if (typeof usernames[id] === 'undefined') {
		logger('- remembering that '+name+' is user_id '+id);
		usernames[id] = name;
	}
}

function id_to_name (user_id) {
    for (var k in usernames) {
        if (k == user_id) {
            return usernames[k];
        }
    }
	return 'unknown user';
}

function name_to_id (username) {
	for (var k in usernames) {
		if (usernames[k] == username) {
			return k;
		}
	}
	return;
}
