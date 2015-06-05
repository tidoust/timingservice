# Timing Service

This repository contains the source code of a prototype implementation in Node.js using a WebSocket server of an **online timing resource** as defined in the draft [Timing Object](http://webtiming.github.io/timingobject/) specification developed by the [Multi-Device Timing Community Group](http://www.w3.org/Community/webtiming) in W3C.

**Important:** This is **work in progress** and **prototyping**. The code may not run properly and is only really meant to be used for testing. The initial goal is to explore the interfaces that need to be exposed and defined in the Timing Object specification, not necessarily to provide an accurate implementation of the spec. In particular, the clock synchronization mechanism implemented so far is crude and probably yields very bad results.

## How to install

To install the code, make sure you have git and Node.js installed on your machine and run the following commands in some command-line window to clone the repository and install all needed dependencies:

```bash
git clone https://github.com/tidoust/timingservice.git
cd timingservice
npm install
```

## How to use

The code runs in a Node.js environment. To run the socket example:

1. run `node src/server.js` in some command-line window to start the socket server locally
2. run `node examples/sockettiminglistener.js` in *another* command-line window to start a client that connects to the socket server and listens to all changes made to a particular timing object (this step is optional)
3. run `node examples/sockettiming.js` in *yet another* command-line window to start a client that connects to the socket server, runs a couple of update actions on the underlying timing object, and exits afterwards.

**NB:** The client code should eventually run in a Web browser as well with require.js. However, this has not been tested yet and some adjustments probably need to be made to get rid of the WebSockets library. See the TODO list below.


## Notes on the code

The different classes used in the code are in the `src` folder. The code is highly modular, using abstract base classes and classes that derive from them. That was done on purpose to explore the interfaces to expose in the specification and understand how concepts may be presented.

In particular, a timing object may either be associated with a `LocalTimingProvider`, when motion is managed locally, or with a `SocketTimingProvider` to connect to an online timing resource

When a `SocketTimingProvider` instance is created, it creates a Web socket connection to the given URL and creates a `SocketSyncClock` associated with that connection to adjust the timestamps that the server sends based on an estimation of the local clock's skew relative to that of the server.

The code uses [Woodman](http://joshfire.github.io/woodman/index.html) to output logs when it runs. You may change Woodman's configuration in `src/woodmanConfig.js` to log more things or to stop logging altogether.


## On the TODO list

* Add missing properties on the timing object or drop them from the spec
* Adjust the code for timing objects to run in a browsing context
* Implement range intervals
* Create more useful examples
* Explore how timing objects can be used to control media elements (e.g. a video)
* Improve the clock synchronization mechanism, be it only to take round trip times into account

## License

The source code is available under the <a href="http://www.w3.org/Consortium/Legal/2002/copyright-software-20021231">W3C Software license</a>.</p>

## Contact

For feedback on the timing object, use the [public-webtiming@w3.org](mailto:public-webtiming@w3.org) mailing-list (with [public archive](http://lists.w3.org/Archives/Public/public-webtiming/)) or get in touch with [Francois Daoust](mailto:fd@w3.org) if you do not wish your comment to appear in public.

Feel free to use the issue tracker to report bugs and feature requests.

## Acknowledgments

This work was done with support from the European Commission under grant agreement no: 610404 ([MediaScape](http://www.mediascapeproject.eu/)).