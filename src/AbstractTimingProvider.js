/**
 * @file A timing provider object is a local object that interfaces with an
 * online timing service.
 *
 * This is an abstract base class that returns a dummy timing provider object.
 * Concrete implementations should derive this class or implement the
 * same interface. The constructor may be different in derived classes.
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var woodman = require('woodman');
  var logger = woodman.getLogger('AbstractTimingProvider');

  var EventTarget = require('EventTarget');
  var MediaStateVector = require('MediaStateVector');
  var Interval = require('Interval');


  /**
   * Creates a timing provider
   *
   * @class
   * @param {MediaStateVector} vector The initial motion vector
   * @param {Interval} range The initial range if one is to be defined
   */
  var AbstractTimingProvider = function (vector, range) {
    this.vector = new MediaStateVector(vector);
    this.range = new Interval(range);
    logger.log('created');
  };


  // Timing providers implement EventTarget
  AbstractTimingProvider.prototype.addEventListener = EventTarget.addEventListener;
  AbstractTimingProvider.prototype.removeEventListener = EventTarget.removeEventListener;
  AbstractTimingProvider.prototype.dispatchEvent = EventTarget.dispatchEvent;


  /**
   * Returns a new MediaStateVector that represents the motion's position,
   * velocity and acceleration at the current local time.
   *
   * @function
   * @returns {MediaStateVector} A new MediaStateVector object that represents
   *   the motion's position, velocity and acceleration at the current local
   *   time.
   */
  AbstractTimingProvider.prototype.query = function () {
    var time = Date.now();
    var currentVector = new MediaStateVector(
      this.vector.computePosition(time),
      this.vector.computeVelocity(time),
      this.vector.computeAcceleration(time),
      time);
    logger.log('query', currentVector);
    return currentVector;
  };


  /**
   * Fetches the current motion from the online timing service.
   *
   * @function
   * @returns {Promise} The promise to get a MediaStateVector that represents
   *   the current motion from the server. Note that the "time" property of
   *   the vector received by the server should be converted to an estimated
   *   local time.
   *   The promise is rejected if the connection with the online timing service
   *   is not possible for some reason (no connection, timing object on the
   *   server was deleted, timeout, permission issue).
   */
  AbstractTimingProvider.prototype.fetch = function () {
    logger.log('fetch');
    return new Promise(function (resolve, reject) {
      var err = new Error('Abstract "fetch" method called');
      logger.error(err);
      reject(err);
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
  AbstractTimingProvider.prototype.update = function (vector) {
    vector = new MediaStateVector(vector || {});
    logger.log('update', vector);
    return new Promise(function (resolve, reject) {
      var err = new Error('Abstract "update" method called');
      logger.error(err);
      reject(err);
    });
  };


  // Expose the class to the outer world
  return AbstractTimingProvider;
});
