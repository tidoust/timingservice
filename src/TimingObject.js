/**
 * @file A timing object exposes methods to control a motion along some
 * uni-dimensional axis.
 *
 * A timing object is either in master mode whereby the motion is controlled
 * directly and associated with the local clock, or in slave mode whereby the
 * motion is synchronized with an online timing service.
 *
 * Question: What is the preferred way to create a timing object instance on
 * the server in a model where we plug a third-party library? Should a timing
 * object have a URN for instance?
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var woodman = require('woodman');
  var logger = woodman.getLogger('TimingObject');

  var EventTarget = require('EventTarget');
  var LocalTimingProvider = require('LocalTimingProvider');


  /**
   * Constructor of the timing object
   *
   * @class
   * @param {MediaStateVector} vector The initial motion vector
   * @param {Interval} range The initial range if one is to be defined
   */
  var TimingObject = function (vector, range) {
    /**
     * Online timing service associated with the timing object.
     *
     * Unused for the time being as the protocol between the timing object
     * and an online timing service is not yet specified
     */
    this.src = null;


    /**
     * Determine whether the timing object is managed locally or through
     * a third-party timing provider
     */
    this.master = true;


    /**
     * Timing provider object associated with this timing object.
     *
     * TODO: hide the property, should not be exposed to the outer world
     *
     * @private
     */
    this.timingProvider = new LocalTimingProvider(vector, range);

    var self = this;
    var changeListener = function (evt) {
      self.dispatchEvent('change', evt);
    };
   
    Object.defineProperty(this, 'srcObject', {
      get: function () {
        // Do not return anything if the timing object is managed locally
        if (self.master) {
          return null;
        }
        else {
          return self.timingProvider;
        }
      },
      set: function (provider) {
        if (provider) {
          // The caller wants to associate the timing object with a third-party
          // timing provider.
          // Stop listening to the old timing provider
          if (self.timingProvider) {
            self.timingProvider.removeEventListener('change', changeListener);
          }
          self.master = false;
          self.timingProvider = provider;
          provider.addEventListener('change', changeListener);
        }
        else {
          // The caller wants to remove the association with a third-party
          // timing provider. The object gets back to being locally managed
          if (self.master) {
            // The timing object is already locally managed,
            // no need to change anything
          }
          else {
            // Stop listening to the old timing provider
            if (self.timingProvider) {
              self.timingProvider.removeEventListener('change', changeListener);
            }
            self.master = true;
            self.timingProvider = new LocalTimingProvider(
              self.timingProvider.query(),
              self.timingProvider.range
            );
          }
        }
      }
    });

    logger.log('created');
  };


  // TimingObject implements EventTarget
  TimingObject.prototype.addEventListener = EventTarget.addEventListener;
  TimingObject.prototype.removeEventListener = EventTarget.removeEventListener;
  TimingObject.prototype.dispatchEvent = EventTarget.dispatchEvent;


  /**
   * Returns a new MediaStateVector that represents the motion's position,
   * velocity and acceleration at the current local time.
   *
   * @function
   * @returns {MediaStateVector} A new MediaStateVector object that represents
   *   the motion's position, velocity and acceleration at the current local
   *   time.
   */
  TimingObject.prototype.query = function () {
    logger.log('query');
    return this.timingProvider.query();
  };


  /**
   * Updates the internal motion.
   *
   * If the timing object is attached to the local clock, the update operation
   * happens synchronously. If not, the update operation is asynchronous as the
   * method then relays the command to the online timing service associated
   * with this timing object.
   *
   * The "change" event is triggered when the update operation has completed.
   *
   * @function
   * @param {Number} position The new motion position. If null, the position
   *  at the current time is used.
   * @param {Number} velocity The new velocity. If null, the velocity at the
   *  current time is used.
   * @param {Number} acceleration The new acceleration. If null, the
   *  acceleration at the current time is used.
   */
  TiminObject.prototype.update = function (position, velocity, acceleration) {
    return this.timingProvider.update({
      position: position,
      velocity: velocity,
      acceleration: acceleration
    });
  };


  // Expose the class to the outer world
  return TiminObject;
});