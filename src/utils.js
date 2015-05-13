/**
 * @file A few useful utility functions
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {

  /**
   * Returns true when parameter is null
   *
   * @function
   * @param {*} obj Object to check
   * @returns {Boolean} true if object is null, false otherwise
   */
  var isNull = function (obj) {
    return obj === null;
  };


  /**
   * Returns true when parameter is a number
   *
   * @function
   * @param {*} obj Object to check
   * @returns {Boolean} true if object is a number, false otherwise
   */
  var isNumber = function (obj) {
    return toString.call(obj) === '[object Number]';
  };


  // Expose helper functions to the outer world
  return {
    isNull: isNull,
    isNumber: isNumber
  };
});