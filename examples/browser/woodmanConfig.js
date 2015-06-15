if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  return {
    appenders: [
      {
        type: 'Console',
        name: 'console',
        appendStrings: false,
        layout: {
          type: 'pattern',
          pattern: '%d{ABSOLUTE} %-6.6relative %-4.4level %logger - %message%n'
        }
      },
      {
        type: 'ElementAppender',
        name: 'element',
        selector: '#log',
        layout: {
          type: 'pattern',
          pattern: '%d{ABSOLUTE} <b>%logger</b> - <em>%level</em> - %message%n'
        }
      }
    ],
    loggers: [
      {
        level: 'info',
        appenders: [
          'console',
          'element'
        ]
      },
      {
        name: 'main',
        level: 'log'
      },
      {
        name: 'Interval',
        level: 'none'
      },
      {
        name: 'StateVector',
        level: 'none'
      }
    ]
  };
});