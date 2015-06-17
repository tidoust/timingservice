/**
 * @file A synchronized clock converts a local timestamp into the corresponding
 * value of a reference clock it is synchronized with.
 *
 * This is an abstract base class that returns a dummy clock synchronized with
 * itself (but note readyState remains at "connecting", hence the class should
 * not be used directly)
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var woodman = require('woodman');
  var logger = woodman.getLogger('AbstractSyncClock');

  var EventTarget = require('event-target');

  /**
   * Default constructor for a synchronized clock
   *
   * @class
   * @param {Number} initialSkew The initial clock skew
   * @param {Number} initialDelta The initial static delta
   */
  var SyncClock = function (initialSkew, initialDelta) {
    var self = this;

    /**
     * The current estimation of the skew with the reference clock, in ms
     */
    var skew = initialSkew || 0.0;

    /**
     * Some agreed fixed delta delay, in ms.
     */
    var delta = initialDelta || 0.0;

    /**
     * The ready state of the synchronized clock
     */
    var readyState = 'connecting';

    /**
     * Define the "readyState", "skew" and "delta" properties. Note that
     * setting these properties may trigger "readystatechange" and "change"
     * events.
     */
    Object.defineProperties(this, {
      readyState: {
        get: function () {
          return readyState;
        },
        set: function (state) {
          if (state !== readyState) {
            readyState = state;
            logger.log('ready state updated, dispatch "readystatechange" event');
            // Dispatch the event on next loop to give code that wants to
            // listen to the initial change to "open" time to attach an event
            // listener (locally synchronized clocks typically set the
            // readyState property to "open" directly within the constructor)
            setTimeout(function () {
              self.dispatchEvent({
                type: 'readystatechange',
                value: state
              });
            }, 0);
          }
        }
      },
      delta: {
        get: function () {
          return delta;
        },
        set: function (value) {
          var previousDelta = delta;
          delta = value;
          if (previousDelta === delta) {
            logger.log('delta updated, same as before');
          }
          else {
            logger.log('delta updated, dispatch "change" event');
            self.dispatchEvent({
              type: 'change'
            });
          }
        }
      },
      skew: {
        get: function () {
          return skew;
        },
        set: function (value) {
          var previousSkew = skew;
          skew = value;
          if (readyState !== 'open') {
            logger.log('skew updated, clock not open');
          }
          else if (previousSkew === skew) {
            logger.log('skew updated, same as before');
          }
          else {
            logger.log('skew updated, dispatch "change" event');
            self.dispatchEvent({
              type: 'change'
            });
          }
        }
      }
    });
  };


  // Synchronized clocks implement EventTarget
  SyncClock.prototype.addEventListener = EventTarget.addEventListener;
  SyncClock.prototype.removeEventListener = EventTarget.removeEventListener;
  SyncClock.prototype.dispatchEvent = EventTarget.dispatchEvent;


  /**
   * Returns the time at the reference clock that corresponds to the local
   * time provided (both in milliseconds since 1 January 1970 00:00:00 UTC)
   *
   * @function
   * @param {Number} localTime The local time in milliseconds
   * @returns {Number} The corresponding time on the reference clock
   */
  SyncClock.prototype.getTime = function (localTime) {
    return localTime + this.skew - this.delta;
  };


  /**
   * Returns the number of milliseconds elapsed since
   * 1 January 1970 00:00:00 UTC on the reference clock
   *
   * @function
   * @returns {Number} The current timestamp 
   */
  SyncClock.prototype.now = function () {
    return this.getTime(Date.now());
  };

  /**
   * Stops synchronization with the reference clock.
   *
   * In derived classes, this should typically be used to stop background
   * synchronization mechanisms.
   *
   * @function
   */
  SyncClock.prototype.close = function () {
    if ((this.readyState === 'closing') ||
        (this.readyState === 'closed')) {
      return;
    }
    this.readyState = 'closing';
    this.readyState = 'closed';
  };

  // Expose the class to the outer world
  return SyncClock;
});