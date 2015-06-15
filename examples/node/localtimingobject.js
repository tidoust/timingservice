var woodman = require('woodman');
var woodmanConfig = require('./woodmanConfig');
var TimingObject = require('../../src/TimingObject');

woodman.load(woodmanConfig);
var logger = woodman.getLogger('main');

logger.info('create timing object');
var timing = new TimingObject();
logger.info('create timing object... done');

logger.info('query timing object...');
timing.query();
logger.info('query timing object... done');

logger.info('add listener to "timeupdate" events...');
timing.addEventListener('timeupdate', function () {
  logger.info('timeupdate event', timing.query());
});
logger.info('add listener to "timeupdate" events... done');

logger.info('set timing object in motion...');
timing.update(null, 1.0);
logger.info('set timing object in motion... done');

logger.info('sleep for a few seconds...');
setTimeout(function () {
  logger.info('stop motion (needed to clear running timeupdate interval)...');
  timing.update(null, 0.0);
  logger.info('stop motion (needed to clear running timeupdate interval)... done');

  logger.info('sleep for a few seconds... done');
  logger.info('The end');
}, 5000);

