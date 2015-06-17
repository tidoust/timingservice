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

  var EventTarget = require('event-target');
  var StateVector = require('./StateVector');
  var Interval = require('./Interval');


  /**
   * Creates a timing provider
   *
   * @class
   * @param {StateVector} vector The initial motion vector
   * @param {Interval} range The initial range if one is to be defined
   */
  var AbstractTimingProvider = function (vector, range) {
    this.range = new Interval(range);

    var currentVector = new StateVector(vector);
    var readyState = 'connecting';
    var self = this;
    Object.defineProperties(this, {
      readyState: {
        get: function () {
          return readyState;
        },
        set: function (state) {
          if (state !== readyState) {
            readyState = state;
            logger.log('ready state updated, dispatch "readystatechange" event');
            setTimeout(function () {
              // Dispatch the event on next loop to give code that wants to
              // listen to the initial change to "open" time to attach an event
              // listener (local timing provider objects typically set the
              // readyState property to "open" directly within the constructor)
              self.dispatchEvent({
                type: 'readystatechange',
                value: state
              });
            }, 0);
          }
        }
      },
      vector: {
        get: function () {
          return currentVector;
        },
        set: function (vector) {
          var previousVector = currentVector;
          currentVector = vector;
          if (previousVector.compareTo(currentVector) === 0) {
            logger.log('vector updated, same as before');
          }
          else {
            logger.log('vector updated, dispatch "change" event');
            self.dispatchEvent({
              type: 'change',
              value: currentVector
            });
          }
        }
      }
    });
    logger.info('created');
  };


  // Timing providers implement EventTarget
  AbstractTimingProvider.prototype.addEventListener = EventTarget.addEventListener;
  AbstractTimingProvider.prototype.removeEventListener = EventTarget.removeEventListener;
  AbstractTimingProvider.prototype.dispatchEvent = EventTarget.dispatchEvent;


  /**
   * Returns a new StateVector that represents the motion's position,
   * velocity and acceleration at the current local time.
   *
   * @function
   * @returns {StateVector} A new StateVector object that represents
   *   the motion's position, velocity and acceleration at the current local
   *   time.
   */
  AbstractTimingProvider.prototype.query = function () {
    var timestamp = Date.now() / 1000.0;
    var currentVector = new StateVector({
      position: this.vector.computePosition(timestamp),
      velocity: this.vector.computeVelocity(timestamp),
      acceleration: this.vector.computeAcceleration(timestamp),
      timestamp: timestamp
    });
    logger.log('query', currentVector);
    return currentVector;
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
   * @returns {Promise} The promise to get an updated StateVector that
   *   represents the updated motion on the server once the update command
   *   has been processed by the server.
   *   The promise is rejected if the connection with the online timing service
   *   is not possible for some reason (no connection, timing object on the
   *   server was deleted, timeout, permission issue).
   */
  AbstractTimingProvider.prototype.update = function (vector) {
    vector = new StateVector(vector || {});
    logger.log('update', vector);
    return new Promise(function (resolve, reject) {
      var err = new Error('Abstract "update" method called');
      logger.error(err);
      reject(err);
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
  AbstractTimingProvider.prototype.close = function () {
    if ((this.readyState === 'closing') ||
        (this.readyState === 'closed')) {
      return;
    }
    this.readyState = 'closing';
    this.readyState = 'closed';
  };


  // Expose the class to the outer world
  return AbstractTimingProvider;
});
