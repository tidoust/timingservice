/**
 * @file A timing provider factory exposes provisioning methods for managing
 * timing provider objects.
 *
 * This is an abstract implementation of a timing provider factory meant for
 * demo purpose. Timing provider implementations may follow the same interface
 * although that is by no means compulsory.
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var woodman = require('woodman');
  var logger = woodman.getLogger('TimingProviderFactory');
  var AbstractTimingProvider = require('./AbstractTimingProvider');


  /**
   * Creates a timing object on the online timing service and returns a
   * timing provider object associated with it.
   *
   * If the timing object to create has an ID that refers to an existing oject
   * on the online timing service, that object is used (and not re-created).
   *
   * @function
   * @static
   * @param {TimingObject} timingobject The timing object to create or retrieve
   *  from the online timing service.
   * @returns {Promise} The promise to get a timing provider object associated
   *   with an online timing object that matches the requested one.
   */
  TimingProviderFactory.create = function (timingobject) {
    return new Promise(function (resolve, reject) {
      var provider = new AbstractTimingProvider(timingobject);
      resolve(provider);
    });
  };


  /**
   * Deletes the online representation of the timing object on the online timing
   * service.
   *
   * @function
   * @static
   * @param {String} id The ID of the timing object to delete
   * @returns
   */
  TimingProviderFactory.delete = function (id) {
    return new Promise(function (resolve, reject) {
      resolve();
    });
  };
});
