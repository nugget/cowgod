// phantomjs --ssl-protocol=TLSv1 experimenting.js
var page = require('webpage').create();
var url  = 'https://cdn.plug.dj/_/static/css/index.aaf38b00b055517ee34b68ef13f6b57b6581b3f3.css';

page.onLoadStarted = function () {
	    console.log('Start loading...');
};

page.onResourceError = function(resourceError) {
    page.reason = resourceError.errorString;
    page.reason_url = resourceError.url;
	console.log('err0: '+resourceError.url);
	console.log('err1: '+resourceError.errorString);
};

page.onLoadFinished = function (status) {
	    console.log('Loading finished ('+status+')');
		console.log(page.content);
		phantom.exit();
};

page.open(url);
