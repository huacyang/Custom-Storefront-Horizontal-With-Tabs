var ADOBE = ADOBE || {};

ADOBE.Config = {
	// Whether or not this is an entitlement viewer. If true, then display the header and signin button, otherwise do not.
	IS_ENTITLEMENT_VIEWER: true,

	// Used to get the folios when testing on the desktop since the API is not available.
	// To find your guid go to http://lighthouse.adobe.com/dps/entitlement/.
	GUID: "c5af08b5-5adf-52fb-aae1-464490637ed9",
	
	// Flag to determine whether or not a folio will automatically open when enough of it has been downloaded.
	IS_AUTO_OPEN_DOWNLOADED_FOLIO: true,

	// The number of folios to initially render. The rest of the folios will be added as a user scrolls.
	NUM_FOLIOS_TO_DISPLAY_AT_STARTUP: 9,

	// Flag for whether or not to display "ALL" tab.
	IS_DISPLAY_ALL_TAB: false,

	// The label that will appear for the tab that will display all of the folios. Will only be used if IS_DISPLAY_ALL_TAB=true.
	ALL_TAB_LABEL: "All",

	// Whether or not to display the SFDC banner.
	IS_SFDC_ENABLED: false,
	SFDC_AUTH_URL: "https://login.salesforce.com",
	SFDC_REDIRECT_URI: "://success",
	SFDC_CLIENT_ID: ""

}
