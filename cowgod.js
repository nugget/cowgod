var cowgod = new Object();

var usernames = new Object();
var bot;
var util;

cowgod.logger = function (buf) {
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
};

cowgod.remember_user = function (id,name) {
	if (typeof name === 'undefined' || typeof id === 'undefined') {
		return;
	}
	if (typeof usernames[id] === 'undefined') {
		usernames[id] = name;
		cowgod.logger('- remembering that '+name+' is user_id '+id+' ('+Object.keys(usernames).length+' names in lookup table)');
	}
}

cowgod.id_to_name = function (user_id) {
    for (var k in usernames) {
        if (k == user_id) {
            return usernames[k];
        }
    }
	return 'uid '+user_id;
}

cowgod.name_to_id = function (username) {
	for (var k in usernames) {
		if (usernames[k] == username) {
			return k;
		}
	}
	return;
}

cowgod.set_active_bot = function (botobj) {
	bot = botobj;
	cowgod.logger('Setting active bot');
	return;
}

module.exports = cowgod;
