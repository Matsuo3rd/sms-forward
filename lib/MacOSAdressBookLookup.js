"use strict";

var fs = require('fs');
var log = require('./logger')._system;
var sqlite3 = require('sqlite3').verbose();
var PNF = require('google-libphonenumber').PhoneNumberFormat;
var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

var MacOSAdressBookLookup = function(macos_address_book_db_path, country) {
	this.macos_address_book_db_path = macos_address_book_db_path;
	this.country = country;
};

MacOSAdressBookLookup.prototype.init = function(callback) {
	var that = this;
	loadAddressBookPhoneNumbers(this.macos_address_book_db_path, this.country, function(addressBookPhoneNumbers) {
		that.addressBookPhoneNumbers = addressBookPhoneNumbers;
		callback();
	});
};

MacOSAdressBookLookup.prototype.lookupPhoneNumber = function(phoneNumber) {
	return this.addressBookPhoneNumbers[normalizePhoneNumber(phoneNumber, this.country)];
};

function loadAddressBookPhoneNumbers(macos_address_book_db_path, country, callback) {
	var addressBookPhoneNumbers = {};
	
	let db = new sqlite3.Database(macos_address_book_db_path, sqlite3.OPEN_READONLY, (err) => {
		if (err) {
			log.error(err.message + " - '" + macos_address_book_db_path + "'");
			return;
		}
		log.debug("Connected to addressbook database '" + macos_address_book_db_path + "'");
	});

	db.serialize(() => {
		db.each(`SELECT DISTINCT
					ZABCDRECORD.ZFIRSTNAME,
					ZABCDRECORD.ZLASTNAME,
					ZABCDRECORD.ZMAIDENNAME,
					ZABCDRECORD.ZMIDDLENAME,
					ZABCDRECORD.ZNICKNAME,
					ZABCDRECORD.ZSUFFIX,
					ZABCDRECORD.ZTITLE,
					ZABCDRECORD.ZJOBTITLE,
					ZABCDRECORD.ZORGANIZATION,
					ZABCDPHONENUMBER.ZFULLNUMBER
				FROM ZABCDPHONENUMBER
				LEFT JOIN ZABCDRECORD ON ZABCDPHONENUMBER.ZOWNER = ZABCDRECORD.Z_PK`, (err, row) => {
			
			if (err) {
			  log.error(err.message);
			}
			
			//console.log(row);
			var phoneNumber = normalizePhoneNumber(row.ZFULLNUMBER, country);
			if (phoneNumber != null) {
				addressBookPhoneNumbers[phoneNumber] = row;
			}
		});
	});
	
	db.close((err) => {
		if (err) {
			return log.error(err.message);
		}
		log.debug('Close the addressbook database connection.');
		callback(addressBookPhoneNumbers);
	});
}

function normalizePhoneNumber(phoneNumber, country) {
	try {
		var number = phoneUtil.parse(phoneNumber, country);
		if (phoneUtil.isValidNumber(number)) {
			return phoneUtil.format(number, PNF.INTERNATIONAL);
		}
	}
	catch (err) {
		log.error("Warning:  '" + phoneNumber + "' - " + err);
		return null;
	}
}

module.exports = MacOSAdressBookLookup;
