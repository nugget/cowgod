var fs = require('fs');
var util = require('util');

var Bot  = require('ttapi');
var settings = require('./settings.js');

var config = new Object();
config['autobop']	= 'off';
config['mute']		= 'off';
config['follow']	= 'on';
config['laptop']	= 'mac';
config['log_chat']	= 'log/chat.log';	// filename or set to 'none' to disable logging
config['log_tsv']	= 'none';			// filename or set to 'none' to disable logging

var global = new Object();
global['myvote']	= 'none';
global['cursong']	= 'none';

var users = new Object();
users['nugget']		= '4e00e4e8a3f75104e10b7359';
users['SnS']		= '4e1c8c8b4fe7d031420bdf59';
users['Bagel']		= '4e1c6fb1a3f75163090bc3ae';
users['Jello']		= '4e15df8a4fe7d0665e02a9ef';
users['Storm(e)']	= '4e3e10a94fe7d05787083cf1';
users['Olive']		= '4e0a03aaa3f7517d0f0e639d';
users['PitDemon']	= '4f50ed44590ca261fa004904';

config['owner']	= users['nugget'];

var admins = new Array();
admins.push(users['nugget']);
admins.push(users['SnS']);
admins.push(users['Bagel']);

var leaders = new Array();
leaders.push(users['Bagel']);
leaders.push(users['Jello']);

if (config['log_chat'] != 'none') {
	var log_chat = fs.createWriteStream(config['log_chat'], {'flags': 'a'});
}
if (config['log_tsv'] != 'none') {
	var log_tsv = fs.createWriteStream(config['log_tsv'], {'flags': 'a'});
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

function log_tsv(buf) {
	if (typeof log_tsv === 'undefined') {
	} else {
		var currTime = Math.round(new Date().getTime() / 1000.0);
		log_tsv.write('clock\t'+currTime+'\t');
		log_tsv.write(buf+'\n');
	}
}

function dump_queue() {
	bot.playlistAll(function(data) { 
		global['queuelen'] = data.list.length;

		var qf = fs.createWriteStream('log/queue.dat', {'flags': 'w'});
		var d=new Date();
		qf.write('['+d+']\n\n');

		var i = 0;

		data.list.forEach(function(song) {
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
		case 'awesome':
			do_vote('up');
            logger('= '+id_to_name(data.senderid)+' made me vote awesome');
			break;

		case 'lame':
			do_vote('down');
            logger('= '+id_to_name(data.senderid)+' made me vote lame');
			break;
		case 'autobop':
		case 'mute':
		case 'follow':
		case 'autoskip':
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
			bot.stopSong();
			break;
		case 'dumpqueue':
			dump_queue();
			break;
		case 'comehere':
            logger('= '+id_to_name(data.senderid)+' beckoned me');
			follow_user(data.senderid);
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

console.log('connecting as '+settings.userid);
var bot = new Bot(settings.token, settings.userid, settings.roomid);
bot.debug = settings.debug;

bot.on('roomChanged', function (data) { 
	global['roomid'] = data.room.roomid;
	logger('! Room changed to '+data.room.name+' ('+data.room.roomid+')');

	// util.log(util.inspect(data));

	if (data.room.metadata.current_song == null) {
		logger('- Nothing is currently playing');
	} else {
		global['cursong'] = data.room.metadata.current_song._id;
		logger('! Now Playing '+data.room.metadata.current_song.metadata.song);
	}

	bot.modifyLaptop(config['laptop']);
	// clear_entire_queue();
	dump_queue();
	bot.playlistAll(function(data) { 
		global['queuelen'] = data.list.length;
		logger('- I have '+global['queuelen']+' songs in my queue.');
	});
});

bot.on('registered', function (data) {
	logger('* '+data.user[0].name+' joined the room on a '+data.user[0].laptop+' ('+data.user[0].points+' points) uid '+data.user[0].userid);
});

bot.on('snagged', function (data) {
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
	return;

	if (is_admin(data.user[0].userid)) {
		lag_say('Oh no!');
	} else if (data.user[0].userid == users['Storm(e)']) {
		lag_say('I thought she would never leave!');
	}

});

bot.on('newsong', function (data) { 
	logger('* '+data.room.metadata.current_song.djname+' played '+data.room.metadata.current_song.metadata.song+' by '+data.room.metadata.current_song.metadata.artist);
	global['cursong'] = data.room.metadata.current_song._id;
	if (config['autobop'] == 'on') {
		global['myvote'] = 'up';
		lag_vote('up');
	} else {
		global['myvote'] = 'none';
		// logger('= Clearing my vote for the new song');
	}
});

bot.on('update_votes', function (data) {
	if (config['follow'] == 'off') {
		return;
	}

	user = data.room.metadata.votelog[0][0];
	vote = data.room.metadata.votelog[0][1];

	logger('* '+id_to_name(user)+' voted '+vote);

	if (user == '') {
		if (vote == 'down') {
			if (global['myvote'] != 'down') {
				logger('- Voting '+vote+'!  Because I will dump on anyone');
				global['myvote'] = vote;
				lag_vote(vote);
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
	} else if (is_admin(data.senderid)) {
		say(data.text);
	} else {
		bot.pm(id_to_name(data.senderid)+' PMmed '+data.text,config['owner']);
		logger(id_to_name(data.senderid)+' PMmed '+data.text);
	}
});

bot.on('speak', function (data) {
	logger('<'+data.name+'> '+data.text);
});
