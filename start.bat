@echo off
REM Step 1 - Set environment vars
set CCCID=ac1
set CCCDESC=My jukebox
set CCCWSSPORT=8000
set CCCSERIAL=COM9
set CCCBAUDS=9600
set CCCDEBUG=1
set CCCTIMEOUT=1
set CCCPASS=
set CCCMODEL=v3000
set CCCLPID=1
set CCCPOWERGPIO=0
REM Step 2 - Launch pivot server
node pivot.js