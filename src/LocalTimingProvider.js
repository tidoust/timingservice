/**
 * @file A timing provider object associated with the local clock.
 *
 * Timing objects that are not associated with any other timing provider object
 * are automatically associated with an instance of that class.
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var woodman = require('woodman');
  var logger = woodman.getLogger('LocalTimingProvider');

  var AbstractTimingProvider = require('./AbstractTimingProvider');
  var StateVector = require('./StateVector');
  var isNull = require('./utils').isNull;


  /**
   * Creates a timing provider
   *
   * @class
   */
  var LocalTimingProvider = function (vector, range) {
    AbstractTimingProvider.call(this, vector, range);
    this.readyState = 'open';
    logger.info('created');
  };
  LocalTimingProvider.prototype = new AbstractTimingProvider();


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
  LocalTimingProvider.prototype.update = function (vector) {
    vector = vector || {};

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
    this.vector = new StateVector(newVector);
    logger.info('update', this.vector);

    return new Promise(function (resolve, reject) {
      logger.log('update', 'done');
      resolve(newVector);
    });
  };


  // Expose the class to the outer world
  return LocalTimingProvider;
});
