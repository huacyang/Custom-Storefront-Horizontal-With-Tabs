// The main application file to start the application.
angular.element(document).ready(function() {
	// Options for the indeterminate spinner.
	var opts = {
		  lines: 13, // The number of lines to draw
		  length: 5, // The length of each line
		  width: 2, // The line thickness
		  radius: 6, // The radius of the inner circle
		  corners: 0, // Corner roundness (0..1)
		  rotate: 0, // The rotation offset
		  direction: 1, // 1: clockwise, -1: counterclockwise
		  color: '#000000', // #rgb or #rrggbb
		  speed: 1, // Rounds per second
		  trail: 60, // Afterglow percentage
		  shadow: false, // Whether to render a shadow
		  hwaccel: false, // Whether to use hardware acceleration
		  className: 'spinner', // The CSS class to assign to the spinner
		  zIndex: 2e9, // The z-index (defaults to 2000000000)
		  top: 5, // Top position relative to parent in px
		  left: 180 // Left position relative to parent in px
	};

	var target = document.getElementById("spinner");
	this.spinner = new Spinner(opts).spin(target);

	// Removes the 300ms delay for click events.
	FastClick.attach(document.body);

	var jsFilesLoaded = 0;
	// Specify an absolute path for development so a new viewer does not have to be created for each change.
	// Since the files are loaded dynamically, angular is bootstrapped manually.
	window.basePath = "";//http://lighthouse.adobe.com/users/derek/we.healthcare/";

	// On Android for versions before 4.4.2 if the files are run locally and any url parameters
	// are added then the page will not render so only add a random number for non-android.
	// Math.random() is appended so files are not taken from the cache.
	var r = navigator.userAgent.toLowerCase().indexOf("android") == -1 ? "?r=" + Math.random() : "";

	var jsFiles = [window.basePath + "js/Config.js" + r,
				   window.basePath + "js/app.js" + r,
				   window.basePath + "js/controllers.js" + r,
				   window.basePath + "js/factory.js" + r,
	               window.basePath + "js/services.js" + r,
	               window.basePath + "js/directives/folioItemView.js" + r,
	               window.basePath + "js/directives/folioItemViewGrid.js" + r,
	               window.basePath + "js/directives/previewDialog.js" + r,
	               window.basePath + "js/directives/sfdcBanner.js" + r];

	var css = window.basePath + "styles.css" + r;

	function init() {
		if (typeof adobeDPS == "undefined")	// Testing on the desktop.
			loadAssets();
		else								// Check if the user is online.
			checkIsUserOnline();
	}

	function checkIsUserOnline() {
		var request = new XMLHttpRequest();
			request.open("GET", "http://stats.adobe.com/");

			request.onreadystatechange = function() {
				if (request.readyState == 4) {
					window.isOnline = request.status != 0 && request.status != 404;
					loadAssets();
				}
			};

			request.send();
	}

	function loadAssets() {
		// Set the body content. Load this externally in case this file is loaded from a server and the HTML is local to the viewer.
		// This will allow changes to HTML without necessitating a viewer update.
		if (document.URL.indexOf("file:") == 0 && typeof adobeDPS == "undefined") // If testing through the file system, rather than a webserver, then security restrictions apply so load from dpsapps.com which has a CORS header to allow cross domain loading.
			document.body.insertAdjacentHTML("beforeend", "<ng-include src=\"'https://www.dpsapps.com/users/derek/store_configurator/previews/tabbed_store/templates/body.html?r=" + Math.random() + "'\">");
		else
			document.body.insertAdjacentHTML("beforeend", "<ng-include src=\"'" + window.basePath + "templates/body.html?r=" + Math.random() + "'\">");

		// Load the stylesheet.
		var el = document.createElement("link");
		el.setAttribute("rel", "stylesheet");
		el.setAttribute("type", "text/css");
		el.setAttribute("href", css);
		document.getElementsByTagName("head")[0].appendChild(el);
		
		loadJavaScriptFile(0);
	}
	
	function loadJavaScriptFile(index) {
		var path = jsFiles[index];
		var script = document.getElementsByTagName("script")[0];
		var el = document.createElement("script");
		el.onload = javascriptLoadHandler; 
		el.src = path;
		script.parentNode.insertBefore(el, script);
	}
	
	function javascriptLoadHandler() {
		jsFilesLoaded += 1;
		if (jsFilesLoaded == jsFiles.length) {
			// Manually bootstrap angular after all of the files have downloaded.
			angular.element(document).ready(function() {
				angular.bootstrap(document, ['defaultLibrary']);
			});
		} else {
			loadJavaScriptFile(jsFilesLoaded);
		}
	}

	// To test on the desktop remove the JavaScript include for AdobeLibraryAPI.js.
	if (typeof adobeDPS == "undefined") // Call init() immediately. This will be the case for dev on the desktop.
		init(); 
	else								// API is available so wait for adobeDPS.initializationComplete.
		adobeDPS.initializationComplete.addOnce(function(){ init() });
});