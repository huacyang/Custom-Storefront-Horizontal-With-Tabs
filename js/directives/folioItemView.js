/*
 * Displays an individial folio with cover, folioNumber, state and progressbar.
 */
app.directive("folioItemView", function($rootScope, $compile) {
	return {
		template: "<img class='folio-item-view-img'>" +
				  "<div class='folio-item-view-text-container'>" +
				  		"<div class='folio-item-view-folio-title'>{{folio.title}}</div>" +
				  		"<div class='folio-item-view-folio-number'>{{folio.folioNumber}}</div>" + // Publication Name
				  		"<div class='folio-item-view-state'></div>" + 
				  		"<div class='button folio-item-view-buy-button'></div>" +
				  "</div>",

		link: function(scope, $el, attrs) {
			var folio = scope.folio;
			var $thumbnail = angular.element($el[0].querySelector(".folio-item-view-img"));
			var $folioTitle = angular.element($el[0].querySelector(".folio-item-view-folio-title"));
			var $folioNumber = angular.element($el[0].querySelector(".folio-item-view-folio-number"));
			var $buyButton = angular.element($el[0].querySelector(".folio-item-view-buy-button"));
			var $state = angular.element($el[0].querySelector(".folio-item-view-state"));
			var $textContainer = angular.element($el[0].querySelector(".folio-item-view-text-container"));
			var $progressBarContainer;
			var $progressBar;
			var $resumeCancelButton;

			var currentDownloadTransaction;
			var isTrackingTransaction;

			var previousState;

			var availableWidth;
			var availableHeight;

			var parentEl = $el.parent()[0];

			if ($rootScope.isAPIAvailable) {
				var folioStates = adobeDPS.libraryService.folioStates;
				var transactionStates = adobeDPS.transactionManager.transactionStates;

				// Hack: toggle visibility otherwise there are sometimes artifact lines around the borders.
				$thumbnail.css("visibility", "hidden");

				loadPreviewImage();

				updateView();

				$buyButton.on("click", clickHandler);

				// Add a handler to listen for updates.
				folio.updatedSignal.add(updatedSignalHandler, this);

				// Determine if the folio was in the middle of downloading.
				// If the folio is downloading then find the paused transaction and resume.
				if (folio.state == folioStates.DOWNLOADING) {
					var transactions = folio.currentTransactions;
					var len = transactions.length;
					for (var i = 0; i < len; i++) {
						var transaction = transactions[i];
						if (transaction.state == transactionStates.PAUSED) {
							transaction.resume();
							break;
						}
					}
				}

				// If there is a current state changing transaction then track it.
				if (folio.currentStateChangingTransaction())
					trackTransaction();
			} else {
				$thumbnail.attr("src", folio.libraryPreviewUrl);
				// $buyButton.html("FREE");
				$buyButton.addClass('download-button');
			}

			// Trigger the preview dialog to open.
			$thumbnail.on("click", function() {
				$rootScope.$emit("folioThumbTapped", folio, angular.element($el[0].querySelector(".folio-item-view-img")));
			})

			// Occurs for orientation changes.
			angular.element(window).on("resize", resizeHandler);

			calculateImageDimensions();
			resizeHandler();

			window.addEventListener("orientationchange", function(){
				calculateImageDimensions();
				resizeHandler();
			});

			window.addEventListener("resize", function(){
				calculateImageDimensions();
				resizeHandler();
			});

			function loadPreviewImage() {
				// Load the preview image.
				var transaction = folio.getPreviewImage(120, 160, true);
				transaction.completedSignal.addOnce(function(transaction) {
					if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED && transaction.previewImageURL != null) {
						$thumbnail.attr("src", transaction.previewImageURL);
						$thumbnail.css("visibility", "visible");

						// Need to resize the thumbnail after load otherwise it won't always size properly.
						$thumbnail.bind("load", function() { resizeHandler() });
					} else if (transaction.previewImageURL == null) { // Sometimes previewImageURL is null so attempt another reload.
						var scope = this;
						setTimeout(function() {
							scope.loadPreviewImage();
						}, 200);
					}
				}, this);
			}

			// Returns the padding for this view, $el.
			function getCSSPropertyValue(element, property) {
				return parseInt(window.getComputedStyle(element, null).getPropertyValue(property), 10);
			}

			function clickHandler() {
				if (!folio.isCompatible) {
					alert("Please update your app to view this issue.");
					return;
				}

				downloadButtonWasClicked = true;

				if (folio.isPurchasable) {
					folio.purchase();
				} else if (folio.isDownloadable) {
					folio.download();
				} else if (folio.isUpdatable) {
					if (folio.entitlementType == 0) // User is logged out but has downloaded the folio. Since user is logged out they won't be able to update so call view().
						folio.view();
					else
						folio.update();
				} else if (folio.isViewable) {
					folio.view();
				} else if (currentDownloadTransaction && currentDownloadTransaction.state == adobeDPS.transactionManager.transactionStates.PAUSED) {
					currentDownloadTransaction.resume();
				}
			}

			// Handler for any state changes to the folio.
			function updatedSignalHandler(properties) {
				updateView();
				
				// Progressive download is supported yet on Android but add this
				// as a safeguard for when it is.
				if (properties.indexOf("isViewable") > -1 && folio.isViewable) {
					if (downloadButtonWasClicked && ADOBE.Config.IS_AUTO_OPEN_DOWNLOADED_FOLIO)
						folio.view();
				}
					
				if ((properties.indexOf("state") > -1 || properties.indexOf("currentTransactions") > -1) && folio.currentTransactions.length > 0)
					trackTransaction();
			}
			
			// Updates the label of the buy button and state based on folio.state.
			function updateView() {
				var state = "";
				var buyButtonLabel = "";
				switch (folio.state) {
					case folioStates.INVALID:

						break;
					case folioStates.UNAVAILABLE:

						break;
					case folioStates.PURCHASABLE:
						buyButtonLabel = folio.price;
						break;
					case folioStates.PURCHASING:
						state = "Purchasing";
						buyButtonLabel = folio.price;
						break;
					case folioStates.ENTITLED:
						buyButtonLabel = "DOWNLOAD";
						break;
					case folioStates.DOWNLOADING:
						// This should go in showDownloadStatus() but there is a slight delay before the button is displayed if it is in there.
						if (!$resumeCancelButton) {
							$resumeCancelButton = angular.element("<div class='resume-cancel-button'><span class='glyphicon glyphicon-remove'></span></div>");
							$el.append($resumeCancelButton);
							$resumeCancelButton.on("click", toggleDownload);
							$buyButton.css("display", "none");
						}

						state = "Downloading";
						break;
					case folioStates.EXTRACTING:
					case folioStates.EXTRACTABLE:
						state = "Extracting";
						break;
					case folioStates.INSTALLED:
						buyButtonLabel = "VIEW";
						break;
				}

				// For the restricted distribution case, hide if INVALID or UNAVAILABLE.
				$el.css("display", folio.state == folioStates.INVALID || folio.state == folioStates.UNAVAILABLE ? "none" : "block");

				$buyButton.html(buyButtonLabel);
				$state.html(state);

				// If the folio is now made visible need to call resizeHandler() otherwise the image will be 0px tall.
				if (previousState <= folioStates.UNAVAILABLE && folio.state > folioStates.UNAVAILABLE) {
					resizeHandler();
				}
				previousState = folio.state;
			}

			function trackTransaction() {
				if (isTrackingTransaction)
					return;
			
				var transaction = folio.currentStateChangingTransaction();
				if (!transaction)
					return;

				var transactionType = transaction.jsonClassName;

				if (transactionType != "DownloadTransaction" &&
					transactionType != "UpdateTransaction" &&
					transactionType != "PurchaseTransaction" &&
					transactionType != "ArchiveTransaction" && 
					transactionType != "PreviewTransaction") {
						return;
				}

				// Check if the transaction is active yet
				if (transaction.state == adobeDPS.transactionManager.transactionStates.INITALIZED) {
					// This transaction is not yet started, but most likely soon will
					// so setup a callback for when the transaction starts
					transaction.stateChangedSignal.addOnce(trackTransaction, this);
					return;
				}
				
				isTrackingTransaction = true;
				
				currentDownloadTransaction = null;

				if (transactionType == "DownloadTransaction" || transactionType == "UpdateTransaction" || transactionType == "PreviewTransaction") {
					transaction.stateChangedSignal.add(download_stateChangedSignalHandler, this);
					transaction.progressSignal.add(download_progressSignalHandler, this);
					transaction.completedSignal.add(download_completedSignalHandler, this);
					currentDownloadTransaction = transaction;
				} else if (transactionType == "ArchiveTransaction") {
					transaction.completedSignal.addOnce(function() {
						isTrackingTransaction = false;

						// Add the listener back and then update the view.
						folio.updatedSignal.add(updatedSignalHandler, this);
						updateView();
					});

					$state.html("<strong>Archiving</strong>");

					// Remove the listener so the $state text is not updated.
					folio.updatedSignal.remove(updatedSignalHandler, this);
				} else if (transactionType == "PurchaseTransaction") {
					transaction.completedSignal.addOnce(function(transaction) {
						if (transaction.state == adobeDPS.transactionManager.transactionStates.FAILED) {
							alert("Sorry, unable to purchase");
						}

						isTrackingTransaction = false;
					}, this);
				}
			}

			// Downloads are automatically paused if another one is initiated so watch for changes with this callback.
			function download_stateChangedSignalHandler(transaction) {
				if (transaction.state == adobeDPS.transactionManager.transactionStates.FAILED) {
					if (transaction.error) {
						if (transaction.error.code == adobeDPS.transactionManager.transactionErrorTypes.TransactionFolioNotEnoughDiskSpaceError)
							alert("You do not have enough disk space to download this issue.");
						else if (transaction.error.code == adobeDPS.transactionManager.transactionErrorTypes.TransactionFolioIncompatibleError)
							alert("The issue you are trying to download is incompatible with this viewer. Please update your app.");
						else if (transaction.error.code == adobeDPS.transactionManager.transactionErrorTypes.TransactionCannotConnectToInternetError)
							alert("Please connect to the internet to download this issue.");
						else
							alert("Unable to download folio: " + transaction.error.code + ".");
					} else {
						alert("Unable to download folio.");
					}

					download_completedSignalHandler(transaction);
					updateView();
				} else if (currentDownloadTransaction.state == adobeDPS.transactionManager.transactionStates.PAUSED) {
					// Downloads do not resume from the last point so set the percent back to 0.
					setDownloadPercent(0);
					$state.html("Download Paused");
					$resumeCancelButton.html("<span class='glyphicon glyphicon-refresh'></span>");
				} else if (currentDownloadTransaction.state == adobeDPS.transactionManager.transactionStates.ACTIVE) {
					updateView();
					$resumeCancelButton.html("<span class='glyphicon glyphicon-remove'></span>");
				}
			}
			
			// Updates the progress bar for downloads and updates.
			function download_progressSignalHandler(transaction) {
				if (transaction.progress > 0)
					showDownloadStatus(true);

				setDownloadPercent(transaction.progress);
			}
			
			// Handler for when a download or update completes.
			function download_completedSignalHandler(transaction) {
				transaction.stateChangedSignal.remove(download_stateChangedSignalHandler, this);
				transaction.progressSignal.remove(download_progressSignalHandler, this);
				transaction.completedSignal.remove(download_completedSignalHandler, this);

				isTrackingTransaction = false;

				showDownloadStatus(false);
			}

			function showDownloadStatus(value) {
				if (value) {
					if (!$progressBarContainer) {
						$progressBarContainer = angular.element("<div class='folio-item-view-progress-bar-container'><div class='folio-item-view-progress-bar'></div></div>");
						$el.append($progressBarContainer);

						$progressBarContainer.css("left", getCSSPropertyValue($el[0], "padding-left") + "px");

						$progressBar = angular.element($progressBarContainer[0].querySelector(".folio-item-view-progress-bar"));
					}
				} else {
					if ($progressBarContainer) {
						$progressBarContainer.remove();
						$progressBarContainer = null;
					}

					if ($resumeCancelButton) {
						$resumeCancelButton.off("click", toggleDownload);
						$resumeCancelButton.remove();
						$resumeCancelButton = null;
					}

					$buyButton.css("display", "block");
				}
				
				resizeHandler();
			}

			function setDownloadPercent(value) {
				var maxWidth = $progressBarContainer[0].offsetWidth;
				$progressBar.css("width", Math.min(value, maxWidth) + "%");
			}

			function toggleDownload() {
				if (!currentDownloadTransaction)
					return;
				
				if (currentDownloadTransaction.state == adobeDPS.transactionManager.transactionStates.ACTIVE) {
					currentDownloadTransaction.cancel();
					
					// This should be handled in updateView() but the state is not
					// properly updated for previews so need to explicitly do it here.
					showDownloadStatus(false);
				} else {
					currentDownloadTransaction.resume();
				}
			}

			function calculateImageDimensions() {
				// If the width is set in the CSS the element will not size correctly so need to explicitly
				// get the width from the parent and divide by three which are how many items there are per row.
				availableWidth = Math.floor(window.innerWidth / 4);

				// Aspect ratio for the image.
				// Explicitly set the image dimensions so the size isn't set after the image loads which
				// will cause the UI to shift if the dimensions aren't set.
				var aspectRatio = .75;
				availableHeight = Math.floor(availableWidth / aspectRatio);
			}

			function resizeHandler() {
				$thumbnail.attr("width", availableWidth);
				$thumbnail.attr("height", availableHeight);

				// Explicitly set the width of the text container so it takes the remaining width.
				var parentPadding = getCSSPropertyValue($el.parent()[0], "padding-left");
				var textContainerMarginLeft = getCSSPropertyValue($el[0].querySelector(".folio-item-view-text-container"), "margin-left");
				$textContainer.css("width", (availableWidth - textContainerMarginLeft - parentPadding - 10) + "px");

				if ($progressBarContainer) {
					// Aligns the progress bar to the bottom of the image.
					// Take into account the padding for $el.
					$progressBarContainer.css("top", ($thumbnail[0].offsetHeight - $progressBarContainer[0].offsetHeight + getCSSPropertyValue($el[0], "padding-top")) + "px");
					$progressBarContainer.css("width", (availableWidth - getCSSPropertyValue($el[0], "padding-left") - getCSSPropertyValue($el[0], "padding-right")) + "px");
				}
			}
		}
	};
});