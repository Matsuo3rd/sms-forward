**As I switched to iPhone supporting Dual SIM (eSIM), this repository won't be maintained anymore.**

# sms-forward

[![npm version](https://img.shields.io/npm/v/sms-forward.svg)](https://www.npmjs.com/package/sms-forward)

Auto-forward incoming SMS from one mobile phone number to another phone number using a Huawei mobile broadband device (dongles, wingles).

## Description

This Node.js module forwards incoming SMS from one mobile phone number (e.g. personal) to another one (e.g. work).
The typical use case is someone equipped with a professional mobile phone, who wants to keep his/her personal phone number separate from work number, 
but does not want to carry both phones all the time.

This module acts as a "limited" SMS gateway: source phone number SIM (e.g. personal) is placed into a Huawei mobile broadband device which offers
[SMS APIs](https://www.mrt-prodz.com/blog/view/2015/05/huawei-modem-api-and-data-plan-monitor).
The module scans incoming SMS and forwards them to a target phone number (e.g. work).

The detailed workflow is as follows:
1. Scans for unread SMS in Inbox
2. For each unread SMS:
   * Optionally lookup AddressBook to fetch sender fullname
   * Forward SMS to target phone number
   * Mark SMS as read

## Prerequisites

* Source phone number SIM dedicated for SMS forwarding
* [Huawei Mobile Broadband device](http://consumer.huawei.com/en/?type=mobile-broadband). This has been tested with a (old) E355 model and a (new) E3372 model.
If you are using another model, it would be great if you could report it
* Always-on Linux/Mac computer/Raspberry Pi which executes this Node.js module
* [Node.js](https://nodejs.org) installed on previously mentioned computer

## Installation

1. `npm install -g sms-forward`
2. copy and rename `config.json.sample` to `config.json`
3. edit and save `config.json` accordingly (see Configuration section)
4. `node index.js`

## Configuration

config.json file shall contains the following keys/values:

| Key | Default | Description |
| --- | --- | --- |
| `sms_target_number` | N/A | The phone number to which SMSs are forwarded. This shall be prefixed with international number (e.g. +33) and **MUST NOT CONTAIN ANY WHITESPACES**. e.g. "+33612345678|
| `sms_scan_frequency` | N/A | SMS forwarding scan frequency in seconds. i.e. how often messages to be forwarded shall be checked. e.g. "30" (seconds) |
| `huawei_modem_ip` | N/A | The Huawei Modem's IP. e.g. "192.168.1.1"|
| `huawei_modem_login` | N/A | Optional - The Huawei Modem's login. e.g. "admin". Some Huawei dongles require a login/password authentication (e.g. E355), others do not (e.g. E3372)|
| `huawei_modem_password` | N/A | Optional - The Huawei Modem's login's password. e.g. "admin"|
| `messages_retention_days` | N/A | Optional - Messages older than provided days will be deleted in order to free up messages space (which is limited on Huawei devices). e.g. "30" (days)|
| `macos_address_book_db_path` | N/A | Optional - needed for message's originator's name resolution. Path of your MacOS AddressBook to resolve message's originator's name from phone number. You can find a list of databases by running the following command in a terminal: `find ~/Library/Application\ Support/AddressBook/ -name "AddressBook-v22.abcddb" -exec ls -rtlah {} +`, pick the last one in the list.|
| `country` | N/A | Optional - needed for message's originator's name resolution. Your 2-letters [ISO 3166-2](https://en.wikipedia.org/wiki/ISO_3166-2) code country. e.g. "FR" for France, "GB" for United Kingdom.


Configuration sample:

```json
{
	"sms_target_number": "+33612345678",
	"sms_scan_frequency": 30,
	"huawei_modem_ip": "192.168.1.1",
	"huawei_modem_login": "admin",
	"huawei_modem_password": "admin",
	"messages_retention_days" : 30,
	"macos_address_book_db_path": "/Users/<MY_USER>/Library/Application Support/AddressBook//Sources/DE540B1E-A3CF-4655-B1F6-6DDC0B42CD5F/AddressBook-v22.abcddb",
	"country": "FR"
}
```

## Limitations

1. MMS (pictures/videos attached) are not supported (only SMS are supported).
2. Source phone number' SIM is dedicated for SMS forwarding ("stuck" into the Huawei modem, i.e. you cannot use it on another phone).
This can be overcome if your telco operator offers [Multi-SIM](https://en.wikipedia.org/wiki/Multi-SIM_card): simply order additional SIMs attached to the same phone number.
4. Cannot directly reply to forwarded SMS as the message's originator's phone number has been replaced with the fowarding source phone number.
However, forwarded SMS mentions originator's number which can be used to quickly send a message to her/him (e.g. on iPhones, simply click on phone number to send a message).
4. Forwarded message does not mention message's originator's name but only phone number. This can be problematic to identify the sender.
This can be overcome with the included optional feature which resolves originator's name with phone number from macOS Contacts App (if you happen to run the module on a Mac).
Developers (help needed) may extend this feature to other Contacts repositories (e.g. Google, Outlook, etc.).


## Why?

Incoming calls (voice) can easily be redirected by activating [Call Forwarding](https://en.wikipedia.org/wiki/Call_forwarding).
i.e. all incoming calls (voice) are systematically forwarded to another mobile. This completely covers my use case, because the transfer will happen
no matter if the phone is OFF or the SIM not connected to cellular network.

SMS, however, is a different story. No telco operator (that I know of) offers a SMS Forwarding feature (the equivalent of Call Forwarding for SMS).

There are some options out there but none of them completely meets my requirements:
* Dual SIM can do the job, as iPhones (which I happen to own) feature eSIM support. However, you need a model starting from iPhone XS & XR.
* A very limited set of telco operators, such as [Kyivstar](http://www.pay.kyivstar.ua/en/kr-620/mm/services/services_archive/sms-forward/) offers SMS Forward feature, however both phone numbers must be contracted with the same operator.
* For iPhone, SMS and iMessages can be forwarded using Apple [Continuity](https://support.apple.com/en-us/HT204681) feature to other iDevices, provided they are connected with the same Apple ID and they are switched ON.
That implies an always powered iPhone dedicated to the sole purpose of SMS forwarding, which is something I am not happy with.
* For Android, apps such as [SMS Forwarder](https://play.google.com/store/apps/details?id=org.yas.freeSmsForwarder) are supposed to the job. But I highly suspect they have the same limitation than above (source phone
must be always ON). Plus I do not own an Android phone.

## References

This module heavily relies on the material found in the following links:
* [Huawei Modem API and Data Plan Monitor](https://www.mrt-prodz.com/blog/view/2015/05/huawei-modem-api-and-data-plan-monitor)
* [Building a SMS gateway from a Huawei USB Modem](https://etherarp.net/building-a-sms-gateway-from-a-huawei-usb-modem/)
