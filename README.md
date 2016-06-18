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

The `asm` OR1K engine (default) includes proper timing and will sleep
when idle, providing the best emulation experience. The `safe` engine
(selectable in `index.js`) will always consume 100% cpu, but may be
more stable than the `asm` engine.

Typically however, the `asm` engine is perfectly stable.


What does not work
------------------

* Framebuffer
* Sound
* Saving files locally (though you can scp files)

Useful Key Combinations
-------------

The emulator is controlled by a special key combination, CTRL+X then a
special key. For example, pressing CTRL and X at the same time, then X.

Below are the available key sequences. Take note of the exit command, as
pressing CTRL+C will not exit the emulator.

* Press CTRL+X X to exit the emulator
* Press CTRL+X P to print out the CPU state
* Press CTRL+X I to enable an instructions-per-second counter

* CTRL+C will not exit the emulator, as it is useful in linux applications.
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

