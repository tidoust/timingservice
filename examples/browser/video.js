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
  'src/Sequencer',
  'src/StateVector',
  'woodman',
  'examples/browser/woodmanConfig',
  'examples/browser/WoodmanElementAppender'
], function (
    TimingObject, SocketTimingProvider, Sequencer, StateVector,
    woodman, woodmanConfig, ElementAppender) {

  /**********************************************************************
  No need to deal with time, position and velocity measures that are
  below 1ms, so round all floats to 3 decimals.
  **********************************************************************/
  var roundFloat = function (nb) {
    return Math.round(nb * 1000) / 1000;
  };


  /**********************************************************************
  Set up the logger, using a custom DOM element appender
  **********************************************************************/
  woodman.registerAppender('ElementAppender', ElementAppender);
  woodmanConfig.loggers[0].appenders.pop();
  woodman.load(woodmanConfig);
  var logger = woodman.getLogger('main');


  /**********************************************************************
  Pointers to useful DOM elements
  **********************************************************************/
  var buttons = {
    play: document.getElementById('play'),
    pause: document.getElementById('pause'),
    stop: document.getElementById('stop')
  };
  var info = {
    timing: {
      position: document.getElementById('timingposition'),
      velocity: document.getElementById('timingvelocity')
    },
    video: {
      position: document.getElementById('videoposition'),
      velocity: document.getElementById('videovelocity'),
      drift: document.getElementById('videodrift')
    },
    diff: {
      position: document.getElementById('diffposition'),
      velocity: document.getElementById('diffvelocity'),
      max: {
        position: document.getElementById('diffpositionmax'),
        velocity: document.getElementById('diffvelocitymax')
      }
    }
  };
  var video = document.querySelector('video');


  /**********************************************************************
  Control buttons do not directly control the video, they just send the
  right update command to the underlying timing object. The video
  effectively starts to play or stops playing when the timing object is
  updated.
  **********************************************************************/
  buttons.play.addEventListener('click', function () {
    logger.info('play video');
    sequencer.play();
  });

  buttons.pause.addEventListener('click', function () {
    logger.info('pause video');
    sequencer.pause();
  });

  buttons.stop.addEventListener('click', function () {
    logger.info('stop video');
    sequencer.pause();
    sequencer.currentTime = 0.0;
  });


  /**********************************************************************
  Display timing object and video positions
  **********************************************************************/
  var maxDiff = {
    position: 0,
    velocity: 0
  };
  var renderStateInfo = function () {
    var position = sequencer.currentTime;
    var velocity = sequencer.playbackRate;
    var diff = {
      position: roundFloat(position - video.currentTime),
      velocity: roundFloat(velocity - video.playbackRate)
    };
    info.timing.position.innerHTML = roundFloat(position);
    info.timing.velocity.innerHTML = roundFloat(velocity);
    info.video.position.innerHTML = roundFloat(video.currentTime);
    info.video.velocity.innerHTML = roundFloat(video.playbackRate);
    info.diff.position.innerHTML = diff.position;
    info.diff.velocity.innerHTML = diff.velocity;
    if (Math.abs(diff.position) > Math.abs(maxDiff.position)) {
      maxDiff.position = diff.position;
      info.diff.max.position.innerHTML = diff.position;
    }
    if (Math.abs(diff.velocity) > Math.abs(maxDiff.velocity)) {
      maxDiff.velocity = diff.velocity;
      info.diff.max.velocity.innerHTML = diff.velocity;
    }
  };


  /**********************************************************************
  Create the timing object associated with the online timing service
  **********************************************************************/
  logger.info('create timing object connected to socket...');
  var timingProvider = new SocketTimingProvider(
    'ws://' + document.location.host + '/video');
  var timing = new TimingObject();
  timing.srcObject = timingProvider;
  logger.info('create timing object connected to socket... done');

  logger.info('create sequencer...');
  var sequencer = new Sequencer(timing);
  sequencer.addMediaElement(video);
  logger.info('create sequencer... done');

  logger.info('add listener to "timeupdate" events...');
  sequencer.addEventListener('timeupdate', renderStateInfo);

  logger.info('add listener to "readystatechange" events...');
  sequencer.addEventListener('readystatechange', function (evt) {
    logger.info('readystatechange event', 'state=' + evt.value);
    if (evt.value === 'open') {
      start();
    }
  });
  logger.info('add listener to "readystatechange" events... done');


  /**********************************************************************
  Listen to video changes
  **********************************************************************/
  video.addEventListener('timeupdate', renderStateInfo);
  video.addEventListener('play', renderStateInfo);
  video.addEventListener('pause', renderStateInfo);


  /**********************************************************************
  Enable commands when timing object is connected
  **********************************************************************/
  var start = function () {
    buttons.play.disabled = false;
    buttons.pause.disabled = false;
    buttons.stop.disabled = false;
  };
});