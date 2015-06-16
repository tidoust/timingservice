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
  'src/StateVector',
  'woodman',
  'examples/browser/woodmanConfig',
  'examples/browser/WoodmanElementAppender'
], function (
    TimingObject, SocketTimingProvider, StateVector,
    woodman, woodmanConfig, ElementAppender) {

  /**********************************************************************
  No need to deal with time, position and velocity measures that are
  below 1ms, so round all floats to 3 decimals.
  **********************************************************************/
  var roundFloat = function (nb) {
    return Math.round(nb * 1000) / 1000;
  };


  /**********************************************************************
  Global settings to tweak the behavior of the demo when synchronization
  becomes fairly bad.
  **********************************************************************/
  // The video is considered in sync with the timing object if the difference
  // between its reported position and the position of the timing object is
  // below that threshold (in seconds).
  var minDiff = 0.010;

  // Maximum delay for catching up (in seconds).
  // If the code cannot meet the maxPlaybackRateDelta and maxDelay constraints,
  // it will have the video directly seek to the right position.
  var maxDelay = 1.0;

  // Amortization period (in seconds).
  // The amortization period is used when adjustments are made to
  // the playback rate of the video.
  var amortPeriod = 2.0;


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
  Synchronize video with timing information
  **********************************************************************/
  var timingVector = null;
  var videoVector = null;
  var videoDriftRate = 0.0;
  var videoSeeked = false;
  var amortTimeout = null;

  // Whenever the timing object issues a "change" event, we should ensure
  // the video is aligned with it. If the video was in the middle of an
  // amortization period, we need to cancel it first.
  var onTimingChange = function () {
    if (amortTimeout) {
      // Cancel amortization period, no update to video drift and playback
      // rate, that will be taken care of by the call to controlVideo
      logger.info('cancel amortization period');
      clearTimeout(amortTimeout);
      amortTimeout = null;
      videoSeeked = false;
    }
    controlVideo();
  };


  var controlVideo = function () {
    var diff = 0.0;

    // Do not adjust anything during the amortization period
    if (amortTimeout) {
      return;
    }

    // Get new readings from Timing object
    timingVector = timing.query();

    if ((timingVector.velocity === 0.0) &&
        (timingVector.acceleration === 0.0)) {
      logger.info('stop video and seek to right position');
      video.pause();
      video.currentTime = timingVector.position;
      videoVector = new StateVector(timingVector);
    }
    else if (video.paused) {
      logger.info('play video');
      videoVector = new StateVector({
        position: timingVector.position,
        velocity: timingVector.velocity + videoDriftRate,
        acceleration: 0.0,
        timestamp: timingVector.timestamp
      });
      videoSeeked = true;
      video.currentTime = videoVector.position;
      video.playbackRate = videoVector.velocity;
      video.play();
      logger.info('start amortization period',
          'diff=' + diff, 'playbackRate=' + videoVector.velocity);
      amortTimeout = setTimeout(stopAmortizationPeriod, amortPeriod * 1000);
    }
    else {
      videoVector = new StateVector({
        position: video.currentTime,
        velocity: videoVector.velocity,
      });
      diff = timingVector.position - videoVector.position;
      if (Math.abs(diff) < minDiff) {
        logger.info('video and vector are in sync!');
      }
      else if (Math.abs(diff) > maxDelay) {
        // TODO: seek won't work properly as long as data is not there,
        // we should take that into account somehow.
        logger.info('seek video and start amortization period',
          'diff=' + diff, 'pos=' + timingVector.position);
        videoVector.position = timingVector.position;
        videoVector.velocity = timingVector.velocity + videoDriftRate;
        video.currentTime = videoVector.position;
        video.playbackRate = videoVector.velocity;
        videoSeeked = true;
        amortTimeout = setTimeout(stopAmortizationPeriod, amortPeriod * 1000);
      }
      else {
        videoVector.velocity =
          videoDriftRate +
          (timingVector.computePosition(timingVector.timestamp + amortPeriod) -
            videoVector.position) / amortPeriod;
        video.playbackRate = videoVector.velocity;
        logger.info('start amortization period',
          'diff=' + diff, 'playbackRate=' + videoVector.velocity);
        amortTimeout = setTimeout(stopAmortizationPeriod, amortPeriod * 1000);
      }
    }
    renderStateInfo();
  };


  /**********************************************************************
  Stops the playback adjustment once the amortization period is over
  **********************************************************************/
  var stopAmortizationPeriod = function () {
    var now = Date.now() / 1000.0;

    // Don't adjust playback rate and drift rate if video was seeked.
    // The seek operation often introduces artificial delays.
    if (videoSeeked) {
      logger.info('end of amortization period for seek');
      videoSeeked = false;
      amortTimeout = null;
      return;
    }

    // Compute the difference between the position the video should be and
    // the position it is reported to be at.
    var diff = videoVector.computePosition(now) - video.currentTime;

    // Compute the new video drift rate
    videoDriftRate = diff / (now - videoVector.timestamp);

    // Switch back to the current vector's velocity,
    // adjusted with the newly computed drift rate
    videoVector.velocity = timingVector.velocity + videoDriftRate;
    video.playbackRate = videoVector.velocity;

    logger.info('end of amortization period',
      'new drift=' + videoDriftRate,
      'playback rate=' + videoVector.velocity);
    amortTimeout = null;
  };


  /**********************************************************************
  Create the timing object associated with the online timing service
  **********************************************************************/
  logger.info('create timing object connected to socket...');
  var timingProvider = new SocketTimingProvider('ws://192.168.0.140:8080/video');
  var timing = new TimingObject();
  timing.srcObject = timingProvider;
  logger.info('create timing object connected to socket... done');

  logger.info('add listener to "timeupdate" events...');
  timing.addEventListener('timeupdate', controlVideo);
  timing.addEventListener('change', onTimingChange);
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
  buttons.play.addEventListener('click', function () {
    logger.info('set timing object in motion...');
    timing.update(null, 1.0);
    logger.info('set timing object in motion... command sent');
  });

  buttons.pause.addEventListener('click', function () {
    logger.info('pause motion...');
    timing.update(null, 0.0);
    logger.info('pause motion... command sent');
  });

  buttons.stop.addEventListener('click', function () {
    logger.info('stop motion...');
    timing.update(0.0, 0.0);
    logger.info('stop motion... command sent');
  });


  /**********************************************************************
  Display timing object and video positions
  **********************************************************************/
  var maxDiff = {
    position: 0,
    velocity: 0
  };
  var renderStateInfo = function () {
    var vector = timing.query();
    var diff = {
      position: roundFloat(vector.position - video.currentTime),
      velocity: roundFloat(vector.velocity - video.playbackRate)
    };
    info.timing.position.innerHTML = roundFloat(vector.position);
    info.timing.velocity.innerHTML = roundFloat(vector.velocity);
    info.video.position.innerHTML = roundFloat(video.currentTime);
    info.video.velocity.innerHTML = roundFloat(video.playbackRate);
    info.video.drift.innerHTML = roundFloat(videoDriftRate);
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