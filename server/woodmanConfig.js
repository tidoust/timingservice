if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(function (require) {
  return {
    loggers: [
      {
        level: 'info',
        appenders: [
          {
            type: 'Console',
            name: 'console',
            appendStrings: true,
            layout: {
              type: 'pattern',
              pattern: '%d{ABSOLUTE} %-6.6relative %-4.4level %logger - %message%n'
            }
          }
        ]
      },
      {
        name: 'main',
        level: 'log'
      },
      {
        name: 'SocketTimingProvider',
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