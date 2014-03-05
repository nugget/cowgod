#!/usr/bin/env node

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

db_loadsettings(function() {
	if ('log_tsv' in config) {
		config['log_filehandle']  = fs.createWriteStream(config['log_tsv'],  {'flags': 'a'});
		cowgod.logger('Opened '+config['log_tsv']+' for logging');
	} else {
		cowgod.logger('Logging is disabled');
	}
});

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

function after(callback) {
	return function(err, queryResult) {
		if(err) {
			cowgod.logger('database '+err+' (code '+err.code+' at pos '+err.position+')');
			return;
		}
		callback(queryResult);
	}
}

var PlugAPI  = require('plugapi');

PlugAPI.getUpdateCode(settings.plug_auth, settings.plug_room, function(error, updateCode) {
	if(error === false) {
		cowgod.logger('updateCode found: '+updateCode);
		botdb.query('UPDATE settings SET value = $2 WHERE key = $1', [ 'update_code', updateCode ], after(function(result) {
		}));
	} else {
		cowgod.logger('updateCode not found: '+error);
		process.exit(1);
	}
})
