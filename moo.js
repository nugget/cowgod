#!/usr/bin/env node

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

var emotes = require('./emotes.json');
var config = new Object();
var global = new Object();
var localv = new Object();

var admins = new Array();
var trendsetters = new Array();
var bots = new Array();
var outcasts = new Array();

n = new Date();
cowgod.logger(n.toLocaleDateString());
