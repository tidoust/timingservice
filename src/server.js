/**
 * @fileOverview Basic Web socket server that can manage a set of timing objects
 *
 * To run the server from the root repository folder:
 *   node src/server.js
 */

var woodman = require('woodman');
var woodmanConfig = require('./woodmanConfig');
var logger = woodman.getLogger('socket server');

var WebSocketServer = require('websocket').server;
var http = require('http');

// Load logger configuration
woodman.load(woodmanConfig);

logger.info('create HTTP server...');
var server = http.createServer(function (request, response) {
  logger.info('received request for', request.url);
  response.writeHead(404);
  response.end();
});
server.listen(8080, function () {
  logger.info('HTTP server is listening on port 8080');
});
logger.info('create HTTP server... done');

logger.info('create WebSocket server...');
wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});
logger.info('create WebSocket server... done')

var originIsAllowed = function (origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

wsServer.on('request', function (request) {
  logger.info(request);
  logger.log('connection request received', 'origin=' + request.origin);
  if (!originIsAllowed(request.origin)) {
    // Make sure we only accept requests from an allowed origin
    request.reject();
    logger.info('connection rejected', 'origin=' + request.origin);
    return;
  }

  var connection = request.accept('echo-protocol', request.origin);
  logger.info('connection accepted', 'origin=' + request.origin);

  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      logger.info('received message', message.utf8Data);
      // TODO: parse message as JSON and apply command
    }
    else if (message.type === 'binary') {
      logger.info('received binary message', 'ignoring',
        'length=' + message.binaryData.length + ' bytes');
    }
  });

  connection.on('close', function(reasonCode, description) {
    logger.info('peer disconnected', 'address=' + connection.remoteAddress);
  });
});
