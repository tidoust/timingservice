/**
 * @file A timing provider object associated with an online timing server
 * using WebSockets.
 *
 * The socket timing provider object can send 3 different types of commands to
 * the WebSockets server:
 * - info: to retrieve the current media state vector (only done to initialize
 *   the object to the right settings)
 * - update: to update the media state vector
 * - sync: to synchronize local clock with remote clock
 *
 * The socket timing provider object can receive 3 different types of responses:
 * - info: Information about the timing object on the server
 * - change: an update event, meaning the underlying vector was changed
 * - sync: response to the sync command
 *
 * The socket timing provider object does not handle the creation and deletion
 * of the online timing object it is associated with on the server. This should
 * be done in separate factory methods.
 *
 * The socket timing provider object computes an approximation of the skew
 * between the local clock and the server clock on a regular basis (several
 * times per minute). It adjusts the timestamp of change events received from
 * the server automatically based on that computation.
 *
 * The socket timing provider object tries to trigger change events only when
 * appropriate meaning it will queue events that it believes need to be
 * triggered in the future.
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var woodman = require('woodman');
  var logger = woodman.getLogger('SocketTimingProvider');

  var AbstractTimingProvider = require('./AbstractTimingProvider');
  var StateVector = require('./StateVector');
  var SocketSyncClock = require('./SocketSyncClock');
  var isNull = require('./utils').isNull;
  var stringify = require('./utils').stringify;
  
  var W3CWebSocket = null;
  try {
    W3CWebSocket = require('websocket').w3cwebsocket;
  }
  catch (err) {
    W3CWebSocket = window.WebSocket;
  }


  // Web Sockets ready state constants
  var CONNECTING = 0;
  var OPEN = 1;
  var CLOSING = 2;
  var CLOSED = 3;


  /**
   * Creates a timing provider
   *
   * @class
   * @param {String} url The Web socket URL of the remote timing object
   * @param {WebSocket} socket An opened Web socket to use as communication
   *   channel. The parameter is optional, the object will create the
   *   communication channel if not given.
   * @param {AbstractSyncClock} clock A clock to use for synchronization with
   *   the online server clock. If not given, a clock that uses the underlying
   *   WebSocket will be created and used.
   */
  var SocketTimingProvider = function (url, socket, clock) {
    var self = this;

    /**
     * The URL of the online object, it is used as
     * identifier in exchanges with the backend server
     */
    this.url = url;

    /**
     * The current vector as returned by the server.
     *
     * Updating the property through the setter automatically updates
     * the exposed vector as well, converting the server timestamp into
     * a local timestamp based on the underlying synchronized clock's readings
     */
    var serverVector = null;
    Object.defineProperty(this, 'serverVector', {
      get: function () {
        return serverVector;
      },
      set: function (vector) {
        var now = Date.now();
        serverVector = vector;
        self.vector = new StateVector({
          position: vector.position,
          velocity: vector.velocity,
          acceleration: vector.acceleration,
          timestamp: vector.timestamp + (now - self.clock.getTime(now)) / 1000.0
        });
      }
    });

    /**
     * List of "change" events already received from the server but
     * whose estimated timestamps lie in the future
     */
    var pendingChanges = [];

    /**
     * The ID of the timeout used to trigger the first of the remaining
     * pending change events to process
     */
    var pendingTimeoutId = null;

    /**
     * Helper function that schedules the propagation of the next pending
     * change. Note that the function calls itself as long as there are
     * pending changes to schedule.
     *
     * The function should be called whenever the synchronized clock reports
     * changes on its skew evaluation, since that affects the time at which
     * pending changes need to be executed.
     */
    var scheduleNextPendingChange = function () {
      stopSchedulingPendingChanges();
      if (pendingChanges.length === 0) {
        return;
      }

      var now = Date.now();
      var vector = pendingChanges[0];
      var localTimestamp = (vector.timestamp * 1000.0) +
        now - self.clock.getTime(now);
      logger.log('schedule next pending change',
        'delay=' + (localTimestamp - now));

      var applyNextPendingChange = function () {
        // Since we cannot control when this function runs precisely,
        // note we may have to skip over the first few changes. We'll
        // only trigger the change that is closest to now
        logger.log('apply next pending change');
        var now = Date.now();
        var vector = pendingChanges.shift();
        var nextVector = null;
        var localTimestamp = 0.0;
        while (pendingChanges.length > 0) {
          nextVector = pendingChanges[0];
          localTimestamp = nextVector.timestamp * 1000.0 +
            now - self.clock.getTime(now);
          if (localTimestamp > now) {
            break;
          }
          vector = pendingChanges.shift();
        }

        self.serverVector = vector;
        scheduleNextPendingChange();
      };

      if (localTimestamp > now) {
        pendingTimeoutId = setTimeout(
          applyNextPendingChange,
          localTimestamp - now);
      }
      else {
        applyNextPendingChange();
      }
    };


    /**
     * Helper function that stops the pending changes scheduler
     *
     * @function
     */
    var stopSchedulingPendingChanges = function () {
      logger.log('stop scheduling pending changes');
      if (pendingTimeoutId) {
        clearTimeout(pendingTimeoutId);
        pendingTimeoutId = null;
      }
    };


    /**
     * Helper function that processes the "info" message from the
     * socket server when the clock is ready.
     *
     * @function
     */
    var processInfoWhenPossible = function (msg) {
      // This should really just happen during initialization
      if (self.readyState !== 'connecting') {
        logger.warn(
          'timing info to process but state is "{}"',
          self.readyState);
        return;
      }

      // If clock is not yet ready, schedule processing for when it is
      // (note that this function should only really be called once but
      // not a big deal if we receive more than one info message from the
      // server)
      if (self.clock.readyState !== 'open') {
        self.clock.addEventListener('readystatechange', function () {
          if (self.clock.readyState === 'open') {
            processInfoWhenPossible(msg);
          }
        });
        return;
      }

      if (self.clock.delta) {
        // The info will be applied right away, but if the server imposes
        // some delta to all clients (to improve synchronization), it
        // should be applied to the timestamp received.
        msg.vector.timestamp -= (self.clock.delta / 1000.0);
      }
      self.serverVector = new StateVector(msg.vector);

      // TODO: set the range as well when feature is implemented

      // The timing provider object should now be fully operational
      self.readyState = 'open';
    };


    // Initialize the base class with default data
    AbstractTimingProvider.call(this);

    // Connect to the Web socket
    if (socket) {
      this.socket = socket;
      this.socketProvided = true;
    }
    else {
      this.socket = new W3CWebSocket(url, 'echo-protocol');
      this.socketProvided = false;
    }

    this.socket.onerror = function (err) {
      logger.warn('WebSocket error', err);
      // TODO: implement a connection recovery mechanism
    };

    this.socket.onopen = function () {
      logger.info('WebSocket client connected');
      self.socket.send(stringify({
        type: 'info',
        id: url
      }));
    };

    this.socket.onclose = function() {
      logger.info('WebSocket closed');
      self.close();
    };

    this.socket.onmessage = function (evt) {
      var msg = null;
      var vector = null;
      var now = Date.now();
      var localTimestamp = 0;

      if (typeof evt.data === 'string') {
        try {
          msg = JSON.parse(evt.data) || {};
        }
        catch (err) {
          logger.warn('message received from server could not be parsed as JSON');
          return;
        }

        if (msg.id !== url) {
          logger.log('message is for another timing object, ignored');
          return;
        }

        switch (msg.type) {
        case 'info':
          // Info received from the socket server but note that the clock may
          // not yet be synchronized with that of the server, let's wait for
          // that.
          logger.log('timing object info received', msg.vector);
          processInfoWhenPossible(msg);
          break;

        case 'change':
          if (self.readyState !== 'open') {
            logger.log('change message received, but not yet open, ignored');
            return;
          }

          // TODO: not sure what to do when the server sends an update with
          // a timestamp that lies in the past of the current vector we have,
          // ignoring for now
          if (msg.vector.timestamp < self.serverVector.timestamp) {
            logger.warn('change message received, but more ancient than current vector, ignored');
            return;
          }

          // Create a new Media state vector from the one received
          vector = new StateVector(msg.vector);

          // Determine whether the change event is to be applied now or to be
          // queued up for later
          localTimestamp = vector.timestamp * 1000.0 +
              now - self.clock.getTime(now);
          if (localTimestamp < now) {
            logger.log('change message received, execute now');
            self.serverVector = vector;
          }
          else {
            logger.log('change message received, queue for later');
            pendingChanges.push(vector);
            pendingChanges.sort(function (a, b) {
              return a.timestamp - b.timestamp;
            });
            scheduleNextPendingChange();
          }
          break;
        }
      }
    };

    // Create the clock
    if (clock) {
      this.clock = clock;
    }
    else {
      this.clock = new SocketSyncClock(url, this.socket);
      this.clock.addEventListener('change', function () {
        if (self.readyState !== 'open') {
          return;
        }
        logger.log('apply new skew to pending changes');
        scheduleNextPendingChange();
      });
    }




    // Check the initial state of the socket connection
    if (this.socket.readyState === OPEN) {
      logger.info('WebSocket client connected');
      this.socket.send(stringify({
        type: 'info',
        id: url
      }));
    }
    else if (this.socket.readyState === CLOSED) {
      logger.log('WebSocket closed');
      self.close();
    }

    logger.info('created');
  };
  SocketTimingProvider.prototype = new AbstractTimingProvider();


  /**
   * Sends an update command to the online timing service.
   *
   * @function
   * @param {Object} vector The new motion vector
   * @param {Number} vector.position The new motion position.
   *   If null, the position at the current time is used.
   * @param {Number} vector.velocity The new velocity.
   *   If null, the velocity at the current time is used.
   * @param {Number} vector.acceleration The new acceleration.
   *   If null, the acceleration at the current time is used.
   * @returns {Promise} The promise to get an updated StateVector that
   *   represents the updated motion on the server once the update command
   *   has been processed by the server.
   *   The promise is rejected if the connection with the online timing service
   *   is not possible for some reason (no connection, timing object on the
   *   server was deleted, timeout, permission issue).
   */
  SocketTimingProvider.prototype.update = function (vector) {
    vector = vector || {};
    logger.log('update',
      '(position=' + vector.position +
      ', velocity=' + vector.velocity +
      ', acceleration=' + vector.acceleration + ')');

    if (this.readyState !== 'open') {
      return new Promise(function (resolve, reject) {
        logger.warn('update', 'socket was closed, cannot process update');
        reject(new Error('Underlying socket was closed'));
      });
    }
    this.socket.send(stringify({
      type: 'update',
      id: this.url,
      vector: vector
    }));

    return new Promise(function (resolve, reject) {
      // TODO: To be able to resolve the promise, we would need to know
      // when the server has received and processed the request. This
      // requires an ack that does not yet exist. Also, should the promise
      // only be resolved when the update is actually done (which may take
      // place after some time and may actually not take place at all?)
      resolve();
    });
  };


  /**
   * Closes the timing provider object, releasing any resource that the
   * object might use.
   *
   * Note that a closed timing provider object cannot be re-used.
   *
   * @function
   */
  SocketTimingProvider.prototype.close = function () {
    if ((this.readyState === 'closing') ||
        (this.readyState === 'closed')) {
      return;
    }
    this.readyState = 'closing';
    this.clock.close();
    if (!this.socketProvided && (this.socket.readyState !== CLOSED)) {
      this.socket.close();
    }
    this.socket = null;
    this.readyState = 'closed';
  };


  // Expose the class to the outer world
  return SocketTimingProvider;
});
