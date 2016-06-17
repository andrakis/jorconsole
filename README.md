JorConsole
==========

About
-----

JorConsole aims to provide standard console IO to the JOR1K emulator.
The goal is to get a working JOR1K emulator running on a local system,
using local IO, instead of running in a web browser.

This is the modern implementation, using the current jor1k sources -
this includes bugfixes, placing the worker on a separate thread, and
a 9p filesystem.

This is currently a work in progress. The kernel boots and can run
interactively as you would expect. However, networking and saving
local files is not currently implemented.

Running
--------

Ensure your npm modules are installed:

	npm install

Run the emulator using:

	node index


What works
----------

This version, based upon the latest jor1k, currently boots to the shell and
waits for input. It can run any programs compiled for OR1K.


What does not work
------------------

* Networking


Little Tricks
-------------

* Press CTRL+P to print out the CPU state
* Press CTRL+X to exit the emulator
* CTRL+C should be captured by the emulator, but under Cygwin it quits the program

Feature planning
----------------

The order of features is intended to be:

* Implement a Framebuffer device using node-canvas
* Fix input on Windows or non-TTY devices
* Networking support

