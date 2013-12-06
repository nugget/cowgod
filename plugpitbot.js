#!/usr/bin/env node

var fs = require('fs');
var util = require('util');
var argv = require('optimist').argv;
var sys = require('sys');
var exec = require('child_process').exec;
var argv = require('optimist').argv;

var cowgod = require('./cowgod.js');

var config = new Object();

if (typeof argv.nick === 'undefined') {
	console.log('Need a -nick name!');
	process.exit(1);
} else {
	var myname = argv.nick;
	var settings = require('./settings_'+myname+'.js');
}       

if (settings.dbname) {
	cowgod.logger('connecting to postgresql database '+settings.dbname);
	var PostgreSQL = require('pg').Client;

	var connstring = 'postgres://'+settings.dbuser+':'+settings.dbpass+'@'+settings.dbhost+':'+settings.dbport+'/'+settings.dbname;

	var botdb = new PostgreSQL(connstring);
	botdb.connect();

	settings.db = true;
} else {
	settings.db = false;
}

cowgod.logger('! My Name Is '+myname+' headed for '+settings.plug_room);

db_loadsettings();

var PlugAPI  = require('plugapi');
var UPDATECODE = 'fe940d';

if (typeof settings.log_tsv !== 'undefined') {
	var log_tsv  = fs.createWriteStream(settings.log_tsv,  {'flags': 'a'});
}

var nugget = {
	//moo: function() {
	//	console.log('Moo!');
	//};

	log: function() {
		cowgod.logger('raw nugget.log');
		for (var i = 0; i < arguments.length; i++) {
			console.log(arguments[i]);
		}
	}
}

if (typeof settings.irc_server !== 'undefined') {
	var irc = require('irc');
	cowgod.logger('Connecting to IRC '+settings.irc_server+' as '+settings.irc_nick);
	cuckoo = new irc.Client(settings.irc_server, settings.irc_nick, {
		selfSigned: true,
		certExpired: true,
		channels: [settings.irc_channel],
		userName: myname,
		realName: 'Plug.dj bot',
		debug: true,
		showErrors: true
	});

	cuckoo.addListener('message',function(from,to,text,message) {
		cowgod.logger('IRC <'+from+'> '+text);
		if (to == settings.irc_nick) {
			var response = process_cnc_command(text);
			cuckoo.say(from, response);
		}
	});
}

var bot = new PlugAPI(settings.plug_auth, UPDATECODE);
util.log(util.inspect(bot));
cowgod.set_active_bot(bot);

cowgod.logger('doing that logging thing, whatever the fuck that is');
bot.setLogObject(nugget);
cowgod.logger('connecting to '+settings.plug_room);
bot.connect(settings.plug_room);

cowgod.id_to_name('52499dacc3b97a430c54501d');

bot.on('roomJoin', function(data) {
	cowgod.logger('roomJoin');
	logger_tsv([ 'event','roomJoin','nickname',data.user.profile.username,'plug_user_id',data.user.profile.id,'djPoints',data.user.profile.djPoints,'fans',data.user.profile.fans,'listenerPoints',data.user.profile.listenerPoints,'avatarID',data.user.profile.avatarid ]);
	util.log(util.inspect(data));
	cowgod.remember_user(data.user.profile.id,data.user.profile.username);
	load_current_userlist(data);

});

bot.on('chat', function(data) {
	log_chat(data);
	cowgod.remember_user(data.fromID,data.from);
});

bot.on('emote', function(data) {
	log_chat(data);
	cowgod.remember_user(data.fromID,data.from);
});

bot.on('close', function(data) {
	cowgod.logger('close');
	util.log(util.inspect(data));
});

bot.on('error', function(data) {
	cowgod.logger('error');
	util.log(util.inspect(data));
});

bot.on('userJoin', function(data) {
	log_join(data);
	cowgod.remember_user(data.id,data.username);
});

bot.on('userLeave', function(data) {
	log_part(data);
});

bot.on('djUpdate', function(data) {
	log_djupdate(data);
	// process_waitlist();
});

bot.on('curateUpdate', function(data) {
	// this is like a TT snag
	log_curate(data);
});

bot.on('voteUpdate', function(data) {
	log_vote(data);
});

bot.on('userUpdate', function(data) {
	cowgod.logger('userUpdate');
	util.log(util.inspect(data));
});

bot.on('djAdvance', function(data) {
	var leader_prefix  = '';
	var leader_suffix  = '';

	if ('leader' in config && config['leader'] === data.currentDJ) {
		data.pitleader = true;
		leader_prefix   = '*** ';
		leader_suffix   = ' ***';
	} else {
		data.pitleader = false;
	}

	log_play(data);
	util.log(util.inspect(data));

	if (data.media.author !== 'undefined') {
		lag_vote();
		irc_set_topic(data.media.author+' - '+data.media.title+' ('+cowgod.id_to_name(data.currentDJ)+')'+leader_suffix);

		if (settings.announce_play) {
			bot.chat(leader_prefix+data.media.author+' - '+data.media.title+' ('+cowgod.id_to_name(data.currentDJ)+')'+leader_suffix);
		}
	}
});

function do_vote (vote) {
	// bot.chat('Woot!');
	cowgod.logger(' I am wooting');
	bot.woot();
}

function lag_vote (vote) {
	waitms = parseInt(Math.random() * 20000)+500;
	cowgod.logger('- will vote '+vote+' in '+waitms+' ms');
	setTimeout(function(){ do_vote(vote); }, waitms);
}

function logger_tsv(larray) {
	if (typeof log_tsv !== 'undefined') {
		var d = Math.round(new Date().getTime() / 1000.0);

		log_tsv.write('clock\t'+d);
		log_tsv.write('\t');
		log_tsv.write(larray.join('\t'));
		log_tsv.write('\n');
	}
}

function log_chat(data) {
	if (data.type == 'message') {
		cowgod.logger('<'+data.from+'> '+data.message);
	} else if (data.type == 'emote') {
		cowgod.logger('* '+data.from+' '+data.message);
	} else {
		cowgod.logger('chat (unknown type)');
		util.log(util.inspect(data));
	}
	logger_tsv([ 'event','chat','nickname',data.from,'room',data.room,'plug_user_id',data.fromID,'message',data.message,'type',data.type ]);
}

function log_vote(data) {
	if (data.vote == 1) {
		cowgod.logger(cowgod.id_to_name(data.id)+' wooted');
	} else {
		cowgod.logger('vote (unknown type)');
		util.log(util.inspect(data));
	}
	logger_tsv([ 'event','vote','vote',data.vote,'plug_user_id',data.id ]);
}

function log_join(data) {
	cowgod.logger(data.username+' joined the room');
	logger_tsv([ 'event','join','nickname',data.username,'plug_user_id',data.id,'status',data.status,'fans',data.fans,'listenerPoints',data.listenerPoints,'avatarID',data.avatarID,'djPoints',data.djPoints,'permission',data.permission ]);
}

function log_part(data) {
	cowgod.logger(cowgod.id_to_name(data.id)+' left the room');
	logger_tsv([ 'event','part','plug_user_id',data.id ]);
}

function log_curate(data) {
	cowgod.logger(cowgod.id_to_name(data.id)+' snagged this song');
	logger_tsv([ 'event','snag','plug_user_id',data.id ]);
}

function log_play(data) {
	if (data.media.author !== 'undefined') {
		cowgod.logger(cowgod.id_to_name(data.currentDJ)+' is playing '+data.media.title+' by '+data.media.author);
		logger_tsv( [ 'event','djAdvance','plug_user_id',data.currentDJ,'playlistID',data.playlistID,'song',data.media.author,'title',data.media.title,'duration',data.media.duration,'media_id',data.media.id,'media_cid',data.media.cid,'media_format',data.media.format,'leader',data.pitleader ]);
	}
}

function log_djupdate(data) {
	cowgod.logger('djUpdate:');
	util.log(util.inspect(data));
	cowgod.logger('--');
	util.log(util.inspect(data.djs));
	cowgod.logger('--');
	for (var u in data.djs) {
		cowgod.logger('logging a u.user '+u);
		util.log(util.inspect(data.djs[u]));
	}
}

function process_waitlist() {
	cowgod.logger('calling getWaitList');
	bot.getWaitList(function(data) {
		cowgod.logger('I gotWaitList');
		util.log(util.inspect(data));
	});
}

function process_cnc_command(command) {
	var argv = command.replace(/\s+/g,' ').split(' ');
	var command = argv[0].substr(1).toLowerCase();
	var args_arr = argv.slice(1);
	var args     = args_arr.join(' ');

	switch(command) {
		case 'say':
			cuckoo.say(settings.irc_channel,args);
			break;
		case 'plugsay':
			bot.chat(args);
			break;
		case 'woot':
		case 'awesome':
			bot.woot();
			return('Wooted');
			break;
		case 'set':
			if (argv.length == 1) {
				return('Usage: /SET config_item [value]');
				break;
			}
			var itemname = argv[1];
			var toggle   = argv[2];

			if (argv.length == 3) {
				set_config(itemname,toggle);
			}
			return(itemname+' is currently '+config[itemname]);
			break;
		default:
			return('Unknown command');
	}
}

function set_config (item,toggle) {
	config[item] = toggle;
    cowgod.logger('- config['+item+'] is now '+config[item]);
}

function toggle_config (item,toggle) {
    if (toggle === 'undefined') {
        if (config[item] != 'on') {
            config[item] = 'on';
        } else {
            config[item] = 'off';
        }
    } else {
        if (toggle == 'on') {
            config[item] = 'on';
        } else {
            config[item] = 'off';
        }
    }
    cowgod.logger('- config['+item+'] is now '+config[item]);
}

function irc_set_topic(topic) {
	if (typeof cuckoo === 'undefined') {
		return;
	}

	if (settings.irc_topic) {
		cuckoo.send('TOPIC',settings.irc_channel,topic);
	}
}

function load_current_userlist(data) {
	for (var u in data.room.users) {
		// cowgod.logger('logging a u.user '+u);
		// util.log(util.inspect(data.room.users[u]));
		cowgod.remember_user(data.room.users[u].id,data.room.users[u].username);
	}
	
	
}

function after(callback) {
    return function(err, queryResult) {
		if(err) {
            logger('database '+err+' (code '+err.code+' at pos '+err.position+')');
			return;
		}
		callback(queryResult);
	}
}

function db_loadsettings() {
	if (!settings.db) { return; }

	loadcount = 0;
	botdb.query('SELECT * FROM settings WHERE deleted IS NULL AND enabled IS TRUE AND (bot_id IS NULL OR bot_id = $1) ORDER BY bot_id DESC', [
		settings.userid
	], after(function(result) {
		result.rows.forEach(function(setval) {
			config[setval.key] = setval.value;
			cowgod.logger('- '+setval.key+' set to '+config[setval.key]+' from the database');
			loadcount = loadcount + 1;
		});
		cowgod.logger('- Loaded '+loadcount+' settings from database');
	}));
}
