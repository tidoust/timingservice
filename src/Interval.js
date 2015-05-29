/**
 * @file Defines an interval
 */

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var woodman = require('woodman');
  var logger = woodman.getLogger('Interval');

  var isNumber = require('./utils').isNumber;


  /**
   * Creates an interval
   *
   * @class
   * @param {Object} range The range
   * @param {Number} range.low Lower bound of the interval
   * @param {Number} range.high Higher bound of the interval
   * @param {Boolean} range.lowInclude Whether to include the lower bound
   * @param {Boolean} range.highInclude Whether to include the higher bound
   */
  var Interval = function (range) {
    range = range || {};

    this.low = range.low;
    this.lowInclude = range.lowInclude;
    this.high = range.high;
    this.highInclude = range.highInclude;

    // Ensure low <= high
    if (isNumber(this.low) &&
        isNumber(this.high) &&
        (this.low > this.high)) {
      range.low = this.high;
      range.lowInclude = this.highInclude;
      this.high = this.low;
      this.highInclude = this.lowInclude;
      this.low = range.low;
      this.lowInclude = range.lowInclude;
    }

    logger.info('created');
  };


  /**
   * Returns true if interval covers the given value.
   *
   * @function
   * @param {Number} value Value to check
   * @returns {Boolean} true if interval covers the value
   */
  Interval.prototype.covers = function (value) {
    return (!this.low ||
        (this.low < value) ||
        ((this.low === value) && this.lowInclude)) &&
      (!this.high ||
        (this.high > value) ||
        ((this.high === value) && this.highInclude));
  };


  /**
   * Returns true if low is equal to high
   *
   * @function
   * @returns true if low is equal to high
   */
  Interval.prototype.isSingular = function () {
    return this.low === this.high;
  };


  // Expose the Interval class to the outer world
  return Interval;
});