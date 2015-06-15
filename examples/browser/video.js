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

  /**********************************************************************
  Global settings to tweak the behavior of the demo when synchronization
  becomes fairly bad.
  **********************************************************************/
  // The video is considered in sync with the timing object if the difference
  // between its reported position and the position of the timing object is
  // below that threshold (in seconds).
  var minDiff = 0.010;

  // Maximum allowed increase/decrease of the playback rate compared to the
  // velocity of the timing object (in percentage).
  // TODO: This might not be a useful setting given that one cannot really
  // "trust" the playbackRate reported by a video in Web browsers
  var maxPlaybackRateDelta = 30/100;

  // Maximum delay for catching up (in seconds).
  // If the code cannot meet the maxPlaybackRateDelta and maxDelay constraints,
  // it will have the video directly seek to the right position.
  var maxDelay = 2.0;



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
  var playButton = document.getElementById('play');
  var pauseButton = document.getElementById('pause');
  var stopButton = document.getElementById('stop');
  var vectorposEl = document.getElementById('vectorpos');
  var videoposEl = document.getElementById('videopos');
  var video = document.querySelector('video');


  /**********************************************************************
  Synchronize video with given state vector
  **********************************************************************/
  var lastVelocity = 0.0;
  var controlVideo = function () {
    var vector = timing.query();
    var diff = 0.0;
    var lastDiff = 0.0;
    var playbackRateDelta = 0.0;
    var playbackRate = 0.0;

    if ((vector.velocity === 0.0) && (vector.acceleration === 0.0)) {
      logger.info('stop video and seek to right position');
      video.pause();
      video.currentTime = vector.position;
    }
    else {
      if (video.paused) {
        logger.info('play video');
        video.play();
        video.playbackRate = vector.velocity;
        lastVelocity = vector.velocity;
      }

      diff = vector.position - video.currentTime;
      if (Math.abs(diff) < minDiff) {
        logger.info('video and vector are in sync!');
      }
      else {
        playbackRateDelta = diff / maxDelay;
        if (Math.abs(playbackRateDelta) > vector.velocity * maxPlaybackRateDelta) {
          logger.info('seek video',
            'diff=' + diff, 'pos=' + vector.position);

          // TODO: seek won't work properly as long as data is not there,
          // we should take that into account somehow.
          video.currentTime = vector.position;
        }
        else if (lastVelocity === vector.velocity) {
          playbackRate = vector.velocity + playbackRateDelta;
          logger.info('adjust playback rate',
            'diff=' + diff,
            'playbackRate=' + playbackRate,
            'velocity=' + vector.velocity);
          if (Math.abs(lastDiff) >= Math.abs(diff)) {
            video.playbackRate = video.playbackRate * 1.20;
          }
          else {
            video.playbackRate = video.playbackRate * 1.05;
          }
          video.playbackRate = playbackRate;
        }
        else {
          // Timing object velocity has just changed,
          // let's jump to the same value
          logger.info('new playback rate', 'velocity=' + vector.velocity);
          video.playbackRate = vector.velocity;
        }
        lastVelocity = vector.velocity;
      }

    }
    renderPositions();
  };


  /**********************************************************************
  Create the timing object associated with the online timing service
  **********************************************************************/
  logger.info('create timing object connected to socket...');
  var timingProvider = new SocketTimingProvider('ws://localhost:8080/video');
  var timing = new TimingObject();
  timing.srcObject = timingProvider;
  logger.info('create timing object connected to socket... done');

  logger.info('add listener to "timeupdate" events...');
  timing.addEventListener('timeupdate', controlVideo);
  timing.addEventListener('change', controlVideo);
  logger.info('add listener to "timeupdate" events... done');

  logger.info('add listener to "readystatechange" events...');
  timing.addEventListener('readystatechange', function (evt) {
    logger.info('readystatechange event', 'state=' + evt.value);
    if (evt.value === 'open') {
      start();
    }
  });
  logger.info('add listener to "readystatechange" events... done');


  /**********************************************************************
  Control buttons do not directly control the video, they just send the
  right update command to the underlying timing object. The video
  effectively starts to play or stops playing when the timing object is
  updated.
  **********************************************************************/
  playButton.addEventListener('click', function () {
    logger.info('set timing object in motion...');
    timing.update(null, 1.0);
    logger.info('set timing object in motion... command sent');
  });

  pauseButton.addEventListener('click', function () {
    logger.info('pause motion...');
    timing.update(null, 0.0);
    logger.info('pause motion... command sent');
  });

  stopButton.addEventListener('click', function () {
    logger.info('stop motion...');
    timing.update(0.0, 0.0);
    logger.info('stop motion... command sent');
  });


  /**********************************************************************
  Display timing object and video positions
  **********************************************************************/
  var renderPositions = function () {
    var vector = timing.query();
    vectorposEl.innerHTML = vector.position;
    videoposEl.innerHTML = video.currentTime;
  };


  /**********************************************************************
  Listen to video changes
  **********************************************************************/
  video.addEventListener('timeupdate', renderPositions);
  video.addEventListener('play', renderPositions);
  video.addEventListener('pause', renderPositions);


  /**********************************************************************
  Enable commands when timing object is connected
  **********************************************************************/
  var start = function () {
    playButton.disabled = false;
    pauseButton.disabled = false;
    stopButton.disabled = false;
  };
});