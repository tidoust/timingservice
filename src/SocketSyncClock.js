/**
 * @file A clock synchronized with an online server clock over some WebSocket
 * communication channel.
 *
 * Note this implementation is stupid, it computes the skew every 5 seconds
 * without taking into account past measures and round trip times.
 *
 * TODO: consider sending more requests initially and giving priority to
 * exchanges with the fastest round trip times, see the Media State Vector
 * paper and/or the "Probabilistic clock synchronization" paper at:
 * http://www.cs.utexas.edu/users/lorenzo/corsi/cs380d/papers/Cristian.pdf
 *
 * TODO: also consider building a monotonically increasing clock
 * (meaning one that cannot "jump" backward and jumps forward gradually)
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var woodman = require('woodman');
  var logger = woodman.getLogger('SocketSyncClock');

  var AbstractSyncClock = require('./AbstractSyncClock');
  var isNumber = require('./utils').isNumber;
  var stringify = require('./utils').stringify;

  // Web Sockets ready state constants
  var CONNECTING = 0;
  var OPEN = 1;
  var CLOSING = 2;
  var CLOSED = 3;


  /**
   * Creates a Socket synchronization clock
   *
   * @class
   * @param {String} url The URL of the remote timing object for which we
   *   want to synchronize the clock (only used to check permissions)
   * @param {WebSocket} socket A Web socket to use as communication channel.
   */
  var SocketSyncClock = function (url, socket) {
    // Initialize the base class with default data
    AbstractSyncClock.call(this);

    var self = this;

    /**
     * The Web Socket that will be used to exchange sync information with
     * the online server
     */
    this.socket = socket;

    if (socket.readyState === OPEN) {
      logger.info('WebSocket already opened');
      startSync();
    }
    else if (socket.readyState === CLOSED) {
      logger.log('WebSocket closed');
      this.readyState = 'closed';
    }

    // TODO: the code below should rather use "addEventListener"
    // but the WebSockets library only support basic "onXXX" constructs
    // so the code works around that. This only works provided the
    // clock is associated with the socket after the timing provider
    // object!

    var errorHandler = this.socket.onerror;
    this.socket.onerror = function (err) {
      logger.warn('WebSocket error', err);
      // TODO: properly deal with network errors
      if (errorHandler) {
        errorHandler();
      }
    };

    var openHandler = this.socket.onopen;
    this.socket.onopen = function () {
      logger.info('WebSocket client connected');
      startSync();
      if (openHandler) {
        openHandler();
      }
    };

    var closeHandler = this.socket.onclose;
    this.socket.onclose = function () {
      logger.log('WebSocket closed');
      self.close();
      if (closeHandler) {
        closeHandler();
      }
    };

    var messageHandler = this.socket.onmessage;
    this.socket.onmessage = function (evt) {
      var msg = null;
      var received = Date.now();
      var skew = 0.0;

      if (typeof evt.data === 'string') {
        try {
          msg = JSON.parse(evt.data) || {};
        }
        catch (err) {
          logger.warn('message from server could not be parsed as JSON');
          return;
        }

        if (msg.type !== 'sync') {
          logger.log('not a sync message, pass on');
          if (messageHandler) {
            messageHandler(evt);
          }
          return;
        }

        if (!msg.client || !msg.server ||
            !isNumber(msg.client.sent) ||
            !isNumber(msg.server.received) ||
            !isNumber(msg.server.sent)) {
          logger.log('sync message received, but incomplete, ignored');
          return;
        }

        if (isNumber(msg.delta)) {
          self.delta = msg.delta;
          logger.info('sync message received', 'delta=' + self.delta);
        }

        skew = ((msg.server.sent + msg.server.received) -
            (msg.client.sent + received)) / 2.0;
        logger.info('sync message received', 'skew=' + skew);

        // Save the new skew
        // (this triggers a "change" event if value changed)
        self.skew = skew;
      }
    };


    /**
     * Method that starts computing the skew with the online server clock
     * in the background
     */
    var syncInterval = null;
    var startSync = function () {
      var sendSyncRequest = function () {
        logger.info('send a "sync" request');
        self.socket.send(stringify({
          type: 'sync',
          id: url,
          client: {
            sent: Date.now()
          }
        }));
      };
      syncInterval = setInterval(sendSyncRequest, 5000);
      sendSyncRequest();
    };

    /**
     * Method that stops the background synchronization
     */
    this.stopSync = function () {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    };

    logger.info('created');
  };
  SocketSyncClock.prototype = new AbstractSyncClock();


  /**
   * Stops synchronizing the clock with the reference clock
   *
   * Note that a closed synchronized clock object cannot be re-used.
   *
   * @function
   */
  SocketSyncClock.prototype.close = function () {
    if ((this.readyState === 'closing') ||
        (this.readyState === 'closed')) {
      return;
    }
    this.readyState = 'closing';
    this.stopSync();
    this.socket = null;
    this.readyState = 'closed';
  };


  // Expose the class to the outer world
  return SocketSyncClock;
});
