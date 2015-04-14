'use strict';

// Declare app level module which depends on filters, and services
var app = angular.module("defaultLibrary", ["ui.bootstrap"]);

app.run(function($rootScope) {
	$rootScope.isAPIAvailable = typeof adobeDPS != "undefined";
})
