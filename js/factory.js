app.factory("SFDCModel", [function($scope){
	function SFDCModel(){ }

	SFDCModel.prototype = {
		parse: function() {
			var o;
			if (localStorage.sfdcModel) {
				try {
					o = JSON.parse(localStorage.sfdcModel);
				} catch(error) {
					console.log('sfdcmodel::exception');
				}
			}

			if (o)
				this.set(o);
			else
				this.set( {firstName:null, lastName:null, email:null, account: null, opportunity:null, contact:null, url:null, isLoggedIn:null, recording:null, postUrl:null, action:null, parentId:null, startTime:null} );
		},

		toJSON: function() {
			var obj = {
				firstName: 	this.firstName,
				lastName: 	this.lastName,
				email: 		this.email,
				account:  	this.account,
				opportunity:this.opportunity,
				contact: 	this.contact,
				url: 		this.url,
				isLoggedIn: this.isLoggedIn,
				recording: 	this.recording,
				postUrl: 	this.postUrl,
				action: 	this.action,
				parentId: 	this.parentId,
				startTime: 	this.startTime
			};

			return obj;
		},

		set: function(obj) {
			for (var i in obj) {
				this[i] = obj[i];
			}
		},

		save: function() {
			localStorage.sfdcModel = JSON.stringify(this.toJSON());
		},
		
		setIdentity: function(first, last, email) {
			this.set({firstName:first, lastName:last, email:email});
			this.save();
		},
		
		setAccount: function(s) {
			this.set({account:s});
			this.save();
		},
		
		setOpportunity: function(s) {
			this.set({opportunity:s});
			this.save();
		},
		
		setRecording: function(s) {
			this.set({recording:s, startTime:Date.now() });
			
			this.save();
		},

		getRecording: function() {
			return this.recording;
		},

		getStartTime: function() {
			return this.startTime;
		},
		
		setLoginState: function(s) {
			this.set({isLoggedIn:s});
			this.save();
		},
		
		setContact:function(s) {
			this.set('contact',s);
			this.save();
		},
		
		setAction:function(s) {
			this.set('action', s);
			this.save();
		},
		
		setParentId:function(s) {
			this.set('parentId', s);
			this.save();
		},

		getParentId: function() {
			return this.parentId;
		},
		
		setPostUrl:function(s) {
			this.set('postUrl', s);
			this.save();
		},
		
		setUrl: function(key, url) {
			this.set(key, url);
			this.save();
		}
	}

	return SFDCModel;
}])