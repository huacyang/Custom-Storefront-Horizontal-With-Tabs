//Gets the folios from either the API or the XML fulfillment URL.
app.service("folioService", function($http, $rootScope, $q) {
	return {
		getFolios: function() {
			if ($rootScope.isAPIAvailable) { // The API is available so grab the folios from folioMap.
				// Sort the folios by descending publicationDate
				var folios = adobeDPS.libraryService.folioMap.sort(function(a, b) {
					return b.publicationDate - a.publicationDate;
				});

				// Trigger a promise.
				var deferred = $q.defer();
				deferred.resolve(folios);
				return deferred.promise;
			} else {				
				// The API is not available, which means testing on the desktop, so load the folio data from the fulfillment XML.
				// The actual URL for the fulfillment xml is http://edge.adobe-dcfs.com/ddp/issueServer/issues?accountId=,
				// but Safari 6 does not allow x-domain requests from local files anymore so a proxy has been created
				// with a CORS header to allow access from local files.
				// window.guid will be set from the configurator.
				return $http({
						method: "GET",
						url:"http://www.dpsapps.com/dps/v2_library_store_templates/fulfillment_proxy.php",
						params: {accountId: ADOBE.Config.GUID}
					}).then(function(result) {
						var xml = new window.DOMParser().parseFromString(result.data, "text/xml");

						var issueNodes = xml.getElementsByTagName("issue");
						var len = issueNodes.length;
						if (len > 0) {
							var folios = [];
							for (var i = 0; i < len; i++) {
								var issueNode = issueNodes[i];
								// Get the attributes
								var issue = {};
								var attributes = issueNode.attributes;
								issue.id = attributes.getNamedItem("id").value;
								
								// This shouldn't happen but if productId is empty then assign one.
								issue.productId = attributes.getNamedItem("productId") ? attributes.getNamedItem("productId").value : ADOBE.LibraryCollection.productIdCounter++;
								issue.formatVersion = attributes.getNamedItem("formatVersion").value;
								issue.version = attributes.getNamedItem("version").value;
								issue.subpath = attributes.getNamedItem("subpath").value;
								issue.hasSections = attributes.getNamedItem("hasSections") ? attributes.getNamedItem("hasSections").value == "true" : false;
								
								// Loop through the nodes.
								var childNodes = issueNode.childNodes;
								var numNodes = childNodes.length;
								for (var j = 0; j < numNodes; j++) {
									var childNode = childNodes[j];
									if (childNode.nodeType == 1) {
										var nodeName = childNode.nodeName;
										if (nodeName == "libraryPreviewUrl") {
											// issue.libraryPreviewUrl = (childNode.firstChild.nodeValue).trim() + "/portrait";
											issue.libraryPreviewUrl = (childNode.firstChild.nodeValue).trim() + "/landscape";
										} else if (childNode.nodeName == "publicationDate") {
											// 2011-06-22T07:00:00Z.
											var pubDate = childNode.firstChild.nodeValue.split("-");
											var date = new Date(pubDate[0], Number(pubDate[1]) - 1, pubDate[2].substr(0, 2));
											issue[nodeName] = date;
										} else if (childNode.nodeName == "magazineTitle") { // Make the property match the API.
											issue["title"] = childNode.firstChild.nodeValue;
										} else if (childNode.nodeName == "issueNumber") { // Make the property match the API.
											issue["folioNumber"] = childNode.firstChild.nodeValue;
										} else {
											issue[nodeName] = childNode.firstChild.nodeValue;
										}
									}
								}
								
								// This shouldn't happen but if the publicationDate is empty then assign one.
								if (issue.publicationDate == undefined)
									issue.publicationDate = new Date();
								
								folios.push(issue);
							}

							// Sort descending by publicationDate.
							folios.sort(function(a, b) {
								return b.publicationDate - a.publicationDate;
							});

							return folios;
						} else {
							return null;
						}
				});
			}
		}
	}
})

// Checks network connectivity.
app.service("networkService", function($http) {
	return {
		isUserOnline: function() {
			return $http({
				method: "GET",
				url: "http://stats.adobe.com/"
			});
		}
	}
});