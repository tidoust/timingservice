/**
 * @file A State Vector is an object that describes uni-dimensional
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
  var logger = woodman.getLogger('StateVector');

  /**
   * Default constructor for a state vector
   *
   * @class
   * @param {Object} vector The initial motion vector
   * @param {Number} vector.position The initial position (0.0 if null)
   * @param {Number} vector.velocity The initial velocity (0.0 if null)
   * @param {Number} vector.acceleration The initial acceleration (0.0 if null)
   * @param {Number} vector.timestamp The initial time in seconds (now if null)
   */
  var StateVector = function (vector) {
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
  StateVector.prototype.computePosition = function (timestamp) {
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
  StateVector.prototype.computeVelocity = function (timestamp) {
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
  StateVector.prototype.computeAcceleration = function (timestamp) {
    logger.log('compute acceleration returns', this.acceleration);
    return this.acceleration;
  };


  /**
   * Compares this vector with the specified vector for order. Returns a
   * negative integer, zero, or a positive integer as this vector is less than,
   * equal to, or greater than the specified object.
   *
   * Note that the notions of "less than" or "greater than" do not necessarily
   * mean much when comparing motions. In practice, the specified vector is
   * evaluated at the timestamp of this vector. Position is compared first.
   * If equal, velocity is compared next. If equal, acceleration is compared.
   *
   * TODO: the function probably returns differences in cases where it should
   * not because of the limited precision of floating numbers. Fix that.
   *
   * @function
   * @param {StateVector} vector The vector to compare
   * @returns {Integer} The comparison result
   */
  StateVector.prototype.compareTo = function (vector) {
    var timestamp = this.timestamp;
    var value = 0.0;

    value = vector.computePosition(timestamp);
    if (this.position < value) {
      return -1;
    }
    else if (this.position > value) {
      return 1;
    }

    value = vector.computeVelocity(timestamp);
    if (this.velocity < value) {
      return -1;
    }
    else if (this.velocity > value) {
      return 1;
    }

    value = vector.computeAcceleration(timestamp);
    if (this.acceleration < value) {
      return -1;
    }
    else if (this.acceleration > value) {
      return 1;
    }

    return 0;
  };


  /**
   * Overrides toString to return a meaningful string serialization of the
   * object for logging
   *
   * @function
   * @returns {String} A human-readable serialization of the vector
   */
  StateVector.prototype.toString = function () {
    return '(position=' + this.position +
      ', velocity=' + this.velocity +
      ', acceleration=' + this.acceleration +
      ', timestamp=' + this.timestamp + ')';
  };


  // Expose the Media State Vector constructor
  return StateVector;
});