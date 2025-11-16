// vex-tracker.js — runs on https://vr.vex.com/*
// - starts WebGazer on the VEX page
// - draws a green gaze dot at the predicted gaze position
// - sends normalized gaze data to the extension
// - shows a 5-point click calibration overlay

(function () {
  if (!window.webgazer) {
    console.warn('WebGazer not found in content script');
    return;
  }

  // ------------- Gaze dot on VEX page -------------

  const dotStyle = document.createElement('style');
  dotStyle.textContent = `
    #gaze-dot {
      position: fixed;
      width: 16px;
      height: 16px;
      margin: -8px 0 0 -8px;
      border-radius: 50%;
      background: #00ff88;
      box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.25);
      pointer-events: none;
      z-index: 2147483645;
      transition: transform 0.05s linear;
      transform: scale(1);
    }
  `;
  document.head.appendChild(dotStyle);

  const gazeDot = document.createElement('div');
  gazeDot.id = 'gaze-dot';
  document.body.appendChild(gazeDot);

  function updateGazeDot(x, y) {
    gazeDot.style.left = x + 'px';
    gazeDot.style.top  = y + 'px';
  }

  // ------------- WebGazer setup -------------------

  webgazer
    .setRegression('ridge')
    .showVideo(false)            // small video in top-left
    .showFaceOverlay(true)      // green face box
    .showFaceFeedbackBox(true)
    .showPredictionPoints(false);

  webgazer.setGazeListener((data, elapsedTime) => {
    if (!data) return;

    const x = data.x; // viewport coords on the VEX page
    const y = data.y;

    // Move the on-page gaze dot
    updateGazeDot(x, y);

    // Normalize for popup dashboard
    const w = window.innerWidth  || 1;
    const h = window.innerHeight || 1;

    const nx = x / w;
    const ny = y / h;

    chrome.runtime.sendMessage({
      type: 'gaze-update',
      normalizedX: nx,
      normalizedY: ny,
      timestamp: performance.now()
    });
  }).begin();

  console.log('vex-tracker.js: WebGazer started on VEX page with gaze dot');

  // ------------- Calibration overlay --------------

  // 5 points: center + 4 corners (percentages of viewport)
  const CAL_POINTS = [
    [50, 50], // center
    [10, 10], // top-left
    [90, 10], // top-right
    [10, 90], // bottom-left
    [90, 90]  // bottom-right
  ];
  const CLICKS_PER_POINT = 5;

  let calibOverlay = null;
  let calibDot = null;
  let calibInfo = null;
  let currentIdx = 0;
  let currentClicks = 0;

  function injectCalibrationStyles() {
    if (document.getElementById('wg-calibration-style')) return;

    const style = document.createElement('style');
    style.id = 'wg-calibration-style';
    style.textContent = `
      #wg-calibration-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.35);
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #wg-calibration-dot {
        position: fixed;
        width: 22px;
        height: 22px;
        margin: -11px 0 0 -11px;
        border-radius: 50%;
        background: #ffb300;
        box-shadow: 0 0 0 4px rgba(255,255,255,0.8);
        cursor: pointer;
        transition: transform 0.1s ease-out, box-shadow 0.1s ease-out, background 0.1s ease-out;
      }
      #wg-calibration-info {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(0,0,0,0.75);
        color: #fff;
        font-size: 13px;
      }
    `;
    document.head.appendChild(style);
  }

  function showCalibrationOverlay() {
    injectCalibrationStyles();

    if (calibOverlay) calibOverlay.remove();

    calibOverlay = document.createElement('div');
    calibOverlay.id = 'wg-calibration-overlay';

    calibDot = document.createElement('div');
    calibDot.id = 'wg-calibration-dot';

    calibInfo = document.createElement('div');
    calibInfo.id = 'wg-calibration-info';
    calibInfo.textContent = 'Calibration: look at the dot and click it 5 times at each position.';

    calibOverlay.appendChild(calibDot);
    calibOverlay.appendChild(calibInfo);
    document.body.appendChild(calibOverlay);

    // Hide the moving gaze dot while calibrating
    gazeDot.style.display = 'none';

    currentIdx = 0;
    currentClicks = 0;
    positionCalibrationDot();
    calibDot.addEventListener('click', handleCalibrationClick);
  }

  function hideCalibrationOverlay() {
    if (!calibOverlay) return;
    calibDot.removeEventListener('click', handleCalibrationClick);
    calibOverlay.remove();
    calibOverlay = calibDot = calibInfo = null;

    // Show gaze dot again
    gazeDot.style.display = '';
  }

  function positionCalibrationDot() {
    const [px, py] = CAL_POINTS[currentIdx]; // percentages
    calibDot.style.left = px + 'vw';
    calibDot.style.top  = py + 'vh';

    calibDot.style.transform = 'scale(1)';
    calibDot.style.boxShadow = '0 0 0 4px rgba(255,255,255,0.8)';
  }

  function handleCalibrationClick(e) {
    e.stopPropagation();
    currentClicks += 1;

    // Simple visual feedback
    const scale = 1 + currentClicks * 0.12;
    calibDot.style.transform = `scale(${scale})`;
    calibDot.style.boxShadow = '0 0 0 6px rgba(255,255,255,1)';

    // WebGazer itself listens to click events and uses them as training data,
    // so we don't need to call anything extra here.

    if (currentClicks >= CLICKS_PER_POINT) {
      currentIdx += 1;
      currentClicks = 0;

      if (currentIdx >= CAL_POINTS.length) {
        calibInfo.textContent = 'Calibration complete!';
        setTimeout(hideCalibrationOverlay, 600);
      } else {
        positionCalibrationDot();
        calibInfo.textContent = 'Keep looking at the dot and click it 5 times at each position.';
      }
    }
  }

  // Start calibration shortly after WebGazer begins
  setTimeout(() => {
    showCalibrationOverlay();
  }, 2000);

  // Allow manual recalibration with "C"
  window.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
      showCalibrationOverlay();
    }
  });

  console.log('vex-tracker.js: calibration overlay ready (press "C" to recalibrate)');
})();
