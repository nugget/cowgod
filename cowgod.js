var fs = require('fs');
var util = require('util');

var Bot  = require('ttapi');
var settings = require('./settings.js');
settings.db = false;

if (settings.dbname) {
	logger('connecting to posgresql database '+settings.dbname);
	var Client = require('pg').Client;

	var connstring = 'postgres://'+settings.dbuser+':'+settings.dbpass+'@'+settings.dbhost+':'+settings.dbport+'/'+settings.dbname;

	var botdb = new Client(connstring);
	botdb.connect();

	settings.db = true;
}

var config = new Object();
config['autobop']		= 'off';
config['mute']			= 'off';
config['follow']		= 'on';
config['database']		= 'on';
config['say_snags']		= 'on';
config['say_odometer']	= 'on';

var global = new Object();
global['myvote']	= 'none';
global['cursong']	= 'none';
global['roomid']	= settings.roomid;

var users = new Object();
users['nugget']		= '4e00e4e8a3f75104e10b7359';
users['SnS']		= '4e1c8c8b4fe7d031420bdf59';
users['Bagel']		= '4e1c6fb1a3f75163090bc3ae';
users['Jello']		= '4e15df8a4fe7d0665e02a9ef';
users['Storm(e)']	= '4e3e10a94fe7d05787083cf1';
users['Olive']		= '4e0a03aaa3f7517d0f0e639d';
users['PitDemon']	= '4f50ed44590ca261fa004904';
users['Dario']		= '4e00e584a3f75104e30b9fec';
users['Becca']		= '4eeabf24590ca2576200265b';
users['Buff']		= '4e123f71a3f75114d000f378';
users['Bubba_Hotep']= '4e15cf89a3f751698c020b2f';

config['owner']	= users['nugget'];

var admins = new Array();
admins.push(users['nugget']);
admins.push(users['SnS']);
admins.push(users['Bagel']);

var leaders = new Array();
leaders.push(users['Jello']);
leaders.push(users['Becca']);
leaders.push(users['Dario']);
leaders.push(users['Buff']);
leaders.push(users['Bubba_Hotep']);

//Bagel added this to track pending queue dump
var pendingQueueDump;

if (settings.log_chat) {
	var log_chat = fs.createWriteStream(settings.log_chat, {'flags': 'a'});
}
if (settings.log_tsv) {
	var log_tsv  = fs.createWriteStream(settings.log_tsv,  {'flags': 'a'});
}

function logger(buf) {
	if (typeof log_chat === 'undefined') {
	} else {
		var d=new Date();
		log_chat.write('['+d+'] ');
		log_chat.write(buf+'\n');
	}
	console.log(buf)
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

function error_caught(err,context = '') {
	if (err == null) {
		return false;
		logger('error_caught function sees no problem');
	}
	if (context != '') {
		context = ' '+context;
	}
	logger('database '+err+' (code '+err.code+' at pos '+err.position+context+)');
	return true;
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
	if (!settings.db || config['database'] != 'on') {
		logger('no database configured');
		return;
	}

	logger('logging a new song to the database');
	//util.log(util.inspect(data));
	//
	db_songdb(data.room.metadata.current_song);

	botdb.query('INSERT INTO songlog (song_id,room_id,dj_id,stats_djs) SELECT $1,$2,$3,$4', [
		data.room.metadata.current_song._id,
		data.roomid,
		data.room.metadata.current_dj,
		data.room.metadata.djs
	], function(err,result) {
		if (error_caught(err)) { return; }
	});
}

function db_endsong(data) {
	if (!settings.db || config['database'] != 'on') {
		return;
	}
	botdb.query('UPDATE songlog SET stats_djcount = $1, stats_listeners = $2 WHERE song_id = $3 AND room_id = $4 AND stats_djcount IS NULL', [
		data.room.metadata.djcount,
		data.room.metadata.listeners,
		data.room.metadata.current_song._id,
		data.room.roomid
	], function(err,result) {
		if (error_caught(err)) { return; }
	});
	db_songdb(data.room.metadata.current_song);
}

function db_songdb(song) {
	if (!settings.db || config['database'] != 'on') {
		return;
	}

	song.metadata.album = song.metadata.album.replace(/\u0000/g,'');
	song.metadata.artist = song.metadata.artist.replace(/\u0000/g,'');
	song.metadata.song = song.metadata.song.replace(/\u0000/g,'');

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
	], function(err,result) {
		if (error_caught(err)) { return; }
	});
}

function db_snag(data) {
	if (!settings.db || config['database'] != 'on') {
		return;
	}

	logger('logging snag to db for'+global['roomid']);

	botdb.query('INSERT INTO snaglog (play_id, user_id) SELECT id, $1 FROM songlog WHERE room_id = $2 ORDER BY ts DESC LIMIT 1', [
		data.userid,
		global['roomid']
	], function(err,result) {
		if (error_caught(err)) { return; }
	});
}

function db_vote(data) {
	if (!settings.db || config['database'] != 'on') {
		return;
	}

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
	], function(err,result) {
		if (error_caught(err)) { return; }
	});
}

function join_response(data) {
	if (settings.userid != '4f50ea86a3f7517d6c006f16') {
		// This stuff only works for cowgod.
		return;
	}

	if (data.user[0].userid == users['Becca']) {
		lag_heart('Yay! I <3 Becca!');
	}
}

function db_registered(data) {
	if (!settings.db || config['database'] != 'on') {
		return;
	}

	logger('logging join to db');

	//util.log(util.inspect(data));

	botdb.query('INERT INTO users (user_id,nickname) SELECT $1,$2 WHERE 1 NOT IN (SELECT 1 FROM users WHERE user_id = $3)', [
		data.user[0].userid,
		data.user[0].name,
		data.user[0].userid
	], function(err,result) {
		if (error_caught(err)) { return; }
	});

	botdb.query('INSERT INTO users_joins (user_id,room_id,nickname,device,acl,fans,points,avatarid) SELECT $1,$2,$3,$4,$5,$6,$7,$8', [
		data.user[0].userid,
		global['roomid'],
		data.user[0].name,
		data.user[0].laptop,
		data.user[0].acl,
		data.user[0].fans,
		data.user[0].points,
		data.user[0].avatarid
	], function(err,result) {
		if (error_caught(err)) { return; }
	});

	botdb.query('UPDATE users SET nickname = $1 WHERE user_id = $2', [
		data.user[0].name,
		data.user[0].userid
	], function(err,result) {
		if (error_caught(err)) { return; }
	});
}

function db_sayodometer(data) {
	if (!settings.db || config['database'] != 'on' || config['say_odometer'] != 'on') {
		return;
	}

	//util.log(util.inspect(data));

	botdb.query('SELECT song_id, count(*) FROM songlog WHERE dj_id = $1 GROUP BY song_id ORDER BY count DESC LIMIT 1', [
		data.room.metadata.current_song.djid
	], function (err,result) {
		if (error_caught(err)) { return; }

	    if (result.rows.length == 1) {
			if (result.rows[0].song_id == data.room.metadata.current_song._id) { 
				util.log(util.inspect(result.rows[0].age_text));
				var saybuf = 'This is '+data.room.metadata.current_song.djname+'\'s favorite song! '+result.rows[0].count+' plays.';
				logger(saybuf);
				if (result.rows[0].count > 3) {
					lag_say(saybuf);
				}
			}
		}
	});

	botdb.query('SELECT * FROM songlog_expanded WHERE song_id = $1 AND trip_odometer IS TRUE AND ts < current_timestamp at time zone \'utc\' - \'1 minute\'::interval ORDER BY ts DESC LIMIT 1', [
		data.room.metadata.current_song._id
	], function (err,result) {
		if (error_caught(err)) { return; }

	    if (result.rows.length == 1) {
			util.log(util.inspect(result.rows[0].age_text));
			var saybuf = result.rows[0].nickname+' last played this song '+result.rows[0].age_text+'!';
			// logger(saybuf);
			lag_say(saybuf);
		}
	});
}

function db_saysnag(data) {
	if (!settings.db || config['database'] != 'on' || config['say_snags'] != 'on') {
		return;
	}

	//util.log(util.inspect(data));
	//
	global['cursong']      = data.room.metadata.current_song._id;
	global['cursongname']  = data.room.metadata.current_song.metadata.song;
	global['curdjid']      = data.room.metadata.current_song.djid;
	global['curdjname']     = data.room.metadata.current_song.djname;

	botdb.query('SELECT * FROM snaglog_expanded WHERE song_id = $1 AND user_id = $2', [
		data.room.metadata.current_song._id,
		data.room.metadata.current_song.djid
	], function (err,result) {
		if (error_caught(err)) { return; }

	    if (result.rows.length != 1) {
			// logger('No record of this song having been snagged');
		} else {
			util.log(util.inspect(result.rows[0].age_text));
			var saybuf = result.rows[0].nickname+' snagged this song from '+result.rows[0].dj_nickname+' '+result.rows[0].age_text+'!';
			// logger(saybuf);
			lag_say(saybuf);
		}
	});
}

function db_seen(nick) {
	if (!settings.db || config['database'] != 'on') {
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

function is_leader(userid) {
	if (admins.indexOf(userid) != -1) {
		return 1
	}
	if (leaders.indexOf(userid) != -1) {
		return 1
	}
	return 0
}

function toggle_config (item) {
	if (config[item] != 'off') {
		config[item] = 'off';
	} else {
		config[item] = 'on';
	}
}

function say_config (item,user_id) {
	bot.pm(item+' setting is now '+config[item],user_id);
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

function lag_vote (vote) {
	waitms = parseInt(Math.random() * 20000)+500;
	logger('- will vote '+vote+' in '+waitms+' ms');
	setTimeout(function(){ do_vote(vote); }, waitms);
}

function do_vote (vote) {
	bot.roomInfo(false, function(roominfo) {
		// util.log(util.inspect(roominfo));
		if(roominfo.room.metadata.current_dj == settings.userid) {
			logger('- ignoring self-vote');
		} else {
			bot.vote(vote);
		}
	});
}

function do_command (data) {
	var moo     = data.text.indexOf(' ');
	if (moo == -1) {
		var command = data.text.substr(1);
		var args	= '';
	} else {
		var command = data.text.substr(1,moo-1);
		var args    = data.text.substr(moo+1);
	}

	if (!is_admin(data.senderid)) {
		logger('= '+id_to_name(data.senderid)+' tried admin command '+command+'('+args+')');
		return
	}

	switch(command) {
		case 'jump':
            logger('= '+id_to_name(data.senderid)+' tried jump command '+command+'('+args+')');
			if (args == 'down') {
				bot.remDj(settings.userid);
			} else {
				bot.addDj();
			}
			break;
		case 'pm':
			moo			 = args.text.indexOf(' ');
			var receiver = args.text.substr(1,moo-1);
			var msg      = args.text.substr(moo+1);
			bot.pm(msg,receiver);
			break;
		case 'awesome':
			do_vote('up');
            logger('= '+id_to_name(data.senderid)+' made me vote awesome');
			break;
		case 'lame':
			do_vote('down');
            logger('= '+id_to_name(data.senderid)+' made me vote lame');
			break;
		case 'avatar':
			args = parseInt(args);
			bot.setAvatar(args);
			break;
		case 'say':
			say(args);
			break;
		case 'autobop':
		case 'mute':
		case 'follow':
		case 'autoskip':
		case 'database':
			if (args == '') {
				toggle_config(command);
			} else {
				if (args != 'on') {
					config[command] = 'off';
				} else {
					config[command] = 'on';
				}
			}
			say_config(command,data.senderid);
			logger('= '+id_to_name(data.senderid)+' set '+command+' to '+config[command]);
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
		case 'debug':
			if (args != 'on') {
				logger('= '+id_to_name(data.senderid)+' set debug off');
				bot.debug = false;
			} else {
				logger('= '+id_to_name(data.senderid)+' set debug on');
				bot.debug = true;
			}
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
				bot.pm('I am here now!',userid);
			});
		} else {
			logger('* I am already in that room');
			bot.pm('I am already in that room, silly',userid);
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
	global['roomid'] = data.room.roomid;
	logger('! Room changed to '+data.room.name+' ('+data.room.roomid+')');
	logger_tsv([ 'event','newroom','roomname',data.room.name ]);

	// util.log(util.inspect(data));

	if (data.room.metadata.current_song == null) {
		logger('- Nothing is currently playing');
	} else {
		global['cursong'] = data.room.metadata.current_song._id;
		logger('! Now Playing '+data.room.metadata.current_song.metadata.song);
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
	db_registered(data);

	join_response(data);
});

bot.on('snagged', function (data) {
	logger_tsv([ 'event','snag','userid',data.userid,'songid',global['cursong'],'djid',	global['curdjid'],'songname',global['cursongname'],'djname',global['curdjname']	]);
	db_snag(data);

	if (data.userid == settings.userid) {
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

	global['cursong']      = data.room.metadata.current_song._id;
	global['cursongname']  = data.room.metadata.current_song.metadata.song;
	global['curdjid']      = data.room.metadata.current_song.djid;
	global['curdjname']     = data.room.metadata.current_song.djname;

	if (config['autobop'] == 'on') {
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

	if (user == '') {
		if (vote == 'down') {
			if (global['myvote'] != 'down') {
				// logger('- Voting '+vote+'!  Because I will dump on anyone');
				// global['myvote'] = vote;
				// lag_vote(vote);
			}
		}
	} else if (is_leader(user)) {
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

bot.on('add_dj', function (data) {
	logger('* New DJ '+data.user[0].name);
	logger_tsv([ 'event','newdj','userid',data.user[0].userid ]);

	return;

	if (data.user[0].userid == users['Bagel']) {
		say('Bagel Time!');
	} else if (data.user[0].userid == users['Storm(e)']) {
		say('No Dubstep!');
	} else if (is_admin(data.user[0].userid)) {
		say('I love '+data.user[0].name+'! (no homo)');
	}
});

bot.on('pmmed', function (data) {
	if (data.text.match(/^\//)) {
		do_command(data);
	} else {
		bot.pm(id_to_name(data.senderid)+' PMmed '+data.text,config['owner']);
		logger(id_to_name(data.senderid)+' PMmed '+data.text);
	}
});

bot.on('speak', function (data) {
	logger('<'+data.name+'> '+data.text);
});
