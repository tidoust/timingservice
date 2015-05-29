/**
 * @file A timing provider object associated with an online timing server
 * using WebSockets.
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


  /**
   * Creates a timing provider
   *
   * @class
   */
  var SocketTimingProvider = function (vector, range) {
    AbstractTimingProvider.call(this, vector, range);
    logger.log('created');
  };
  SocketTimingProvider.prototype = new AbstractTimingProvider();


  /**
   * Fetches the current motion from the online timing service.
   *
   * @function
   * @returns {Promise} The promise to get a MediaStateVector that represents
   *   the current motion from the server. Note that the "time" property of
   *   the vector received by the server should be converted to an estimated
   *   local time.
   */
  SocketTimingProvider.prototype.fetch = function () {
    logger.log('fetch');
    var currentVector = this.query();
    return new Promise(function (resolve, reject) {
      logger.info('fetch', currentVector);
      resolve(currentVector);
    });
  };


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

    var timestamp = Date.now() / 1000.0;
    var newVector = {
      position: (isNull(vector.position) ?
        this.vector.computePosition(timestamp) :
        vector.position),
      velocity: (isNull(vector.velocity) ?
        this.vector.computeVelocity(timestamp) :
        vector.velocity),
      acceleration: (isNull(vector.acceleration) ?
        this.vector.computeAcceleration(timestamp) :
        vector.acceleration),
      timestamp: timestamp
    };
    this.vector = new MediaStateVector(newVector);

    logger.log('update', vector, 'dispatch "change" event');
    this.dispatchEvent({
      type: 'change',
      value: this.vector
    });

    return new Promise(function (resolve, reject) {
      logger.info('update', vector, 'done');
      resolve(newVector);
    });
  };


  // Expose the class to the outer world
  return SocketTimingProvider;
});
