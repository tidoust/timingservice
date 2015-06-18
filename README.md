# Timing Service

This repository contains the source code of a prototype implementation in Node.js using a WebSocket server of an **online timing resource** as defined in the draft [Timing Object](http://webtiming.github.io/timingobject/) specification developed by the [Multi-Device Timing Community Group](http://www.w3.org/Community/webtiming) in W3C.

**Important:** This is both **work in progress** and **a prototype**. The code may not run properly and is only really meant to be used for testing. The initial goal is to explore the interfaces that need to be exposed and defined in the Timing Object specification, not necessarily to provide an accurate implementation of the spec. In particular, the clock synchronization mechanism implemented so far is somewhat basic.

## How to install

To install the code, make sure you have git and Node.js installed on your machine and run the following commands in some command-line window to clone the repository and install all needed dependencies:

```bash
git clone https://github.com/tidoust/timingservice.git
cd timingservice
npm install
```

## How to use

The code is divided into two parts:

1. The `TimingObject` implementation that runs both in Web browsers and Node.js environments.
2. The online timing service implementation using WebSockets that runs in a Node.js environment.

To run the online timing service implementation locally, run `node server/server.js` in your bash. This will start the HTTP and socket server on port `8080` on `localhost`.

To run the video synchronization exampls in your Web browser, open `http://localhost:8080/examples/browser/video.html` in two different browser windows, or using your local IP address instead of localhost (beware of your firewall settings), on two different computers. You should be able to play/pause/stop the video, which should play *almost in sync* in both browser windows. The actual result depends on your machine and on the Web browser you are using. Video will likely appear more in sync than audio.

**Beware:** the demo does not yet support media buffering issues, so wait for your Web browser to complete the downloading of the video before playing. You may get a black or white screen instead of the video otherwise.

Check the `examples` folder for other (more basic) examples to run in your browser or in a Node.js environment. For instance, to run the Node.js example that uses the `TimingObject` implementation and connect to the online timing service, run `node examples/node/sockettiming.js` in *another* command-line window to start a client that connects to the socket server, runs a couple of update actions on the underlying timing object, and exits afterwards.

**NB:** The examples are still pretty rough. Remember that this is a prototype!


## Notes on the code

The different classes used in the code are in the `src` folder. The code is highly modular, using abstract base classes and classes that derive from them. That was done on purpose to explore the interfaces to expose in the specification and understand how concepts may be presented.

In particular, a timing object may either be associated with a `LocalTimingProvider`, when motion is managed locally, or with a `SocketTimingProvider` to connect to an online timing resource

When a `SocketTimingProvider` instance is created, it creates a Web socket connection to the given URL and creates a `SocketSyncClock` associated with that connection to adjust the timestamps that the server sends based on an estimation of the local clock's skew relative to that of the server.

The `TimingMediaController` class provides the glue between a timing object and a media element in HTML.

The code uses [Woodman](http://joshfire.github.io/woodman/index.html) to output logs when it runs. To log more things or to stop logging altogether, you may change Woodman's configuration used for the online timing service in `server/woodmanConfig.js`, that used for the browser examples in `examples/browser/woodmanConfig.js` and that used for the Node.js examples in `examples/node/woodmanConfig.js`.


## On the TODO list

* Add missing properties on the timing object or drop them from the spec
* Implement range intervals
* Create more useful examples


## License

The source code is available under the <a href="http://www.w3.org/Consortium/Legal/2002/copyright-software-20021231">W3C Software license</a>.</p>

## Contact

For feedback on the timing object, use the [public-webtiming@w3.org](mailto:public-webtiming@w3.org) mailing-list (with [public archive](http://lists.w3.org/Archives/Public/public-webtiming/)) or get in touch with [Francois Daoust](mailto:fd@w3.org) if you do not wish your comment to appear in public.

Feel free to use the issue tracker to report bugs and feature requests.

## Acknowledgments

This work was done with support from the European Commission under grant agreement no: 610404 ([MediaScape](http://www.mediascapeproject.eu/)).