// camera.js
const msg = document.getElementById('msg');
const requestBtn = document.getElementById('request');
const v = document.getElementById('v');

let liveStream = null;
let isRunning = false;

async function startPreview() {
  // Ask for camera and start the <video> preview
  liveStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });

  v.srcObject = liveStream;
  await v.play();

  v.style.display = 'block';
  msg.textContent = '✅ Camera ON (live preview).';
  requestBtn.textContent = 'Turn Camera Off';
  isRunning = true;

  // Tell tracker.js that the camera is live
  if (window.onCameraStarted) {
    window.onCameraStarted();
  }
}

function stopPreview() {
  // Stop media tracks
  if (liveStream) {
    liveStream.getTracks().forEach(t => t.stop());
    liveStream = null;
  }

  v.srcObject = null;
  v.style.display = 'none';
  msg.textContent = 'Live preview OFF.';
  requestBtn.textContent = 'Turn Camera On/Off';
  isRunning = false;

  // Tell tracker.js that camera stopped
  if (window.onCameraStopped) {
    window.onCameraStopped();
  }
}

requestBtn.addEventListener('click', async () => {
  if (isRunning) {
    stopPreview();
  } else {
    msg.textContent = 'Requesting camera permission…';
    try {
      await startPreview();
    } catch (e) {
      msg.textContent = `❌ ${e.name}: ${e.message}`;
      console.error(e);
    }
  }
});

window.addEventListener('beforeunload', stopPreview);
