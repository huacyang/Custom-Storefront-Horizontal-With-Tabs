/*
 * Displays the tiles on the home page.
 */

app.directive("folioItemViewGrid", function() {
	return function($scope) {
		var numFoliosToDisplayAtStartup = 8;
		$scope.$watch("tab.hasBeenViewed", function(value) {
			if ($scope.tab.hasBeenViewed && !$scope.tab.visibleFolios) {
				$scope.tab.visibleFolios = [];
				var len = Math.min($scope.tab.foliosDeferred.length, numFoliosToDisplayAtStartup)
				for (var i = 0; i < len; i++) {
					$scope.tab.visibleFolios.push($scope.tab.foliosDeferred[i]);
				}
			}
		});

		var $el = arguments[2].$$element;
		var $parent = $el.parent();

		// Handle scroll events for lazy loading of rows.
		var folioContainer = $el[0];
		$parent.bind("scroll", function(e) {
			if ($scope.tab.visibleFolios && $parent[0].scrollTop + $parent[0].offsetHeight + 100 >= $parent[0].scrollHeight) {
				var numFoliosToAdd = 4;
				var startIndex = $scope.tab.visibleFolios.length;
				var endIndex = Math.min(startIndex + numFoliosToAdd, $scope.tab.foliosDeferred.length); // Calculate the end index.

				if (endIndex > $scope.tab.visibleFolios.length) { // $scope.visibleFolios.length is the number of visible items. 
					for (var i = startIndex; i < endIndex; i++) {
						$scope.tab.visibleFolios.push($scope.tab.foliosDeferred[i])
					}

					$scope.$apply($scope.tab.visibleFolios);
				}
			}
		});

		// Hard code this otherwise it is zero when this loads since it isn't visible.
		var tabHeight = 31;
		function resizeHandler() {
			// Unable to set a directive on the parent since this is in a tabset so setting the parent height here.
			// Explicitly set the parent height so it scrolls and the header and tab stay in place.
			$parent[0].setAttribute("style", "height:" + (window.innerHeight - document.getElementById("header").offsetHeight - tabHeight - document.getElementById("sfdc-banner").offsetHeight) + "px");
		};

		angular.element(window).bind("resize", function() {
			resizeHandler();
		});

		resizeHandler();

		// Stop the page from bounce scrolling if this container isn't scrollable.
		$parent.on("touchmove",function(e){
			if ($parent[0].offsetHeight == $parent[0].scrollHeight)
				e.preventDefault();
		});
	}
});
