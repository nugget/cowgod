#!/usr/bin/env node

Syslog = require('node-syslog');
Syslog.init('plugbot', Syslog.LOG_PID | Syslog.LOG_ODELAY, Syslog.LOG_LOCAL0);

var PlugAPI = require('plugapi');

var fs = require('fs');
var util = require('util');
var argv = require('optimist').argv;
var sys = require('sys');
var exec = require('child_process').exec;
var argv = require('optimist').argv;
var sleep = require('sleep');
var timediff = require('timediff');

cowgod = require('./cowgod.js');

var config = new Object();
var global = new Object();
var localv = new Object();

var admins = new Array();
var trendsetters = new Array();
var bots = new Array();
var outcasts = new Array();

//heartbeat_reset('init');
//setInterval(heartbeat, 60000);

if (typeof argv.nick === 'undefined') {
	console.log('Need a -nick name!');
	process.exit(1);
} else {
	var myname = argv.nick;
	var settings = require('./settings_'+myname+'.js');
}

function after(callback) {
	return function(err, queryResult) {
		if(err) {
			cowgod.logger('database '+err+' (code '+err.code+' at pos '+err.position+')');
			return;
		}
		callback(queryResult);
	}
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

function db_loadsettings(callback) {
	if (!settings.db) { return; }

	var loadcount = 0;
	var seen = new Array();

	botdb.query('SELECT * FROM settings WHERE deleted IS NULL AND enabled IS TRUE AND (uid IS NULL OR uid = $1) ORDER BY uid', [
		settings.userid
	], after(function(result) {

		result.rows.forEach(function(setval) {
			if (seen.indexOf(setval.key) != -1) {
				// cowgod.logger('- skipping setting '+setval.key+' for uid '+setval.uid+' because it is a duplicate');
			} else {
				seen.push(setval.key);

				if (setval.key in config) {
					if (config[setval.key] != setval.value) {
						config[setval.key] = setval.value;
						cowgod.logger('- config '+setval.key+' changed to '+config[setval.key]+' from the database (uid '+setval.uid+')');
						loadcount = loadcount + 1;
					}
				} else {
					config[setval.key] = setval.value;
					cowgod.logger('- config '+setval.key+' set to '+config[setval.key]+' from the database (uid '+setval.uid+')');
					loadcount = loadcount + 1;
				}
			}
		});
		if (loadcount > 0) {
			cowgod.logger('- Loaded '+loadcount+' settings from database');
		}

		callback();
	}));
}

function db_loadglobals() {
	if (!settings.db) { return; }

	var loadcount = 0;
	botdb.query('SELECT * FROM globals WHERE uid = $1 ORDER BY added', [
		settings.userid
	], after(function(result) {
		result.rows.forEach(function(setval) {
			global[setval.key] = setval.value;
			cowgod.logger('- global '+setval.key+' set to '+global[setval.key]+' from the database');
			loadcount = loadcount + 1;
		});
		cowgod.logger('- Loaded '+loadcount+' globals settings from database');
	}));
}

function db_loadusers() {
	if (!settings.db) { return; }

	admins.length = 0;
	botdb.query('SELECT uid FROM users WHERE uid IS NOT NULL AND (owner IS TRUE OR admin IS TRUE) ORDER BY nickname',after(function(result) {
		result.rows.forEach(function(user) {
			admins.push(user.uid);
		});
		cowgod.logger('- Loaded '+admins.length+' admins from database');
	}));

	trendsetters.length = 0;
	botdb.query('SELECT uid FROM users WHERE uid IS NOT NULL AND (trendsetter IS TRUE) ORDER BY nickname',after(function(result) {
		result.rows.forEach(function(user) {
			trendsetters.push(user.uid);
		});
		cowgod.logger('- Loaded '+trendsetters.length+' trendsetters from database');
	}));

	bots.length = 0;
	botdb.query('SELECT uid FROM users WHERE uid IS NOT NULL AND (bot IS TRUE) ORDER BY nickname',after(function(result) {
		result.rows.forEach(function(user) {
			bots.push(user.uid);
		});
		cowgod.logger('- Loaded '+bots.length+' bots from database');
	}));

	outcasts.length = 0;
	botdb.query('SELECT uid FROM users WHERE uid IS NOT NULL AND (ignore IS TRUE) ORDER BY nickname',after(function(result) {
		result.rows.forEach(function(user) {
			outcasts.push(user.uid);
		});
		cowgod.logger('- Loaded '+outcasts.length+' outcasts from database');
	}));
}


db_loadsettings(function() {
	if ('log_tsv' in config) {
		config['log_filehandle']  = fs.createWriteStream(config['log_tsv'],  {'flags': 'a'});
		cowgod.logger('Opened '+config['log_tsv']+' for logging');
	} else {
		cowgod.logger('Logging is disabled');
	}
});

db_loadglobals();
db_loadusers();

cowgod.logger('! My Name Is '+myname+' headed for '+settings.plug_room);

new PlugAPI({
	email: settings.email,
	password: settings.password
}, function(err, bot) {
	util.log(util.inspect(bot));
	cowgod.set_active_bot(bot);

	cowgod.logger('connecting to '+settings.plug_room);
	bot.connect(settings.plug_room);

	if (typeof settings.irc_server !== 'undefined') {
		var irc = require('irc');
	}

	function connect_to_irc() {
		if (typeof settings.irc_server == 'undefined') {
			return;
		}

		cowgod.logger('Connecting to IRC '+settings.irc_server+' as '+settings.irc_nick);
		cuckoo = new irc.Client(settings.irc_server, settings.irc_nick, {
			selfSigned: true,
			certExpired: true,
			channels: [settings.irc_channel],
			userName: myname,
			realName: 'Plug.dj bot',
			debug: false,
			showErrors: true
		});

		cuckoo.addListener('message',function(from,to,text,message) {
			cowgod.logger('IRC <'+from+'> '+text);
			if (to == settings.irc_nick) {
				var response = process_irc_message(from,to,text,message);
				if (response != null) {
					cowgod.logger('irc send '+response);
					cuckoo.say(from, response);
				}
			}
		});

		cuckoo.addListener('notice',function(from,to,text,message) {
			cowgod.logger('IRC <'+from+'> '+text);
			if (to == settings.irc_nick) {
				var response = process_irc_message(from,to,text,message);
				if (response != null) {
					cowgod.logger('irc send '+response);
					cuckoo.say(from, response);
				}
			}
		});
	}

	function process_irc_message(from,to,text,message) {
		if(text.substr(0,1) == '/') {
			cowgod.logger('Command detected');
			return process_cnc_command(text,from);
		}

		if(from == 'NickServ') {
			if(text.indexOf('You have 30 seconds to identify to your nickname before it is changed') >= 0) {
				nickserv_identify();
				return;
			}
			return;
		}

		return 'Moo';
	}

	function nickserv_register() {
		cuckoo.say('NickServ','REGISTER '+settings.irc_password+' '+settings.irc_nick+'@macnugget.org');
		cuckoo.say('NickServ','SET ENFORCE ON');
		cuckoo.say('NickServ','SET HIDEMAIL ON');
		cuckoo.say('NickServ','SET NOGREET ON');
		cuckoo.say('NickServ','SET NOMEMO ON');
	}
		
	function nickserv_identify() {
		var buf = 'IDENTIFY '+settings.irc_password;
		cowgod.logger('Registering with NickServ: '+buf);
		cuckoo.say('NickServ',buf);
	}

	var reconnect = function() {
		cowgod.logger('Disconnected from Plug.dj');
		process.exit(1);
		cowgod.logger('Disconnected from Plug.dj, will reconnect momentarily...');
		waitms = parseInt(Math.random() * 20000)+500;
		setTimeout(function(){ bot.connect(settings.plug_room); }, waitms);
	}

	bot.on('close', reconnect);
	bot.on('error', reconnect);
	bot.on('unableToConnect', reconnect);
	bot.on('connectionError', reconnect);
	bot.on('invalidLogin', reconnect);

	bot.on('debug', function(text) {
		if (config_enabled('debug')) {
			cowgod.logger(text);
		}
	});

	bot.on('roomJoin', function(data) {
		cowgod.logger('roomJoin');
		heartbeat_reset('roomJoin');
		localv['voted'] = false;
		process_userlist();
		process_waitlist();
		connect_to_irc();
	});

	bot.on('chat', function(data) {
		// cowgod.logger('chat');
		heartbeat_reset('chat');
		// util.log(util.inspect(data));
		log_chat(data);
		cowgod.remember_user(data.from.id,data.from.username);
		did_user_get_ninjad(data);
	});

	bot.on('emote', function(data) {
		heartbeat_reset('emote');
		log_chat(data);
		cowgod.remember_user(data.from.id,data.from);
	});

	bot.on('userJoin', function(data) {
		heartbeat_reset('userJoin');
		//cowgod.logger('join event');
		//util.log(util.inspect(data));
		cowgod.remember_user(data.id,data.username);
		log_join(data);
		update_user(data);
		process_waitlist();

		if (config_enabled('greet_bagel')) {
			if (data.id == 3664680) {
				// lag_say('https://i.chzbgr.com/maxW500/8282054144/hEFDE7F7B/.gif');
				lag_say('http://31.media.tumblr.com/98a0849910642e43808a144b01fae784/tumblr_mvvfp4fZ3Y1s373hwo1_500.gif');
			}
		};
		if (config_enabled('greet_pink')) {
			if (data.id == 4104272 ) {
				lag_say('http://i.imgur.com/TggQP.gif');
			}
		};

	});

	bot.on('userLeave', function(data) {
		heartbeat_reset('userLeave');
		// cowgod.logger('leave event');
		// util.log(util.inspect(data));
		log_part(data);
		process_waitlist();
	});

	bot.on('djListUpdate', function(data) {
		heartbeat_reset('waitListUpdate');
		cowgod.logger('waitListUpdate event');
		//util.log(util.inspect(data));
		process_waitlist('djUpdate');
	});

	bot.on('scoreUpdate', function(data) {
		// 8 Jun 20:06:57 - { positive: 2, negative: 0, grabs: 0 }
		heartbeat_reset('scoreUpdate');
		cowgod.logger('scoreUpdate event');
		util.log(util.inspect(data));
	});

	bot.on('grab', function(data) {
		heartbeat_reset('grab');
		//cowgod.logger('grab event');
		//util.log(util.inspect(data));
		// this is like a TT snag
		log_curate(data);
	});

	bot.on('vote', function(data) {
		heartbeat_reset('voteUpdate');
		//cowgod.logger('voteUpdate event');
		//util.log(util.inspect(data));
		log_vote(data);
	});
	
	bot.on('userUpdate', function(data) {
		heartbeat_reset('userUpdate');
		cowgod.logger('userUpdate');
		util.log(util.inspect(data));
	});

	bot.on('advance', function(data) {
		heartbeat_reset('advance');
		cowgod.logger('advance event');
		// util.log(util.inspect(data));
		localv['voted'] = false;

		if (localv['leader_play'] == true) {
			cowgod.logger('This is the song immediately following the leader play');
			cowgod.logger('currentDJ is '+data.currentDJ.id+' and isleader is '+is_leader(data.currentDJ.id));
			if (!is_leader(data.currentDJ.id)) {
				if (global['waitlist'] != '') {
					if (global['room_mode'] == 'roulette') {
						cowgod.logger('We are eligibile for the roulette revolver');
						play_roulette();
					}
				}
			}
		}
		localv['leader_play'] = false;
	
		var leader_prefix  = '';
		var song_divider = '';

		if (data.media === null || typeof data.media === 'undefined') {
			current_dj(null);
			set_global('leader','','Nothing is playing');
			irc_set_topic('Nothing is playing in the Pit :(');
			process_waitlist('silence');
		} else {
			cowgod.remember_user(data.currentDJ.id,data.currentDJ.username);

			var playstart = new Date(Date.parse(data.startTime+' GMT-0000'));
			var playtime = timediff(playstart,'now','s');

			if (playtime.milliseconds > 10000) {
				cowgod.logger('This song has been playing for '+playtime.milliseconds+'ms so I will skip the normal advance activities');
				return;
			} else {
				cowgod.logger('This song has only been playing for '+playtime.milliseconds+'ms so I will perform the normal advance activities');
			}

			if (is_leader(data.currentDJ.id)) {
				// cowgod.logger('this dj is the leader');
				data.pitleader = true;
				localv['leader_play'] = true;

				if (global['waitlist'] != '') {
					// cowgod.logger('wl is '+global['waitlist']);
					leader_prefix   = ':star2: ';
				}

				// cowgod.logger('setting a new lead song');
				set_global('lead_song',song_string(data.media));
			} else {
				// cowgod.logger('this dj is not the leader');
				data.pitleader = false;
			}

			log_play(data);

			if (config_enabled('autobop') || (config_enabled('woot_leaders') && is_trendsetter(data.currentDJ.id))) {
				if (!localv['voted']) {
					localv['voted'] = true;
					lag_vote(1);
				}
			}
			irc_set_topic(song_string(data.media)+' ('+cowgod.id_to_name(data.currentDJ.id)+')');
			current_dj(data.currentDJ.id);

			if (config_enabled('song_dividers')) {
				song_divider = 'https://macnugget.org/cowgod/images/noshamediv.png ';
			}

			if (config_enabled('announce_play')) {
				if (data.pitleader == true) {
					if (global['waitlist'] != '') {
						bot.sendChat(leader_prefix+' LEAD SONG');
					}
				}
				bot.sendChat(song_divider+leader_prefix+song_string(data.media)+' ('+cowgod.id_to_name(data.currentDJ.id)+')');

				if (data.pitleader == true) {
					if (global['waitlist'] != '') {
						if (global['room_mode'] == 'roulette') {
							if (global['bullets'] == 1) {
								bot.sendChat(':gun: Leader Roulette is enabled! There is '+global['bullets']+' bullet in the revolver...');
							} else {
								bot.sendChat(':gun: Leader Roulette is enabled! There are '+global['bullets']+' bullets in the revolver...');
							}
						}
					}
				}
			}
		}
	
		process_userlist();
		process_waitlist('djAdvance');
		db_loadsettings(function() {});
	});

	function play_roulette() {
		var bootid = global['leader'];
		var roll = Math.floor((Math.random()*6)+1);
		var bang = 'FALSE';

		cowgod.logger(cowgod.id_to_name(bootid)+' hit chamber '+roll+' with '+global['bullets']+' in the gun');

		if (bootid && roll <= global['bullets']) {
			bang = 'TRUE';

			var logline = ':gun: @'+cowgod.id_to_name(bootid)+' has been shot!';
			bot.sendChat(logline);
			bot.moderateRemoveDJ(parseInt(global['leader']));
		} else {
			var logline = ':gun: *click*';
			bot.sendChat(logline);
		}

		return;
	}

	function song_string(media) {
		return media.author+' - '+media.title;
	}
	
	function do_vote (vote) {
		if (is_outcast(global['current_dj'])) {
			cowgod.logger('skipping vote for outcast');
			return;
		}
		if (typeof vote === 'undefined') {
			vote = 1;
		}
		// cowgod.logger(' I am voting '+vote);
		bot.woot(vote);
	}
	
	function lag_vote (vote) {
		waitms = parseInt(Math.random() * 20000)+500;
		// cowgod.logger('- will vote '+vote+' in '+waitms+' ms');
		setTimeout(function(){ do_vote(vote); }, waitms);
	}

	function lag_say (text) {
		waitms = parseInt(Math.random() * 5000)+500;
		setTimeout(function(){ bot.sendChat(text); }, waitms);
	}


	function logger_tsv(larray) {
		if ('log_filehandle' in config) {
			var log_tsv  = config['log_filehandle'];
			var d = Math.round(new Date().getTime() / 1000.0);
	
			log_tsv.write('clock\t'+d);
			log_tsv.write('\t');
			log_tsv.write(larray.join('\t'));
			log_tsv.write('\n');
		}
	}

	function log_chat(data) {
		logger_tsv([ 'event','chat','nickname',data.from.username,'plug_user_id',data.from.id,'message',data.message,'type',data.type,'chat_id',data.cid ]);
	
		if (data.type == 'message') {
			cowgod.logger('<'+data.from.username+'> '+data.message);
		} else if (data.type == 'emote') {
			cowgod.logger('* '+data.from.username+' '+data.message);
			data.message = '/me '+data.message;
		} else  if (data.type == 'mention') {
			cowgod.logger('<'+data.from.username+'> '+data.message);
			process_room_command(data);
		} else  if (data.type == 'skip') {
			cowgod.logger('# '+data.message);
		} else  if (data.type == 'welcome') {
			cowgod.logger('# '+data.message);
		} else {
			cowgod.logger('chat (unknown type: '+data.type+')');
			util.log(util.inspect(data));
		}

		if (config_enabled('db_log_chats')) {
			botdb.query('INSERT INTO chats (user_id,text) SELECT user_id,$2 FROM users WHERE uid = $1', [
				data.from.id,data.message
			], after(function(result) {
				// cowgod.logger('Logged chat to database');
			}));
		}
	}

	function log_vote(data) {
		if (data.v == 1) {
			cowgod.logger(pretty_user(data.i)+' wooted');
			if (config_enabled('follow_trends') && is_trendsetter(data.i)) {
				if (!localv['voted']) {
					localv['voted'] = true;
					cowgod.logger('Following trendsetter '+cowgod.id_to_name(data.i)+'\'s vote ('+data.v+')');
					
					lag_vote(data.v);
				}
			}
		} else if (data.v == -1) {
			cowgod.logger(pretty_user(data.i)+' voted meh');
		} else {
			cowgod.logger('vote (unknown type: '+data.v+')');
			util.log(util.inspect(data));
		}
		logger_tsv([ 'event','vote','vote',data.v,'plug_user_id',data.i]);
	}

	function log_join(data) {
		cowgod.logger(pretty_user(data.id)+' joined the room');
		logger_tsv([ 'event','join','nickname',data.username,'plug_user_id',data.id,'status',data.status,'fans',data.fans,'listenerPoints',data.listenerPoints,'avatarID',data.avatarID,'djPoints',data.djPoints,'permission',data.permission ]);
	}
	
	function log_part(data) {
		cowgod.logger(pretty_user(data.id)+' left the room');
		logger_tsv([ 'event','part','plug_user_id',data.id ]);
	}

	function log_curate(data) {
		cowgod.logger(pretty_user(data)+' snagged this song');
		util.log(util.inspect(data));
		logger_tsv([ 'event','snag','plug_user_id',data ]);
	}

	function log_play(data) {
		if (data.media !== null) {
			// util.log(util.inspect(data));
			if (typeof data.media.title === 'undefined') { data.media.title = ''; }
			if (typeof data.media.author === 'undefined') { data.media.author = ''; }
	
			cowgod.logger(pretty_user(data.currentDJ.id)+' is playing '+data.media.title+' by '+data.media.author);
			logger_tsv( [ 'event','djAdvance','plug_user_id',data.currentDJ.id,'playlistID',data.playlistID,'song',data.media.author,'title',data.media.title,'duration',data.media.duration,'media_id',data.media.id,'media_cid',data.media.cid,'media_format',data.media.format,'leader',data.pitleader ]);

			if (config_enabled('db_log_plays')) {
				update_plug_media(data.media);

				botdb.query('INSERT INTO plays (user_id,playlist_id,media_id,leader) SELECT user_id,$2,$3,$4 FROM users WHERE uid = $1', [
					data.currentDJ.id,data.playlistID,data.media.id,data.pitleader
				], after(function(result) {
					// cowgod.logger('Logged play to database');
				}));
			}
		}
	}

	function update_plug_media(media) {
		if (!config_enabled('db_log_plays')) {
			return;
		}
		if (media == null) {
			return;
		}
		botdb.query('INSERT INTO plug_media (media_id,author,title,format,cid,duration) SELECT $2,$3,$4,$5,$6,$7 WHERE 1 NOT IN (SELECT 1 FROM plug_media WHERE media_id = $1)', [
			media.id,media.id,media.author,media.title,media.format,media.cid,Math.floor(media.duration)
		], after(function(result) {
			// util.log(util.inspect(result));
			if (result.rowCount == 1) {
				//cowgod.logger('New plug_media added: '+media.author+' - '+media.title+' ('+media.id+')');
			}
		}));
	}

	function log_djupdate(data) {
		//cowgod.logger('djUpdate:');
		//util.log(util.inspect(data));
		for (var u in data.djs) {
			// cowgod.logger('logging a u.user '+u);
			// util.log(util.inspect(data.djs[u]));
		}
	}

	function process_userlist() {
		users = bot.getUsers();

		heartbeat_reset('process_userlist getUsers');
		// util.log(util.inspect(users));

		for (var u in users) {
			update_user(users[u]);
		}
	}

	function process_waitlist(event) {
		if (config_enabled('db_maintain_users')) {
			if (event === 'silence') {
				set_global('waitlist','','Nothing playing');
				return;
			}

			var wl = bot.getWaitList();
			heartbeat_reset('process_waitlist getWaitList');
			// util.log(util.inspect(wl));

			var gwl = new Array();
			var nwl = new Array();

			var wlbuf = '';
			for (var u in wl) {
				wlbuf = wlbuf+' '+wl[u].id;
				nwl.push(wl[u].id);
			}
			wlbuf = wlbuf.trim();
	
			var gwl_raw = global['waitlist'].split(' ');
			for (var u in gwl_raw) {
				var uid = parseInt(gwl_raw[u],10);
				if (!isNaN(uid)) {
					gwl.push(parseInt(gwl_raw[u],10));
				}
			}

			cowgod.logger('pwl:         raw: '+pretty_waitlist(wl));
			cowgod.logger('pwl:         nwl: '+nwl);
			cowgod.logger('pwl: getWaitList: '+pretty_waitlist(nwl));
			cowgod.logger('pwl:         gwl: '+gwl);
			cowgod.logger('pwl:      global: '+pretty_waitlist(gwl));
			cowgod.logger('pwl:       wlbuf: '+wlbuf);

			if (nwl.length > gwl.length) {
				cowgod.logger('waitlist grew');
				if (config_enabled('manage_waitlist')) {
					cowgod.logger('and i manage the waitlist');
					if (event == 'djUpdate') {
						cowgod.logger('and this was a new song djAdvance');
						new_dj(gwl,nwl);
					}
				}
			} 
			if (nwl.length < gwl.length) {
				var sizediff = gwl.length - nwl.length;
				if (sizediff != 1 && nwl.length == 0) {
					cowgod.logger('waitlist shrunk by '+sizediff+' spots and is empty now, that is too suspicious.  Ignoring');
					return;
				} 
				cowgod.logger('waitlist shrunk by '+sizediff+' spots');
				lost_dj(gwl,nwl);
			}
		
			set_global('waitlist',wlbuf,'Updated by getWaitList');
			// cowgod.logger('Updated waitlist global cache');
			// util.log(util.inspect(data));
			//
			var current_dj = bot.getDJ();
			if (current_dj === 'undefined' || current_dj === null) {
				// cowgod.logger('Process waitlist saw no current_dj');
				process_waitlist('silence');
			} else {
				// There is an active DJ 
				// cowgod.logger('process_waitlist: there is an active dj and the wl length is '+wl.length);
				if (wl.length == 0) {
				// And there is nobody else playing
					// util.log(util.inspect(current_dj));
					if (global['leader'] != current_dj.id) {
						cowgod.logger(pretty_user(current_dj.id)+' is the only DJ, promoting to leader');
						set_global('leader',current_dj.id,'Only DJ playing');
					}
				}
			}
		}
	}

	function pretty_waitlist(wl) {
		var buf = '';
		var count = 0;

		for (var u in wl) {
			var uid = wl[u].id;
			if (typeof uid === 'undefined') {
				uid = wl[u];
			}
			if (uid != '') {
				buf = buf+pretty_user(uid)+' ';
				count = count + 1;
			}
		}
		if (count == 0) {
			return 'empty (size '+count+')';
		} else {
			return buf+'(size '+count+')';
		}
	}

	function pretty_user(uid) {
		return cowgod.id_to_name(uid)+'/'+uid;
	}

	function new_dj(old_wl,new_wl) {
		//cowgod.logger('ndj: old: '+pretty_waitlist(old_wl));
		//cowgod.logger('ndj: new: '+pretty_waitlist(new_wl));
	
		for (u in new_wl) {
			if (old_wl.indexOf(new_wl[u]) == -1) {
				cowgod.logger(pretty_user(new_wl[u])+' joined the waitlist');
				//cowgod.logger('leader is -'+pretty_user(global['leader'])+'-');
				if (global['leader'] == '') {
					//cowgod.logger('No Leader, No Announce)');
				} else {
					// cowgod.logger('New DJ!');
					move_to_end_of_round(new_wl[u]);
					bot.sendChat('Welcome to the Pit, @'+cowgod.id_to_name(new_wl[u])+'!  The lead song is '+global['lead_song']+' // https://macnugget.org/cowgod/waitlist');
				}
			}
		}
	}

	function lost_dj(old_wl,new_wl) {
		cowgod.logger('ldj: old: '+pretty_waitlist(old_wl));
		cowgod.logger('ldj: new: '+pretty_waitlist(new_wl));

		//
		// we have to do a getDJ call here because sometimes Plug sends out of
		// order messages and global[current_dj] is not accurate at this point
		//
		var cdj = bot.getDJ();
		if (cdj === null || typeof cdj === 'undefined') {
			cowgod.logger('cannot find current current dj cdj');
			return;
		}
		var current_dj = cdj.id;

		for (u in old_wl) {
			var uid = old_wl[u];
			var old_rank = u;
			var new_rank = new_wl.indexOf(uid);

			if (uid == cdj.id) {
				cowgod.logger(pretty_user(uid)+' moved from old_wl['+old_rank+'] to the DJ booth');
			} else if (new_rank >= 0) {
				cowgod.logger(pretty_user(uid)+' moved from old_wl['+old_rank+'] to new_wl['+new_rank+']');
			} else {
				// I think this is the guy who dropped!
				if (uid != global['leader']) {
					cowgod.logger(pretty_user(uid)+' moved from old_wl['+old_rank+'] to nowhere');
				} else {
					cowgod.logger(pretty_user(uid)+' moved from old_wl['+old_rank+'] to nowhere and was our leader');
					var new_leader = new_wl[u];
					cowgod.logger('new_wl['+u+'] is '+new_leader);
					if (new_leader === null || typeof new_leader === 'undefined') {
						new_leader = current_dj;
						cowgod.logger('current_dj is '+new_leader);
					}
					if (new_leader === null || typeof new_leader === 'undefined') {
						cowgod.logger('no viable leader found');
					} else {
						cowgod.logger('setting new leader '+pretty_user(new_leader));
						set_global('leader',new_leader,'Battlefield promotion from lost_dj');
					}
				}
			}
		}
	}

	function move_to_end_of_round(uid) {
		if (global['current_dj'] == global['leader']) {
			cowgod.logger('No need to move new DJ since the round just started');
			return;
		}

		cowgod.logger('I need to move '+pretty_user(uid)+' to the end of the waitlist');
		cowgod.logger('current_dj is '+pretty_user(global['current_dj']));
	
		var wl = bot.getWaitList();
		heartbeat_reset('move_to_end_of_round getWaitList');

		var uidlist = new Array();

		for (var u in wl) {
			uidlist.push(wl[u].id);
		}

		cowgod.logger('move_to_end waitlist is '+pretty_waitlist(wl));

		var leader_pos = uidlist.indexOf(parseInt(global['leader'], 10))
		var target_pos = uidlist.indexOf(parseInt(uid, 10))

		cowgod.logger('leader_pos '+leader_pos+' and target_pos '+target_pos);

		if (target_pos > leader_pos) {
			cowgod.logger('attempting move');
			bot.moderateMoveDJ(uid,leader_pos+1);
		}
	}
	
	function process_room_command(data) {
		var command = data.message.toLowerCase();

		util.log(util.inspect(data));

		if (data.from.role <= 1) {
			cowgod.logger('Ignoring message from user with role '+data.from.role);
		} else {
			cowgod.logger('Processing message from user with role '+data.from.role);
		}

		if (data.message.toLowerCase().indexOf('how many points') >= 0) {
			report_points();
		} else if (data.message.toLowerCase().indexOf('room mode') >= 0) {
			set_room_mode(data);
		} else if (data.message.toLowerCase().indexOf('make me the leader') >= 0) {
			set_global('leader',data.from.id,'Set by request in the room');
		}
	}

	function set_room_mode(data) {
		var room_mode = '';

		if (data.message.toLowerCase().indexOf('normal') >= 0) {
			room_mode = 'normal';
		} else if (data.message.toLowerCase().indexOf('roulette') >= 0) {
			room_mode  = 'roulette';
		} else if (data.message.toLowerCase().indexOf('oneshot') >= 0) {
			room_mode = 'oneshot';
		}

		if (room_mode == '') {
			bot.sendChat('The room mode is currently '+global['room_mode']);
		} else {
			set_global('room_mode',room_mode,'Set in channel by '+data.from.username);
			bot.sendChat('The room mode is now '+global['room_mode']);
		}
	}


	function numberWithCommas(x) {
		if (typeof x === 'undefined') {
			return 'undef';
		}
		return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	function report_points() {
		cowgod.logger('reporting points to room');
		var me = bot.getUser();
		heartbeat_reset('report_points getUser');
		util.log(util.inspect(me));
		lag_say('I currently have '+numberWithCommas(me.xp)+' xp!');
	}
	
	function process_cnc_command(command,from) {
		var argv = command.replace(/\s+/g,' ').split(' ');
		var command = argv[0].substr(1).toLowerCase();
		var args_arr = argv.slice(1);
		var args     = args_arr.join(' ');
	
		switch(command) {
			case 'say':
				cuckoo.say(settings.irc_channel,args);
				break;
			case 'plugsay':
				bot.sendChat(args);
				break;
			case 'ircpm':
				var target = argv[1];
				var message = argv.slice(2).join(' ');
				cuckoo.say(target,message);
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
	
				switch(toggle) {
					case 'none':
						toggle = '';
						break;
					case 'current_dj':
						toggle = global['current_dj'];
						break;
				}
	
				if (argv.length == 3) {
					if (itemname in config) {
						set_config(itemname,toggle);

						return(itemname+' is currently '+config[itemname]);
					} else {
						set_global(itemname,toggle,'Set on IRC by '+from);

						if (itemname == 'leader') {
							return(itemname+' is currently '+pretty_user(global[itemname]));
						} else {
							return(itemname+' is currently '+global[itemname]);
						}
					}
				}
				break;
			case 'nickserv_register':
				nickserv_register();
				break;
			case 'nickserv_identify':
				nickserv_identify();
				break;
			case 'waitlist':
				process_waitlist();
				break;
			case 'ninja':
				ninja_bump(argv[1]);
				break;
			case 'avatar':
				bot.set_avatar(argv[1]);
				break;
			case 'reload':
				db_loadsettings(function() {});
				break;
			case 'report_points':
				report_points();
				break;
			case 'suicide':
				process.exit(1);
				break;
			case 'kick':
				cowgod.logger('trying a kick');
				bot.moderateRemoveDJ(parseInt(argv[1]),function(remdj) {
					util.log(util.inspect(remdj));
					cowgod.logger('Inside the remdj function;');
				});
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
		if (typeof toggle === 'undefined') {
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


	function current_dj(djid) {
		if (djid != null) {
			set_global('current_dj',djid);
		}
		return global['current_dj'];
	}

	function config_enabled(setting) {
		if (setting in config) {
			if (config[setting] == 'true' || config[setting] == 'yes' || config[setting] == 1) {
				return true;
			}
		}
		return false;
	}



	function set_global(key,value,comments) {
		if (key in global) {
			if (global[key] != value) {
				global[key] = value;

				if (key == 'leader') {
					if (value != '') {
						if (global['waitlist'] != '') {
							bot.sendChat('*** The leader is now @'+cowgod.id_to_name(value));
						} else {
							cowgod.logger('*** The leader is now '+pretty_user(value));
						}
					} else {
						bot.sendChat('*** There is no leader, let anarchy reign! (RICSAS)');
					}
				} else if (key == 'waitlist') {
					cowgod.logger('The waitlist is now: '+pretty_waitlist(value.split(' ')));
				} else if (key == 'current_dj') {
					// No need to announce this
				} else {
					cowgod.logger('- global['+key+'] changed from "'+global[key]+'" to "'+value+'"');
				}
				
				botdb.query('UPDATE globals SET value = $1, comments = $2 WHERE key = $3 AND uid = $4', [
					value, comments, key, settings.userid
				], after(function(result) {} ));
			}
		} else {
			cowgod.logger('- global['+key+'] set to '+value);
			global[key] = value;
			botdb.query('INSERT INTO globals (value,comments,key,uid) SELECT $1,$2,$3,$4', [
				value, comments, key, settings.userid
			], after(function(result) {} ));
		}
	}


	function is_leader(djid) {
		cowgod.logger('looking to see if '+djid+' is the leader');
		cowgod.logger('global leader is '+global['leader']);
		if ('leader' in global && global['leader'] == djid.toString()) {
			return true;
		} else {
			return false;
		}
	}

	function update_user(user) {
		//cowgod.logger('update user command');
		//util.log(util.inspect(user));
		cowgod.remember_user(user.id,user.username);
		if (!config_enabled('db_maintain_users')) {
			return;
		}

		// cowgod.logger('update_user '+user.username);

		//util.log(util.inspect(user));
		if (user.xp != null) {
			logger_tsv([ 'event','score','nickname',user.username,'plug_user_id',user.id,'level',user.level,'xp',user.xp ]);
			cowgod.logger(user.username+' is level '+user.level+' and has '+numberWithCommas(user.xp)+'xp points!');
		}
		
		botdb.query('INSERT INTO users (uid) SELECT $1 WHERE 1 NOT IN (SELECT 1 FROM users WHERE uid = $2) RETURNING user_id', [
			user.id,user.id
		], after(function(insresult) {
			if (insresult.rowCount == 1) {
				cowgod.logger('Added new user '+user.username+' ('+user.id+') to database');
				lag_say('Hey! Welcome to the Pit, @'+user.username+' please take a moment to read our room rules');
			}

			botdb.query('SELECT * FROM users WHERE uid = $1', [ user.id ], after(function(result) {
				result.rows.forEach(function(dbuser) {
					//util.log(util.inspect(dbuser));

					var update_needed = false;

					//cowgod.logger('comparing '+dbuser.level+' and '+user.level+' for '+user.username);
	
					if (dbuser.level != user.level) {
						update_needed = true;

						cowgod.logger(pretty_user(user.id)+' is now level '+user.level+' up from '+dbuser.level);
		
						if (dbuser.level !== null) {
							cowgod.logger('announcing level up');
							if (user.id == settings.userid) {
								lag_say('Woot!  I just hit level '+user.level+'!');
							} else {
								lag_say('Congratulations on reaching level '+user.level+' @'+cowgod.id_to_name(user.id));
							}
						}
					}

					if(dbuser.nickname != user.username) {
						update_needed = true;
						cowgod.logger(pretty_user(user.id)+' is now nickname '+user.username+' changed from '+dbuser.nickname);
					}

					if(dbuser.avatar != user.avatarID) {
						update_needed = true;
						cowgod.logger(pretty_user(user.id)+' is now avatar '+user.avatarID+' changed from '+dbuser.avatar);

						if (dbuser.avatar !== null && user.id != settings.userid) {
							lag_say('Spiffy new avatar, @'+cowgod.id_to_name(user.id));
						}
					}

					if (update_needed) {
						logger_tsv([ 'event','userinfo','nickname',user.username,'plug_user_id',user.id,'level',user.level,'avatar',user.avatarID]);
						botdb.query('UPDATE users SET level = $2, nickname = $3, avatar = $4 WHERE uid = $1', [
							user.id, user.level, user.username, user.avatarID
						], after(function(updresult) {
							cowgod.logger('Updated '+pretty_user(user.id)+' in the database');
							//util.log(util.inspect(updresult));
						}));
					}
				});
			}));
		}));
	}

	function did_user_get_ninjad(data) {
		if (!config_enabled('manage_waitlist')) {
			return;
		}

		if (data.message.toLowerCase().indexOf('ninja') == 0) {
			ninja_bump(data.from.id);
		}
	}

	function ninja_bump(uid) {
		cowgod.logger('ninja bumping user '+uid);

		if (is_leader(uid)) {
			bot.sendChat('You can\'t ninja yourself, silly!');
			return;
		}
		if (is_leader(global['current_dj'])) {
			bot.sendChat('You can\'t get ninjad while the leader is playing a song, doofus!  A new round is starting now.');
			return;
		}
		var wl = bot.getWaitList();

		var leader_pos = -1;
		var target_pos = -1;
		var ninjad_pos = -1;

		for (var u in wl) {
			if (is_leader(wl[u].id)) {
				cowgod.logger('leader is in position '+u);
				leader_pos = parseInt(u) + 1;
				target_pos = parseInt(u) + 2;
			}
			if (wl[u].id == uid) {
				cowgod.logger('ninja-ee is in position '+u);
				ninjad_pos = parseInt(u) + 1;
			}
		}		
		cowgod.logger(leader_pos+' and '+ninjad_pos);
		if (leader_pos > 0 && ninjad_pos > 0 && target_pos > ninjad_pos) {
			cowgod.logger('Need to move pos '+ninjad_pos+' to '+leader_pos);
			bot.sendChat('ha ha!  Removing you from this round!');
			target_pos = target_pos - 1;
			cowgod.logger('Adjusting target_pos to '+target_pos+' to make the API happy');
			bot.moderateMoveDJ(uid,target_pos);
			botdb.query('INSERT INTO ninjas (user_id,dj_id,leader_id) SELECT id_from_uid($1),id_from_uid($2),id_from_uid($3)', [
				uid,global['current_dj'],global['leader']
			], after(function(result) {}));
		}
	}


	function is_admin(userid) {
		return (admins.indexOf(userid.toString()) != -1);
	}

	function is_owner(userid) {
		return (owners.indexOf(userid.toString()) != -1);
	}

	function is_bot(userid) {
		return (bots.indexOf(userid.toString()) != -1);
	}

	function is_trendsetter(userid) {
		return (trendsetters.indexOf(userid.toString()) != -1);
	}

	function is_outcast(userid) {
		return (outcasts.indexOf(userid.toString()) != -1);
	}

	function heartbeat_reset(event) {
		localv['last_heartbeat'] = Math.round(new Date().getTime() / 1000.0);
		//cowgod.logger('updating last_heartbeat ('+event+')');
		return;
	}

	function heartbeat(action) {
		var current_time = Math.round(new Date().getTime() / 1000.0);
		var diff = current_time - localv['last_heartbeat'];

		if (diff < 60) {
			// cowgod.logger('Last heartbeat was '+diff+' seconds ago, that seems cool');
			return;
		}

		cowgod.logger('Heartbeat! '+current_time+' '+localv['last_heartbeat']+' ('+diff+')');

		if (diff > 120) {
			cowgod.logger('That is weird, the heartbeat is old ('+diff+')');
		}

		if (diff > 300) {
			cowgod.logger('Shit, the heartbeat is crazy old ('+diff+')');
			process.exit(1);
		}

		var me = bot.getUser();
		util.log(util.inspect(me));

		if (me === null || typeof me === 'undefined') {
			// nobody is playing a song
			cowgod.logger('Failed heartbeat with no result from getUser');
		} else {
			if (me.id === null || typeof me.id === 'undefined') {
				cowgod.logger('Failed heartbeat with unexpected result from getUser');
				util.log(util.inspect(me));
			} else {
				heartbeat_reset('heartbeat internal');
			}
		}

		var media = bot.getMedia();

		//util.log(util.inspect(media));
		var tr = bot.getTimeRemaining();

		//util.log(util.inspect(tr));
		if (media === null || typeof media === 'undefined') {
			cowgod.logger('nothing playing');
			process_waitlist('silence');
		} else {
			cowgod.logger('playtime logging '+media.id+'/'+tr+' :: '+localv['last_media_id']+'/'+localv['last_media_tr']);
			if (localv['last_media_id'] == media.id && localv['last_media_tr'] == tr) {
				localv['last_media_sc'] = localv['last_media_sc'] + 1;
				cowgod.logger('playing is stalled for '+localv['last_media_sc']+' cycles');

				if (localv['last_media_sc'] > 10) {
					cowgod.logget('Playing stalled for 10 cycles, reconnecting');
					process.exit(1);
				}
			} else {
				localv['last_media_id'] = media.id;
				localv['last_media_tr'] = tr;
				localv['last_media_sc'] = 0;
			}
		}
		return;
	}
});
