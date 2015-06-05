/**
 * @file A clock synchronized with itself.
 *
 * This class should only really be used for testing.
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var AbstractSyncClock = require('./AbstractSyncClock');

  /**
   * Default constructor for a synchronized clock
   *
   * @class
   */
  var LocalSyncClock = function (initialSkew, initialDelta) {
    // Initialize the base class with default data
    AbstractSyncClock.call(this);
    this.readyState = 'open';
  };
  LocalSyncClock.prototype = new AbstractSyncClock();


  // Expose the class to the outer world
  return LocalSyncClock;
});