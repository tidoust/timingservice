/**
 * @file A sequencer takes inputs from a timing object and harnesses one or
 * more HTML media elements (audio, video, media controller) accordingly.
 *
 * A sequencer exposes usual media element controls such as "play", "pause"
 * methods as well as "currentTime" and "playbackRate" attributes. Internally,
 * calling these methods or setting these attributes update the timing object's
 * state vector, which should in turn affect the HTML media elements that the
 * sequencer harnesses.
 *
 * Said differently, commands sent to a sequencer are not directly applied to
 * the HTML media elements under control. Everything goes through the timing
 * object to enable cross-device synchronization effects.
 *
 * TODO: add logic to handle buffering hiccups in media elements.
 * TODO: add logic to remove elements from the list of controlled elements.
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var woodman = require('woodman');
  var logger = woodman.getLogger('Sequencer');

  var EventTarget = require('event-target');
  var TimingObject = require('./TimingObject');
  var StateVector = require('./StateVector');


  /**
   * Constructor of a sequencer
   *
   * @class
   * @param {TimingObject} timing The timing object attached to the sequencer
   * @param {Object} options Sequencer settings
   */
  var Sequencer = function (timing, options) {
    var self = this;
    options = options || {};    

    if (!timing || (!timing instanceof TimingObject)) {
      throw new Error('No timing object provided');
    }

    /**
     * The sequencer's internal settings
     */
    var settings = {
      // Media elements are considered in sync with the timing object if the
      // difference between the position they report and the position of the
      // timing object is below that threshold (in seconds).
      minDiff: options.minDiff || 0.010,

      // Maximum delay for catching up (in seconds).
      // If the code cannot meet the maxDelay constraint,
      // it will have the media element directly seek to the right position.
      maxDelay: options.maxDelay || 1.0,

      // Amortization period (in seconds).
      // The amortization period is used when adjustments are made to
      // the playback rate of the video.
      amortPeriod: options.amortPeriod || 2.0
    };


    /**
     * The list of Media elements controlled by this sequencer.
     *
     * For each media element, the sequencer maintains a state vector
     * representation of the element's position and velocity, a drift rate
     * to adjust the playback rate, whether we asked the media element to
     * seek or not, and whether there is an amortization period running for
     * the element
     *
     * {
     *   vector: {},
     *   driftRate: 0.0,
     *   seeked: false,
     *   amortization: false,
     *   element: {}
     * }
     */
    var controlledElements = [];


    /**
     * The timing object's state vector last time we checked it.
     * This variable is used in particular at the end of the amortization
     * period to compute the media element's drift rate
     */
    var timingVector = null;


    /**
     * Pointer to the amortization period timeout.
     * The sequencer uses only one amortization period for all media elements
     * under control.
     */
    var amortTimeout = null;


    Object.defineProperties(this, {
      /**
       * Report the state of the underlying timing object
       *
       * TODO: should that also take into account the state of the controlled
       * elements? Hard to find a proper definition though
       */
      readyState: {
        get: function () {
          return timingProvider.readyState;
        }
      },


      /**
       * The currentTime attribute returns the position that all controlled
       * media elements should be at, in other words the position of the
       * sequencer when this method is called.
       *
       * On setting, the timing object's state vector is updated with the
       * provided value, which will (asynchronously) affect all controlled
       * media elements.
       *
       * Note that getting "currentTime" right after setting it may not return
       * the value that was just set.
       */
      currentTime: {
        get: function () {
          return timing.query().computePosition(Date.now() / 1000.0);
        },
        set: function (value) {
          timing.update(value, null);
        }
      },


      /**
       * The current playback rate of the sequencer (controlled media elements
       * may have a slightly different playback rate since the role of the
       * sequencer is precisely to adjust their playback rate to ensure they
       * keep up with the sequencer's position.
       *
       * On setting, the timing object's state vector is updated with the
       * provided value, which will (asynchronously) affect all controlled
       * media elements.
       *
       * Note that getting "playbackRate" right after setting it may not return
       * the value that was just set.
       */
      playbackRate: {
        get: function () {
          return timing.query().computeVelocity(Date.now() / 1000.0);
        },
        set: function (value) {
          timing.update(null, value);
        }
      }
    });


    /**
     * Start playing the controlled elements
     *
     * @function
     */
    this.play = function () {
      timing.update(null, 1.0);
    };


    /**
     * Pause playback
     *
     * @function
     */
    this.pause = function () {
      timing.update(null, 0.0);
    };


    /**
     * Add a media element to the list of elements controlled by this
     * sequencer
     *
     * @function
     * @param {MediaElement} element The media element to associate with the
     *  sequencer.
     */
    this.addMediaElement = function (element) {
      var found = false;
      controlledElements.forEach(function (wrappedEl) {
        if (wrappedEl.element === element) {
          found = true;
        }
      });
      if (found) {
        return;
      }
      controlledElements.push({
        element: element,
        vector: null,
        driftRate: 0.0,
        seeked: false,
        amortization: false
      });
    };


    /**
     * Helper function that cancels a running amortization period
     */
    var cancelAmortizationPeriod = function () {
      if (!amortTimeout) {
        return;
      }
      clearTimeout(amortTimeout);
      amortTimeout = null;
      controlledElements.forEach(function (wrappedEl) {
        wrappedEl.amortization = false;
        wrappedEl.seeked = false;
      });
    };


    /**
     * Helper function to stop the playback adjustment once the amortization
     * period is over.
     */
    var stopAmortizationPeriod = function () {
      var now = Date.now() / 1000.0;
      amortTimeout = null;

      controlledElements.forEach(function (wrappedEl) {
        // Nothing to do if element was not part of amortization period
        if (!wrappedEl.amortization) {
          return;
        }
        wrappedEl.amortization = false;

        // Don't adjust playback rate and drift rate if video was seeked
        // or if element was not part of that amortization period.
        if (wrappedEl.seeked) {
          logger.log('end of amortization period for seek');
          wrappedEl.seeked = false;
          return;
        }

        // Compute the difference between the position the video should be and
        // the position it is reported to be at.
        var diff = wrappedEl.vector.computePosition(now) -
          wrappedEl.element.currentTime;

        // Compute the new video drift rate
        wrappedEl.driftRate = diff / (now - wrappedEl.vector.timestamp);

        // Switch back to the current vector's velocity,
        // adjusted with the newly computed drift rate
        wrappedEl.vector.velocity = timingVector.velocity + wrappedEl.driftRate;
        wrappedEl.element.playbackRate = wrappedEl.vector.velocity;

        logger.log('end of amortization period',
          'new drift=' + wrappedEl.driftRate,
          'playback rate=' + wrappedEl.vector.velocity);
      });
    };



    /**
     * React to timing object's changes, harnessing the controlled
     * elements to align them with the timing object's position and velocity
     */
    var onTimingChange = function () {
      cancelAmortizationPeriod();
      controlElements();
    };


    /**
     * Ensure media elements are aligned with the current timing object's
     * state vector
     */
    var controlElements = function () {
      // Do not adjust anything during an amortization period
      if (amortTimeout) {
        return;
      }

      // Get new readings from Timing object
      timingVector = timing.query();

      controlledElements.forEach(controlElement);

      var amortNeeded = false;
      controlledElements.forEach(function (wrappedEl) {
        if (wrappedEl.amortization) {
          amortNeeded = true;
        }
      });

      if (amortNeeded) {
        logger.info('start amortization period');
        amortTimeout = setTimeout(stopAmortizationPeriod, settings.amortPeriod * 1000);
      }

      // Queue a task to fire a simple event named "timeupdate"
      setTimeout(function () {
        self.dispatchEvent({
          type: 'timeupdate'
        }, 0);
      });
    };


    /**
     * Ensure the given media element (wrapped in info structure) is aligned
     * with the current timing object's state vector
     */
    var controlElement = function (wrappedEl) {
      var element = wrappedEl.element;
      var diff = 0.0;
      var futurePos = 0.0;

      if ((timingVector.velocity === 0.0) &&
          (timingVector.acceleration === 0.0)) {
        logger.info('stop element and seek to right position');
        element.pause();
        element.currentTime = timingVector.position;
        wrappedEl.vector = new StateVector(timingVector);
      }
      else if (element.paused) {
        logger.info('play video');
        wrappedEl.vector = new StateVector({
          position: timingVector.position,
          velocity: timingVector.velocity + wrappedEl.driftRate,
          acceleration: 0.0,
          timestamp: timingVector.timestamp
        });
        wrappedEl.seeked = true;
        wrappedEl.amortization = true;
        element.currentTime = wrappedEl.vector.position;
        element.playbackRate = wrappedEl.vector.velocity;
        element.play();
      }
      else {
        wrappedEl.vector = new StateVector({
          position: element.currentTime,
          velocity: wrappedEl.vector.velocity,
        });
        diff = timingVector.position - wrappedEl.vector.position;
        if (Math.abs(diff) < settings.minDiff) {
          logger.info('video and vector are in sync!');
        }
        else if (Math.abs(diff) > settings.maxDelay) {
          logger.info('seek video to pos={}', timingVector.position);
          wrappedEl.vector.position = timingVector.position;
          wrappedEl.vector.velocity = timingVector.velocity + wrappedEl.driftRate;
          wrappedEl.seeked = true;
          wrappedEl.amortization = true;
          element.currentTime = wrappedEl.vector.position;
          element.playbackRate = wrappedEl.vector.velocity;
        }
        else {
          futurePos = timingVector.computePosition(
            timingVector.timestamp + settings.amortPeriod);
          wrappedEl.vector.velocity =
            wrappedEl.driftRate +
            (futurePos - wrappedEl.vector.position) / settings.amortPeriod;
          wrappedEl.amortization = true;
          element.playbackRate = wrappedEl.vector.velocity;
          logger.info('new playbackrate={}', wrappedEl.vector.velocity);
        }
      }
    };
    

    /**********************************************************************
    Listen to the timing object
    **********************************************************************/
    logger.info('add listener to "timeupdate" events...');
    timing.addEventListener('timeupdate', controlElements);
    timing.addEventListener('change', onTimingChange);
    logger.info('add listener to "timeupdate" events... done');

    logger.info('add listener to "readystatechange" events...');
    timing.addEventListener('readystatechange', function (evt) {
      self.dispatchEvent(evt);
    });
    logger.info('add listener to "readystatechange" events... done');

    logger.info('created');
  };


  // Sequencer implements EventTarget
  Sequencer.prototype.addEventListener = EventTarget.addEventListener;
  Sequencer.prototype.removeEventListener = EventTarget.removeEventListener;
  Sequencer.prototype.dispatchEvent = EventTarget.dispatchEvent;


  // Expose the class to the outer world
  return Sequencer;
});