# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
