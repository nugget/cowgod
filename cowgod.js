exports.logger = function (buf) {
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
