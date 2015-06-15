/**
 * @fileoverview An Appender for Woodman that delivers log events to a DOM
 * element.
 *
 * The appender ignores events if the DOM element does not exist. It also
 * assumes that the selector provided in the configuration will always select
 * the same DOM element over time.
 *
 * Note the appender does not escape the string to insert at all. That's on
 * purpose to be able to specify markup in the Pattern layout associated with
 * the appender, but it also means the appender won't work well if the message
 * to output contains characters such as "<" or ">". To be fixed!
 */
/*global document, module*/

// Ensure "define" is defined in node.js in the absence of require.js
// See: https://github.com/jrburke/amdefine
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  var Appender = require('../../node_modules/woodman/lib/appender');

  /**
   * Definition of the Appender class
   *
   * @constructor
   */
  var ElementAppender = function (config) {
    config = config || {};
    Appender.call(this, config);

    /**
     * CSS selector to use to address the DOM element
     */
    this.elementSelector = config.selector;

    /**
     * Pointer to the element
     */
    this.element = null;
  };
  ElementAppender.prototype = new Appender();


  /**
   * Appends the given event.
   *
   * The event is formatted using the underlying Layout
   *
   * @function
   * @param {!LogEvent} evt The logger event to append
   */
  ElementAppender.prototype.doAppend = function (evt) {
    var layout = this.getLayout();
    var level = evt.getLevel();
    var message = null;

    if (!this.element) {
      this.element = document.querySelector(this.elementSelector);
    }
    if (!this.element) {
      return;
    }

    message = layout.toMessageString(evt);
    message = message.replace(/\n/g, '<br/>');
    this.element.innerHTML += message;
  };


  // Expose the constructor
  return ElementAppender;
});