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
   * Helper function to propagate a change event onto underlying object
   *
   * Remember to bind the function to the object on which it is to apply
   * before using it with code such as:
   *   var changeHandler = propagateChange.bind(obj);
   *
   * @function
   * @param {Event} evt Change event to propagate
   */
  var propagateChange = function (evt) {
    this.dispatchEvent('change', evt);
  };


  /**
   * Constructor of the timing object
   *
   * @class
   * @param {MediaStateVector} vector The initial motion vector
   * @param {Interval} range The initial range if one is to be defined
   */
  var TimingObject = function (vector, range) {
    /**
     * Determine whether the timing object is managed locally or through
     * a third-party timing provider
     */
    var master = true;

    /**
     * Timing provider object associated with this timing object.
     * Newly created timing object instances are associated with a
     * local timing provider to start with. Set the "srcObject" to
     * change that behavior afterwards.
     */
    var timingProvider = new LocalTimingProvider(vector, range);

    /**
     * All "change" events received from the timing provider will be
     * propagated on this object
     */
    var changeListener = propagateChange.bind(this);

    /**
     * Helper methods to start/stop dispatching time update events
     * (only triggered when the object is moving)
     *
     * Note that setInterval is bound to the event loop and thus
     * the precision of the timing update depends on the overall
     * event loop "congestion".
     *
     * TODO: note that the object cannot be garbage collected as long as
     * "timeupdate" events are being dispatched. Not sure that there is
     * much we can do here.
     */
    var self = this;
    var timeupdateInterval = null;
    var startDispatchingTimeUpdateEvents = function () {
      var delay = 5000;
      if (timeupdateInterval) { return; }
      timeupdateInterval = setInterval(function () {
        self.dispatchEvent('timeupdate');
      }, delay);
    };
    var stopDispatchingTimeUpdateEvents = function () {
      if (!timeupdateInterval) { return; }
      clearInterval(timeupdateInterval);
      timeupdateInterval = null;
    };


    /**
     * Returns a new MediaStateVector that represents the motion's position,
     * velocity and acceleration at the current local time.
     *
     * @function
     * @returns {MediaStateVector} A new MediaStateVector object that represents
     *   the motion's position, velocity and acceleration at the current local
     *   time.
     */
    this.query = function () {
      logger.log('query');
      return timingProvider.query();
    };


    /**
     * Updates the internal motion.
     *
     * If the timing object is attached to the local clock, the update operation
     * happens synchronously. If not, the update operation is asynchronous as
     * the method then relays the command to the online timing service
     * associated with this timing object.
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
    this.update = function (position, velocity, acceleration) {
      timingProvider.update({
        position: position,
        velocity: velocity,
        acceleration: acceleration
      });
      if ((velocity !== 0.0) || (acceleration !== 0.0)) {
        startDispatchingTimeUpdateEvents();
      }
      else {
        stopDispatchingTimeUpdateEvents();
      }
    };


    /**
     * Returns true when the object is moving, in other words when velocity
     * or acceleration is different from 0.0, else False
     *
     * @function
     */
    this.isMoving = function () {
      var vector = timingProvider.query();
      return (vector.velocity !== 0.0) || (vector.acceleration !== 0.0);
    };

   
    /**
     * Define the "srcObject" property
     */
    Object.defineProperties(this, {
      srcObject: {
        get: function () {
          // Do not return anything if the timing object is managed locally
          if (timing.master) {
            return null;
          }
          else {
            return timing.timingProvider;
          }
        },
        set: function (provider) {
          var previousProvider = timing.timingProvider;
          if (provider) {
            // The caller wants to associate the timing object with a
            // third-party timing provider.
            // Stop listening to the old timing provider
            if (previousProvider) {
              previousProvider.removeEventListener('change', changeListener);
            }
            timing.master = false;
            timing.timingProvider = provider;
            provider.addEventListener('change', changeListener);
          }
          else {
            // The caller wants to remove the association with a third-party
            // timing provider. The object gets back to being locally managed
            if (timing.master) {
              // The timing object is already locally managed,
              // no need to change anything
            }
            else {
              // Stop listening to the old timing provider
              if (previousProvider) {
                previousProvider.removeEventListener('change', changeListener);
              }
              timing.master = true;
              timing.timingProvider = new LocalTimingProvider(
                previousProvider.query(),
                previousProvider.range
              );
            }
          }
        }
      }
    });

    // TODO: implement "range"
    // TODO: implement "vector", "previousVector" properties (is that needed?)
    // TODO: implement "currentXXX" properties (is that needed?)
    // TODO: implement "readyState" and related change event
    // TODO: implement on... event properties

    logger.log('created');
  };


  // TimingObject implements EventTarget
  TimingObject.prototype.addEventListener = EventTarget.addEventListener;
  TimingObject.prototype.removeEventListener = EventTarget.removeEventListener;
  TimingObject.prototype.dispatchEvent = EventTarget.dispatchEvent;


  // Expose the class to the outer world
  return TimingObject;
});