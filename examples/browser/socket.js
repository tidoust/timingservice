require.config({
  baseUrl: '../..',
  paths: {
    'woodman': 'node_modules/woodman/dist/woodman',
    'event-target': 'node_modules/event-target/build/event-target.amd',
    'websocket': 'node_modules/websocket/lib/browser'
  }
});

require([
  'src/TimingObject',
  'src/SocketTimingProvider',
  'woodman',
  'examples/browser/woodmanConfig',
  'examples/browser/WoodmanElementAppender'
], function (
    TimingObject, SocketTimingProvider,
    woodman, woodmanConfig, ElementAppender) {
  // Use custom DOM element appender for Woodman
  woodman.registerAppender('ElementAppender', ElementAppender);
  woodman.load(woodmanConfig);
  var logger = woodman.getLogger('main');

  logger.info('create timing object connected to socket...');
  var timingProvider = new SocketTimingProvider(
    'ws://' + document.location.host + '/example');
  var timing = new TimingObject();
  timing.srcObject = timingProvider;
  logger.info('create timing object connected to socket... done');


  var main = function () {
    logger.info('set timing object in motion...');
    timing.update(null, 1.0);
    logger.info('set timing object in motion... done');

    logger.info('sleep for a few seconds...');
    setTimeout(function () {
      logger.info('close connection to timing provider...');
      timing.update(null, 0.0);

      setTimeout(function () {
        timingProvider.close();

        logger.info('close connection to timing provider... done');
        logger.info('sleep for a few seconds... done');
        logger.info('The end');
      }, 5000);
    }, 5000);
  };


  logger.info('add listener to "timeupdate" events...');
  timing.addEventListener('timeupdate', function () {
    logger.info('timeupdate event', timing.query());
  });
  logger.info('add listener to "timeupdate" events... done');


  logger.info('add listener to "readystatechange" events...');
  var run = false;
  timing.addEventListener('readystatechange', function (evt) {
    logger.info('readystatechange event', 'state=' + evt.value);
    if (!run && evt.value === 'open') {
      run = true;
      main();
    }
  });
  logger.info('add listener to "readystatechange" events... done');

  if (timing.readyState === 'open') {
    run = true;
    main();
  }

});