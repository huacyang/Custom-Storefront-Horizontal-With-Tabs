app.controller("MainController", function($scope, $rootScope, $filter, folioService, networkService) {
	var SIGN_IN_LBL = "SIGN IN",
		SIGN_OUT_LBL = "SIGN OUT",
		show_register_button = true;

	function init() {
		if ($rootScope.isAPIAvailable) {
			if (adobeDPS.libraryService.currentTransaction) // Check if an updateLibrary() call is already occurring.
				adobeDPS.libraryService.currentTransaction.completedSignal.addOnce(function(){ $scope.updateLibraryHandler() }, $scope);
			else
				adobeDPS.libraryService.updateLibrary().completedSignal.addOnce(function(){ $scope.updateLibraryHandler() }, $scope);
		} else {
			$scope.updateLibraryHandler();
		}

		$scope.isEntitlementViewer = ADOBE.Config.IS_ENTITLEMENT_VIEWER;
		$scope.isSFDCEnabled = ADOBE.Config.IS_SFDC_ENABLED;

		if ($rootScope.isAPIAvailable) {
			// Listen to login status changes.
			adobeDPS.authenticationService.userAuthenticationChangedSignal.add($scope.userAuthenticationChangedHandler, $scope);

			$scope.setSignInLabel();
		} else {
			$scope.signInLabel = SIGN_IN_LBL;
		}

		$scope.isDisplayRegisterButton = show_register_button;
	}

	// Handler for when the library has been updated.
	$scope.updateLibraryHandler = function() {
		if ($rootScope.isAPIAvailable)
			adobeDPS.libraryService.updateLibrary().completedSignal.remove($scope.updateLibraryHandler, $scope);

		folioService.getFolios().then(
			function(folios) {
				// If the user is offline and there aren't any folios to display then show the error message.
				if ($rootScope.isAPIAvailable && !window.isOnline) {
					if (!folios || folios.length == 0) {
						checkIsUserOnline();
						
						function checkIsUserOnline() {
							var request = new XMLHttpRequest();
								request.open("GET", "http://stats.adobe.com/");

								request.onreadystatechange = function() {
									if (request.readyState == 4) {
										if (request.status == 0 || request.status == 404) {
											// Can't connect so check for network status changes.
											// Can't rely on adobeDPS.deviceService.isOnline since that only checks if a user is
											// on a network, which doesn't necessarily mean they are connected to the internet.
											adobeDPS.deviceService.updatedSignal.add(function(properties) {
												if (properties.indexOf("isOnline") != -1)
													checkIsUserOnline();
											});

											document.getElementById("loading-label").innerHTML = "Please connect to the internet to download content.";
										} else { // User is online so load the assets.
											adobeDPS.deviceService.updatedSignal.removeAll();
											document.getElementById("loading-label").innerHTML = "Loading...";
											
											adobeDPS.libraryService.updateLibrary().completedSignal.addOnce(function(){ $scope.updateLibraryHandler() }, $scope);
										}
									}
								};

								request.send();
						}
						
						return;
					}
				}

				if ($rootScope.isAPIAvailable) {
					var isSubscriptionsAvailable = false;
					// Make sure there are subscriptions for the "subscribe" button.
					for (var s in adobeDPS.receiptService.availableSubscriptions) {
						if (adobeDPS.receiptService.availableSubscriptions[s]) {
							isSubscriptionsAvailable = true;
							break;
						}
					}

					if (isSubscriptionsAvailable) {
						// Only show the subscribe button if the user is not entitled to the latest folio.
						var latestFolio = folios[0];
						if (latestFolio.state == adobeDPS.libraryService.folioStates.PURCHASABLE) {
							$scope.isDisplaySubscribeButton = true;

							// Listen for any changes in case the user becomes entitled.
							latestFolio.updatedSignal.add(function() {
								if (latestFolio.state >= adobeDPS.libraryService.folioStates.ENTITLED) {
									// Explicitly update the property since we are outside of angular.
									$scope.$apply(function () {
										$scope.isDisplaySubscribeButton = false;
									});
								}
							})
						}
					}
				} else {
					$scope.isDisplaySubscribeButton = true;
				}

				// These tabs should match the filter labels.
				var tabs = [];

				// For a predefined tab order, explicitly create the elements in tabs and remove the alphabetical sort below.
				// loop through the arrays to get the filter values
				angular.forEach(folios, function(folio) {
					if (folio.filter) {
						var filters = $filter("filter")(tabs, {label: folio.filter});
						if (filters.length == 0) { // New filter found.
							// Create a new tab object to store the label and associated folios.
							var tab = {};
							tab.label = folio.filter;
							// Store the folios for this filter in foliosDeferred so the folios are not populated until the tab is selected.
							// When the tab is selected, tab.folios is set to foliosDeferred.
							tab.foliosDeferred = [folio];

							tabs.push(tab);
						} else { 
							// Filter already exists so just add the folio to the folios property of the filter.
							filters[0].foliosDeferred.push(folio);
						}
					}
				});

				if (tabs.length > 0) {
					// Sort alphabetically.
					tabs.sort(function(a, b) {
						if (a.label > b.label)
							return 1;
						else if (a.label < b.label)
							return -1;
						else
							return 0;
					});

					if (ADOBE.Config.IS_DISPLAY_ALL_TAB)
						tabs.push({label: ADOBE.Config.ALL_TAB_LABEL, foliosDeferred: folios});

					$scope.tabs = tabs;

					$scope.isFoliosLoaded = true;
				} else {
					alert("Sorry, this template uses the folio filter values for the tabs. The account you are using does not have any folio filter values. Please add folio filter values and then you can use this template.");
				}
			}
		);
	}

	// Handler for when a user clicks the signin button.
	$scope.signIn_clickHandler = function() {
		if ($rootScope.isAPIAvailable) {
			if (adobeDPS.authenticationService.isUserAuthenticated)
				adobeDPS.authenticationService.logout();
			else
				adobeDPS.authenticationService.displaySignIn();
		}
	}

	$scope.registerButton_clickHandler = function() {
		adobeDPS.dialogService.open('http://www.google.com/');
	}

	$scope.subscribeButton_clickHandler = function() {
		if ($rootScope.isAPIAvailable) {
			adobeDPS.receiptService.displaySubscribe();
		}
	}

	$scope.setSignInLabel = function() {
		$scope.signInLabel = adobeDPS.authenticationService.isUserAuthenticated ? SIGN_OUT_LBL : SIGN_IN_LBL;
		// The label doesn't update so explictly call apply. Use a timeout otherwise there will be an error.
		setTimeout(function() { $scope.$apply()}, 10);
	}

	$scope.userAuthenticationChangedHandler = function() {
		$scope.setSignInLabel();

		// Need to explicitly call updateLibrary() on Android after a user logs in or out.
		if (navigator.userAgent.toLowerCase().indexOf("android") != -1)
			adobeDPS.libraryService.updateLibrary();
	}

	// Handler when an event is triggered to open a tab.
	$rootScope.$on("gotoTab", function(e, label) {
		// Get the index of the label.
		var index = $scope.tabs.map(function(el) {
			return el.label;
		}).indexOf(label);

		// label was found so set tab.folios.
		if (index != -1) {
			var tab = $filter("filter")($scope.tabs, {label: label})[0];
			tab.active = true;
			if (!tab.hasBeenViewed) {
				// Hack: Set a timeout to set the folios otherwise when
				//		 they initially render the width/height will be zero.
				setTimeout(function() {
					tab.hasBeenViewed = true; // This will trigger the folios to display.
				}, 10);
			}
		}

		// Trigger binding so the view updates.
		$scope.$apply();
	});

	$scope.tabSelectHandler = function(tab) {
		if (tab)
			tab.hasBeenViewed = true; // This will trigger the folios to display.
	}

	init();

	// Global function that outputs strings to a TextArea. The TextArea should be commented in from body.html.
	// Remote debugging should be enabled in 31.1.
	window.debug = function(value) {
		var textArea = document.getElementById("debug");
		var val = textArea.value;
		textArea.value = (val + (val == "" ? "" : "\n") + value);
	}
});
