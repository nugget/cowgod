#!/usr/bin/env node

var PlugBotAPI  = require('./plugbotapi');
var fs = require('fs');
var util = require('util');
var argv = require('optimist').argv;
var sys = require('sys');
var exec = require('child_process').exec;
var argv = require('optimist').argv;
var sleep = require('sleep');

var cowgod = require('./cowgod.js');

var config = new Object();
var global = new Object();
var localv = new Object();

var admins = new Array();
var trendsetters = new Array();
var bots = new Array();
var outcasts = new Array();

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
	botdb.query('SELECT * FROM settings WHERE deleted IS NULL AND enabled IS TRUE AND (uid IS NULL OR uid = $1) ORDER BY uid DESC', [
		settings.userid
	], after(function(result) {
		result.rows.forEach(function(setval) {
			if (setval.key in config) {
				if (config[setval.key] != setval.value) {
					config[setval.key] = setval.value;
					cowgod.logger('- config '+setval.key+' changed to '+config[setval.key]+' from the database');
					loadcount = loadcount + 1;
				}
			} else {
				config[setval.key] = setval.value;
				cowgod.logger('- config '+setval.key+' set to '+config[setval.key]+' from the database');
				loadcount = loadcount + 1;
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

var creds = {
	email: settings.email,
	password: settings.password
};

	cowgod.logger('! My Name Is '+myname+' headed for '+settings.plug_room);

	var bot = new PlugBotAPI(creds);

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
			return process_cnc_command(text);
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

	bot.on('roomJoin', function() {
		cowgod.logger('roomJoin');
		localv['voted'] = false;
		process_waitlist();
		process_userlist();
		connect_to_irc();
	});

	bot.on('chat', function(data) {
		//util.log(util.inspect(data));
		log_chat(data);
		cowgod.remember_user(data.uid,data.un);
		did_user_get_ninjad(data);
	});

	bot.on('emote', function(data) {
		log_chat(data);
		cowgod.remember_user(data.fromID,data.from);
	});

	bot.on('userJoin', function(data) {
		// cowgod.logger('join event');
		// util.log(util.inspect(data));
		log_join(data);
		update_user(data);
		cowgod.remember_user(data.id,data.username);
		process_waitlist();

		if (config_enabled('greet_bagel')) {
			if (data.id == 3664680) {
				// lag_say('https://i.chzbgr.com/maxW500/8282054144/hEFDE7F7B/.gif');
				lag_say('http://31.media.tumblr.com/98a0849910642e43808a144b01fae784/tumblr_mvvfp4fZ3Y1s373hwo1_500.gif');
			}
		};
		if (config_enabled('greet_pink')) {
			if (data.id == 4104272 ) {
				lag_say('hhttp://i.imgur.com/TggQP.gif');
			}
		};

	});

	bot.on('userLeave', function(data) {
		// cowgod.logger('leave event');
		// util.log(util.inspect(data));
		log_part(data);
		process_waitlist();
	});

	bot.on('waitListUpdate', function(data) {
		//cowgod.logger('waitListUpdate event');
		//util.log(util.inspect(data));
		process_waitlist('djUpdate');
	});

	bot.on('grabUpdate', function(data) {
		cowgod.logger('curate event');
		util.log(util.inspect(data));
		// this is like a TT snag
		log_curate(data);
	});

	bot.on('voteUpdate', function(data) {
		//cowgod.logger('voteUpdate event');
		//util.log(util.inspect(data));
		log_vote(data);
	});
	
	bot.on('userUpdate', function(data) {
		cowgod.logger('userUpdate');
		util.log(util.inspect(data));
	});

	bot.on('advance', function(data) {
		cowgod.logger('advance event');
		// util.log(util.inspect(data));
		localv['voted'] = false;
	
		var leader_prefix  = '';
		var leader_suffix  = '';

		if (data.media === null || data.media === undefined) {
			current_dj(null);
			set_global('leader','','Nothing is playing');
			irc_set_topic('Nothing is playing in the Pit :(');
		} else {
			if (is_leader(data.dj.id)) {
				cowgod.logger('this dj is the leader');
				data.pitleader = true;

				if (global['waitlist'] != '') {
					cowgod.logger('wl is '+global['waitlist']);
					leader_prefix   = '*LEAD SONG* ';
					leader_suffix   = ' ~***';
				}

				cowgod.logger('setting a new lead song');
				set_global('lead_song',song_string(data.media));
			} else {
				cowgod.logger('this dj is not the leader');
				data.pitleader = false;
			}

			log_play(data);

			if (config_enabled('autobop') || (config_enabled('woot_leaders') && is_trendsetter(data.dj.id))) {
				if (!localv['voted']) {
					localv['voted'] = true;
					lag_vote(1);
				}
			}
			irc_set_topic(song_string(data.media)+' ('+cowgod.id_to_name(data.dj.id)+')'+leader_suffix);
			current_dj(data.dj.id);
	
			if (config_enabled('announce_play')) {
				bot.chat(leader_prefix+song_string(data.media)+' ('+cowgod.id_to_name(data.dj.id)+')'+leader_suffix);
			}
		}
	
		process_waitlist('djAdvance');
		db_loadsettings(function() {});
		check_my_level();
	});

	function song_string(media) {
		return media.author+' - '+media.title;
	}
	
	function do_vote (vote) {
		if (is_outcast(global['current_dj'])) {
			cowgod.logger('skipping vote for outcast');
			return;
		}
		if (typeof vote == undefined) {
			vote = 1;
		}
		cowgod.logger(' I am voting '+vote);
		bot.woot(vote);
	}
	
	function lag_vote (vote) {
		waitms = parseInt(Math.random() * 20000)+500;
		cowgod.logger('- will vote '+vote+' in '+waitms+' ms');
		setTimeout(function(){ do_vote(vote); }, waitms);
	}

	function lag_say (text) {
		waitms = parseInt(Math.random() * 5000)+500;
		setTimeout(function(){ bot.chat(text); }, waitms);
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
		logger_tsv([ 'event','chat','nickname',data.un,'plug_user_id',data.fromID,'message',data.message,'type',data.type,'chat_id',data.chatID ]);
	
		if (data.type == 'message') {
			cowgod.logger('<'+data.un+'> '+data.message);
		} else if (data.type == 'emote') {
			cowgod.logger('* '+data.un+' '+data.message);
			data.message = '/me '+data.message;
		} else  if (data.type == 'mention') {
			cowgod.logger('<'+data.un+'> '+data.message);
			process_room_command(data);
		} else  if (data.type == 'skip') {
			cowgod.logger('# '+data.message);
		} else {
			cowgod.logger('chat (unknown type)');
			util.log(util.inspect(data));
		}

		if (config_enabled('db_log_chats')) {
			botdb.query('INSERT INTO chats (user_id,text) SELECT user_id,$2 FROM users WHERE uid = $1', [
				data.fromID,data.message
			], after(function(result) {
				// cowgod.logger('Logged chat to database');
			}));
		}
	}

	function log_vote(data) {
		if (data.vote == 1) {
			cowgod.logger(cowgod.id_to_name(data.user.id)+' wooted');
			if (config_enabled('follow_trends') && is_trendsetter(data.user.id)) {
				if (!localv['voted']) {
					localv['voted'] = true;
					cowgod.logger('Following trendsetter '+cowgod.id_to_name(data.user.id)+'\'s vote ('+data.vote+')');
					
					lag_vote(data.vote);
				}
			}
		} else if (data.vote == -1) {
			cowgod.logger(cowgod.id_to_name(data.user.id)+' voted meh');
		} else {
			cowgod.logger('vote (unknown type)');
			util.log(util.inspect(data));
		}
		logger_tsv([ 'event','vote','vote',data.vote,'plug_user_id',data.user.id ]);
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
		cowgod.logger(cowgod.id_to_name(data.user.id)+' snagged this song');
		logger_tsv([ 'event','snag','plug_user_id',data.user.id ]);
	}

	function log_play(data) {
		if (data.media !== null) {
			// util.log(util.inspect(data));
			if (typeof data.media.title == 'undefined') { data.media.title = ''; }
			if (typeof data.media.author == 'undefined') { data.media.author = ''; }
	
			cowgod.logger(cowgod.id_to_name(data.dj.id)+' is playing '+data.media.title+' by '+data.media.author);
			logger_tsv( [ 'event','djAdvance','plug_user_id',data.dj.id,'playlistID',data.playlistID,'song',data.media.author,'title',data.media.title,'duration',data.media.duration,'media_id',data.media.id,'media_cid',data.media.cid,'media_format',data.media.format,'leader',data.pitleader ]);

			if (config_enabled('db_log_plays')) {
				update_plug_media(data.media);

				botdb.query('INSERT INTO plays (user_id,playlist_id,media_id,leader) SELECT user_id,$2,$3,$4 FROM users WHERE uid = $1', [
					data.dj.id,data.playlistID,data.media.id,data.pitleader
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
				cowgod.logger('New plug_media added: '+media.author+' - '+media.title+' ('+media.id+')');
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
		bot.getUsers( function(users) {
			// util.log(util.inspect(users));
			for (var u in users) {
				update_user(users[u]);
			}
		});
	}

	function process_waitlist(event) {
		if (config_enabled('db_maintain_users')) {
			bot.getWaitList( function(wl) {
				var wlbuf = ''

				cowgod.logger('The waitlist has '+wl.length+' DJs');
				cowgod.logger('current_dj is '+global['current_dj']);
				cowgod.logger('our leader is '+global['leader']);

				var moo = bot.getDJ(function(current_dj) {
					if (current_dj === undefined || current_dj === null) {
						// cowgod.logger('Process waitlist saw no current_dj');
					} else {
						// There is an active DJ 
						cowgod.logger('pw there is an active dj and the wl length is '+wl.length);
						if (wl.length == 0) {
							cowgod.logger('and nobody else playing! leader is '+global['leader']);
							// And there is nobody else playing
							// util.log(util.inspect(current_dj));
							if (global['leader'] != current_dj.id) {
								cowgod.logger(cowgod.id_to_name(current_dj.id)+' is the only DJ, promoting to leader');
								set_global('leader',current_dj.id,'Only DJ playing');
							}
						}
					}
				});
		
				for (var u in wl) {
					wlbuf = wlbuf+' '+wl[u].id;
				}
				wlbuf = wlbuf.trim();

				if (wlbuf.length > global['waitlist'].length) {
					cowgod.logger('waitlist grew');
					if (config_enabled('manage_waitlist')) {
						cowgod.logger('and i manage the waitlist');
						if (event == 'djUpdate') {
							cowgod.logger('and this was a new song djAdvance');
							new_dj(global['waitlist'],wlbuf);
						}
					}
				} 
				if (wlbuf.length < global['waitlist'].length) {
					cowgod.logger('waitlist shrunk');
					lost_dj(global['waitlist'],wlbuf);
				}
		
				set_global('waitlist',wlbuf,'Updated by getWaitList');
				cowgod.logger('Updated waitlist global cache');
				// util.log(util.inspect(data));
			});
		}
	}

	function new_dj(s_old_wl,s_new_wl) {
		var old_wl = s_old_wl.split(' ');
		var new_wl = s_new_wl.split(' ');
	
		// cowgod.logger('old_wl');
		// util.log(util.inspect(old_wl));
		// cowgod.logger('new_wl');
		// util.log(util.inspect(new_wl));
	
		for (u in new_wl) {
			if (old_wl.indexOf(new_wl[u].toString()) == -1) {
				cowgod.logger(cowgod.id_to_name(new_wl[u])+' joined the waitlist');
				cowgod.logger('leader is -'+global['leader']+'-');
				if (global['leader'] == '') {
					cowgod.logger('No Leader, No Announce)');
				} else {
					// cowgod.logger('New DJ!');
					move_to_end_of_round(new_wl[u]);
					bot.chat('Welcome to the Pit, @'+cowgod.id_to_name(new_wl[u])+'!  The lead song is '+global['lead_song']+' // https://macnugget.org/cowgod/waitlist');
				}
			}
		}
	}

	function lost_dj(s_old_wl,s_new_wl) {
		var old_wl = s_old_wl.split(' ');
		var new_wl = s_new_wl.split(' ');
	
		// cowgod.logger('old_wl');
		// util.log(util.inspect(old_wl));
		// cowgod.logger('new_wl');
		// util.log(util.inspect(new_wl));

		// cowgod.logger('new_wl.length is '+new_wl.length);
		// cowgod.logger('old_wl.length is '+old_wl.length);

		if (new_wl.length ==1) {
			cowgod.logger('new_wl.length is 1 and it contains '+new_wl[0]);
			if (new_wl[0] == '') {
				// cowgod.logger('that is bogus');
				// bot.chat('Plug.dj just tried to trick me, but I am too smart for that.');
				return;
			}
		} else if (new_wl.length == 0 && old_wl.length != 1) {
			cowgod.logger('Ignoring bogus zero-length waitlist because the old waitlist was not just 1 person');
			// bot.chat('Plug.dj just tried to trick me, but I am too smart for that.');
			return;
		}
	
		for (u in old_wl) {
			if (new_wl.indexOf(old_wl[u].toString()) == -1) {
				if (old_wl[u] == global['current_dj']) {
					cowgod.logger('Confused, it looked like '+cowgod.id_to_name(old_wl[u])+' left the waitlist, but that is the current DJ');
				} else {
					cowgod.logger(cowgod.id_to_name(old_wl[u])+' left the waitlist');
	
					if (old_wl[u] == global['leader']) {
						cowgod.logger('Ack, we need a new leader!');
						var new_guy = new_wl[u];
						cowgod.logger('new_guy is '+new_guy+' and comes from position '+u+' in new_wl list');
						if (typeof new_guy  === 'undefined' || new_guy == '') {
							cowgod.logger('That will not do, we will use current_dj for the new leader: '+global['current_dj']);
							new_guy = global['current_dj'];
						}
						set_global('leader',new_guy,'Battlefield promotion from lost_dj');
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

		cowgod.logger('I need to move '+uid+' to the end of the waitlist');
		cowgod.logger('current_dj is '+global['current_dj']);
	
		bot.getWaitList( function(wl) {
			var uidlist = new Array();
	
			for (var u in wl) {
				uidlist.push(wl[u].id);
			}

			cowgod.logger('uidlist length is '+uidlist.length);
	
			var leader_pos = uidlist.indexOf(parseInt(global['leader'], 10))
			var target_pos = uidlist.indexOf(parseInt(uid, 10))

			cowgod.logger('leader_pos '+leader_pos+' and target_pos '+target_pos);
	
			if (target_pos > leader_pos) {
				cowgod.logger('attempting move');
				bot.moderateMoveDJ(uid,leader_pos+1);
			}
		});
	}
	
	function process_room_command(data) {
		var command = data.message.toLowerCase();

		if (data.message.toLowerCase().indexOf('how many points') >= 0) {
			report_points();
		}
	}

	function numberWithCommas(x) {
		return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	function report_points() {
		cowgod.logger('reporting points to room');
		bot.getUser(settings.userid, function(me) {
			//util.log(util.inspect(me));
			lag_say('I currently have '+numberWithCommas(me.xp)+' xp and '+numberWithCommas(me.ep)+' plug points!');
		});
	}

	function check_my_level() {
		bot.getUser(settings.userid, function(me) {
			// util.log(util.inspect(me));
			if ('level' in global) {
				if (me.level == global['level']) {
					cowgod.logger('check_my_level: I am still level '+me.level+' ('+numberWithCommas(me.xp)+')');
				} else {
					cowgod.logger('check_my_level: I am level '+me.level+' ('+numberWithCommas(me.xp)+')!');
					lag_say('Ding level '+me.level+'!');
				}
			}
			set_global('level',me.level,'check_my_level()');
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
						set_global(itemname,toggle,'comment');
						return(itemname+' is currently '+global[itemname]);
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
			case 'level_check':
				check_my_level();
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
		cowgod.logger('set_global: '+key+','+value+','+comments);
		if (key in global) {
			if (global[key] != value) {
				cowgod.logger('- global['+key+'] changed from '+global[key]);
				cowgod.logger('- global['+key+'] changed to   '+value);
				global[key] = value;

				if (key == 'leader') {
					if (value != '') {
						if (global['waitlist'] != '') {
							bot.chat('*** The leader is now @'+cowgod.id_to_name(value));
						} else {
							cowgod.logger('*** The leader is now '+cowgod.id_to_name(value));
						}
					} else {
						bot.chat('*** There is no leader, let anarchy reign! (RICSAS)');
					}
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
		cowgod.remember_user(user.id,user.username);
		if (!config_enabled('db_maintain_users')) {
			return;
		}

		util.log(util.inspect(user));
		botdb.query('INSERT INTO users (uid) SELECT $1 WHERE 1 NOT IN (SELECT 1 FROM users WHERE uid = $2) RETURNING user_id', [
			user.id,user.id
		], after(function(insresult) {
			// util.log(util.inspect(insresult));
			botdb.query('UPDATE users SET nickname = $2, dj_points = $3, listen_points = $4, fans = $5, avatar = $6, curate_points = $7 WHERE uid = $1 RETURNING user_id', [
				user.id, user.username, user.djPoints, user.listenerPoints, user.fans, user.avatarID, user.curatorPoints
			], after(function(updresult) {
				util.log(util.inspect(updresult));
				if (insresult.rowCount == 1) {
					cowgod.logger('Added new user '+user.username+' ('+user.id+') to database');
				} else {
					cowgod.logger('Updated user '+user.username+' ('+user.id+') in database');
				}
			}));
		}));
	}

	function did_user_get_ninjad(data) {
		if (!config_enabled('manage_waitlist')) {
			return;
		}

		if (data.message.toLowerCase().indexOf('ninja') == 0) {
			ninja_bump(data.fromID);
		}
	}

	function ninja_bump(uid) {
		cowgod.logger('ninja bumping user '+uid);

		if (is_leader(uid)) {
			bot.chat('You can\'t ninja yourself, silly!');
			return;
		}
		if (is_leader(global['current_dj'])) {
			bot.chat('You can\'t get ninjad while the leader is playing a song, doofus!  A new round is starting now.');
			return;
		}
		bot.getWaitList( function(wl) {
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
				bot.chat('ha ha!  Removing you from this round!');
				bot.moderateMoveDJ(uid,target_pos);
				botdb.query('INSERT INTO ninjas (user_id,dj_id,leader_id) SELECT id_from_uid($1),id_from_uid($2),id_from_uid($3)', [
					uid,global['current_dj'],global['leader']
				], after(function(result) {}));
			}
		});
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
