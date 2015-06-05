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
var _ = require('underscore');

var TimingObject = require('./TimingObject');
var stringify = require('./utils').stringify;


/**
 * Implement filtering logic
 *
 * @function
 * @param {String} origin The origin that sent the reuqest
 * @returns {Boolean} true when the origin is allowed
 */
var originIsAllowed = function (origin) {
  logger.warn('TODO: implement origin check!');
  return true;
};


/**
 * Creates a "change" event listener that broadcasts the change to all
 * connected clients.
 *
 * @function
 * @param {Object} msg The sync message received
 * @returns {Object} Object to send back to the client over the socket
 */
var getChangeListenerFor = function (id) {
  return function (evt) {
    var value = evt.value;
    connections = connections || [];
    if (connections.length === 0) {
      return;
    }
    var msg = stringify({
      type: 'change',
      id: id,
      vector: value
    });
    connections.forEach(function (connection) {
      connection.sendUTF(msg);
    });
    logger.log('broadcasted "change" event', 'id=' + id);
  };
};



/**********************************************************************
Main server loop
**********************************************************************/

// Load logger configuration
woodman.load(woodmanConfig);

/**
 * The common delta in ms that all connected clients should apply
 * to change messages received from the server (to improve synchronicity
 * among clients)
 */
var delta = 0;
if (process.argv.length > 2) {
  try {
    delta = parseInt(process.argv[2], 10);
    logger.info('using delta... ' + delta);
  }
  catch (err) {
    logger.warn('wrong delta argument passed on the command-line');
  }
}

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
var wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});
var connections = [];
logger.info('create WebSocket server... done');

logger.info('load timing object storage...');
logger.warn('TODO: implement proper storage with creation/deletion mechanism');
var timingAndConnections = {};
logger.info('load timing object storage... done');


wsServer.addListener('request', function (request) {
  logger.log('connection request received', 'origin=' + request.origin);
  if (!originIsAllowed(request.origin)) {
    // Make sure we only accept requests from an allowed origin
    request.reject();
    logger.info('connection rejected', 'origin=' + request.origin);
    return;
  }

  var connection = request.accept('echo-protocol', request.origin);
  connections.push(connection);
  logger.info('connection accepted', 'origin=' + request.origin);

  connection.addListener('message', function (message) {
    var request = null;
    var timing = null;

    if (message.type === 'utf8') {
      logger.info('received message', message.utf8Data);
      try {
        request = JSON.parse(message.utf8Data);
      }
      catch (err) {
        logger.warn('could not parse message as JSON', err);
        return;
      }

      timing = timingAndConnections[request.id];

      switch (request.type) {
      case 'info':
        // The client wants detailed information about the timing object
        // The command is also used to associate the Web socket connection
        // with the timing object so that "change" events propagate to all
        // connected clients
        if (!timing) {
          logger.warn('TODO: implement timing create/destroy mechanism');
          timing = {
            connections: [],
            timing: new TimingObject(),
            onchange: getChangeListenerFor(request.id)
          };
          timing.timing.addEventListener('change', timing.onchange);
          timingAndConnections[request.id] = timing;
        }
        timing.connections.push(connection);
        logger.log('new connection to timing object',
          'id=' + request.id,
          'nb=' + timing.connections.length);

        logger.warn('TODO: add extra properties once available (e.g. range)');
        connection.sendUTF(stringify({
          type: 'info',
          id: request.id,
          vector: timing.timing.query()
        }));
        logger.log('sent timing info', 'id=' + request.id);
        break;

      case 'update':
        // The client wants to update the Timing Object's vector
        // Note that the update method will trigger a "change" event
        // and thus send the update back to all connected connections
        // including the one that sent the initial request
        var vector = request.vector || {};
        if (timing) {
          timing.timing.update(
            vector.position,
            vector.velocity,
            vector.acceleration);
          logger.log('updated timing object', 'id=' + request.id);
          logger.warn('TODO: send update ack back to requester?');
        }
        else {
          logger.warn('received an update request on unknown timing object',
            'id=' + request.id, 'ignored');
        }
        break;

      case 'sync':
        // The client wants to synchronize its clock with that of the server
        // NB: in this implementation, it's hard to measure the time taken to
        // process the message. This would require digging into Web socket
        // frames to record the time when the first byte is received.
        var now = Date.now();
        connection.sendUTF(stringify({
          type: 'sync',
          id: request.id,
          client: {
            sent: (request.client || {}).sent
          },
          server: {
            received: now,
            sent: now
          },
          delta: delta
        }));
        logger.log('sync message sent', 'id=' + request.id);
        break;

      default:
        logger.log('unknown command',
          'id=' + request.id, 'cmd=' + request.type, 'ignored');
      }
    }
    else if (message.type === 'binary') {
      logger.info('received binary message', 'ignored',
        'length=' + message.binaryData.length + ' bytes');
    }
  });

  connection.addListener('close', function(reasonCode, description) {
    logger.info('peer disconnected', 'address=' + connection.remoteAddress);
    connection.removeAllListeners('message');
    connection.removeAllListeners('close');
    _.forEach(timingAndConnections, function (timingAndConnection) {
      if (_.contains(timingAndConnection.connections, connection)) {
        timingAndConnection.connections = _.without(
          timingAndConnection.connections,
          connection);
      }
    });
  });
});
