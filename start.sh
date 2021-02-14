#Step 1 - Set environment vars
export CCCID=ac1
export CCCDESC=My jukebox
export CCCWSSPORT=8000
export CCCSERIAL=/dev/ttyUSB0
export CCCBAUDS=9600
export CCCDEBUG=1
export CCCTIMEOUT=1
export CCCPASS=
export CCCMODEL=v5000
export CCCLPID=1
export CCCPOWERGPIO=0
#Step 2 - Launch pivot server
node pivot.js
