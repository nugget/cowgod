var fs = require('fs');

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
	if (user_id == USERID) {
		return 'The Bot';
	}
	for (var k in users) {
		if (users.hasOwnProperty(k)) {
			if (users[k] == user_id) {
				return k;
			}
		}
	}
	return user_id;
}

function lag_vote (vote) {
	waitms = parseInt(Math.random() * 20000)+500;
	logger('- will vote '+vote+' in '+waitms+' ms');
	setTimeout(function(){ bot.vote(vote); }, waitms);
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
            logger('= '+id_to_name(data.senderid)+' tried j command '+command+'('+args+')');
			if (args == 'down') {
				bot.remDj(USERID);
			} else {
				bot.addDj();
			}
			break;
		case 'awesome':
			bot.vote('up');
            logger('= '+id_to_name(data.senderid)+' made me vote awesome');
			break;

		case 'lame':
			bot.vote('down');
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

console.log('connecting as '+settings.userid);
var bot = new Bot(settings.token, settings.userid, settings.roomid);
bot.debug = true;
bot.modifyLaptop(config['laptop']);

bot.on('registered', function (data) {
	logger('* '+data.user[0].name+' joined the room on a '+data.user[0].laptop+' ('+data.user[0].points+' points) uid '+data.user[0].userid);
});

bot.on('snagged', function (data) {
	logger('* '+id_to_name(data.userid)+' snagged this song');
	if (global['cursong'] != 'none') {
		if (global['myvote'] != 'down' ) {
			bot.playlistAdd(global['cursong']);
		}
	}
});

bot.on('deregistered', function (data) {
	logger('* '+data.user[0].name+' left the room');
	return

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
		return
	}

	user = data.room.metadata.votelog[0][0];
	vote = data.room.metadata.votelog[0][1];

	logger('* '+id_to_name(user)+' voted '+vote);

	if (user == '') {
		if (vote == 'down') {
			logger('- Voting '+vote+'!  Because I will dump on anyone');
			global['myvote'] = vote;
			lag_vote(vote);
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
	return

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
