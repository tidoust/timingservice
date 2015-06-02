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
 *
 * TODO: recover from temporary network failures
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
  var MediaStateVector = require('./MediaStateVector');
  var isNull = require('./utils').isNull;
  var stringify = require('./utils').stringify;
  var W3CWebSocket = require('websocket').w3cwebsocket;


  // Web Sockets ready state constants
  const CONNECTING = 0;
  const OPEN = 1;
  const CLOSING = 2;
  const CLOSED = 3;


  /**
   * Creates a timing provider
   *
   * @class
   * @param {String} url The Web socket URL of the remote timing object
   * @param {WebSocket} socket An opened Web socket to use as communication
   *   channel. The parameter is optional, the object will create the
   *   communication channel if not given.
   */
  var SocketTimingProvider = function (url, socket) {
    var self = this;

    // Save the URL of the online object, it is used as
    // identifier in exchanges with the backend server
    this.url = url;

    // Initialize the base class with default data
    AbstractTimingProvider.call(this);

    // Connect to the Web socket
    if (socket) {
      this.socket = socket;
      if (socket.readyState === OPEN) {
        logger.info('WebSocket client connected');
        this.socket.send(stringify({
          type: 'info',
          id: url
        }));
      }
      else if (socket.readyState === CLOSED) {
        logger.log('WebSocket closed');
        self.readyState = 'closed';
      }
    }
    else {
      this.socket = new W3CWebSocket(url, 'echo-protocol');
    }

    this.socket.onerror = function (err) {
      logger.warn('WebSocket error', err);
      logger.warn('TODO: implement a connection recovery mechanism');
      self.socket = null;
      self.readyState = 'closed';
    };

    this.socket.onopen = function () {
      logger.info('WebSocket client connected');
      self.socket.send(stringify({
        type: 'info',
        id: url
      }));
    };

    this.socket.onclose = function() {
      logger.log('WebSocket closed');
      self.socket = null;
      self.readyState = 'closed';
    };

    this.socket.onmessage = function (evt) {
      if (typeof evt.data === 'string') {
        logger.log('message received from server');
        var msg = null;
        try {
          msg = JSON.parse(evt.data) || {};
        }
        catch (err) {
          logger.warn('message from server could not be parsed as JSON');
          return;
        }

        if (msg.id !== url) {
          logger.log('message is for another timing object, ignored');
          return;
        }

        switch (msg.type) {
        case 'info':
          if (self.readyState === 'opening') {
            logger.log('timing object info received', msg.vector);
            self.vector = new MediaStateVector(msg.vector);
            logger.warn('TODO: set range as well');
            self.readyState = 'open';
          }
          else {
            logger.log('timing object info already known, ignored');
          }
          break;

        case 'change':
          if (self.readyState === 'open') {
            logger.log('change event received', msg.vector);
            logger.warn('TODO: convert timestamp, queue or fire');
            self.vector = new MediaStateVector(msg.vector);
          }
          else {
            logger.log('change event received, but not yet open, ignored');
          }
          break;

        case 'sync':
          logger.log('sync message received');
          logger.warn('TODO: compute skew, process queue of events as needed');
          break;

        default:
          logger.log('unknown message type received', msg.type);
        }
      }
    };

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
   * @returns {Promise} The promise to get an updated MediaStateVector that
   *   represents the updated motion on the server once the update command
   *   has been processed by the server.
   *   The promise is rejected if the connection with the online timing service
   *   is not possible for some reason (no connection, timing object on the
   *   server was deleted, timeout, permission issue).
   */
  SocketTimingProvider.prototype.update = function (vector) {
    vector = vector || {};
    logger.log('update', vector);

    if (this.readyState !== 'open') {
      return new Promise(function (resolve, reject) {
        logger.warn('update', 'socket was closed, cannot process update');
        reject(new Error('Underlying socket was closed'));
      })
    }
    this.socket.send(stringify({
      type: 'update',
      id: this.url,
      vector: vector
    }));

    return new Promise(function (resolve, reject) {
      logger.warn('TODO: wait for the "change" to be acknowledged by the server');
      logger.info('update', vector, 'done');
      resolve(newVector);
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
    this.socket.close();
  };


  // Expose the class to the outer world
  return SocketTimingProvider;
});
