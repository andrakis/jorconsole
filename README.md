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

This is currently a work in progress, and whilst the kernel boots,
there is missing functionality required for the kernel to finish
booting.


Running
--------

Ensure your npm modules are installed:

	npm install

NPM will automatically compile the worker thread, but if changes are made
you can manually recompile it via running:

	./compile

Run the emulator:

	node index.js


What works
----------

This version, based upon the latest jor1k, currently boots to a certain
point and then halts due to missing replacement functions for features
like setTimeout.


What does not work
------------------

* Everything.


Little Tricks
-------------

* Press CTRL+P to print out the CPU state
* Press CTRL+X to exit the emulator
* CTRL+C should be captured by the emulator, but under Cygwin it quits the program

Feature planning
----------------

The order of features is intended to be:

* Finish implementing missing functionality
* Finish keyboard input (currently quite a few keys dont work)
* Implement a Framebuffer device using node-canvas
* Fix input on Windows or non-TTY devices
* Networking support
* Update to use more recent version of JOR1k


	More recent version of JOR1k include faster CPU modules, better device
	support, and more features in general.


Workarounds
-----------

* W1 Workaround 1: Text input on Cygwin

	Since Cygwin and others do not provide a TTY interface, there are issues
	with the keyboard input on the emulator running under Windows.

	A workaround exists: run node from a cmd window instead. Everything seems
	to work pretty well using a standard Windows cmd interface, but is broken
	on Cygwin.

	Specifically, the input buffer takes only a single keypress, and then
	ignores the rest of the input. This means to run any command, you must
	type each character followed by a newline.

