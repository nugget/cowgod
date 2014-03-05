#!/usr/bin/env node

var PlugAPI  = require('plugapi');
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
	botdb.query('SELECT uid FROM users WHERE owner IS TRUE OR admin IS TRUE ORDER BY nickname',after(function(result) {
		result.rows.forEach(function(user) {
			admins.push(user.uid);
		});
		cowgod.logger('- Loaded '+admins.length+' admins from database');
	}));

	trendsetters.length = 0;
	botdb.query('SELECT uid FROM users WHERE trendsetter IS TRUE ORDER BY nickname',after(function(result) {
		result.rows.forEach(function(user) {
			trendsetters.push(user.uid);
		});
		cowgod.logger('- Loaded '+trendsetters.length+' trendsetters from database');
	}));

	bots.length = 0;
	botdb.query('SELECT uid FROM users WHERE bot IS TRUE ORDER BY nickname',after(function(result) {
		result.rows.forEach(function(user) {
			bots.push(user.uid);
		});
		cowgod.logger('- Loaded '+bots.length+' bots from database');
	}));

	outcasts.length = 0;
	botdb.query('SELECT uid FROM users WHERE ignore IS TRUE ORDER BY nickname',after(function(result) {
		result.rows.forEach(function(user) {
			outcasts.push(user.uid);
		});
		cowgod.logger('- Loaded '+outcasts.length+' outcasts from database');
	}));
}

cowgod.logger('! My Name Is '+myname+' headed for '+settings.plug_room);

db_loadsettings(function() {
	if ('log_tsv' in config) {
		config['log_filehandle']  = fs.createWriteStream(config['log_tsv'],  {'flags': 'a'});
		cowgod.logger('Opened '+config['log_tsv']+' for logging');
	} else {
		cowgod.logger('Logging is disabled');
	}
});

var nuglog = {
	log: function() {
		cowgod.logger('raw nugget.log');
		for (var i = 0; i < arguments.length; i++) {
			console.log(arguments[i]);
		}
	}
}

db_loadglobals();
db_loadusers();

cowgod.logger('getUpdateCode('+settings.plug_auth+','+settings.plug_room+')');
PlugAPI.getUpdateCode(settings.plug_auth, settings.plug_room, function(error, updateCode) {
	if (error === false) {
		cowgod.logger('Learned update code from plug site');
	} else {
		cowgod.logger('Error: '+error);
		cowgod.logger('Unable to learn updateCode, falling back on database value');
		updateCode = settings.update_code;
	}

	cowgod.logger('Current updateCode is "'+updateCode+'"');
		
	var bot = new PlugAPI(settings.plug_auth,updateCode);
	// util.log(util.inspect(bot));
	cowgod.set_active_bot(bot);

	cowgod.logger('doing that logging thing, whatever the fuck that is');
	bot.setLogObject(nuglog);
	cowgod.logger('connecting to '+settings.plug_room);
	bot.connect(settings.plug_room);

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
		cowgod.logger('Disconnected from Plug.dj, will reconnect momentarily...');
		waitms = parseInt(Math.random() * 20000)+500;
		setTimeout(function(){ bot.connect(settings.plug_room); }, waitms);
	}

	bot.on('close', reconnect);
	bot.on('error', reconnect);

	bot.on('roomJoin', function(data) {
		cowgod.logger('roomJoin');
		localv['voted'] = false;
		logger_tsv([ 'event','roomJoin','nickname',data.user.profile.username,'plug_user_id',data.user.profile.id,'djPoints',data.user.profile.djPoints,'fans',data.user.profile.fans,'listenerPoints',data.user.profile.listenerPoints,'avatarID',data.user.profile.avatarid ]);
		// util.log(util.inspect(data));
		update_user(data.user.profile);
		current_dj(data.room.currentDJ);
		load_current_userlist(data);
		update_plug_media(data.room.media);
		process_waitlist();
	});

	bot.on('chat', function(data) {
		log_chat(data);
		cowgod.remember_user(data.fromID,data.from);
		did_user_get_ninjad(data);
	});

	bot.on('emote', function(data) {
		log_chat(data);
		cowgod.remember_user(data.fromID,data.from);
	});

	bot.on('userJoin', function(data) {
		util.log(util.inspect(data));
		log_join(data);
		update_user(data);
		cowgod.remember_user(data.id,data.username);
		process_waitlist();
	});

	bot.on('userLeave', function(data) {
		log_part(data);
		process_waitlist();
	});

	bot.on('djUpdate', function(data) {
		log_djupdate(data);
		process_waitlist('djUpdate');
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
		localv['voted'] = false;
	
		var leader_prefix  = '';
		var leader_suffix  = '';
	
		if (is_leader(data.currentDJ)) {
			data.pitleader = true;
			leader_prefix   = '*LEAD SONG* ';
			leader_suffix   = ' ~***';
	
			set_global('lead_song',song_string(data.media));
		} else {
			data.pitleader = false;
		}
	
		log_play(data);
		// util.log(util.inspect(data));
	
		if (data.media === null) {
			current_dj(null);
			set_global('leader','','Nothing is playing');
			irc_set_topic('Nothing is playing in the Pit :(');
		} else {
			if (config_enabled('autobop') || (config_enabled('woot_leaders') && is_trendsetter(data.currentDJ))) {
				if (!localv['voted']) {
					localv['voted'] = true;
					lag_vote(1);
				}
			}
			irc_set_topic(song_string(data.media)+' ('+cowgod.id_to_name(data.currentDJ)+')'+leader_suffix);
			current_dj(data.currentDJ);
	
			if (config_enabled('announce_play')) {
				bot.chat(leader_prefix+song_string(data.media)+' ('+cowgod.id_to_name(data.currentDJ)+')'+leader_suffix);
			}
		}
	
		process_waitlist('djAdvance');
		db_loadsettings(function() {});
	});

	function song_string(media) {
		return media.author+' - '+media.title;
	}
	
	function do_vote (vote) {
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
		logger_tsv([ 'event','chat','nickname',data.from,'room',data.room,'plug_user_id',data.fromID,'message',data.message,'type',data.type ]);
	
		if (data.type == 'message') {
			cowgod.logger('<'+data.from+'> '+data.message);
		} else if (data.type == 'emote') {
			cowgod.logger('* '+data.from+' '+data.message);
			data.message = '/me '+data.message;
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
			cowgod.logger(cowgod.id_to_name(data.id)+' wooted');
			if (config_enabled('follow_trends') && is_trendsetter(data.id)) {
				if (!localv['voted']) {
					localv['voted'] = true;
					cowgod.logger('Following trendsetter '+cowgod.id_to_name(data.id)+'\'s vote ('+data.vote+')');
					lag_vote(data.vote);
				}
			}
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
		if (data.media !== null) {
			util.log(util.inspect(data));
			if (typeof data.media.title === 'undefined') { data.media.title = ''; }
			if (typeof data.media.author === 'undefined') { data.media.author = ''; }
	
			cowgod.logger(cowgod.id_to_name(data.currentDJ)+' is playing '+data.media.title+' by '+data.media.author);
			logger_tsv( [ 'event','djAdvance','plug_user_id',data.currentDJ,'playlistID',data.playlistID,'song',data.media.author,'title',data.media.title,'duration',data.media.duration,'media_id',data.media.id,'media_cid',data.media.cid,'media_format',data.media.format,'leader',data.pitleader ]);

			if (config_enabled('db_log_plays')) {
				update_plug_media(data.media);

				botdb.query('INSERT INTO plays (start_time,user_id,playlist_id,media_id,leader) SELECT $1,user_id,$3,$4,$5 FROM users WHERE uid = $2', [
					data.mediaStartTime,data.currentDJ,data.playlistID,data.media.id,data.pitleader
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
		cowgod.logger('djUpdate:');
		util.log(util.inspect(data));
		// cowgod.logger('--');
		// util.log(util.inspect(data.djs));
		// cowgod.logger('--');
		for (var u in data.djs) {
			// cowgod.logger('logging a u.user '+u);
			// util.log(util.inspect(data.djs[u]));
		}
	}

	function process_waitlist(event) {
		var wl = bot.getWaitList();
	
		if (config_enabled('db_maintain_users')) {
			var wlbuf = ''
	
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
		}
		// util.log(util.inspect(data));
	}

	function new_dj(s_old_wl,s_new_wl) {
		var old_wl = s_old_wl.split(' ');
		var new_wl = s_new_wl.split(' ');
	
		// cowgod.logger('old_wl');
		// util.log(util.inspect(old_wl));
		// cowgod.logger('new_wl');
		// util.log(util.inspect(new_wl));
	
		for (u in new_wl) {
			if (old_wl.indexOf(new_wl[u]) == -1) {
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
	
		cowgod.logger('old_wl');
		util.log(util.inspect(old_wl));
		cowgod.logger('new_wl');
		util.log(util.inspect(new_wl));
	
		for (u in old_wl) {
			if (new_wl.indexOf(old_wl[u]) == -1) {
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
	
		var wl = bot.getWaitList();
		var uidlist = new Array();
	
		for (var u in wl) {
			uidlist.push(wl[u].id);
		}
	
		var leader_pos = uidlist.indexOf(global['leader']);
		var target_pos = uidlist.indexOf(uid);
	
		if (target_pos > leader_pos) {
			bot.moveDJ(uid,leader_pos+1);
		}
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
			update_user(data.room.users[u]);
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
				cowgod.logger('- global['+key+'] changed from '+global[key]);
				cowgod.logger('- global['+key+'] changed to   '+value);
				global[key] = value;

				if (key == 'leader') {
					if (value != '') {
						bot.chat('*** The leader is now '+cowgod.id_to_name(value));
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
		if ('leader' in global && global['leader'] === djid) {
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

		// util.log(util.inspect(user));
		botdb.query('INSERT INTO users (uid) SELECT $1 WHERE 1 NOT IN (SELECT 1 FROM users WHERE uid = $2) RETURNING user_id', [
			user.id,user.id
		], after(function(insresult) {
			// util.log(util.inspect(insresult));
			botdb.query('UPDATE users SET nickname = $2, dj_points = $3, listen_points = $4, fans = $5, avatar = $6, curate_points = $7 WHERE uid = $1 RETURNING user_id', [
				user.id, user.username, user.djPoints, user.listenerPoints, user.fans, user.avatarID, user.curatorPoints
			], after(function(updresult) {
				// util.log(util.inspect(updresult));
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
			bot.chat('ha ha!  Removing you from this round!');
			bot.moveDJ(uid,target_pos);
			botdb.query('INSERT INTO ninjas (user_id,dj_id,leader_id) SELECT id_from_uid($1),id_from_uid($2),id_from_uid($3)', [
				uid,global['current_dj'],global['leader']
			], after(function(result) {}));
		}
	}


	function is_admin(userid) {
		return (admins.indexOf(userid) != -1);
	}

	function is_owner(userid) {
		return (owners.indexOf(userid) != -1);
	}

	function is_bot(userid) {
		return (bots.indexOf(userid) != -1);
	}

	function is_trendsetter(userid) {
		return (trendsetters.indexOf(userid) != -1);
	}
});
