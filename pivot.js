/*
CCCpivot - CAC Control Center "pivot" module
A Node.js application to send serial commands for Pioneer CAC autochangers by websocket messages.
*/

// Constants & script environment
const APPNAME	= "CCCpivot";
const VERSION	= "1.0.0";

const PIVOTID 	= process.env.CCCID || 'ac0';				// Unique name of instance
const DESC	 	= process.env.CCCDESC || 'No description';	// Description of the instance (string)
const WSSPORT 	= parseInt(process.env.CCCWSSPORT) || 8000;	// Port used for WebSocket
const SERIAL 	= process.env.CCCSERIAL || '/dev/ttyUSB0';	// Serial port to be used (/dev/ttyXXXX or COMx)
const BAUDS 	= parseInt(process.env.CCCBAUDS) || 9600;	// Serial port speed in bauds (4800 or 9600)
const DEBUG 	= process.env.CCCDEBUG || false;			// Trace all client's activity (heavy debug)
const TIMEOUT 	= parseInt(process.env.CCCTIMEOUT) || 10;	// Timeout waiting for serial port (in seconds)
const PASS 		= process.env.CCCPASS || '';				// Password for authentification
const MODEL 	= process.env.CCCMODEL || '';				// Internal Autochanger model ID
const LPID 		= parseInt(process.env.CCCLPID) || 1;		// Left Player ID (0 or more)
// TLS additions
const USESSL	= parseInt(process.env.CCCSSL) || 0;			// SSL enabled or disabled (default)
const CERTFILE	= process.env.CCCSSLCERT || "cert.pem";			// Certificate filename
const SSLDIR	= process.env.CCCSSLDIR || "/opt/cccpivot/";	// Dir. of certificate and private key (.pem files)
const KEYFILE	= process.env.CCCSSLKEY || "key.pem";			// Private key filename
const PASSPHR	= process.env.CCCPASSPHR || "cccpivot";			// Passphrase for private key

// UART options (fixed too)
const SERIAL_OPEN_OPTIONS = {autoOpen: false, baudRate: BAUDS, dataBits: 8, parity: 'none', stopBits: 1};
// Maximum Pioneer Autochanger command line length
const CAC_COMMAND_MAX_LENGTH = 20;

// Required core/packages/modules & global objects
let WebSocketServerMod = require("ws").Server;
let SerialPortMod = require('serialport');
let sprintf = require("sprintf-js").sprintf;
let os = require('os');
let logger = require('logger').createLogger();
let events = require('events');
let em = new events.EventEmitter();
let fs = require('fs');
let https = require('https');

// Global vars
let httpsServer = null;				// Object - HTTPS Server (Used only in TLS mode)
let wss = null;						// Object - WebSockerServer 
let serial = null;					// Object - SerialPort 
let clients = {};					// Object - Clients collection
let commandsQueue = [];				// Array - Queue - commands objects
let processingQueue = false;		// Boolean - Queue processing is running or not
let clientIDCounter = 1;			// Integer - Incremental client ID
let serialLock = false;				// Boolean - Serial Port lock flag
let serialPortOK = false;			// Boolean - Serial Port opened OK flag
let readFromSerial = "";			// String - Buffer, read chars from the serial port
let timeoutSerialTimer = null;		// Object - Timer for serial read timeout
let startupTimestamp = new Date();	// Date - Startup time of this instance
let currentCommand = undefined;		// Object - Current proceeded command (client + command string + flag)
let hrstart, hrend;					// Serial performance mesurement

// TLS initialization
let privateKey, certificate, credentials;
if (USESSL == 1) {
	privateKey = fs.readFileSync(`${SSLDIR}${KEYFILE}`, 'utf8');
	certificate = fs.readFileSync(`${SSLDIR}${CERTFILE}`, 'utf8');
	credentials = { key: privateKey, cert: certificate, passphrase: PASSPHR };
}

// ################################# Main program #################################
// ################################# Main program #################################
// ################################# Main program #################################

const main = () => {
	// Init events
	// When the jukebox answers on the serial port, send the reply via websocket.
	em.on('SerialReadEvent', (data) => {
		wssSendSerialReply(data);
	});
	// When a jukebox response was send, check if there is another one again and again
	em.on('SerialRepliedEvent', () => {
		proceedSerialCommandsQueue();
	});
	// Idem above but in can of timeout was reached, check if there is another one again and again
	em.on('SerialTimeOutExpiredEvent', () => {
		proceedSerialCommandsQueue();
	});
	// When a jukebox command was added to the queue, processing it now
	em.on('SerialCommandArrivedEvent', () => {
		proceedSerialCommandsQueue();
	});
	// Enable debug or info only
	if (DEBUG == 1) {
		logger.setLevel('debug');
	} else {
		logger.setLevel('info');
	}
	// Display at startup
	logger.info(`Starting ${APPNAME} ${VERSION}...`);
	logger.info(`Instance: ${PIVOTID} - ${DESC}`);
	logger.info(`Listening port for websockets: ${WSSPORT}`);
	logger.info("TLS: "+((USESSL == 1) ? 'enabled' : 'disabled'));
	logger.info(sprintf("Serial port: %s",SERIAL));
	logger.info(sprintf("Baud rate: %s",BAUDS));
	logger.info("Debug: "+((DEBUG == 1) ? 'enabled' : 'disabled'));
	logger.info(sprintf("Timeout: %s second(s)",TIMEOUT));
	logger.info("Password: "+((PASS) ? 'enabled' : 'disabled'));
	logger.info(`Autochanger model: ${MODEL}`);
	// Program initialization (instancing core objects)
	// If SSL so build the https server
	if (USESSL == 1) {
		try {
			httpsServer = https.createServer(credentials);
			httpsServer.listen(WSSPORT);
		} catch(error) {
			logger.error('Unable to start the HTTPS server! Exiting...');
			logger.fatal(error);
			process.exit(3);
		}
	}
	// Now the websocket server
	try {
		if (USESSL == 1) {
			wss = new WebSocketServerMod({server:httpsServer});
		} else {
			wss = new WebSocketServerMod({port:WSSPORT});
		}
		logger.info('Websocket TCP port successfully opened.');
	}
	catch(error) {
		logger.error('Unable to start the WebSocket server! Exiting...');
		logger.fatal(error);
		process.exit(1);
	}
	// Now the serial port object
	try {
		serial = new SerialPortMod(SERIAL, SERIAL_OPEN_OPTIONS);
		serial.open( (err) => {
			if (err) {
				logger.error(`Unable to access the serial port ${SERIAL}! Exiting...`);
				logger.fatal(err);
				process.exit(2);
			} else {
				return 0;
			}});
		serial.on('error', function(err) {
			serialPortOK = false;
			logger.error(err.message);
		});
		serial.on('open', () => {
			logger.info('Serial port successfully opened.');
			serialPortOK = true;
		});
		serial.on('close', () => {
			serialPortOK = false;
			logger.info('Serial port successfully closed or lost.');
		});
	}
	catch(error) {
		logger.error(`Problem with the serial port ${SERIAL}! Exiting...`);
		logger.fatal(error);
		process.exit(2);
	}
	/* Callback function on serial data arrival */
	serial.on('data', (data) => {
		s = data.toString();
		// Read buffer
		for (let i = 0; i < s.length; i++) {
			c = s.charAt(i);
			// CR = Response from autochanger is complete
			if (c == "\r") {
				hrend = process.hrtime(hrstart);
				logger.debug(`Read from serial: ${readFromSerial} in ${Math.round(hrend[1] / 1000000)}ms`);
				// Serial read terminated - Emit an event to send the resppnse to client.
				em.emit('SerialReadEvent', readFromSerial);
				readFromSerial = "";
			} else {
				readFromSerial += c;
			}
		}
	});

	wss.on('connection', function connecting(ws) {
		let client = new Object();
		client.clientId = clientIDCounter;
		client.socket = ws;
		clients[clientIDCounter] = client;
		client.unlocked = (PASS == '');
		clientIDCounter++;
		logger.debug(`New client ${String(client.clientId)} comes.`)
		ws.on("message", (e) => {
			try {
				let jsonMessage=JSON.parse(e);
				// Reformat the command
				client.com = jsonMessage.com.toUpperCase().trim().replace(/(\r\n|\n|\r)/gm, "");
				client.flag = jsonMessage.flag;
				logger.debug(`Received from client ${client.clientId}: ${client.com}`);
				if (client.com.charAt(0) == '/') {
					// The command begins with / so it's an internal command
					proceedInternalCommand(client);
				} else {
					if (!client.unlocked) {
						wssSendDirectReply(client, 'NOPASS', 2);
					} else {
						let newCommands = client.com.split(';');
						newCommands.forEach( (aCommand) => {
							if (aCommand != "") {
								let newCommandObj = {};
								newCommandObj.client = client;
								newCommandObj.command = aCommand;
								newCommandObj.flag = jsonMessage.flag;
								// Add to the queue & manage prioritization
								(jsonMessage.pri) ? commandsQueue.unshift(newCommandObj) : commandsQueue.push(newCommandObj);
								// Emit an event to proceed the queue if possible 
								em.emit('SerialCommandArrivedEvent');
							}
						});

					}
				}
			} catch (err) {
				// Error when receiving a websocket message. Log & ignore.
				logger.error(err);
			}
		})
		ws.on("close", function closing() {
			delete clients[client.clientId];
			logger.debug(`Client ${String(client.clientId)} gone.`)
			logger.debug(`Remaining clients: ${String(Object.keys(clients).length)}.`)
			});
	});
	// Trap SIGTERM signal to terminate process properly.
	process.on('SIGTERM', function () {
		logger.info("SIGTERM received.");
		logger.info(`${APPNAME} is closing...`);
		serial.close();
	  	wss.close(function () {
		logger.info(`Good bye!`);
	    process.exit(0);
	  });
	});
	logger.info(`${APPNAME} is ready!`);
}
main();

// ################################# Functions #################################
// ################################# Functions #################################
// ################################# Functions #################################

/** Answer to client the result of a autochanger command (from serial) */
function wssSendSerialReply(answerToReply) {
    // Suppress fuzzy chars
    answerToReply = answerToReply.trim().replace(/[^\x00-\x7F]/g, "");
	// Build response
	let json = {'com' : currentCommand.command, 'flag' : currentCommand.flag, 'res' : answerToReply, 'err' : 0};
	try {
		// Check if client is still here
		if (currentCommand.client.socket.readyState === currentCommand.client.socket.OPEN) {
			currentCommand.client.socket.send(JSON.stringify(json));
			logger.debug(`Replied to client ${currentCommand.client.clientId} about ${currentCommand.command}: ${answerToReply}`);
		} else {
			logger.debug(`Client ${currentCommand.client.clientId} has closed the connection before sending the response.`);
		}
	} catch (err) {
		logger.error(err);
	}
	// Release the serial port & clean timeout timer
	serialLock = false;
	clearTimeout(timeoutSerialTimer);
	// Emit events the serial response was send and now it's ready for proceed a new command
	em.emit('SerialRepliedEvent');
}

/** Answer to client a direct (internal) command result (without serial) */
function wssSendDirectReply(client, answerToReply, numError) {
	let json = {'com' : client.com, 'flag' : client.flag, 'res' : answerToReply, 'err' : numError};
	try {
		client.socket.send(JSON.stringify(json));
		logger.debug(`Replied to client ${client.clientId} (${client.com}): ${answerToReply}`);
	} catch (err) {
		// Error can happen when sending a websocket message. Log & ignore. Often violent client disconnection.
		logger.error(err);
	}
}

/** Called when no response from serial port during more of timeout duration */
function serialTimeoutExpired() {
	hrend = process.hrtime(hrstart);
	try {
		if (currentCommand.client.socket.readyState === currentCommand.client.socket.OPEN) {
			json = {'com' : currentCommand.command, 'flag' : currentCommand.flag, 'res' : '', 'err' : 3};
			currentCommand.client.socket.send(JSON.stringify(json));
		} else {
			logger.debug(`Client ${currentCommand.client.clientId} has closed the connection before sending the response.`);
		}
	} catch (err) {
		// Error can happen when sending a websocket message. Log & ignore. Often violent client disconnection.
		logger.error(err);
	}
	logger.debug(sprintf('Timeout of %1$d seconds reached for client %2$d. Command %1$s aborted.',TIMEOUT,currentCommand.client.clientId,currentCommand.command));
	serialLock = false;
	// Emit events the serial response was send and now it's ready for proceed a new command in the queue
	em.emit('SerialTimeOutExpiredEvent');
}

/** Called to handle an internal command */
function proceedInternalCommand(client) {
	// According to the command received, give the right response.
	switch(client.com) {
		case '/AUTH':
			wssSendDirectReply(client, (PASS=="") ? 'NO' : 'YES', 0);
			break;
		case '/CONN':
			wssSendDirectReply(client, client.clientId, 0);
			break;
		case '/COUNTCLI':
			wssSendDirectReply(client, Object.keys(clients).length, 0);
			break;
		case '/COUNTQUEUE':
			wssSendDirectReply(client, commandsQueue.length, 0);
			break;
		case '/DESC':
			wssSendDirectReply(client, DESC, 0);
			break;
		case '/HOST':
			wssSendDirectReply(client, os.hostname(), 0);
			break;
		case '/JID':
			wssSendDirectReply(client, PIVOTID, 0);
			break;
		case '/LPID':
			wssSendDirectReply(client, LPID, 0);
			break;
		case '/MODEL':
			wssSendDirectReply(client, MODEL, 0);
			break;
		case '/PASS':
			// Client send a passord.
			// Authentication is necessary ?
			if (PASS) {
				// Yes, check the password
				if (PASS == jsonMessage.val) {
					// Right password, unlock this client
					client.unlocked = true;
					wssSendDirectReply(client, 'OK', 0);
				} else {
					// Fail, wrong password
					wssSendDirectReply(client, 'KO', 1);
				}
			}
			break;
		case '/PING':
			wssSendDirectReply(client, 'PONG', 0);
			break;
		case '/PORT':
			wssSendDirectReply(client, WSSPORT, 0);
			break;
		case '/SERIAL':
			wssSendDirectReply(client, SERIAL, 0);
			break;
		case '/SERIALOK':
			wssSendDirectReply(client, serialPortOK, 0);
			break;
		case '/SERIALRECO':
			if (serialPortOK == false) {
				// Reset only if port is lost or closed.
				serial.open( (err) => {
					if (err) {
						logger.error(`Unable to access the serial port ${SERIAL}!`);
						logger.error(err);
						wssSendDirectReply(client, false, 0);
					} else {
						logger.info(`The serial port ${SERIAL} has been successfully opened!`);
						wssSendDirectReply(client, true, 0);
					}});
			} else {
				// No reset needed, all is OK, code error 5
				wssSendDirectReply(client, false, 5);
			}
			break;
		case '/START':
			wssSendDirectReply(client, startupTimestamp, 0);
			break;
		case '/TIMEOUT':
			wssSendDirectReply(client, TIMEOUT, 0);
			break;
		case '/VERSION':
			wssSendDirectReply(client, VERSION, 0);
			break;
		default:
			// This internal command is not known. Error code 6 returned.
			wssSendDirectReply(client,"NOT UNDERSTAND", 6);
			break;
	}
}

/** Processing the commands queue (to send to the autochanger) */
function proceedSerialCommandsQueue() {
	/* If processing is already in progress 
	and the serial port is already occupied by the execution
	of a previous command wait the next event firing */
	if (processingQueue == false && serialLock == false) {
		// Check if the queue is not empty
		if (commandsQueue.length > 0) {
			// OK, lock !
			processingQueue = true;
			currentCommand = commandsQueue.shift();
			// Check if the concerned client is still there
			if (clients[currentCommand.client.clientId]) {
				// OK, now check command maximum length
				if (currentCommand.command.length > CAC_COMMAND_MAX_LENGTH) {
					// Replies gently.
					logger.debug( `Autochanger command '${currentCommand.command}' exceeds the maximum length! Code 7 returned to client.`);
					json = {'com':currentCommand.command, 'flag':currentCommand.flag, 'res':'', 'err' : 7};
					currentCommand.client.socket.send(JSON.stringify(json));
				} else {
					// Next, check if the serial port is OK or not ?
					if (serialPortOK == false) {
						logger.debug("Serial port is not OK! Code 4 returned to client.");
						json = {'com':currentCommand.command, 'flag':currentCommand.flag, 'res':'', 'err' : 4};
						currentCommand.client.socket.send(JSON.stringify(json));
					} else {
						logger.debug(`Executing ${currentCommand.command} ...`);
						serialLock = true; // Lock the serial port
						timeoutSerialTimer = setTimeout(serialTimeoutExpired, TIMEOUT * 1000); // Enable the timeout timer
						serial.write(currentCommand.command + '\r');
						hrstart = process.hrtime();
					}
				}
			}
		}
		processingQueue = false;
	}
}