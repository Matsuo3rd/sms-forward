"use strict";

var log = require('./logger')._system;
var http = require('http');
var base64 = require('js-base64').Base64;
var xml = require('./xml-wrapped-parser');

// see: https://github.com/knq/hilink/blob/master/hilink.go
// also see: https://blog.hqcodeshop.fi/archives/259-Huawei-E5186-AJAX-API.html
// also see: https://github.com/BlackyPanther/Huawei-HiLink/blob/master/hilink.class.php
// also see: http://www.bez-kabli.pl/viewtopic.php?t=42168

var HuaweiModemClient = function(ip, login, password) {
	this.ip = ip;
	this.login = login;
	this.password = password;
	
	this.sesInfo = '';
	this.tokInfo = '';
};

HuaweiModemClient.prototype.authenticate = function() {
	let request = {
		request : {
			Username : this.login,
			Password : base64.encode(this.password)
		}
	};
	
	return new Promise((resolve, reject) => {
		// First try with basic authentication (old model such as E355) ...
		var that = this;
		that.command('/api/user/login', request).then(function(result){
			resolve(result);
		}).catch(function(err) {
			// ... if error code is 100002 or 100006 or 125002 then token-based authentication is needed
			if (err == 100002 || err == 100006 || err == 125002) {
				that.command('/api/webserver/SesTokInfo', {}, 'GET').then(function(result){
					that.sesInfo = result.response.SesInfo;
					that.tokInfo = result.response.TokInfo;
					resolve(result);
				}).catch(function(err) {
					reject(err);
				});
			}
			else {
				reject(err);
			}
		});
	});
};

// boxType: 1 for inbox, 2 for outbox
HuaweiModemClient.prototype.listSMS = function(boxType = 1, readCount = 20, sortType = 0, ascending = 0, page = 1) {
	let request = {
		request : {
			PageIndex : page,
			ReadCount : readCount,
			BoxType : boxType,
			SortType : sortType,
			Ascending : ascending,
			UnreadPreferred : 0
		}
	};
	
	return this.command('/api/sms/sms-list', request);
};

HuaweiModemClient.prototype.listAllUnreadSMS = function(unreadSMS = [], page = 1) {
	var that = this;
	return new Promise((resolve, reject) => {
    	this.listSMS(1, 20, 0, 1, page).then(function(result){
    		if (parseInt(result.response.Count) > 0) {
      		result.response.Messages[0].Message.forEach(function(message){
      			if (parseInt(message.Smstat) == 0) {
      				unreadSMS.push(message);
      			}
      		});
      		if (parseInt(result.response.Count) == 20) {
      			that.listAllUnreadSMS(unreadSMS, page+1).then(function(result){
      				resolve(result)
      			}).catch(function(err){
      				reject(err);
      			});
      		}
      		else {
      			resolve(unreadSMS);
      		}
    		}
    		else {
    			resolve(unreadSMS);
    		}
    	}).catch(function (err) {
    		reject(err);
    	});
	});
}

//boxType: 1 for inbox, 2 for outbox
HuaweiModemClient.prototype.listSMSOlderThan = function(nbDays, boxType = 1, oldSMS = [], page = 1) {
	var that = this;
	var today = new Date();
	return new Promise((resolve, reject) => {
    	this.listSMS(boxType, 20, 0, 1, page).then(function(result){
    		if (parseInt(result.response.Count) > 0) {
      		result.response.Messages[0].Message.forEach(function(message){
      			var daysDiff = Math.floor(( today - Date.parse(message.Date) ) / 86400000);
      			if (daysDiff >= nbDays) {
      				oldSMS.push(message);
      			}
      		});
      		if (parseInt(result.response.Count) == 20) {
      			that.listSMSOlderThan(nbDays, boxType, oldSMS, page+1).then(function(result){
      				resolve(result)
      			}).catch(function(err){
      				reject(err);
      			});
      		}
      		else {
      			resolve(oldSMS);
      		}
    		}
    		else {
    			resolve(oldSMS);
    		}
    	}).catch(function (err) {
    		reject(err);
    	});
	});
}

HuaweiModemClient.prototype.sendSMS = function(number, content) {
	let request = {
		request : {
			Index : -1,
			Phones : {
				Phone : number
			},
			Sca : "",
			Content : content,
			Length : content.length,
			Reserved : 1,
			// yyyy-MM-dd hh:mm:ss
			Date : new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
		}
	};
	
	return this.command('/api/sms/send-sms', request);
};

HuaweiModemClient.prototype.setSMSAsRead = function(messageId) {
	let request = {
		request : {
			Index : messageId
		}
	};
	
	return this.command('/api/sms/set-read', request);
};

HuaweiModemClient.prototype.deleteSMS = function(message) {
	let request = {
		request : {
			Index : message.Index
		}
	};
		
	return this.command('/api/sms/delete-sms', request);
}

HuaweiModemClient.prototype.monitoringStatus = function() {
	return this.command('/api/monitoring/status', '', 'GET');
};

// controlCode: 1=restart, 2=reset configuration, 3=configuration backup and returned in Base64, 4=shutdown
HuaweiModemClient.prototype.control = function(controlCode) {
	let request = {
		request : {
			Control : controlCode
		}
	};
	
	return this.command('/api/device/control', request);
};

HuaweiModemClient.prototype.command = function(path, request, method = "POST") {
	return new Promise((resolve, reject) => {
		var that = this;
    	var body = xml.obj2String(request);
    	var httpRequest = {
    		host : this.ip,
    		path : path,
    		port : 80,
    		method : method,
    		headers : {
    			//'Content-Type' : 'text/xml',
    			'Content-Length' : Buffer.byteLength(body),
    			'Cookie' : this.sesInfo,
    			'__RequestVerificationToken' : this.tokInfo
    		}
    	};
    
    	var req = http.request(httpRequest, function(res) {
    		var buffer = "";
    		res.on("data", function(data) {
    			buffer = buffer + data;
    		});
    		res.on("end", function(data) {
    			if (res.statusCode != 200) {
    				reject(buffer);
    			} else {
    			  xml.string2Obj(buffer).then(function(xml) {
    			  		if (xml.error != null ) {
    			  			//TODO: resolve error/code with MsgError
    			  			//reject(buffer);
    			  			reject(xml.error.code);
    			  		}
    			  		else {
    			  			// Set token as it changes on every command
    			  			if (res.headers.__requestverificationtoken) {
    			  				that.tokInfo = res.headers.__requestverificationtoken;
    			  			}
    			  			resolve(xml);
    			  		}
    			  }).catch(function(err) {
    			  		log.error("Could not parse XML: " + err + " " + buffer);
    			  		reject("Could not parse XML: " + err + " " + buffer);
    			  	});
    			}
    		});
    	});
    
    	req.on('error', function(error) {
    		reject(error);
    	});
    
    	req.write(body);
    	req.end();
	});
};

module.exports = HuaweiModemClient;
