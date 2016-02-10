JorConsole
==========

About
-----

JorConsole aims to provide standard console IO to the JOR1K emulator.
The goal is to get a working JOR1K emulator running on a local system,
using local IO, instead of running in a web browser.


Running
--------

Ensure your submodules are up to date:

	git submodule update --init

Then simply run index.js from the top level directory (where this file is):

	node index.js


What works
----------

The system boots into an interactive Linux session. You can run most normal
shell commands including top. The console assumes your TTY will handle all
of the text rendering (including special characters and control codes.)


What does not work
------------------

* Special keyboard keys (ctrl+ variants)
* Framebuffer
* Text input on Windows (see W1)
* Networking


Feature planning
----------------

The order of features is intended to be:

* Finish keyboard input (currently quite a few keys dont work)
* Implement a Framebuffer device using node-canvas
* Fix input on Windows or non-TTY devices
* Networking support
* Update to use more recent version of JOR1k


	More recent version of JOR1k include faster CPU modules, better device
	support, and more features in general.


Workarounds
-----------

* W1 Workaround 1: Text input on Windows

	Since Cygwin and others do not provide a TTY interface, there are issues
	with the keyboard input on the emulator running under Windows.
	Specifically, the input buffer takes only a single keypress, and then
	ignores the rest of the input. This means to run any command, you must
	type each character followed by a newline.

