JorConsole
==========

About
-----

JorConsole aims to provide standard console IO to the JOR1K emulator.

The goal is to get a working JOR1K emulator running on a local system,
using local IO, instead of running in a web browser.

Building
--------

NOTE: jor1k may fail to prepare (and therefore be removed from node_module) if
      you do not have browserify. It is not required, but to work around the
      preparation error, you must use the --force flag to npm:

          $ npm install --force

