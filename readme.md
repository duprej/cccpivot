# CCCpivot

Introduction
----
[CCC = CAC Control Center](https://github.com/duprej/ccc). CAC is an accronym for dedicated Pioneer CD Autochangers.
CCCpivot provides communication with Pioneer CAC autochangers in webbrowsers through a websocket.
Pioneer CAC jukeboxes are designed to be connected to a computer with a serial console cable. C, VB, Java, C# or Pascal language applications has libraries to access serial ports and send/receive datas with it. But web-browsers don't, they only can do XHR or websockets. CCCpivot is here to make a bridge between RS-232 physical connection and the TCP/web world. 

How it works ?
----
CCCpivot is a simple Node.js script witch provides a TCP server to pass commands (via JSON messages) to a Pioneer CAC jukebox connected on a serial port and sends the result. One instance of the Node.js script is necessary for each jukebox (each serial connection). Many instances have to be launched if you have many autochangers to control. Each instance is separated with his own serial port and his own TCP port.
|Instance|Description|Serial port|TCP port
---|---|---|---
|Instance 1|Autochanger 1|/dev/ttyUSB0|port 8000
|Instance 2|Autochanger 2|/dev/ttyUSB1|port 8001
|Instance 3|Autochanger 3|/dev/ttyUSB2|port 8002

I recommand launching CCCpivot processes with the [CCClauncher Perl script](https://github.com/duprej/ccclauncher). But can be used without (standalone).

Benefits ?
----
This is the most flexible solution for any application to simply access Pioneer CAC autochangers because there is no need to have the autochangers connected directly to the computer which run the application. Juboxes can be far away in LAN or WAN, handled through Ethernet, Wi-Fi, VPN (/!\ latency), etc...

At the beginning
----
When I purchased my two CAC-V3000 autochangers I planned to develop a traditionnal software with Lazarus (Windows and Linux compatible) with PostgreSQL DB. But some people give me the idea to make a web-based software and the serial connection was the real problem. So the CCCpivot can be used by both because binary compiled applications can also acces webservices as well as web-browsers.

Drawbacks - Limitations
----
Not easy to install. No RPM or deb packages are provided for the moment (I have to focus my time on webapps dev).
Only compatible with Pioneer CAC autochangers. Other brands are not supported.

Files
----

|File|Description
---|---
|/opt/cccpivot/|Application directory
|/opt/cccpivot/pivot.js|Node.js server script. (Needs positionning environment variables before launch)
|/opt/cccpivot/doc/cccPivotCommands.ods|LibreOffice spreadsheet describing JSON websocket protocol
|/opt/cccpivot/doc/cccPivotHowItWorks.odt|LibreOffice document with some explanations

CCCpivot Node.js script standalone usage (without CCClauncher)
----
* Step 1 - Position environment - export these CCCxxxxx variables:

```console
export CCCID='jb1'                  # Unique name of instance (string)
export CCCDESC='Studio 3 - Left'	# Description of the instance (string)
export CCCWSSPORT=8000 				# Port used for WebSocket Server (Serial port commands)
export CCCSERIAL='/dev/ttyUSB1'		# Serial port to be used /dev/ttyXXXX
export CCCBAUDS=9600				# Serial port speed (4800 or 9600)
export CCCDEBUG=true				# Trace all clients activity (commands) for debug
export CCCTIMEOUT=12				# Timeout waiting for serial port (in seconds)
export CCCPASS=changeme				# Password for authenticate, leave empty for no protection
export CCCMODEL=v3000 				# Internal model ID string ['v3000','v3200','v5000','v180m']
export CCCLPID=1					# Left Player ID (0 for v180m model)
```

* Step 2 - Launch the script as you want (nohup, &, >, 2>&1)
node /opt/cccpivot/pivot.js

Installation on Linux (in terminal)
----
All CCC modules are located in /opt directory by default.

Install the latest Active LTS Node.js release

https://en.wikipedia.org/wiki/Node.js#Releases

https://www.instructables.com/id/Install-Nodejs-and-Npm-on-Raspberry-Pi/

https://github.com/nodesource/distributions/blob/master/README.md

Make sure all is OK.

```console
node -v
v10.19.0
npm -v
6.14.4
```
Download the latest version:

```console
sudo -- bash  -c 'cd /opt;git clone https://github.com/duprej/cccpivot'
```

Install dependencies:

```console
sudo -- bash  -c 'cd /opt/cccpivot/;npm install'
```

Check :

```console
sudo ls -R /opt/cccpivot/
```

TLS usage (optional)
----

This is a more complicated way. Not needed for home/local environment.

Additionnal optional SSL/TLS vars (WS -> WSS):

```console
export CCCSSL=1					    # Use SSL/TLS (HTTPS)
export CCCSSLDIR=/opt/cccpivot/	    # Directory of .pem files
export CCCSSLCERT=cert.pem		    # Certificate filename
export CCCSSLKEY=key.pem		    # Private key filename
export CCCPASSPHR=cccpivot		    # Passphrase for private key
```

Generating self-signed certificate for 2 years:

```console
sudo su -
cd /opt/cccpivot/
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 730
```
If you plan to use apache2, make a private key without the passphrase:

```console
cd /opt/cccpivot/
openssl rsa -in key.pem -out key2.pem
```

Don't forget to:
- check configuration in ssl section of the launcher.cfg file in CCClauncher module,
- configure changers.csv in CCClauncher (useTLS = true),
- configure HTTPS on nginx & apache2 for CCCtester & CCCweb applications.