JorConsole
==========

About
-----

JorConsole provides a standard console IO to the JOR1K emulator.
It provides a working JOR1K emulator running on a local system,
using local IO, instead of running in a web browser.

It requires no native node modules, so can be run on systems without
a native compiler. Networking support does require a native node module,
but this is an optional dependency.

This is the modern implementation, using the current jor1k sources -
this includes bugfixes, placing the worker on a separate thread,
networking support, and a 9p filesystem.

All keyboard handling issues are resolved.

Running
--------

Ensure your npm modules are installed:

	npm install

Please also ensure you have updated your submodules, as the path used
for jor1k-sysroot has been updated to a personal fork with more features.
This fork includes all of the games and utilities (compilers, etc) for
Jor1K.

Run the emulator using:

	node index


What works
----------

This version, based upon the latest jor1k, currently boots to the shell and
waits for input. It can run any programs compiled for OR1K.

Networking support is available, provided you can build the optional
dependency websockets - if not available the emulator will continue
without networking support. This means that the only feature that requires
a native node module is networking.

What does not work
------------------

* Framebuffer
* Sound
* Saving files locally (though you can scp files)

Little Tricks
-------------

* Press CTRL+P to print out the CPU state
* Press CTRL+X to exit the emulator
* CTRL+C should be captured by the emulator, but under Cygwin it quits the program

Feature planning
----------------

The order of features is intended to be:

* Optional extras:
  * Implement a Framebuffer device using node-canvas
  * Saving and loading virtual machine state
  * Local filesystem / loop filesystem via 9p
  * Extend abilities of filesystem loader
    * Remove requirement for fs.json
* Sound
* Fix input on Windows or non-TTY devices

