/*
 * Displays the preview dialog when a user taps a folio thumbnail.
 */
app.directive("previewDialog", function($rootScope, $window) {
	return {
		template: "<div ng-show='isDisplayPreviewDialog' class='ng-cloak modal-background-grey'>" +
						"<div id='preview-dialog'>" +
							"<div id='preview-dialog-top-row'>" +
								"<img id='preview-dialog-folio-cover'/>" +
								"<div id='preview-dialog-right-column'>" +
									"<div id='preview-dialog-title'></div>" +
									"<div id='preview-dialog-folio-number'></div>" +
									"<div id='preview-dialog-header-button-container'>" +
									"<div class='button' id='preview-dialog-download-button'>DOWNLOAD</div>" +
								"</div>" +
								"</div>" +
							"</div>" +
							"<div id='preview-dialog-description'></div>" +
							"<div id='preview-dialog-close-button'>x</div>" +
						"</div>",

		replace: true,

		link: function(dialogScope, $el, attrs) {
			// Set when a user taps a folio cover.
			var folio;

			// The id of the originating folio thumb. 
			var folioThumbElementId;

			// The thumbnail which triggered this dialog.
			var $thumbnailImage;

			var $previewDialog = angular.element(document.getElementById("preview-dialog"));
			var $folioCover = angular.element(document.getElementById("preview-dialog-folio-cover"));
			var $title = angular.element(document.getElementById("preview-dialog-title"));
			var $folioNumber = angular.element(document.getElementById("preview-dialog-folio-number"));
			var $description = angular.element(document.getElementById("preview-dialog-description"));
			var $downloadButton = angular.element(document.getElementById("preview-dialog-download-button"));
			var $buttonContainer = angular.element(document.getElementById("preview-dialog-header-button-container"));

			var $previewButton;
			var $archiveButton;

			if ($rootScope.isAPIAvailable)
				var folioStates = adobeDPS.libraryService.folioStates;

			// Handler for when a user taps a folio thumb.
			$rootScope.$on("folioThumbTapped", function(e, data, $thumbnailImage) {
				// Don't allow the user to scroll the background grid while this dialog is open.
				document.ontouchmove = function(e){
				    e.preventDefault();
				}

				showPreviewButton(false);

				if ($rootScope.isAPIAvailable) {
					folio = adobeDPS.libraryService.folioMap.internal[data.id];
					folio.updatedSignal.add(updateButton, this);

					updateButton();
					
					if (folio.isPurchasable && !folio.hasSections) { // Only check to see if preview is supported if this folio is purchasable and doesn't have sections.
						var transaction = folio.verifyContentPreviewSupported(); // Check to see if this folio supports previews.
						transaction.completedSignal.addOnce(verifyContentPreviewSupportedHandler, this);
					}
				} else {
					folio = data;
				}

				$title.html(folio.title);
				$folioNumber.html(folio.folioNumber);
				$description.html($rootScope.isAPIAvailable ? folio.folioDescription : folio.description);
				$folioCover.attr("src", angular.element($thumbnailImage).attr("src"));

				dialogScope.isDisplayPreviewDialog = true;
				dialogScope.$apply("isDisplayPreviewDialog");
			});

			$el.on("click", function(e) {
				clickHandler(e);
			});

			angular.element(document.getElementById("preview-dialog-close-button")).on("click", function() {
				close();
			});
			
			if ($rootScope.isAPIAvailable) {
				$downloadButton.on("click", function() {
					buyButton_clickHandler();
				});
			}

			// Handler for when a user clicks the buy button.
			function buyButton_clickHandler() {
				if ($rootScope.isAPIAvailable) {
					if (!folio.isCompatible) {
						alert("Please update your app to view this issue.");
						return;
					}
					
					var state = folio.state;
					
					if (state == folioStates.PURCHASABLE) {
						var transaction = folio.purchase();
						transaction.completedSignal.addOnce(function(transaction) {
							if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED)
								close();
						}, this);
					} else if (folio.isUpdatable) {
						folio.update();
						close();
					} else if (folio.isViewable) {
						folio.view();
						close();
					} else if (state == folioStates.ENTITLED) {
						folio.download();
						close();
					}
					
				}
			}

			function updateButton() {
				var label = "";
				
				switch (folio.state) {
					case folioStates.INVALID:
						label = "Invalid";
						break;
					case folioStates.UNAVAILABLE:
						label = "Unavaliable";
						break;
					case folioStates.PURCHASABLE:
						label = folio.price;
						break;
					case folioStates.ENTITLED:
						label = "DOWNLOAD";
						break;
					case folioStates.DOWNLOADING:
					case folioStates.INSTALLED:
						label = "VIEW";
						break;
					case folioStates.PURCHASING:
						label = "PURCHASING";
						break;
					case folioStates.EXTRACTING:
					case folioStates.EXTRACTABLE:
						label = "View";
						break;
				}
				
				$downloadButton.html(label);

				showArchiveButton(folio.state >= folioStates.INSTALLED);
			}

			function clickHandler(e) {
				var clientX = e.clientX;
				var clientY = e.clientY;

				// Calculate the top and left coordinates.
				var dialogWidth = $previewDialog[0].offsetWidth;
				var dialogHeight = $previewDialog[0].offsetHeight;
				var left = (window.innerWidth - dialogWidth) / 2;
				var top = (window.innerHeight - dialogHeight) / 2;

				if (clientX < left || clientX > left + dialogWidth || clientY < top || clientY > top + dialogHeight)
					close();
			}

			function verifyContentPreviewSupportedHandler(transaction) {
				if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
					if (folio.canDownloadContentPreview() || // Preview has not been downloaded yet.
						folio.supportsContentPreview) { 	  // canDownloadContentPreview()==false but supportsContentPreview==true so preview has already been downloaded.
						showPreviewButton(true);
					}
				}
			}

			function showSubscribeButton() {
				var $subscribeButton = angular.element("<div class='button'>SUBSCRIBE</div>");
				$buttonContainer.append($subscribeButton);

				var scope = this;
				$subscribeButton.on("click", function() {
					$el.trigger("subscribeButtonClicked");
				});
			}

			function showPreviewButton(value) {
				if (value) {
					$previewButton = angular.element("<div class='button' id='preview-button'>PREVIEW</div>");

					$buttonContainer.append($previewButton);

					// Add a click handler for the text link.
					$previewButton.on("click", function() {
						try {
							if (folio.canDownloadContentPreview()) {	// Preview can be downloaded.
								// Start the download.
								folio.downloadContentPreview();
								close();
							} else { 										// Preview is already downloaded so view the folio.
								// Check to see if the downloaded content preview is now entitled.
								// First check if it is downloadable (only true if entitled)
								// and the folio is not updatable
								// and we do not have a download going.
								// If so, start a download because we expect one to
								// be acting on the folio if we are not done
								if (folio.isDownloadable &&
									!folio.isUpdatable &&
									folio.currentStateChangingTransaction() == null) {
									// Start a new download transaction to get the rest of the folio
									folio.download();
								}
								
								folio.view();
							}
						} catch(e) {
							alert(e);
						}
					});
				} else {
					if ($previewButton) {
						$previewButton.off("click");
						$previewButton.remove();
						$previewButton = null;
					}
				}
			}

			function showArchiveButton(value) {
				if (value && !$archiveButton) {
					$archiveButton = angular.element("<div class='button' id='archive-button'>ARCHIVE</div>");

					$buttonContainer.append($archiveButton);

					// Add a click handler for the text link.
					$archiveButton.on("click", function() {
						if (folio.isArchivable) {
							$archiveButton.css("opacity", .7);

							function archive() {
								var archiveTransaction = folio.archive();
								archiveTransaction.completedSignal.addOnce(function(transaction) {
									if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
										showArchiveButton(false);
									}
								}, this);
							}

							if (folio.currentStateChangingTransaction() && folio.currentStateChangingTransaction().isCancelable) {
								var transaction = folio.currentStateChangingTransaction().cancel();
								transaction.completedSignal.addOnce(function() {
									archive();
								}, this);
							} else {
								archive();
							}
						}
					});
				} else {
					if ($archiveButton) {
						$archiveButton.off("click");
						$archiveButton.remove();
						$archiveButton = null;
					}
				}
			}
			
			function close() {
				dialogScope.isDisplayPreviewDialog = false;
				dialogScope.$apply("isDisplayPreviewDialog");
				showArchiveButton(false);
				document.ontouchmove = null;
			}
		}
	}
});