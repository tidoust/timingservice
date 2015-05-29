/**
 * @file A Media State Vector is an object that describes uni-dimensional
 * motion in real time.
 *
 * The motion is described by four real numbers [p, v, a, t] representing
 * the position (p), velocity (v), and acceleration (a) at time (t).
 *
 * The time (t) is expressed in seconds. The position unit is entirely up to
 * the application. The velocity is in position units per second, and the
 * acceleration in position units per second squared.
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var woodman = require('woodman');
  var logger = woodman.getLogger('msv');

  /**
   * Default constructor for a media state vector
   *
   * @class
   * @param {Object} vector The initial motion vector
   * @param {Number} vector.position The initial position (0.0 if null)
   * @param {Number} vector.velocity The initial velocity (0.0 if null)
   * @param {Number} vector.acceleration The initial acceleration (0.0 if null)
   * @param {Number} vector.timestamp The initial time in seconds (now if null)
   */
  var MediaStateVector = function (vector) {
    vector = vector || {};

    /**
     * The position of the motion along its axis.
     *
     * The position unit may be anything.
     */
    this.position = vector.position || 0.0;

    /**
     * The velocity of the motion in position units per second.
     */
    this.velocity = vector.velocity || 0.0;

    /**
     * The acceleration of the motion in position units per second squared.
     */
    this.acceleration = vector.acceleration || 0.0;

    /**
     * The local time in milliseconds when the position, velocity and
     * acceleration are evaluated.
     */
    this.timestamp = vector.timestamp || (Date.now() / 1000.0);

    logger.info('created', this);
  };


  /**
   * Computes the position along the uni-dimensional axis at the given time
   *
   * @function
   * @param {Number} timestamp The reference time in seconds
   */
  MediaStateVector.prototype.computePosition = function (timestamp) {
    var elapsed = timestamp - this.timestamp;
    var result = this.position +
      this.velocity * elapsed +
      0.5 * this.acceleration * elapsed * elapsed;
    logger.log('compute position returns', result);
    return result;
  };


  /**
   * Computes the velocity along the uni-dimensional axis at the given time
   *
   * @function
   * @param {Number} timestamp The reference time in seconds
   */
  MediaStateVector.prototype.computeVelocity = function (timestamp) {
    var elapsed = timestamp - this.timestamp;
    var result = this.velocity +
      this.acceleration * elapsed;
    logger.log('compute velocity returns', result);
    return result;
  };


  /**
   * Computes the acceleration along the uni-dimensional axis at the given time
   *
   * Note that this function merely exists for symmetry with computePosition and
   * computeAcceleration. In practice, this function merely returns the vector's
   * acceleration which is unaffected by time.
   *
   * @function
   * @param {Number} timestamp The reference time in seconds
   */
  MediaStateVector.prototype.computeAcceleration = function (timestamp) {
    logger.log('compute acceleration returns', this.acceleration);
    return this.acceleration;
  };


  /**
   * Overrides toString to return a meaningful string serialization of the
   * object for logging
   *
   * @function
   * @returns {String} A human-readable serialization of the vector
   */
  MediaStateVector.prototype.toString = function () {
    return '(position=' + this.position +
      ', velocity=' + this.velocity +
      ', acceleration=' + this.acceleration +
      ', timestamp=' + this.timestamp + ')';
  };


  // Expose the Media State Vector constructor
  return MediaStateVector;
});