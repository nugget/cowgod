var util = require('util');
var exec = require('child_process').exec;

child = exec("git log -1", function (error, stdout, stderr) {
	util.print('stdout: ' + stdout);
	util.print('stderr: ' + stderr);
	  if (error !== null) {
	      console.log('exec error: ' + error);
		    }
});
