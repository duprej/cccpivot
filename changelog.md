# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2021-01-22

### Changed

- Shortening to one letter keys in JSON messages for performance optimisation (com => c, res => r, pri => p, val => v, err => e, flag => f).

## [1.1.1] - 2021-01-17

### Added

- Changing log library from 'logger' to 'simple-node-logger'. No more compatible for Node > 10. (<https://github.com/matzehecht/koa-oas-router/issues/3>)

## [1.1.0] - 2020-12-20

### Added

- Power management internal commands for Raspberry Pi (/POWERGPIO, /POWERON, /POWEROFF & /POWERSTATE)

### Changed

- Broadcast messages for COUNTCLI, SERIAL and POWER events
- Internal timer every second to reconnect serial USB adapter, no client action needed, /SERIALRECO command removed.

### Fixed

- Bad LPID (Left Player ID) reported with V180M model. 0 becamed always 1 at starting when testing parameters.

## [1.0.1] - 2020-11-13

### Added

- Debug Log : Add left player ID information in log at startup.

### Fixed

- Authentication : Problem with /PASS command.
- Robustness : JSON message received without "com" property (message not well sent, client fault) is ignored. No more stacktraces. 

## [1.0.0] - 2020-04-18

### Added

- Debug Log : Add serial performance display (hrstart/hrend)
- Debug Log : Add logger npm module (it replace standard console.log)

### Changed

### Removed
