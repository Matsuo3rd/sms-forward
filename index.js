var fs = require('fs');
var log = require('./lib/logger')._system;
var HuaweiModemClient = require('./lib/HuaweiModemClient.js');
var MacOSAdressBookLookup = require('./lib/MacOSAdressBookLookup.js');

if (!fs.existsSync(__dirname + '/config.json')) {
	log
			.error("'config.json' does not exist. Please create one by renaming and editing 'config.json.sample'.");
	process.exit();
}
var config = require('./config.json');
var smsClient = new HuaweiModemClient(config.huawei_modem_ip, config.huawei_modem_login,
		config.huawei_modem_password);

log.info("SMS Forward started");
scanSMS();

function scanSMS() {
	var addressBookLookup = new MacOSAdressBookLookup(config.macos_address_book_db_path, config.country);
	addressBookLookup.init(function() {
		smsClient.authenticate().then(function(result){
			log.debug("Scanning SMS");
			cleanOldMessages(config.messages_retention_days).then(function() {
  			smsClient.listAllUnreadSMS().then(function(messages) {
      			if (messages.length > 0) {
      				this.forwardedCount = 0;
      				
      				var forwardMessages = function(i){
      				  if (i<messages.length) {
      				  	forwardMessage(messages[i], addressBookLookup).then(function(result) {
      				  		forwardMessages(i+1);
      				  	}).catch(function(err){
      				  		setTimeout(scanSMS, config.sms_scan_frequency * 1000);
      				  		log.error("Could not complete forwarding SMS - " + err);
      				  	});
      				  } else {
      				  	log.info("SMS scan complete: " + this.forwardedCount + " messages forwarded");
      				  	setTimeout(scanSMS, config.sms_scan_frequency * 1000);
      				  }
      				};
      				
      				forwardMessages(0);
      			} else {
      				log.debug("SMS scan complete - no message to forward");
      				setTimeout(scanSMS, config.sms_scan_frequency * 1000);
      			}
      		}).catch(function(err){
      			log.error("Could not list unread messages: " + err.stack);
      			setTimeout(scanSMS, config.sms_scan_frequency * 1000);
      		});
				}).catch(function(err){
	    		log.error("Could not clean old messages: Error code " + err);
	    		setTimeout(scanSMS, config.sms_scan_frequency * 1000);
	    	});
    	}).catch(function(err){
    		//TODO: lookup error code in HuaweiModemErrorCodes
    		log.error("Could not authenticate: Error code " + err);
    		setTimeout(scanSMS, config.sms_scan_frequency * 1000);
    	});
  });
}

function cleanOldMessages(nbDays) {
	log.debug("Old messages cleanup started");
	return new Promise((resolve, reject) => {
  	if (nbDays !== undefined && nbDays > 0) {
  		cleanOldMessagesBox(nbDays, 1).then(function(messages) {
  			if (messages.length > 0) {
  				log.info(messages.length + " old SMS deleted from inbox");
  			}
  			cleanOldMessagesBox(nbDays, 2).then(function(messages) {
  				if (messages.length > 0) {
  					log.info(messages.length + " old SMS deleted from outbox");
  				}
  				log.debug("Old messages cleanup completed");
  				resolve();
  			}).catch(function(err){
  				log.warn("Could not clean old messages from outbox: Error code " + err);
  				reject(err);
  	    })
  		}).catch(function(err){
      	log.warn("Could not clean old messages from inbox: Error code " + err);
      	reject(err);
      });
  	}
  	else {
  		resolve();
  	}
	});
}

function cleanOldMessagesBox(nbDays, boxType) {
	return new Promise((resolve, reject) => {
  	smsClient.listSMSOlderThan(nbDays, boxType).then(function(messages) {
  		if (messages.length > 0) {
  			var deleteMessages = function(i) {
  			  if (i<messages.length) {
  			  	smsClient.deleteSMS(messages[i]).then(function(result) {
  			  		deleteMessages(i+1);
  			  	}).catch(function(err){
  			  		log.error("Could not delete old SMS - " + err);
  			  		reject(err);
  			  	});
  			  } else {
  			  	resolve(messages);
  			  }
  			};
  			
  			deleteMessages(0);
  		}
  		else {
  			resolve(messages);
  		}
  	}).catch(function(err){
  		log.error("Could not list old messages: " + err);
  		reject(err);
  	});
	});
}

function forwardMessage(message, addressBookLookup) {
	return new Promise((resolve, reject) => {
    	smsClient.sendSMS(config.sms_target_number, getForwardedMessageContent(message, addressBookLookup)).then(function(result) {
    		// Need to pause between send/setAsRead (error 113018)
    		setTimeout(function() {
    			smsClient.setSMSAsRead(message.Index[0]).then(function(result) {
    				log.debug("Message [" + message.Content[0] + "] from [" + message.Phone[0] 
    					+ "] forwarded to [" + config.sms_target_number + "]");
    				this.forwardedCount++;
    				resolve(result);
    			}).catch(function(err) {
    				log.error("Could not set SMS as read - " + err);
    				reject(err);
    			});
    		}, 2000);
    	}).catch(function(err) {
    		log.error("Could not forward SMS - " + err);
    		reject(err);
    	});
	});
}

function getForwardedMessageContent(message, addressBookLookup) {
	var messageContent = 'From: ' + message.Phone[0];
	var contact = addressBookLookup.lookupPhoneNumber(message.Phone[0]);
	if (contact) {
		messageContent += ` (${contact.ZFIRSTNAME} ${contact.ZLASTNAME})`;
	}
	messageContent += '\nDate: ' + message.Date[0];
	messageContent += '\n' + message.Content[0];

	return messageContent;
}
