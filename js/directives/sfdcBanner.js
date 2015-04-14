/*
 * Displays an individial folio with cover, folioNumber, state and progressbar.
 */
app.directive("sfdcBanner", function($rootScope, $http, SFDCModel) {
	return {
		template: "<div ng-show='!isUserAuthenticated' >" +
					  	"<div id='connect-button' class='sfdc-button header-button'>CONNECT</div>" + 
						"<a href='salesforce1://foobar'><img id='sfdc1-button' src='images/SFbutton.png' height='40' /></a>" +
				  "</div>" +
				  "<div ng-show='isUserAuthenticated' class='authenticated' id='authenticated' >" +
				  	  	"<div id='sfdcLogout' class='sfdc-button header-button'>LOGOUT</div>" +
						"<a href='salesforce1://foobar'><img id='sfdc1-button' src='images/SFbutton.png' height='40' /></a>" +
				  	  	"<img src='images/salesforce_logged_in_icon.png' width='21' height='21'/>" +
			  			"<div class='sfdcUser'>{{model.firstName}} {{model.lastName}}</div>" +
			  			"<div class='sfdcInstance'>{{url}}</div>" +
				  		"<div id='account-fields-container'>" +
				  			"<div class='account-field-container'><div class='account-field'>Account: {{model.account}}</div></div>" +
				  			"<div class='account-field-container'><div class='account-field'>Opportunity: {{model.opportunity}}</div></div>" +
				  			"<div class='account-field-container'><div class='account-field'>Lead: {{model.contact}}</div></div>" +
				  		"</div>" +
				  		"<div class='sfdc-row'>" +
				  			"<div class='recordingsLabel'>Active/Pending Recordings:&nbsp;</div><div id='recordings'>0</div>" +
				  			"<div id='recording-status-container'>" +
				  				"<div id='sfdcFeedback'>00:00:00</div>" +
				  				"<div id='record-button' class='button'>STOP RECORDING</div>" +
				  			"</div>" +
				  		"</div>" +
				  "</div>",

		link: function(scope, $el, attrs) {
			if (!ADOBE.Config.IS_SFDC_ENABLED)
				return;

			var capturedEventCount = 0;
			var uploadedEventCount = 0;

			var plugin_namespace = "";

			var latitude = 0;
			var longitude = 0;

			var RECORDING_TIMEOUT = 2;  // hours

			var recordingTimer = null;

			var model = new SFDCModel();
			model.parse();

			if ($rootScope.isAPIAvailable)
				adobeDPS.configurationService.applicationContextUpdatedSignal.add(updateContext, this);
			
			if ($rootScope.isAPIAvailable)
				adobeDPS.folioActivityService.stateChangedSignal.add(onRecordingStateChanged, this);

			// Add button actions
			angular.element(document.getElementById("connect-button")).on("click", function() { oasAuthorize(); } );
			angular.element(document.getElementById("sfdcLogout")).on("click",function() { oasRevoke(); } );

			var $recordButton = angular.element(document.getElementById("record-button"));
			var $sfdcFeedback = angular.element(document.getElementById("sfdcFeedback"));

			// Disable $recordButton until the plugin data is returned. 
			var isPluginCheckPending = true;
			$recordButton.css("opacity", .4);

			initOAuth();

			updateView();

			function updateView() {
				//console.log('sfdcbanner::render=>'+JSON.stringify(model.toJSON() ) );
				var json = model.toJSON();

				scope.isUserAuthenticated = json.isLoggedIn;

				if (!$rootScope.isAPIAvailable)
					return;

				scope.model = json;
				
				if (json.recording) {
					$recordButton.html("Stop Recording");
					
					// Start a timer
					if (!recordingTimer) recordingTimer = setInterval(
								
						function() { 
							if (model.getRecording()) {
								var deltaT = Date.now() - model.getStartTime();
								
								var sec_num = Math.floor(deltaT / 1000.0);
								var minutes = Math.floor((sec_num % 3600) / 60); 
								var seconds = Math.floor(sec_num % 60);
								var hours   = Math.floor(sec_num / 3600);
								
								if (hours   < 10) {hours   = "0"+hours;}
								if (minutes < 10) {minutes = "0"+minutes;}
								if (seconds < 10) {seconds = "0"+seconds;}
								var time	= hours+':'+minutes+':'+seconds;
								
								$sfdcFeedback.html(time);
								
								if (deltaT>(RECORDING_TIMEOUT*3600000) ) {
									alert("Event Recording has been halted.<br />The availble time has been exceeded.");
									turnOffRecording();
								} else if ( (sec_num % 60)==0) {   // every minute only
									// check geoloc
									if (latitude!=0 && longitude!=0) {
										
										adobeDPS.geolocation.getCurrentPosition( 
											function(pos) {
												console.log('checking flat earth range: '+pos.coords.latitude+"/"+pos.coords.longitude);
												var dLat = 60*(pos.coords.latitude-latitude);
												var dLon = 60*(pos.coords.longitude-longitude)*Math.cos(latitude);
												var flatEarthRange = Math.sqrt(dLat*dLat+dLon*dLon);
												console.log("flat earth range = "+flatEarthRange*1852+" meters");
												if (flatEarthRange > 0.5) {
													 alert("Recording has been halted<br/>The device seems to have been moved from its initial recording location.");
													 turnOffRecording();
												}
											}, 
											function() {}, 
											{enableHighAccuracy:false,maximumAge:30000,timeout:30000} );
										
									}
								}
							} else  {
								$sfdcFeedback.html("");
							}
						}, 1000);
				} else {
					$sfdcFeedback.html("00:00:00");
					$recordButton.html("Start Recording");
					if (recordingTimer) clearInterval(recordingTimer);
					recordingTimer=null;
				}
				
				var r = (adobeDPS.folioActivityService.recordings!=null && adobeDPS.folioActivityService.recordings.length>0) ? adobeDPS.folioActivityService.recordings.length : "0";
				angular.element(document.getElementById("recordings")).html(r);
				
				$recordButton.off("click");
				if ( (json.account || json.contact) && json.isLoggedIn) {
					$recordButton.on("click", function() {
						if (!isPluginCheckPending)
							toggleRecording();
					} );
				}

				setTimeout(function() { scope.$apply() }, 10);
			}

			function onRecordingStateChanged() {
				try {
					var r = adobeDPS.folioActivityService.recordings[0];
					if (r)
						console.log("onRecordingStateChanged::"+r.recordingId+":"+r.stateCode+" ("+r.eventsCount+" records"+")" );
					else
						console.log("onRecordingStateChanged");
					
				} catch (ee) {
					console.log('recordingstatechange exception '+ee);
				}
			}

			function updateContext() {
				console.log("context updated");
				// New context
				
				if (!$rootScope.isAPIAvailable)
					return;
				
				if (adobeDPS.configurationService.applicationContext && adobeDPS.configurationService.applicationContext.urlQueryString) {
					// Argh...why does decodeURI... leave the &quot;???
					var s = decodeURIComponent(adobeDPS.configurationService.applicationContext.urlQueryString['json']).replace(/&quot;/g, "\"");
					
					console.log('json = '+ s);
					try {
						var json = JSON.parse(s);
						if (json) {
							var account	 = json['AccountName'];
							var opportunity = json['OpportunityName'];
							var contact	 = json['LeadName'];
							var parentId	= json['ParentId'];
							var postUrl	 = json['relUrl'];
							var action	  = json['action'];
							
							var existing = model.getParentId();
							
							console.log('new parent = '+parentId+", existing = "+model.parentid );
							
							if (parentId && existing && (existing!=parentId)) {
								// Changing accounts...disable tracking.
								console.log('turning off tracking');
								alert("The Account, Opportunity or Lead changed...Recording has been halted");
								turnOffRecording();
							}
							if (!account) account=null;
							if (!opportunity) opportunity=null;
							if (!contact) contact=null;
							
							model.set({account:account,opportunity:opportunity,contact:contact,parentId:parentId,postUrl:postUrl});
							model.save();
							updateView();
						}
					} catch (e) {
						console.log('error parsing json: '+JSON.stringify(e) );
					}
				}
			}

			// Called once the Adobe API AND OAuth data are both initialed and ready
			function initOAuth() {
				if ($rootScope.isAPIAvailable) { 
				// Start the renewal of the OAuth
				try {
					//console.log('initAuthData = '+JSON.stringify(this.oauth) );

					var oauth = {
						authURL: ADOBE.Config.SFDC_AUTH_URL,
						clientId: ADOBE.Config.SFDC_CLIENT_ID,
						redirectURI: ADOBE.Config.SFDC_REDIRECT_URI
					};
					
					adobeDPS.oauthRedirectService.initAuthData(
						oauth, 
						function() {
							if (adobeDPS.oauthRedirectService.oauthData) {
								renewOAuth();
							} else {
								model.setLoginState(false);
								updateView();
							}
						}, 
						function(error) {
							console.log('oauth init failed - '+JSON.stringify(error));
							alert("Could not initialize the OAuth channel to Salesforce");
							turnOffRecording();
						} 
					);
				} catch(error) {
					console.log('exception - error: ', error);
				}
				}
				
				updateContext();   // Have to do this for the case of a cold start.
				
				if ($rootScope.isAPIAvailable) adobeDPS.configurationService.applicationContextUpdatedSignal.add( function() { updateContext();  }, this );  // And this is for the case of a update while the app is running
			}

			function sfdc_getUserInfo(id) {
				console.log("sfdc_getUserInfo - "+id );
				
				if (!$rootScope.isAPIAvailable) return;
				
				var oauthData = adobeDPS.oauthRedirectService.oauthData;
				if (oauthData === undefined || oauthData === null) {
					// Not initialized…
					console.log("getUserInfor - failed.  Auth session not initialized!" );
					return;
				}

				console.log(oauthData);

				var reqObj = {
					method: "POST",
					url: id,
					headers: {
						"Authorization": "Bearer " + oauthData['access_token'],
						"Content-Type": "application/x-www-form-urlencoded"
					}
				};

				$http(reqObj).
					success(function(json, status, xhr) {
						console.log("user info = "+json );
						model.setIdentity( json.first_name, json.last_name, json.email );
						model.setUrl('instanceUrl', oauthData.instance_url );
						updateView();
						
						sfdc_checkForPlugin();
					}).
					error(function (data, status, error) {
						console.log("error - could not receive current user info...must be offline");
						model.setLoginState(false);
						updateView();
						alert("Unable to retrieve User Record. Verify permissions and try again");
						turnOffRecording();
					})
			}

			function sfdc_checkForPlugin() {
				console.log("sfdc_checkForPlugin" );
				
				if (!$rootScope.isAPIAvailable) return;
				
				var oauthData = adobeDPS.oauthRedirectService.oauthData;
				if (oauthData === undefined || oauthData === null) {
					// Not initialized…
					console.log("sfdc_checkForPlugin - failed.  Auth session not initialized!" );
					return;
				}

				var reqObj = {
					method: "GET",
					url: oauthData.instance_url+"/services/data/v31.0/query?q=select NamespacePrefix from ApexClass where Name = 'postFolioEvent'",
					headers: {
						"Authorization": "Bearer " + oauthData['access_token']
					}
				};

				$http(reqObj).
					success(function (json, status, xhr) {
						console.log("ADPS Plugin Detected: json="+JSON.stringify(json) );
						if (json.totalSize>0) {
							var ns = json.records[0].NamespacePrefix;
							console.log("Plugin Detected: namespace="+ns);
							if (ns!=null && ns!=undefined)
								plugin_namespace=ns+"/";
							else
								plugin_namespace="";

							isPluginCheckPending = false;
							$recordButton.css("opacity", 1);
						}
					}).
					error(function (data, status, error) {
						console.log("The ADPS Plugin was not detected");
						alert("Your Salesforce instance is not configured for FolioEvent tracking OR you do not have permissions to read the FolioEvent objects.");
						turnOffRecording();
					})
			}

			// begin the sign in process
			function oasAuthorize() {
				model.setLoginState(false);
				updateView();
				
				if (!$rootScope.isAPIAvailable) return;
				
				function successCB() {
					var loginUrl = ADOBE.Config.SFDC_AUTH_URL + "/services/oauth2/authorize";
					loginUrl += "?display=touch&response_type=token&state=validation";
					loginUrl += "&client_id=" +encodeURIComponent(ADOBE.Config.SFDC_CLIENT_ID);
					loginUrl += "&redirect_uri=" +ADOBE.Config.SFDC_REDIRECT_URI;
					adobeDPS.dialogService.open(loginUrl);
				}
				function authCB(response) {
					adobeDPS.dialogService.close();
					if (response.hasOwnProperty("timeout")) {
						console.log("the authentication request timed out");
					} else if (response.hasOwnProperty("error")) {
						console.log("Authentication Failed: "+ response['error']);
						alert("Authentication Failed: "+ response['error'] );
						turnOffRecording();
					} else {
						// the authentication server returned success
						console.log("authentication successful");
						model.setLoginState(true);
						updateView();
						
						if (adobeDPS.oauthRedirectService.oauthData) {
							console.log("id = "+adobeDPS.oauthRedirectService.oauthData['id']);
							console.log("oauthdata = "+JSON.stringify(adobeDPS.oauthRedirectService.oauthData) );
							// Get information about the authenticated user
							var sfdc_user_id = adobeDPS.oauthRedirectService.oauthData['id'];
							sfdc_getUserInfo( sfdc_user_id);
						}
						
					}
				}
				function authError(error) {
					console.log("authorize failed: ", error);
				}
				
				try {
					adobeDPS.oauthRedirectService.startListening(authCB, successCB, authError);
				} catch (error) { console.log("failed to start listending"); }
			}

			// Renew
			function renewOAuth() {
				console.log("renew");
				
				if (!$rootScope.isAPIAvailable) return;
				
				var oauthData = adobeDPS.oauthRedirectService.oauthData;
				if (oauthData === undefined || oauthData === null) {
					// Not initialized…
					console.log("Auth session not initialized! Call initAuthData()" );
					model.setLoginState(false);
					updateView();
					console.log("oauthData = "+JSON.stringify(oauthData) );
				} else if (oauthData.refresh_token=== undefined || oauthData.refresh_token===null) {
		            // No refresh token provided...out of here without checking
		            alert("Your OAuth expired immediately and can not be refreshed.  Please login in again.");
		            turnOffRecording();
		            model.setLoginState(false);
		            updateView();
		            return;
		        }
				else {
					var refreshData = "grant_type=refresh_token";
					refreshData += "&client_id=" + ADOBE.Config.SFDC_CLIENT_ID;
					refreshData += "&refresh_token=" + encodeURIComponent(oauthData.refresh_token);

					var reqObj = {
						method: "POST",
						url: ADOBE.Config.SFDC_AUTH_URL + '/services/oauth2/token',
						headers: {
							"Authorization": "Bearer " + oauthData.refresh_token,
							"Content-Type": "application/x-www-form-urlencoded"
						},
						data: refreshData
					};

					$http(reqObj).
						success(function (data, status, xhr) {
							// Reset oauthData in native storage.
							console.log('renew token complete...updating authdata');
							try {
								adobeDPS.oauthRedirectService.updateAuthData(
									data, 
									function() { 
										console.log("success: token refreshed"); 
										console.log("renew::id = "+adobeDPS.oauthRedirectService.oauthData['id']);
										console.log("renew::oauthdata = "+JSON.stringify(adobeDPS.oauthRedirectService.oauthData) );
										// Get information about the authenticated user
										model.setLoginState(true);
										updateView();
										
										var sfdc_user_id = adobeDPS.oauthRedirectService.oauthData['id'];
										sfdc_getUserInfo( sfdc_user_id);
									},
									function() {
										console.log("failed to refresh token");
										model.setLoginState(false);
										updateView();
									} 
								);
							} catch (error) {
								console.log(error);
								model.setLoginState(false);
								updateView();
							}
						}).
						error(function (data, status, error) {
							console.log("A server error occured");
							console.log("status = "+status+" code=", data );
							alert("You appear to be offline...any recording will be queued.");
							turnOffRecording();
						});
				}
			}

			function oasRevoke() {
				if (!$rootScope.isAPIAvailable) return;
				
				var oauthData = adobeDPS.oauthRedirectService.oauthData;
				if (oauthData === undefined || oauthData === null) {
					console.log("Auth session not initialized! Please call initAuthData() to get the latest refresh_token.");
					return;
				}

				var revokeUrl = oauthData.instance_url + '/services/oauth2/revoke';
				var revokeData = "token=" + encodeURIComponent(oauthData.refresh_token ? oauthData.refresh_token : oauthData.access_token);

				var reqObj = {
					method: "POST",
					url: revokeUrl,
					headers: {
						"Content-Type": "application/x-www-form-urlencoded"
					},
					data: revokeData
				};

				$http(reqObj).
					success(function (data, status, xhr) {
						// Reset refresh_token and access_token in native storage.
						console.log('sfdc revoke success');
						try {
							adobeDPS.oauthRedirectService.resetAuthData(
								function() {
									console.log("successfully revoked token (logout)");
									model.setLoginState(false);
									updateView();
									//alert("You have been logged out");
									turnOffRecording();
								}, 
								function(xhr,status,error) {
									console.log("sfdc revoke error");
								}
							);
						} catch (error) {
							alert("There was an error revoking your token: "+error);
							turnOffRecording();
						}
					}).
					error(function(data, status, error) {
						console.log("could not revoke - offline");
						alert("There was an error revoking your token: "+ status);
						turnOffRecording();
					});
			}

			/* Folio Activity Events+Attributes
			Events:
			Issue Download Started,Issue Download Completed,Issue Download Terminal Error,Issue Download Cancelled,Content View,Content Browse,AD View,Edit view,Overlay Started,Overlay Stopped,URL clicks,Social Content Share,End of article reached,Custom Event 1,Custom Event 2,Custom Event 3,Custom Event 4,Custom Event 5,Custom Event 6,Custom Event 7,Custom Event 8,Custom Event 9,Custom Event 10

			Event Attributes:
			urlDestination,downloadState,viewerType,sharingMode,findMethod,deviceOrientation,eventName,appVersion,customVariable1,customVariable2,appStore,issueName,publicationId,adStackTitle,issueId,customVariable3,stackId,customVariable4,pushToken,customVariable6,contentType,customVariable7,articleStackTitle,screenId,customVariable5,customVariable8,contentTitle,viewerVersion,customVariable9,entitlementCategory,url,overlayId,downloadError,customVariable10,overlayType,networkStatus 
			*/

			function sfUploadFolioEvent(opportunityId, folioEvent, onSuccess) {
				var sentoffObject = {};
				// var eventTime = new Date(folioEvent.eventTime*1000);
				// folioEvent.eventTime = eventTime.toJSON();
				
				for (var attr in folioEvent) {
					if (folioEvent.hasOwnProperty(attr)) {
						switch(attr) {
							case "eventTime":
							case "eventName":
							case "issueName":
							case "issueId":
							case "stackId":
								sentoffObject[attr] = folioEvent[attr];
								break;
							case "articleStackTitle":
								if ((typeof folioEvent['screenId']!='undefined') && folioEvent['screenId']>0) {
									sentoffObject[attr] = folioEvent[attr] + "-"+ folioEvent['screenId'];
								} else {
									sentoffObject[attr] = folioEvent[attr];
								}
								break;
									
							case "screenId":
							case "overlayId":
							case "urlDestination":
							case "downloadState":
							case "viewerType":
							case "sharingMode":
							case "findMethod":
							case "deviceOrientation":
							case "appVersion":
							case "customVariable1":
							case "customVariable2":
							case "appStore":
							case "publicationId":
							case "adStackTitle":
							case "customVariable3":
							case "customVariable4":
							case "pushToken":
							case "customVariable6":
							case "contentType":
							case "customVariable7":
							case "customVariable5":
							case "customVariable8":
							case "contentTitle":
							case "viewerVersion":
							case "customVariable9":
							case "entitlementCategory":
							case "url":
							case "downloadError":
							case "customVariable10":
							case "overlayType":
							case "networkStatus":
							default:
							// do nothing

						}
					}
				}																
				//sentoffObject.ADPS__opportunityId__c = opportunityId;
				sentoffObject.parentId = model.getParentId();
				
				var str = JSON.stringify(sentoffObject);		
																
				var oauthData = adobeDPS.oauthRedirectService.oauthData;  
				if (oauthData && oauthData.access_token) {
					
					var url = oauthData.instance_url;
					url += '/services/apexrest/'+plugin_namespace+'postFolioEvent'; 

					var reqObj = {
						method: "POST",
						url: url,
						headers: {
							"Content-Type": "application/json",
							"Authorization": "Bearer " + oauthData.access_token
						},
						data: str
					};

					$http(reqObj).
						success(function(data, status, xhr) {
							console.log("onSuccess");
							if( onSuccess != null ) {
								console.log("calling the onSuccess function");
								onSuccess();
							}
						}).
						error(function(data, status, error) {
							console.log("A server error occured, status:"+status+", error:"+error );
							alert("Could not post FolioEvents to Salesforce.");
							turnOffRecording();
						});
				} else {
					console.log("Please login to SalesForce or call adobeDPS.oauthRedirectService.initAuthData(authHost)");
				}
			}

			function sfUploadAllFolioEvents(folioEvents, onComplete) {
				console.log('sfUploadAllFolioEvents - BEGIN');
				for( var index = 0; index<folioEvents.events.length; index++ )
				{
					console.log('index = '+index);
					if (index==(folioEvents.events.length-1)) {
						// Final final
						 sfUploadFolioEvent(folioEvents.recordingId, folioEvents.events[index], onComplete );
					}
					else {
						sfUploadFolioEvent(folioEvents.recordingId, folioEvents.events[index], null );
					}
					console.log("id: " + folioEvents.recordingId + "Event: " + folioEvents.events[index].eventTime+ " : " +folioEvents.events[index].eventName);
				}
				console.log('sfUploadAllFolioEvents - COMPLETE');
				if (folioEvents.events.length==0 && onComplete) onComplete();
			}

			function toggleRecording( ) {
			   if (model.getRecording()) {
				   turnOffRecording();
			   } else {
				   turnOnRecording();
			   }
			}

			function turnOnRecording() {
				console.log('turnOnRecording');
				
				try {
					adobeDPS.folioActivityService.startRecording( 
						model.getParentId(), 
						{enableRecordingStatusUI: true, eventsFilter:[]}, 
					   function() {
						   console.log('recording started'); 
						   model.setRecording(true); 
						   updateView();
						   adobeDPS.geolocation.getCurrentPosition( function(position) {console.log('onGetPos'); latitude=position.coords.latitude; longitude=position.coords.longitude; console.log("lat/lon = "+latitude+"/"+longitude);}, function() {console.log('there was an error getting the position'); }, {enableHighAccuracy:false,maximumAge:300000,timeout:60000});
					   }, 
					   function(e) {console.log('could not start recording:'+JSON.stringify(e) ); }
					);
				}
				catch(error) {
					console.log('exception - '+JSON.stringify(error) );
				}
			}

			function turnOffRecording(){
				console.log('turnOffRecording - '+adobeDPS.folioActivityService.currentRecordingId);
				if (recordingTimer) {
					clearInterval(recordingTimer);
				}
				recordingTimer=0;
				
				model.setRecording(false);
				updateView();
				
				adobeDPS.folioActivityService.stopRecording( 
					function() {
						onRecordingStopped.call();
						latitude=0;
						longitude=0;
					},
					
					//onRecordingStopped, 
					function() { 
						console.log('recording stopped, but nothing was recorded');
					}
				);
			}

			function onRecordingStopped() {
				console.log('recording stopped: Pending: '+adobeDPS.folioActivityService.recordings.length); // +adobeDPS.folioActivityService.currentRecordingId);
				var length=adobeDPS.folioActivityService.recordings.length;
				
				console.log('length = '+length);
				if (length==0) {
					updateView();
					return;
				}
				for (var i=0;i<length; i++) {
					var recordingId=adobeDPS.folioActivityService.recordings[i].recordingId;
					console.log('onRecordingStopped::getEvents: '+ recordingId);
					adobeDPS.folioActivityService.getEvents( 
						recordingId, 
						function(events) {
							onGetEvents(events);
						},
						function(error) {
							onGetEventsError(error);
						}
					);
				   
				}
			}

			function onGetEventsError(error ) {
				console.log('onGetEventsError');
			}

			function onGetEvents(events) {
				console.log('onGetEvents');
				if (events && events.events) {
					capturedEventCount = events.events.length;
					console.log(' - count='+events.events.length);
				}
				var recordingId = events.recordingId;
				sfUploadAllFolioEvents(events, 
					function() { 
						onUploadComplete(recordingId) 
					} 
				);
			}

			function onUploadComplete(recordingId) {
				//console.log("onUploadComplete()");
				uploadedEventCount = capturedEventCount;
				capturedEventCount = 0;
				//console.log('onUploadComplete - Deleting event ID '+recordingId);
				
				adobeDPS.folioActivityService.deleteEvents(
					recordingId,
					function() {
						console.log("resetOnSuccess");
						serviceResetSuccess();
					},
					function() {
						console.log("resetFail");
						serviceResetFail();
					}
				);
				
				alert("FolioEvent upload to Salesforce is complete: "+uploadedEventCount+" Records");
				turnOffRecording();
			}

			function resetRecordingActivity() {
				console.log('resetRecordingActivity');
				adobeDPS.folioActivityService.resetService(
					function() {
						serviceResetSuccess();
					},
					function() {
						serviceResetFail();
					}
				);
			}

			function serviceResetSuccess(){
				console.log("service reset successfully all records deleted");
				updateView();
			}

			function serviceResetFail(recordingId, e) {
				console.log("service reset fail");
			}
		}
	};
});