/**
 * @file A clock synchronized with an online server clock over some WebSocket
 * communication channel.
 *
 * This clock has an initialization period during it sends a batch of "sync"
 * requets to the server to compute the minimum roundtrip duration and a
 * realistic threshold for that roundtrip duration.
 *
 * The threshold is used afterward to reject sync messages that spend too much
 * time in the network (or in the client or server waiting to be processed),
 * as these messages would otherwise lead to a poor skew estimate.
 *
 * Note that this clock is not necessarily monotonic.
 *
 * This implementation borrows idea from the Media State Vector
 * paper and/or the "Probabilistic clock synchronization" paper at:
 * http://motioncorporation.com/publications/mediastatevector2012.pdf
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

  // Number of exchanges to make with the server to compute the first skew
  var initialAttempts = 10;

  // Interval between two exchanges during initialization (in ms)
  var initialInterval = 10;

  // Maximum number of attempts before giving up
  var maxAttempts = 10;

  // Interval between two attempts when the clock is open (in ms)
  var attemptInterval = 500;

  // Interval between two synchronization batches (in ms)
  var batchInterval = 10000;

  // Minimum roundtrip threshold (in ms)
  var minRoundtripThreshold = 5;


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


    /**
     * Minimum round trip detected so far (in ms)
     */
    var roundtripMin = 1000;


    /**
     * Current round trip threshold above which the "sync"
     * request is considered to be a failure (in ms)
     *
     * NB: this threshold must always be higher than the minimum round trip
     */
    var roundtripThreshold = 1000;


    /**
     * Number of "sync" attempts in the current batch so far.
     * The clock will attempt up to maxAttempts attempts in a row
     * each time it wants to synchronize
     */
    var attempts = 0;


    /**
     * Valid responses received from the server for the current batch
     */
    var initialSyncMessages = [];


    /**
     * ID of the attempt response we are currently waiting for
     */
    var attemptId = null;


    /**
     * The attempt timeout
     */
    var attemptTimeout = null;


    /**
     * Timeout to detect when the server fails to respond in time
     */
    var timeoutTimeout = null;


    if (socket.readyState === OPEN) {
      logger.info('WebSocket already opened');
      sendSyncRequest();
    }
    else if (socket.readyState === CLOSED) {
      logger.log('WebSocket closed');
      this.readyState = 'closed';
    }

    var errorHandler = function (err) {
      logger.warn('WebSocket error', err);
      // TODO: properly deal with network errors
      return true;
    };

    var openHandler = function () {
      logger.info('WebSocket client connected');
      sendSyncRequest();
      return true;
    };

    var closeHandler = function () {
      logger.log('WebSocket closed');
      self.close();
      return true;
    };

    var messageHandler = function (evt) {
      var msg = null;
      var received = Date.now();
      var skew = 0;

      if (typeof evt.data !== 'string') {
        logger.log('message from server is not a string, pass on');
        return true;
      }

      try {
        msg = JSON.parse(evt.data) || {};
      }
      catch (err) {
        logger.warn('message from server is not JSON, pass on');
        return true;
      }

      if (msg.type !== 'sync') {
        logger.log('message from server is not a sync message, pass on');
        return true;
      }

      if (!msg.client || !msg.server ||
          !isNumber(msg.client.sent) ||
          !isNumber(msg.server.received) ||
          !isNumber(msg.server.sent)) {
        logger.log('sync message is incomplete, ignore');
        return true;
      }

      if (msg.id !== attemptId) {
        logger.log('sync message is not the expected one, ignore');
        return true;
      }

      // Message is for us
      attempts += 1;

      // Compute round trip duration
      var roundtripDuration = received - msg.client.sent;

      // Check round trip duration
      if ((self.readyState !== 'connecting') &&
          (roundtripDuration > roundtripThreshold)) {
        logger.log('sync message took too long, ignore');
        return false;
      }

      if (timeoutTimeout) {
        // Cancel the timeout set to detect server timeouts.
        clearTimeout(timeoutTimeout);
        timeoutTimeout = null;
      }
      else {
        // A timeout already occurred
        // (should have normally be trapped by the check on round trip
        // duration, but timeout scheduling and the event loop are not
        // an exact science)
        logger.log('sync message took too long, ignore');
        return false;
      }

      // During initialization, simply store the response,
      // we'll process things afterwards
      if (self.readyState === 'connecting') {
        logger.log('sync message during initialization, store');
        initialSyncMessages.push({
          received: received,
          roundtrip: roundtripDuration,
          msg: msg
        });
        if (attempts >= initialAttempts) {
          initialize();
          scheduleNextBatch();
        }
        else {
          scheduleNextAttempt();
        }
        return false;
      }

      // Adjust the minimum round trip and threshold if needed
      if (roundtripDuration < roundtripMin) {
        roundtripThreshold = Math.ceil(
          roundtripThreshold * (roundtripDuration / roundtripMin));
        if (roundtripThreshold < minRoundtripThreshold) {
          roundtripThreshold = minRoundtripThreshold;
        }
        roundtripMin = roundtripDuration;
      }


      // Sync message can be directly applied
      skew = ((msg.server.sent + msg.server.received) -
          (msg.client.sent + received)) / 2.0;
      if (Math.abs(skew - self.skew) < 1) {
        skew = self.skew;
      }
      else {
        skew = Math.round(skew);
      }
      logger.info('sync message received, skew={}', skew);

      // Save the new skew
      // (this triggers a "change" event if value changed)
      self.skew = skew;

      // No need to schedule another attempt,
      // let's simply schedule the next sync batch of attempts
      scheduleNextBatch();

      return false;
    };

    // NB: calling "addEventListener" does not work in a Node.js environment
    // because the WebSockets library used only supports basic "onXXX"
    // constructs. The code below works around that limitation but note that
    // only works provided the clock is associated with the socket *after* the
    // timing provider object!
    var previousErrorHandler = this.socket.onerror;
    var previousOpenHandler = this.socket.onopen;
    var previousCloseHandler = this.socket.onclose;
    var previousMessageHandler = this.socket.onmessage;
    if (this.socket.addEventListener) {
      this.socket.addEventListener('error', errorHandler);
      this.socket.addEventListener('open', openHandler);
      this.socket.addEventListener('close', closeHandler);
      this.socket.addEventListener('message', messageHandler);
    }
    else {
      this.socket.onerror = function (evt) {
        var propagate = errorHandler(evt);
        if (propagate && previousErrorHandler) {
          previousErrorHandler(evt);
        }
      };
      this.socket.onopen = function (evt) {
        var propagate = openHandler(evt);
        if (propagate && previousOpenHandler) {
          previousOpenHandler(evt);
        }
      };
      this.socket.onclose = function (evt) {
        var propagate = closeHandler(evt);
        if (propagate && previousCloseHandler) {
          previousCloseHandler(evt);
        }
      };
      this.socket.onmessage = function (evt) {
        var propagate = messageHandler(evt);
        if (propagate && previousMessageHandler) {
          previousMessageHandler(evt);
        }
      };
    }


    /**
     * Helper function to send a "sync" request to the socket server
     */
    var sendSyncRequest = function () {
      logger.log('send a "sync" request');
      attemptId = url + '#' + Date.now();
      self.socket.send(stringify({
        type: 'sync',
        id: attemptId,
        client: {
          sent: Date.now()
        }
      }));
      attemptTimeout = null;

      timeoutTimeout = setTimeout(function () {
        attempts += 1;
        timeoutTimeout = null;
        logger.log('sync request timed out');
        if (attempts >= maxAttempts) {
          if (self.readyState === 'connecting') {
            initialize();
          }
          else {
            roundtripThreshold = Math.ceil(roundtripThreshold * 1.20);
            logger.log('all sync attempts failed, increase threshold to {}',
              roundtripThreshold);
          }
          scheduleNextBatch();
        }
        else {
          scheduleNextAttempt();
        }
      }, roundtripThreshold);
    };


    /**
     * Helper function to schedule the next sync attempt
     *
     * @function
     */
    var scheduleNextAttempt = function () {
      var interval = (self.readyState === 'connecting') ?
        initialInterval :
        attemptInterval;
      if (timeoutTimeout) {
        clearTimeout(timeoutTimeout);
        timeoutTimeout = null;
      }
      if (attemptTimeout) {
        clearTimeout(attemptTimeout);
        attemptTimeout = null;
      }
      attemptTimeout = setTimeout(sendSyncRequest, interval);
    };


    /**
     * Helper function to schedule the next batch of sync attempts
     *
     * @function
     */
    var scheduleNextBatch = function () {
      if (timeoutTimeout) {
        clearTimeout(timeoutTimeout);
        timeoutTimeout = null;
      }
      if (attemptTimeout) {
        clearTimeout(attemptTimeout);
        attemptTimeout = null;
      }
      attempts = 0;
      attemptTimeout = setTimeout(sendSyncRequest, batchInterval);
    };


    /**
     * Helper function that computes the initial skew based on the
     * sync messages received so far and adjust the roundtrip threshold
     * accordingly.
     *
     * The function also sets the clock's ready state to "open".
     *
     * @function
     */
    var initialize = function () {
      var msg = null;
      var skew = null;
      var received = 0;
      var pos = 0;

      logger.log('compute initial settings');

      // Sort messages received according to round trip
      initialSyncMessages.sort(function (a, b) {
        return a.roundtrip - b.roundtrip;
      });

      // Use the first message to compute the initial skew
      if (initialSyncMessages.length > 0) {
        msg = initialSyncMessages[0].msg;
        received = initialSyncMessages[0].received;
        roundtripMin = initialSyncMessages[0].roundtrip;

        if (isNumber(msg.delta)) {
          self.delta = msg.delta;
        }

        skew = ((msg.server.sent + msg.server.received) -
            (msg.client.sent + received)) / 2.0;
        if (Math.abs(skew - self.skew) < 1) {
          skew = self.skew;
        }
        else {
          skew = Math.round(skew);
        }
        self.skew = skew;
      }

      // Adjust the threshold to preserve at least half of the sync messages
      // that should have been received.
      pos = Math.ceil(initialAttempts / 2) - 1;
      if (pos >= initialSyncMessages.length) {
        pos = initialSyncMessages.length - 1;
      }
      if (pos >= 0) {
        roundtripThreshold = initialSyncMessages[pos].roundtrip;
      }

      // Ensure the threshold is not too low compared to the
      // known minimum roundtrip duration
      if (roundtripThreshold < roundtripMin * 1.30) {
        roundtripThreshold = Math.ceil(roundtripMin * 1.30);
      }
      if (roundtripThreshold < minRoundtripThreshold) {
        roundtripThreshold = minRoundtripThreshold;
      }

      // Clock is ready
      logger.info('clock is ready: ' +
        'skew={}, delta={}, roundtrip min={}, threshold={}',
        self.skew, self.delta, roundtripMin, roundtripThreshold);
      self.readyState = 'open';
      initialSyncMessages = [];
    };


    /**
     * Method that stops the background synchronization
     */
    this.stopSync = function () {
      if (attemptTimeout) {
        clearTimeout(attemptTimeout);
        attemptTimeout = null;
      }
      if (timeoutTimeout) {
        clearTimeout(timeoutTimeout);
        timeoutTimeout = null;
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
