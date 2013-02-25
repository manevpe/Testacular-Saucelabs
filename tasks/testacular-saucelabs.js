/*
 * grunt-saucelabs
 * https://github.com/username/grunt-saucelabs
 *
 * Copyright (c) 2012 Petar Manev
 * Licensed under the MIT license.
 */

module.exports = function(grunt) {
  var saucelabsTunnel;
  grunt.registerMultiTask('testacular_saucelabs_tunnel', 'start saucelabs tunnel', function() {
    var self = this;
    if (self.data.tunnel) {
		var done = self.async();
        //Start the tunnel
        console.log('Starting the SauceLabs Tunnel');
		var spawn = require('child_process').spawn;
	    saucelabsTunnel = spawn('java', ['-jar', './testacular-saucelabs/Sauce-Connect/Sauce-Connect.jar', self.data.tunnel.username, self.data.tunnel.key]);

		//Wait for it to load
		saucelabsTunnel.stdout.on('data', function (data){
			//console.log('stdout: ' + data);
			if (('' + data).indexOf('Connected! You may start your tests.') > -1){
                console.log('SauceLabs Tunnel Started');
				done(true);
			}
		});
		
		/*saucelabsTunnel.stderr.on('data', function (data){
			console.log(data);
			done(false);
		});*/
		
    } else {
		grunt.log.ok("No SauceLabs tunnel will be used...");
	}
  });

  grunt.registerMultiTask('testacular_saucelabs_run', 'start browser instances with saucelabs, point them at a local port via localtunnel, wait for the tests to finish and terminate the browsers', function() {
    var self = this;
    if (self.data.authentication && self.data.browsers) {
		var done = self.async();
		
		var webdriver = require('wd');
		var desiredBrowsers = self.data.browsers;
		var maxWait = self.data.maxWait || 60;
		var maxWaitBrowserInit = self.data.maxWaitBrowserInit || 100;

		var initBrowsers = 0;
		var finishedBrowsers = 0;
		var terminatedBrowsers = 0;

		for (var i = 0; i < desiredBrowsers.length; i++){
			(function(i) {
				var browser = webdriver.remote(self.data.authentication.hostname, self.data.authentication.port, self.data.authentication.username, self.data.authentication.personalKey);

				browser.on('status', function(info){
					console.log('\x1b[36m%s\x1b[0m', info);
				});

				browser.on('command', function(meth, path){
					//grunt.log.ok(' > \x1b[33m%s\x1b[0m: %s', meth, path);
				});

				grunt.log.ok('Starting browser: ' + desiredBrowsers[i].browserName + ' ' + desiredBrowsers[i].version + ' on ' + desiredBrowsers[i].platform);
				browser.init(desiredBrowsers[i], function() {
					initBrowsers += 1;
					var retryInit = 0;
					var intervalInitBrowser = setInterval(function(){
						if (initBrowsers === desiredBrowsers.length){
							clearInterval(intervalInitBrowser);
							browser.get("http://localhost:9000/", function(){
								var retry = 0;
								var interval = setInterval(function(){
									browser.elementsByClassName('idle', function(err, idleBrowsers){
										if (!err){
											if (idleBrowsers.length === desiredBrowsers.length){
												finishedBrowsers++;
												clearInterval(interval);
												var allFinishedRetry = 0;
												var allFinishedCheckInterval = setInterval(function(){
													if (finishedBrowsers === desiredBrowsers.length){
														clearInterval(allFinishedCheckInterval);
														setTimeout(function(){ //Dummy fix to wait for Testacular to get coverage details
                                                            browser.quit();
                                                        }, 5 * 1000);
														
														//Check whether all browsers have quited
														terminatedBrowsers++;
														var completeRetry = 0;
														var completeInterval = setInterval(function(){
															if (terminatedBrowsers === desiredBrowsers.length){
																clearInterval(completeInterval);
																done(true);
															}else{
																completeRetry++;
																if (completeRetry > maxWait){
																	clearInterval(completeInterval);
																	grunt.log.error('Error - browsers did not terminate in time!');
																	done(false);
																}
															}
														}, 1000);
													}else{
														allFinishedRetry++;
														if (allFinishedRetry > maxWait){
															clearInterval(allFinishedCheckInterval);
															grunt.log.error('Error - the execution did not finish in time!');
                                                            setTimeout(function(){ //Dummy fix to wait for Testacular to get coverage details
                                                                browser.quit();
                                                                done(false);
                                                            }, 5 * 1000);
														}
													}
												}, 1000);
											}else {
												retry++;
												if (retry > maxWait){
													clearInterval(interval);
													grunt.log.error('Error - the execution did not finish in time!');
                                                    setTimeout(function(){ //Dummy fix to wait for Testacular to get coverage details
                                                        browser.quit();
                                                        done(false);
                                                    }, 5 * 1000);
												}
											}
										}
									});
								}, 1000);
							});
						}else{
							retryInit++;
							if (retryInit > maxWaitBrowserInit){
								clearInterval(intervalInitBrowser);
								grunt.log.error('Error - the browsers did not initialize in time!');
								browser.quit();
								done(false);
							}
						}
					}, 1000);
				});
			})(i);
		}
    } else {
        grunt.log.error("Missing authentication or browsers details");
    }
  });

  grunt.registerMultiTask('testacular_saucelabs_clean', 'stop all running browsers and tunnels for the specified account', function() {
      var done = this.async();
      saucelabsTunnel.kill();
      saucelabsTunnel.on('exit', function (code){
          console.log('SauceLabs Tunnel Exit Code: ' + code);
          done(true);
      });
  });

};
