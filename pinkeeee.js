#!/usr/bin/env node

var fs = require('fs');
var util = require('util');
var argv = require('optimist').argv;
var sys = require('sys');
var exec = require('child_process').exec;
var process = require('process');

function init_pinkeeee_fortune() {
	process.env['FORTUNE_PATH'] = '/home/pinkeeee/cowgod';
	log_command('/usr/games/strfile minimetexts minimetexts.dat');
	return;
}

if (typeof argv.nick === 'undefined') {
	var myname = 'cowgod';
	var settings = require('./settings.js');
} else {
	var myname = argv.nick;
	var settings = require('./settings_'+myname+'.js');
}       
logger('! My Name Is '+myname);

var Bot  = require('ttapi');
settings.db = false;

if (settings.dbname) {
	logger('connecting to postgresql database '+settings.dbname);
	var Client = require('pg').Client;

	var connstring = 'postgres://'+settings.dbuser+':'+settings.dbpass+'@'+settings.dbhost+':'+settings.dbport+'/'+settings.dbname;

	var botdb = new Client(connstring);
	botdb.connect();

	settings.db = true;
}

var config = new Object();
config['autobop']		= settings.autobop;
config['mute']			= settings.mute;
config['follow']		= settings.follow;
config['database']		= settings.db;
config['say_snags']		= settings.say_snags;
config['say_odometer']	= settings.say_odometer;
config['owner_follow']	= 'on';

var setting_description = new Object();
setting_description['oneanddone'] = 'Epic No-Shame Mode';

db_loadsettings();

init_pinkeeee_fortune();

var users = new Object();
var usernames = new Object();

var global = new Object();
global['myvote']	= 'none';
global['cursong']	= 'none';
global['roomid']	= settings.roomid;
global['speak_last_user'] = '';
global['speak_linecount'] = 0;
global['speak_epoch'] = 0;
global['owner_in_room'] = 0;

var admins = new Array();
var leaders = new Array();
var owners = new Array();
var bots = new Array();

//Bagel added this to track pending queue dump
var pendingQueueDump;

db_loadadmins();
db_loadleaders();
db_loadowners();
db_loadbots();

// util.log(util.inspect(config));

if (settings.log_chat) {
	var log_chat = fs.createWriteStream(settings.log_chat, {'flags': 'a'});
}
if (settings.log_tsv) {
	var log_tsv  = fs.createWriteStream(settings.log_tsv,  {'flags': 'a'});
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
		log_tsv.write('\tmyid\t'+settings.userid);
		log_tsv.write('\troomid\t'+global['roomid']);
		log_tsv.write('\t');
		log_tsv.write(larray.join('\t'));
		log_tsv.write('\n');
	}
}

function parse_username(text) {
	var moo     = text.indexOf('@');

	if (moo == -1) {
		return;
	} else {
		return text.substr(moo+1);
	}
}

function db_read() {
	return settings.db;
}

function db_write() {
	if (!settings.db || settings.dbreadonly) {
		return false;
	}
	return true;
}

function after(callback) {
	return function(err, queryResult) {
		if(err) {
			logger('database '+err+' (code '+err.code+' at pos '+err.position+')');
					return;
					}
					callback(queryResult)
					}
					}

					function dump_queue() {
					logger('- dumping queue to file');
					bot.playlistAll(function(data) { 
						global['queuelen'] = data.list.length;

						var qf = fs.createWriteStream('public_html/queue.tsv', {'flags': 'w'});

						//var d=new Date();
						//qf.write('['+d+']\n\n');

						var i = 0;

						data.list.forEach(function(song) {
							db_songdb(song);

							qf.write('index\t'+i);
							qf.write('\t_id\t'+song._id);
							qf.write('\tsong\t'+song.metadata.song);
							qf.write('\tartist\t'+song.metadata.artist);
							qf.write('\talbum\t'+song.metadata.album);
							qf.write('\tlength\t'+song.metadata.length);
							qf.write('\tmnid\t'+song.metadata.mnid);
							qf.write('\tgenre\t'+song.metadata.genre);
							qf.write('\tcoverart\t'+song.metadata.coverart);
							qf.write('\n');
							i = i + 1;
							});

						if (data.success == false) {
							qf.write('Failed: '+data.err);
						} else {
							qf.write('Success');
						}
						qf.end();
					});
					}



function db_newsong(data) {
	if (!db_write()) { return; }

	logger('logging a new song to the database');
	//util.log(util.inspect(data));
	//
	db_songdb(data.room.metadata.current_song);

	botdb.query('INSERT INTO songlog (song_id,room_id,dj_id,stats_djs) SELECT $1,$2,$3,$4', [
			data.room.metadata.current_song._id,
			data.roomid,
			data.room.metadata.current_dj,
			data.room.metadata.djs
			], after(function(result) {} ));
}

function newsong_theme_management(data) {
	var djid = data.room.metadata.current_song.djid;
	var djs = data.room.metadata.djs;
	if (opt('follow_seed_enabled') == 'on') {
		if(djs[djs.length-1] == djid) {
			logger('= this is the last last dj, I need to add my wisdom');
			say_command('/usr/games/fortune -s -a');
		} else {
			logger('= follow_seed is enabled, but this is not the last dj');
		}
	} else {
		logger('- follow_seed_enabled is not on');
		if(djs[0] == djid) {
			logger('= first dj, lets learn the theme');
		}
	}
}

function newsong_one_and_done(data) {
	var djid = data.room.metadata.current_song.djid;
	var djs = data.room.metadata.djs;
	var bootid = djs[0];
	if (opt('one_and_done_allowed') == 'on') {
		if (opt('oneanddone') == 'on') {
			if(djs[1] == djid) {
				logger('= new song is DJ number two, I should boot '+bootid);
				bot.remDj(bootid);
			}
		}
	}
}

function say_command(command) {
	child = exec(command, function (error,stdout,stderr) {
		var outbuf = stdout;
		outbuf = outbuf.trim();
		outbuf = outbuf.replace(/ +/g,' ');
		// pm(outbuf,'4e00e4e8a3f75104e10b7359');
		if (outbuf.length < 200) {
			logger('= cmdout is '+outbuf.length+' bytes');
			lag_say(outbuf);
		} else {
			logger('= cmdout was too long to say ('+outbuf.length+') '+outbuf);
		}
	});
}

function log_command(command) {
	child = exec(command, function (error,stdout,stderr) {
		var outbuf = stdout;
		outbuf = outbuf.trim();
		logger(outbuf);
	});
}

function ban_user(userid,adminid) {
	if (!db_write()) { return; }

	if(is_admin(userid)) {
		say('Are you crazy?  I won\'t do that!')
		return;
	}

	if(is_leader(userid)) {
		say('I like '+id_to_name(userid)+' too much to do that.');
		return;
	}

	if(userid == settings.userid) {
		say('Look, everyone, we got ourselves a comedian here...');
		return;
	}

	logger('Banning user_id '+userid);

	bot.bootUser(userid,'See ya');

	botdb.query('INSERT INTO blacklist (user_id,added_by,public_msg,private_msg) VALUES ($1,$2,$3,$4)', [
		userid, adminid, id_to_name(adminid)+' :boot: that guy.', 'You are not welcome in here'
	], after(function(result) {} ));
}

function db_endsong(data) {
	if (!db_write()) { return; }

	update_dj_live_stats(data.room.metadata.current_dj);

	botdb.query('UPDATE songlog SET stats_djcount = $1, stats_listeners = $2 WHERE song_id = $3 AND room_id = $4 AND stats_djcount IS NULL', [
			data.room.metadata.djcount,
			data.room.metadata.listeners,
			data.room.metadata.current_song._id,
			data.room.roomid
			], after(function(result) {} ));
	db_songdb(data.room.metadata.current_song);
}

function db_songdb(song) {
	if (!db_write()) { return; }

	// util.log(util.inspect(song));

	if (song.metadata.album)
		song.metadata.album = song.metadata.album.replace(/\u0000/g,'');

	if (song.metadata.artist)
		song.metadata.artist = song.metadata.artist.replace(/\u0000/g,'');

	if (song.metadata.song)
		song.metadata.song = song.metadata.song.replace(/\u0000/g,'');

	if (song.metadata.song == '') {
		logger('Nothing playing, no need to log');
		return;
	}

	if (song.metadata.labelid == '') {
		song.metadata.labelid = 0;
	}

	botdb.query('INSERT INTO songs (song_id,artist,song,album,genre,length,mnid,coverart,md5,labelid)  SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 WHERE 1 NOT IN (SELECT 1 FROM songs WHERE song_id = $11)', [
			song._id,
			song.metadata.artist,
			song.metadata.song,
			song.metadata.album,
			song.metadata.genre,
			song.metadata.length,
			song.metadata.mnid,
			song.metadata.coverart,
			song.metadata.md5,
			song.metadata.labelid,
			song._id
			], after(function(result) {} ));
}

function db_snag(data) {
	if (!db_write()) { return; }

	logger('logging snag to db for'+global['roomid']);

	botdb.query('INSERT INTO snaglog (play_id, user_id) SELECT id, $1 FROM songlog WHERE room_id = $2 ORDER BY ts DESC LIMIT 1', [
			data.userid,
			global['roomid']
			], after(function(result) {} ));
}

function db_vote(data) {
	if (!db_write()) { return; }

	var user = data.room.metadata.votelog[0][0];
	var vote = data.room.metadata.votelog[0][1];

	if (user == '') {
		logger('Ignoring anonymous downvote');
		return;
	}

	logger('logging vote to db for room:'+global['roomid']+' user:'+user+' vote:'+vote);

	botdb.query('INSERT INTO votelog (play_id, user_id, vote) SELECT id, $1, $2 FROM songlog WHERE room_id = $3 ORDER BY ts DESC LIMIT 1', [
			user,
			vote,
			global['roomid']
			], after(function(result) {} ));
}

function join_response(data) {
        if (settings.userid != '51fc4bb6eb35c104c18698d2') {
                // This stuff only works for Pink's Mini Me.
                return;
        }

        if (data.user[0].userid == '51813658aaa5cd3df7b79831') {
                lag_heart('I <3 YOU @Pinkeeee, You Da Boss');
        }
		if (data.user[0].userid == '4e00e4e8a3f75104e10b7359') {
                lag_heart('Oh It\'s my owner @nugget I\'m so Happy Now!');
        }
		if (data.user[0].userid == '4e1c8c8b4fe7d031420bdf59') {
                lag_heart('Everyone Be Naughty the Boss is in!');
        }
		if (data.user[0].userid == '4f072161a3f751171100088a') {
                lag_heart('The Doctor is in!');
        }
}



function enforce_blacklist(data) {
	if (settings.userid != '4f50ea86a3f7517d6c006f16') {
		// This stuff only works for cowgod.
		return;
	}

	botdb.query('SELECT * FROM blacklist WHERE user_id = $1 AND enabled IS TRUE', [
			data.user[0].userid
			], after(function(result) {
				if (result.rows.length == 1) {
				logger('! Got a blacklist hit on this join: '+data.user[0].userid);

				var user = result.rows[0];
				util.log(util.inspect(user));

				bot.bootUser(user.user_id,user.private_msg);

				lag_say(user.public_msg);
				}
				}));
}

function db_speak(data) {
	if (!db_write()) { return; }

	botdb.query('INSERT INTO chat_log (user_id,room_id,text) SELECT $1,$2,$3', [
			data.userid,
			data.roomid,
			data.text
			], after(function(result) {} ));
}

function check_flood_rate(data) {
	if (opt('flood_protection') == 'on') {
		if (global['speak_last_user'] == data.userid) {
			global['speak_linecount'] = global['speak_linecount'] + 1;
		} else {
			global['speak_last_user'] = data.userid;
			global['speak_linecount'] = 1;
			global['speak_epoch'] = Math.floor((new Date).getTime()/1000.00);
		}

		var seconds = (Math.floor((new Date).getTime()/1000.00) - global['speak_epoch']);
		if (seconds == 0) {
			seconds = 1;
		}
		var rate = 0.00 + (global['speak_linecount'] / seconds);


		botdb.query('SELECT * FROM users WHERE user_id = $1', [
			data.userid
		], after(function(result) {
			result.rows.forEach(function(user) {
				var rate_tolerance = 3;
				var lines_tolerance = 8;

				if (user.live_points > 50) {
					rate_tolerance = 5;
					lines_tolerance = 10;
				}
				if (user.live_points > 100) {
					rate_tolerance = 8;
					lines_tolerance = 10;
				}
				if (user.live_points > 10000) {
					rate_tolerance = 10;
					lines_tolerance = 10;
				}

				logger(global['speak_last_user']+' spoke '+global['speak_linecount']+' lines (limit '+lines_tolerance+') since '+global['speak_epoch']+' at a rate of '+rate+' lines/sec over past '+seconds+' seconds (limit '+rate_tolerance+')');

				if ( (seconds < 5 && rate > rate_tolerance) || (seconds >= 5 && global['speak_linecount'] > lines_tolerance) ) {
					if (user.admin == true || user.owner == true || user.trendsetter == true || user.bot == true) {
						logger('- I will ignore flood from trusted user '+user.nickname);
						return
					} 

					if (user.live_points < 50) {
						logger('Banning user because they have fewer than 50 points');
						botdb.query('INSERT INTO blacklist (user_id,added_by,public_msg,private_msg) VALUES ($1,$2,$3,$4)', [
						user.user_id, settings.userid, 'Flood Spammer Asshole', 'You are too loud for us'
						], after(function(result) {} ));
					}

					bot.bootUser(user.user_id,'You are too loud for us');
				}
			});
		}));
	}
}
function db_registered(data) {
	if (!db_write()) { return; }

	logger('logging join to db');


	//util.log(util.inspect(data));

	botdb.query('INSERT INTO users (user_id,nickname) SELECT $1,$2 WHERE 1 NOT IN (SELECT 1 FROM users WHERE user_id = $3)', [
			data.user[0].userid,
			data.user[0].name,
			data.user[0].userid
			], after(function(result) {} ));

	botdb.query('INSERT INTO users_joins (user_id,room_id,nickname,device,acl,fans,points,avatarid) SELECT $1,$2,$3,$4,$5,$6,$7,$8', [
			data.user[0].userid,
			global['roomid'],
			data.user[0].name,
			data.user[0].laptop,
			data.user[0].acl,
			data.user[0].fans,
			data.user[0].points,
			data.user[0].avatarid
			], after(function(result) {} ));

	botdb.query('UPDATE users SET nickname = $1 WHERE user_id = $2', [
			data.user[0].name,
			data.user[0].userid
			], after(function(result) {} ));

	update_dj_live_stats(data.user[0].userid);
}

function db_loadowners() {
	if (!db_read()) { return; }

	leaders.length = 0;
	botdb.query('SELECT user_id FROM users WHERE owner IS TRUE ORDER BY nickname',after(function(result) {
				result.rows.forEach(function(user) {
					owners.push(user.user_id);
					});
				logger('- Loaded '+owners.length+' owners from database');
				}));
}

function db_loadbots() {
	if (!db_read()) { return; }

	leaders.length = 0;
	botdb.query('SELECT user_id FROM users WHERE bot IS TRUE ORDER BY nickname',after(function(result) {
				result.rows.forEach(function(user) {
					bots.push(user.user_id);
					});
				logger('- Loaded '+bots.length+' bots from database');
				}));
}

function db_loadleaders() {
	if (!db_read()) { return; }

	leaders.length = 0;
	botdb.query('SELECT user_id FROM users WHERE (owner IS NOT TRUE AND admin IS NOT TRUE) AND trendsetter IS TRUE ORDER BY nickname',after(function(result) {
				result.rows.forEach(function(user) {
					leaders.push(user.user_id);
					});
				logger('- Loaded '+leaders.length+' leaders from database');
				}));
}

function db_loadsettings() {
	if (!db_read()) { return; }

	loadcount = 0;
	botdb.query('SELECT * FROM settings WHERE deleted IS NULL AND enabled IS TRUE AND (bot_id IS NULL OR bot_id = $1) ORDER BY bot_id DESC', [
			  settings.userid
			], after(function(result) {
				result.rows.forEach(function(setval) {
					config[setval.key] = setval.value;
					logger('- '+setval.key+' set to '+config[setval.key]+' from the database');
					loadcount = loadcount + 1;
					});
				logger('- Loaded '+loadcount+' settings from database');
				}));
}

function db_loadadmins() {
	if (!db_read()) { return; }

	admins.length = 0;
	botdb.query('SELECT user_id FROM users WHERE owner IS TRUE OR admin IS TRUE ORDER BY nickname',after(function(result) {
				result.rows.forEach(function(user) {
					admins.push(user.user_id);
					});
				logger('- Loaded '+admins.length+' admins from database');
				}));

}

function add_leader(user_id) {
	if (db_write()) {
		botdb.query('UPDATE users SET trendsetter = TRUE WHERE trendsetter IS NOT TRUE AND user_id = $1', [
				user_id
				], after(function(result) {} ));
	}
	db_loadleaders();
}

function drop_leader(user_id) {
	if (db_write()) {
		botdb.query('UPDATE users SET trendsetter = FALSE WHERE trendsetter IS NOT FALSE AND user_id = $1', [
				user_id
				], after(function(result) {} ));
	}
	db_loadleaders();
}

function db_sayodometer(data) {
	if (!db_read()) { return; }
	if (config['say_odometer'] != 'on') { return; }

	//util.log(util.inspect(data));

	//logger('cursongname   = \''+global['cursongname']+'\'');
	//logger('curartistname = \''+global['curartistname']+'\'');

	botdb.query('SELECT secs_ago FROM songlog_expanded WHERE (song_id = $1 OR (song ILIKE $2 AND artist ILIKE $3)) AND stats_djcount IS NOT NULL ORDER BY id DESC LIMIT 1', [
			global['cursong'],
			global['cursongname'],
			global['curartistname']
			], after(function(result) {
				// util.log(util.inspect(result));

				var buf = result.rows[0];

			    if (typeof buf === 'undefined') {
					logger('Never heard this song before.');
				} else {
					var seconds = buf.secs_ago;
					var minutes = Math.round( seconds / 60 );
					var hours   = Math.round( seconds / 3600 );

					if (seconds < 3600) {
						lag_say('Wow, I haven\'t heard this song in, like, '+minutes+' minutes!');
					} else if (seconds < 36000) {
						lag_say('Wow, I haven\'t heard this song in, like, '+hours+' hours!');
					} else {
						logger('Last heard this song '+hours+' hours ago ('+seconds+')');
					}
				}
	}));

	botdb.query('SELECT lower(artist) as artist,count(*) as plays,(SELECT count(*) FROM songlog_expanded WHERE dj_id = $1) as total_plays FROM songlog_expanded WHERE dj_id = $1 GROUP BY lower(artist) ORDER BY plays DESC LIMIT 1', [
			data.room.metadata.current_song.djid
			], after(function(result) {
				// util.log(util.inspect(result));

				if (result.rows.length == 1) {
				var buf = result.rows[0];

				var a_fav = buf.artist;
				var a_cur = data.room.metadata.current_song.metadata.artist;

				if (a_fav.toLowerCase() == a_cur.toLowerCase()) {
				var percentage = Math.round( buf.plays / buf.total_plays * 1000) / 10;
				var saybuf = 'This is '+data.room.metadata.current_song.djname+'\'s favorite artist! '+buf.plays+' plays ('+percentage+'%)';
				if (buf.plays > 5) {
				lag_say(saybuf);
				}
				}
				}
				}));

	botdb.query('SELECT song_id, count(*) FROM songlog WHERE dj_id = $1 GROUP BY song_id ORDER BY count DESC LIMIT 1', [
			data.room.metadata.current_song.djid
			], after(function(result) {
				if (result.rows.length == 1) {
				if (result.rows[0].song_id == data.room.metadata.current_song._id) { 
				// util.log(util.inspect(result.rows[0].age_text));
				var saybuf = 'This is '+data.room.metadata.current_song.djname+'\'s favorite song! '+result.rows[0].count+' plays.';
				//logger(saybuf);
				if (result.rows[0].count > 3) {
				lag_say(saybuf);
				}
				}
				}
				}));

	botdb.query('SELECT * FROM songlog_expanded WHERE song_id = $1 AND trip_odometer IS TRUE AND ts < current_timestamp at time zone \'utc\' - \'1 minute\'::interval ORDER BY ts DESC LIMIT 1', [
			data.room.metadata.current_song._id
			], after(function(result) {
				if (result.rows.length == 1) {
				// util.log(util.inspect(result.rows[0].age_text));
				var saybuf = result.rows[0].nickname+' last played this song '+result.rows[0].age_text+'!';
				// logger(saybuf);
				lag_say(saybuf);
				}
				}));
}

function db_djstats(target,data) {
	if (!db_read()) { return; }
	if (config['say_odometer'] != 'on') {
		return;
	}

	var sql = 'SELECT count(l.*) as plays, count(DISTINCT l.song_id) as songs, ';
	// sql = sql+' (\'1970-01-01 00:00:00\' - timestamp without time zone \'epoch\' + sum(length) * \'1 second\'::interval)::varchar as duration, ';
	sql = sql+' sum(length) as duration, ';
	sql = sql+' avg(length) as avg_seconds, ';
	sql = sql+' avg(l.stats_listeners) as avg_listeners, max(l.stats_listeners) as max_listeners, sum(length) as secs, ';
	sql = sql+' (SELECT count(v.*) FROM votelog v LEFT JOIN songlog s ON s.id = v.play_id WHERE s.dj_id = $1) as upvotes, ';
	sql = sql+' sum((dj_id=substring(stats_djs from 3 for 24))::integer) as seat_one ';
	sql = sql+' FROM songlog_expanded l WHERE dj_id = $1';

	logger(sql);

	botdb.query(sql, [
			global['curdjid']
			], after(function(result) {
				// util.log(util.inspect(result));

				var statline = id_to_name(global['curdjid']);

				if (result.rows.length == 1) {
				var buf = result.rows[0];

				//util.log(util.inspect(buf));

				if (buf.plays == 1) {
				statline = statline+' is playing their first song in here.  Welcome!';
				} else {
				var unique = Math.round(buf.songs / buf.plays * 1000) / 10;

				var amm = Math.floor(buf.avg_seconds / 60);
				var ass = Math.round(buf.avg_seconds - (amm * 60));
				var hours = Math.floor(buf.duration / 60 / 60);
				var apm = Math.round(buf.upvotes / (buf.secs / 60) * 1000) / 1000;

				// var hogper = Math.round(buf.seat_one / buf.plays * 1000) / 10;

				statline = statline+' has spun '+buf.songs+' songs in '+buf.plays+' plays in the Pit';
				statline = statline+' ('+unique+'% unique)';

				statline = statline+' and hogged the first chair for '+buf.seat_one+' songs.';
				if (hours > 0) {
					statline = statline+' That\'s '+hours+' hours of music';
					statline = statline+' with  '+apm+' apm.';
				}
				statline = statline+' Largest crowd: '+buf.max_listeners+' people.';
				statline = statline+' Average song: '+amm+' min '+ass+' sec long.';
				}
				} else {
					statline = 'I\'m confused!';
				}

				if(target == 'public') {
					say(statline);
				} else {
					pm(statline,data.senderid);
				}
			}));
}

function db_songstats(target,data) {
	if (!db_read()) { return; }
	if (config['say_odometer'] != 'on') {
		return;
	}

	// util.log(util.inspect(data));
	
	var whereclause = 'song ILIKE $1 AND artist ILIKE $2';

	botdb.query('select *, (SELECT count(*) FROM songlog_expanded WHERE '+whereclause+') AS plays, (SELECT count(DISTINCT dj_id) FROM songlog_expanded WHERE '+whereclause+') AS djs FROM songlog_expanded WHERE '+whereclause+' AND stats_djcount IS NOT NULL ORDER BY id DESC LIMIT 1', [
			global['cursongname'],
			global['curartistname']
			], after(function(result) {
				var statline;

				if (result.rows.length == 1) {
					var buf = result.rows[0];

					var when = buf.age_text;

					if (buf.sec_ago < 3600) {
						when = 'in the past hour!';
					} else if (buf.secs_ago < 86400) {
						when = 'earlier today!';
					} else {
						when = buf.age_text;
					}

					// util.log(util.inspect(buf));

					if (buf.plays == 1) {
						statline = buf.song=' has only been played once before by '+buf.nickname+' '+when;
						if (target == 'public') { say(statline); } else { pm(statline,data.senderid); }
					} else {
						if (buf.djs == 1) {
							statline = buf.song+' has only been played by '+buf.nickname+', '+buf.plays+' times, most recently '+when;
							if (target == 'public') { say(statline); } else { pm(statline,data.senderid); }
						} else {
							statline = buf.song+' has been played '+buf.plays+' times by '+buf.djs+' DJs.';
							// statline = statline+' Most recently by '+buf.nickname+' '+when;
	
							botdb.query('SELECT * FROM songlog_expanded WHERE '+whereclause+' ORDER BY ts LIMIT 1', [
								global['cursongname'],
								global['curartistname']
							], after(function(result) {
								if (result.rows.length == 1) {
									var buftwo = result.rows[0];
									// util.log(util.inspect(buftwo));
									statline = statline+' It was first played by '+buftwo.nickname+' '+buftwo.age_text;
									statline = statline+' and most recently by '+buf.nickname+' '+buf.age_text;
									if (target == 'public') { say(statline); } else { pm(statline,data.senderid); }
								}
							}));
						}
					}
				} else {
					statline = 'I\'ve never heard this song before today!';
					if (target == 'public') { say(statline); } else { pm(statline,data.senderid); }
				}
			}));


}

function db_saysnag(data) {
	if (!db_read()) { return; }
	if (config['say_snags'] != 'on') {
		return;
	}

	//util.log(util.inspect(data));
	//
	global['cursong']      = data.room.metadata.current_song._id;
	global['cursongname']  = data.room.metadata.current_song.metadata.song;
	global['curartistname']  = data.room.metadata.current_song.metadata.artist;
	global['curdjid']      = data.room.metadata.current_song.djid;
	global['curdjname']     = data.room.metadata.current_song.djname;

	botdb.query('SELECT * FROM snaglog_expanded WHERE song_id = $1 AND user_id = $2', [
			data.room.metadata.current_song._id,
			data.room.metadata.current_song.djid
			], after(function(result) {
				if (result.rows.length != 1) {
				// logger('No record of this song having been snagged');
				} else {
				// util.log(util.inspect(result.rows[0].age_text));
				if (result.rows[0].age_text == '00:00:00 ago') {
				var saybuf = result.rows[0].nickname+' just snagged this song from '+result.rows[0].dj_nickname+' earlier today!';
				} else {
				var saybuf = result.rows[0].nickname+' snagged this song from '+result.rows[0].dj_nickname+' '+result.rows[0].age_text+'!';
				}
				// logger(saybuf);
				lag_say(saybuf);
				}
				}));
}

function db_seen(nick) {
	if (!db_read()) { return; }
	if (config['say_seen'] != 'on') {
		return;
	}
}

function pick_random(count) {
	var indexFrom = 0;
	count = parseInt(count);

	// logger('- random count is '+count);

	for (i=1; i<= count; i++) {
		indexFrom = parseInt(Math.random() * global['queuelen']);
		logger('- Moving song index '+indexFrom+' to the top');
		bump_song(indexFrom);
	}
}

function bump_song(indexFrom) {
	indexFrom = parseInt(indexFrom);

	bot.playlistReorder(indexFrom, 0);
	schedule_queue_dump();
}

//Clear any pending dumps and schedule a new one (currently hardcoded at 5 sec)
function schedule_queue_dump() {
	if( pendingQueueDump )
		clearTimeout(pendingQueueDump);
	pendingQueueDump = setTimeout(function(){ dump_queue(); }, 5000);
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

function is_leader(userid) {
	if (admins.indexOf(userid) != -1) {
		return 1
	}
	if (leaders.indexOf(userid) != -1) {
		return 1
	}
	return 0
}

function explain_rules(djname) {
	if (opt('oneanddone') == 'on') {
		say('Welcome to the Pit, @'+djname+'!  The Pit is in Epic No Shame rotation -- No follow required. Play the best of your worst, or the worst of your best. Push the limits of decency! If you have any questions, ask one of these Shameless Bastards! http://macnugget.org/cowgod/djstats');
	} else {
		say('Welcome to the Pit, @'+djname+'!  We usually play follow the leader here with theme rounds based on whatever 1st chair plays. Have fun!  You can see what was recently played at http://macnugget.org/cowgod/recent');
	}
}

function toggle_config (item,toggle) {
	logger('* toggle is '+toggle);
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
	logger('- config['+item+'] is now '+config[item]);
}

function opt (item) {
	if (typeof config[item] === 'undefined') {
		return 'off';
	}
	return config[item];
}

function say_config (item,user_id) {
	if (typeof setting_description[item] === 'undefined') {
		pm(item+' setting is now '+config[item],user_id);
	} else {
		say(setting_description[item]+' is now '+config[item],user_id);
	}
}

function say(text) {
	if (config['mute'] == 'off') {
		bot.speak(text);
	} else {
		logger('muted: '+text);
	}
}

function lag_say (text) {
	waitms = parseInt(Math.random() * 8000)+500;
	setTimeout(function(){ say(text); }, waitms);
}

function pm (text,receiver) {
	logger('PM to '+id_to_name(receiver)+': '+text);
	bot.pm(text,receiver);
}

function lag_pm (text,receiver) {
	waitms = parseInt(Math.random() * 8000)+500;
	setTimeout(function(){ pm(text,receiver); }, waitms);
}

function lag_heart (text) {
	waitms = parseInt(Math.random() * 8000)+500;
	setTimeout(function(){ 
			say(text);
			bot.snag();
			}, waitms);
}

function id_to_name (user_id) {
	if (user_id == settings.userid) {
		return 'The Bot';
	}
	for (var k in usernames) {
		if (k == user_id) {
			return usernames[k];
		}
	}
	for (var k in users) {
		if (users.hasOwnProperty(k)) {
			if (users[k] == user_id) {
				return k;
			}
		}
	}
	bot.getProfile(user_id, function(userdata) {
			return userdata.name;
			});

	return user_id;
}

function update_dj_live_stats (dj_id) {
	if (!db_write()) { return; }
	bot.getProfile(dj_id, function(data) {
		logger('- Updating live DJ stats for '+dj_id);
		// util.log(util.inspect(data));
		botdb.query('UPDATE users SET live_points = $2, live_avatar = $3 WHERE user_id = $1', [
			dj_id,
			data.points,
			data.avatarid
		]);
	});
}

function name_to_id (username) {
	for (var k in usernames) {
		if (usernames[k] == username) {
			return k;
		}
	}
	botdb.query('SELECT * FROM users WHERE nickname = $1', [
		username
	], after(function(result) {
		if (result.rows.length == 1) {
			var user = result.rows[0];
			// util.log(util.inspect(user));
			return user._id;
		}
	}));

	return;
}

function lag_vote (vote) {
	waitms = parseInt(Math.random() * 20000)+500;
	logger('- will vote '+vote+' in '+waitms+' ms');
	setTimeout(function(){ do_vote(vote); }, waitms);
}

function look_for_owners(users) {
	var in_room = 0;
	users.forEach(function(user) {
		if(is_owner(user.userid)) {
			in_room = 1;
		}
	});

	if (in_room != global['owner_in_room']) {
		global['owner_in_room'] = in_room;
		logger('* owner_in_room is now '+global['owner_in_room']);
	}
}

function do_vote (vote) {
	bot.roomInfo(false, function(roominfo) {
		// util.log(util.inspect(roominfo));
		look_for_owners(roominfo.users);
		if(roominfo.room.metadata.current_dj == settings.userid) {
			logger('- ignoring self-vote');
		} else {
			botdb.query('SELECT * FROM users WHERE user_id = $1', [
				roominfo.room.metadata.current_dj
			], after(function(result) {
				if (result.rows.length == 1) {
					var user = result.rows[0];
					//util.log(util.inspect(user));
					if(user.ignore) { 
						logger('- ignoring pariah '+user.nickname);
					} else {
						bot.vote(vote);
					}
				}
			}));
		}
	});
}

function do_command (data) {
	var argv = data.text.replace(/\s+/g,' ').split(' ');
	var command = argv[0].substr(1).toLowerCase();
	var args_arr = argv.slice(1);
	var args     = args_arr.join(' ');

	if (!is_admin(data.senderid)) {
		logger('= '+id_to_name(data.senderid)+' tried admin command '+command+'('+args+')');
		owners.forEach(function(owner) {
			logger(id_to_name(data.senderid)+' just tried to do /'+command+' '+args);
		});

		pm('Not authorized',data.senderid);
		return
	}

	logger('= '+id_to_name(data.senderid)+' issued admin command '+command+'('+args+')');

	switch(command) {
		case 'jump':
			if (argv[1] == 'down') {
				bot.remDj(settings.userid);
			} else {
				bot.addDj();
			}
			break;
		case 'fortune':
			say_command('/usr/games/fortune -s -a');
			break;
		case 'phb':
			say_command('/usr/local/bin/speak');
			break;
		case 'awesome':
			do_vote('up');
			break;
		case 'lame':
			do_vote('down');
			break;
		case 'avatar':
			args = parseInt(args);
			bot.setAvatar(args);
			break;
		case 'say':
			logger('= '+id_to_name(data.senderid)+' ventriloquist:');
			say(args);
			break;
		case 'autobop':
		case 'oneanddone':
		case 'mute':
		case 'follow':
		case 'autoskip':
		case 'database':
			pm('Please use /SET to alter settings.  The old way is no longer supported.',data.senderid);
			break;
		case 'set':
			if (argv.length == 1) {
				pm('Usage: /SET config_item [value]',data.senderid);
				break;
			}
			var itemname = argv[1];
			var toggle   = argv[2];

			if (typeof(config[itemname]) === 'undefined') {
				pm('I have never heard of that setting',data.senderid);
				break;
			}

			if (argv.length == 2) {
				pm(itemname+' is currently '+config[itemname],data.senderid);
				break;
			}

			logger('toggle is ('+toggle+')');
			toggle_config(itemname,toggle);
			pm(itemname+' is now '+config[itemname],data.senderid);
			break;
		case 'snag':
			logger('- '+id_to_name(data.senderid)+' wants me to add this song to my queue');
			add_current_song_to_queue(true);
			break;
		case 'skip':
			logger('= '+id_to_name(data.senderid)+' skipped this song');
			bot.stopSong();
			break;
		case 'dumpqueue':
			logger('= '+id_to_name(data.senderid)+' dumped the queue');
			dump_queue();
			break;
		case 'comehere':
			logger('= '+id_to_name(data.senderid)+' beckoned me');
			follow_user(data.senderid);
			break;
		case 'random':
			logger('= '+id_to_name(data.senderid)+' wants '+args+' new random tracks');
			pick_random(args);
			break;
		case 'bump':
			logger('= '+id_to_name(data.senderid)+' bumped track '+args+' to the top');
			bump_song(args);
			break;
		case 'addleader':
			logger('= '+id_to_name(data.senderid)+' added '+args+' as a leader');
			add_leader(args);
			break;
		case 'dropleader':
			logger('= '+id_to_name(data.senderid)+' dropped '+args+' as a leader');
			drop_leader(args);
			break;
		case 'reload':
			db_loadsettings();
			db_loadadmins();
			db_loadleaders();
			db_loadowners();
			break;
		case 'debug':
			if (args != 'on') {
				logger('= '+id_to_name(data.senderid)+' set debug off');
				bot.debug = false;
			} else {
				logger('= '+id_to_name(data.senderid)+' set debug on');
				bot.debug = true;
			}
			break;
		case 'djstats':
			logger('! '+id_to_name(data.senderid)+' asked for dj stats');
			db_djstats(args,data);
			break;
		case 'songstats':
			logger('! '+id_to_name(data.senderid)+' asked for song stats');
			db_songstats(args,data);
			break;
		case 'default':
			logger('! '+id_to_name(data.senderid)+' tried unknown command '+command+'('+args+')');
			break;
	}
}

function add_current_song_to_queue(visible) {
	if (global['cursong'] == 'none') {
		logger('! I do not know what song is playing');
		return;
	}

	bot.playlistAll(function(data) { 
			global['queuelen'] = data.list.length;
			global['addok'] = 1;

			data.list.forEach(function(song) {
				// logger('- comparo '+song._id+' and '+global['cursong']);
				if (song._id == global['cursong']) {
				logger('! '+song.metadata.song+' by '+song.metadata.artist+' is already in my queue -- skipping');
				global['addok'] = 0;
				return;
				}
				});
			// logger('post-scan global ok is '+global['addok']);

			if (global['addok'] == 1) {
			bot.playlistAdd('default',global['cursong'],global['queuelen'],function(resp) {
				logger('* Song '+global['cursong']+' added to index '+global['queuelen']);
				if (visible == true) {
				logger('- making hearts');
				bot.snag();
				}
				});
			}
	});
}

function follow_user(userid) {
	bot.stalk(userid, true, function(userdata) {
			// util.log(util.inspect(userdata));
			var target_id = userdata.roomId;

			if (target_id != global['roomid']) {
			logger('* Following '+id_to_name(userid)+' to room_id '+target_id);
			bot.roomDeregister( function(data) {
				bot.roomRegister(target_id);
				pm('I am here now!',userid);
				});
			} else {
			logger('* I am already in that room');
			pm('I am already in that room, silly',userid);
			}
			});
}

function clear_entire_queue() {
	for (i=0; i<= 500; i++) {
		bot.playlistRemove('default',i,function(resp) {
			// > ~m~77~m~{"msgid": 6, "success": true, "song": {"fileid": "4e1e27ef99968e3cc5000428"}}
			if (resp.success == true) {
			    if (typeof resp.song.fileid === 'undefined') {
					logger('! Removed song index '+i+' (success='+resp.success+')');
				} else {
					logger('! Removed song index '+i+' (success='+resp.success+', song='+resp.song.fileid+')');
				}
			} else {
				// logger('Removed song index '+i+' (success='+resp.success+')');
			}
		});
	}
}

process.umask(022);
console.log('connecting as '+settings.userid);
var bot = new Bot(settings.token, settings.userid, settings.roomid);
bot.debug = settings.debug;

// bot.modifyLaptop(settings.laptop);
// bot.setAvatar(settings.avatar);

bot.on('roomChanged', function (data) { 
	// util.log(util.inspect(data));
	
	global['roomid'] = data.room.roomid;
	logger('! Room changed to '+data.room.name+' ('+data.room.roomid+')');
	logger_tsv([ 'event','newroom','roomname',data.room.name ]);

	look_for_owners(data.users);

	// util.log(util.inspect(data));

	if (data.room.metadata.current_song == null) {
		logger('- Nothing is currently playing');
	} else {
		global['cursong']      = data.room.metadata.current_song._id;
		global['cursongname']  = data.room.metadata.current_song.metadata.song;
		global['curartistname']  = data.room.metadata.current_song.metadata.artist;
		global['curdjid']      = data.room.metadata.current_song.djid;
		global['curdjname']    = data.room.metadata.current_song.djname;
		logger('! Now Playing '+data.room.metadata.current_song.metadata.song);
	}

	for (i=0; i< data.users.length; i++) {
		// util.log(util.inspect(data.users[i]));
		usernames[data.users[i].userid] = data.users[i].name;
		// logger('I see '+data.users[i].name);
	}

	bot.modifyLaptop(settings.laptop);
	// clear_entire_queue();
	dump_queue();
	bot.playlistAll(function(data) { 
		global['queuelen'] = data.list.length;
		logger('- I have '+global['queuelen']+' songs in my queue.');
	});
});

bot.on('registered', function (data) {
	logger('* '+data.user[0].name+' joined the room on a '+data.user[0].laptop+' ('+data.user[0].points+' points) uid '+data.user[0].userid);
	logger_tsv([ 'event','joined','userid',data.user[0].userid,'username',data.user[0].name,'device',data.user[0].laptop ]);
	usernames[data.user[0].userid] = data.user[0].name;
	db_registered(data);
	join_response(data);
	enforce_blacklist(data);
});

bot.on('snagged', function (data) {
	logger_tsv([ 'event','snag','userid',data.userid,'songid',global['cursong'],'djid',	global['curdjid'],'songname',global['cursongname'],'djname',global['curdjname']	]);
	db_snag(data);

	if (data.userid == settings.userid || data.userid == '4f50ea86a3f7517d6c006f16') {
		// logger('- ignoring self-snag');
		// this is me!  ignore it
		return;
	}

	logger('* '+id_to_name(data.userid)+' snagged this song');
	if (global['cursong'] != 'none') {
		if (global['myvote'] != 'down' ) {
			add_current_song_to_queue(false);
		}
	}
});

bot.on('deregistered', function (data) {
	logger('* '+data.user[0].name+' left the room');
	logger_tsv([ 'event','part','userid',data.user[0].userid,'username',data.user[0].name ]);
	return;

	if (is_admin(data.user[0].userid)) {
		lag_say('Oh no!');
	} else if (data.user[0].userid == users['Storm(e)']) {
		lag_say('I thought she would never leave!');
	}

});

bot.on('newsong', function (data) { 
	logger('* '+data.room.metadata.current_song.djname+' played '+data.room.metadata.current_song.metadata.song+' by '+data.room.metadata.current_song.metadata.artist);
	logger_tsv([ 'event','newsong','songid',data.room.metadata.current_song._id,
				'djid',data.room.metadata.current_song.djid,
				'djname',data.room.metadata.current_song.djname,
				'album',data.room.metadata.current_song.metadata.album,
				'artist',data.room.metadata.current_song.metadata.artist,
				'coverart',data.room.metadata.current_song.metadata.coverart,
				'song',data.room.metadata.current_song.metadata.song,
				'mnid',data.room.metadata.current_song.metadata.mnid,
				'genre',data.room.metadata.current_song.metadata.genre,
				'length',data.room.metadata.current_song.metadata.length
			   ]);

	db_newsong(data);
	newsong_theme_management(data);
	newsong_one_and_done(data);

	bot.roomInfo(false, function(roominfo) {
		look_for_owners(roominfo.users);
	});

	global['cursong']      = data.room.metadata.current_song._id;
	global['cursongname']  = data.room.metadata.current_song.metadata.song;
	global['curdjid']      = data.room.metadata.current_song.djid;
	global['curdjname']     = data.room.metadata.current_song.djname;

	if (config['autobop'] == 'on') {
		global['myvote'] = 'up';
		lag_vote('up');
	} else if (is_admin(data.room.metadata.current_song.djid)) {
		global['myvote'] = 'up';
		lag_vote('up');
	} else if (is_bot(data.room.metadata.current_song.djid)) {
		global['myvote'] = 'up';
		lag_vote('up');
	} else {
		global['myvote'] = 'none';
		// logger('= Clearing my vote for the new song');
	}


	db_saysnag(data);
	db_sayodometer(data);
});

bot.on('endsong', function (data) { 
	db_endsong(data);
});

bot.on('update_votes', function (data) {
	user = data.room.metadata.votelog[0][0];
	vote = data.room.metadata.votelog[0][1];

	logger_tsv([ 'event','vote','songid',global['cursong'],'userid',user,'vote',vote ]);
	db_vote(data);

	if (config['follow'] == 'off') {
		return;
	}

	logger('* '+id_to_name(user)+' voted '+vote);

	if (config['owner_follow'] == 'on') {
		if (global['owner_in_room'] == 1) {
			if (global['myvote'] == 'none') {
				logger('- owner_follow is enabled and owner is in the room');
			}
		} else {
			if (global['myvote'] == 'none') {
				logger('- owner_follow is enabled and owner is NOT in the room');
			}
			return;
		}
	}

	if (is_leader(user)||is_bot(user)) {
		if (global['myvote'] == 'none') {
			logger('- Voting '+vote+'!  I am such a follower');
			global['myvote'] = vote;
			lag_vote(vote);
		}
	}

	if (is_admin(user)) {
		if (vote != global['myvote']) {
			global['myvote'] = vote;
			lag_vote(vote);
		}
	}

});

bot.on('update_user', function (data) {
	update_dj_live_stats(data.userid);
});

bot.on('add_dj', function (data) {
	logger('* New DJ '+data.user[0].name);
	logger_tsv([ 'event','newdj','userid',data.user[0].userid ]);

	// logger('+ dj_scold is '+opt('dj_scold'));
	if (opt('dj_scold') == 'on') {
		botdb.query('SELECT count(*) FROM songlog WHERE dj_id = $1', [
			data.user[0].userid
		], after(function(result) {
			// util.log(util.inspect(result));
			
			if (result.rows.length == 1) {
				var playcount = result.rows[0];
				// util.log(util.inspect(playcount));
				if(playcount.count == 0) { 
					explain_rules(data.user[0].name);
				}
			}
		}));
	}

	return;

	if (data.user[0].userid == users['Bagel']) {
		say('Bagel Time!');
	} else if (data.user[0].userid == users['Storm(e)']) {
		say('No Dubstep!');
	} else if (is_admin(data.user[0].userid)) {
		say('I love '+data.user[0].name+'! (no homo)');
	}
});

bot.on('rem_moderator', function (data) {
	util.log(util.inspect(data));
	logger('* '+id_to_name(data.userid)+' lost their moderator status');
	if (is_owner(data.userid) || is_bot(data.userid)) {
		logger('* '+id_to_name(data.userid)+' needs saving!');
		bot.addModerator(data.userid);
	}

});

bot.on('new_moderator', function (data) {
	// util.log(util.inspect(data));
	logger('* '+id_to_name(data.userid)+' is now a moderator');
});

bot.on('pmmed', function (data) {
	if (data.text.match(/^\//)) {
		do_command(data);
	} else {
		pm(id_to_name(data.senderid)+' PMmed '+data.text,config['owner']);
		logger(id_to_name(data.senderid)+' PMmed '+data.text);
	}
});

bot.on('speak', function (data) {
	// util.log(util.inspect(data));

	logger('<'+data.name+'> '+data.text);
	db_speak(data);

	check_flood_rate(data);

	if (data.text.toLowerCase().indexOf('make it stop') != -1) {
		if (is_leader(data.userid)) {
			logger('user wants us to lame');
			global['myvote'] = 'down';
			do_vote(global['myvote']);
		}
	}

	if (opt('follow_seed_allowed') == 'on') {
		if (data.text.toLowerCase().indexOf('lets play the follow game') != -1) {
			if (is_leader(data.userid)) {
				if (opt('follow_seed_enabled') != 'on') {
					logger('user wants us to play follow game');
					toggle_config('follow_seed_enabled');
					say('Yay!  I love the follow game');
				}
			}
		} else if (data.text.toLowerCase().indexOf('sick of this game') != -1) {
			if (is_leader(data.userid)) {
				if (opt('follow_seed_enabled') == 'on') {
					logger('user wants us to stop the follow game');
					toggle_config('follow_seed_enabled');
					say('That was fun, thanks everyone.');
				}
			}
		}
	}

	if (settings.userid == '4f50ea86a3f7517d6c006f16') {
		if (data.text.toLowerCase().indexOf('@cowgod') != -1) {
			logger('= '+id_to_name(data.senderid)+' said my name');
			say_command('/usr/games/fortune -s -a');
		}
	}

	if (settings.userid == '4f91a1a1aaa5cd581d000280') {
		if (data.text.toLowerCase().indexOf('@flightaware') != -1) {
			logger('= '+id_to_name(data.senderid)+' said my name');
			say_command('/usr/local/bin/speak');
		}
	}
	
	if (settings.userid == '51fc4bb6eb35c104c18698d2') {
		if (data.text.toLowerCase().indexOf('@pink\'s mini me') != -1) {
			logger('= '+id_to_name(data.senderid)+' said my name');
			
			if (data.userid == '51813658aaa5cd3df7b79831') {
                lag_say('You\'re the BEST!');
		}	else {
				lag_say('@Pinkeeee is the BEST!');
			}
		}
	}

	// All commands below are chatty, so ignore unless odometer is enabled
	if (config['say_odometer'] != 'on') {
		return;
	}

	if (data.text.toLowerCase() == '/songstats') {
		db_songstats('public',data);
	}

	if (data.text.toLowerCase() == '/djstats') {
		db_djstats('public',data);
	}

	// All commands below are write ops, so skip if we can't
	if (!db_write()) { return; }

	if (data.text.toLowerCase().indexOf('/shame @') != -1) {
		logger('= shame');
		var username = parse_username(data.text);
		logger('= shame '+username);

		if (is_admin(data.userid)) {
			logger('= shame yes '+name_to_id(username));
			ban_user(name_to_id(username),data.userid);
		} else {
			logger('= shame no');
			say('Sorry, I just can\'t do that.');
		}
	}


});
