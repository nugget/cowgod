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

var myname = 'cowgod';
var settings = require('./settings_'+myname+'.js');
settings.db = false;


var PlugAPI  = require('plugapi');

cowgod.logger('getUpdateCode('+settings.plug_auth+','+settings.plug_room+')');
PlugAPI.getUpdateCode(settings.plug_auth, settings.plug_room, function(error, updateCode) {
	console.log('error is '+error);
	if(error === false) {

		console.log('update code is :'+updateCode);

		var bot = new PlugAPI(settings.plug_auth, updateCode);
		bot.connect(settings.plug_room);

		bot.on('roomJoin', function(data) {
			console.log('Joined room: '+data);
		});

		bot.on('djAdvance', function(data) {
			console.log('djAdvance');
		});

		bot.on('chat', function(data) {
			console.log('djAdvance');
		});

	} else {
		console.log(error);
	}
});
