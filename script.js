const views = {
  home: document.querySelector('#home-view'),
  turley: document.querySelector('#turley-view'),
  share: document.querySelector('#share-view'),
  success: document.querySelector('#success-view'),
};

const toast = document.querySelector('.toast');
const placeholderButtons = document.querySelectorAll('.placeholder-button');
const cameraInput = document.querySelector('#camera-input');
const galleryInput = document.querySelector('#gallery-input');
const photoPicker = document.querySelector('#photo-picker');
const previewCard = document.querySelector('#preview-card');
const photoPreview = document.querySelector('#photo-preview');
const fileName = document.querySelector('#file-name');
const fileSize = document.querySelector('#file-size');
const removePhotoButton = document.querySelector('#remove-photo');
const photoForm = document.querySelector('#photo-form');
const consentInput = document.querySelector('#photo-consent');
const submitButton = document.querySelector('#submit-photo');
const formMessage = document.querySelector('#form-message');
const shareAnotherButton = document.querySelector('#share-another');
const supporterNameInput = document.querySelector('#supporter-name');
const pickerActions = document.querySelector('.picker-actions');
const previewToolbar = document.querySelector('.preview-toolbar');
const uploadProgress = document.querySelector('#upload-progress');
const uploadStatus = document.querySelector('#upload-status');
const uploadPercent = document.querySelector('#upload-percent');
const uploadProgressBar = document.querySelector('#upload-progress-bar');

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
let selectedFile = null;
let previewUrl = '';
let toastTimer;
let activeView = 'home';
let uploadInProgress = false;

function showView(name) {
  Object.entries(views).forEach(([viewName, element]) => {
    element.hidden = viewName !== name;
  });

  document.body.classList.toggle('challenge-mode', name === 'turley');
  document.body.style.overflow = name === 'turley' ? 'hidden' : '';
  activeView = name;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function routeFromHash() {
  const route = window.location.hash.replace('#', '');

  if (route === 'turley') {
    const enteringChallenge = activeView !== 'turley';
    showView('turley');
    if (enteringChallenge) resetChallenge();
    return;
  }

  if (route === 'share') {
    showView('share');
    return;
  }

  if (route === 'success') {
    showView('success');
    return;
  }

  showView('home');
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');

  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2600);
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function updateSubmitState() {
  submitButton.disabled = uploadInProgress || !(selectedFile && consentInput.checked);
}

function setUploadProgress({ visible, percent = 0, status = 'Preparing photo…' }) {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
  uploadProgress.hidden = !visible;
  uploadProgress.setAttribute('aria-valuenow', String(safePercent));
  uploadStatus.textContent = status;
  uploadPercent.textContent = `${safePercent}%`;
  uploadProgressBar.style.width = `${safePercent}%`;
}

function setUploadState(isUploading) {
  uploadInProgress = isUploading;
  photoForm.classList.toggle('is-uploading', isUploading);
  pickerActions.classList.toggle('is-uploading', isUploading);
  previewToolbar.classList.toggle('is-uploading', isUploading);
  cameraInput.disabled = isUploading;
  galleryInput.disabled = isUploading;
  removePhotoButton.disabled = isUploading;
  supporterNameInput.disabled = isUploading;
  consentInput.disabled = isUploading;
  submitButton.classList.toggle('is-loading', isUploading);
  submitButton.textContent = isUploading ? 'Submitting…' : 'Submit Photo';
  updateSubmitState();
}

function clearPreview() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  selectedFile = null;
  previewUrl = '';
  photoPreview.removeAttribute('src');
  fileName.textContent = '';
  fileSize.textContent = '';
  previewCard.hidden = true;
  photoPicker.hidden = false;
  cameraInput.value = '';
  galleryInput.value = '';
  formMessage.textContent = '';
  updateSubmitState();
}

function displayFile(file) {
  formMessage.textContent = '';

  if (!VALID_TYPES.includes(file.type)) {
    clearPreview();
    formMessage.textContent = 'Please choose a JPG, PNG or WEBP image.';
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    clearPreview();
    formMessage.textContent = 'That photo is larger than 15MB. Please choose a smaller image.';
    return;
  }

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  photoPreview.src = previewUrl;
  fileName.textContent = file.name || 'Matchday photo';
  fileSize.textContent = formatFileSize(file.size);
  previewCard.hidden = false;
  photoPicker.hidden = true;
  updateSubmitState();
}

function handleFileSelection(event) {
  const [file] = event.target.files;

  if (file) {
    displayFile(file);
  }
}

function resetForm() {
  setUploadState(false);
  photoForm.reset();
  clearPreview();
  setUploadProgress({ visible: false });
}

placeholderButtons.forEach((button) => {
  button.addEventListener('click', () => {
    showToast(button.dataset.placeholder || 'Coming soon.');
  });
});

cameraInput.addEventListener('change', handleFileSelection);
galleryInput.addEventListener('change', handleFileSelection);
removePhotoButton.addEventListener('click', clearPreview);
consentInput.addEventListener('change', updateSubmitState);

function firebaseErrorMessage(error) {
  const code = String(error?.code || '');

  if (!navigator.onLine) {
    return 'You appear to be offline. Reconnect and try the upload again.';
  }

  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return 'Anonymous sign-in is not enabled in Firebase Authentication yet.';
  }

  if (code === 'storage/unauthorized' || code === 'permission-denied') {
    return 'Firebase blocked the upload. Deploy the included Firestore and Storage rules, then try again.';
  }

  if (code === 'storage/quota-exceeded') {
    return 'The photo service has reached its current storage allowance.';
  }

  if (code === 'storage/retry-limit-exceeded' || code === 'storage/unknown') {
    return 'The upload connection timed out. Please try again.';
  }

  if (code === 'storage/canceled') {
    return 'The photo upload was cancelled.';
  }

  if (code === 'failed-precondition') {
    return 'Firebase Storage or Firestore has not been fully enabled for this project.';
  }

  return 'The photo could not be submitted. Please try again.';
}

photoForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formMessage.textContent = '';

  if (uploadInProgress) return;

  if (!selectedFile) {
    formMessage.textContent = 'Please add a photo before submitting.';
    return;
  }

  if (!consentInput.checked) {
    formMessage.textContent = 'Please confirm you have permission to share the photo.';
    return;
  }

  setUploadState(true);
  setUploadProgress({ visible: true, percent: 0, status: 'Connecting securely…' });

  try {
    const { submitPhotoForModeration } = await import('./firebase.js');

    await submitPhotoForModeration({
      file: selectedFile,
      supporterName: supporterNameInput.value,
      onStatus: (status) => {
        const currentPercent = Number(uploadProgress.getAttribute('aria-valuenow')) || 0;
        setUploadProgress({ visible: true, percent: currentPercent, status });
      },
      onProgress: (percent) => {
        setUploadProgress({ visible: true, percent, status: 'Uploading photo…' });
      },
    });

    setUploadProgress({ visible: true, percent: 100, status: 'Added to approval queue' });
    resetForm();
    window.location.hash = 'success';
  } catch (error) {
    console.error('Photo submission failed:', error);
    formMessage.textContent = firebaseErrorMessage(error);
    setUploadState(false);
    setUploadProgress({ visible: false });
  }
});

shareAnotherButton.addEventListener('click', () => {
  resetForm();
  window.location.hash = 'share';
});

/* --------------------------------------------------------------------------
   TURLEY CHALLENGE
   Match-screen proportions and meter behaviour mirror Monday Cup's
   WeeklyChallengeMatchScreen. Rugby-specific scoring and visuals sit on top.
   -------------------------------------------------------------------------- */

const CHALLENGE_PHASE = Object.freeze({
  READY: 'ready',
  POWER: 'power',
  ACCURACY: 'accuracy',
  FLIGHT: 'flight',
  END: 'end',
});

const LEADERBOARD_KEY = 'leighLeopards.turleyChallenge.localLeaderboard.v1';
const LEADERBOARD_LIMIT = 10;
const POWER_SWEEP_MS = 1300;
const POWER_TARGET = Object.freeze({ start: 40, end: 60 });
const ACCURACY_TARGET = Object.freeze({ start: 40, end: 60 });

const closeChallengeButton = document.querySelector('#close-challenge');
const leighScore = document.querySelector('#leigh-score');
const kickMarkers = document.querySelector('#kick-markers');
const challengeTicker = document.querySelector('.challenge-ticker');
const challengeTickerText = document.querySelector('#challenge-ticker-text');
const rugbyPitch = document.querySelector('#rugby-pitch');
const rugbyBall = document.querySelector('#rugby-ball');
const crowdBackdrop = document.querySelector('#crowd-backdrop');
const kickInstruction = document.querySelector('#kick-instruction');
const meterPanel = document.querySelector('#meter-panel');
const meterLabel = document.querySelector('#meter-label');
const meterValue = document.querySelector('#meter-value');
const meterTarget = document.querySelector('#meter-target');
const meterNeedle = document.querySelector('#meter-needle');
const kickMeter = document.querySelector('#kick-meter');
const kickButton = document.querySelector('#kick-button');

const challengeModal = document.querySelector('#challenge-modal');
const modalCloseButton = document.querySelector('#modal-close');
const resultTab = document.querySelector('#result-tab');
const leaderboardTab = document.querySelector('#leaderboard-tab');
const resultPanel = document.querySelector('#result-panel');
const leaderboardPanel = document.querySelector('#leaderboard-panel');
const resultScore = document.querySelector('#result-score');
const resultCopy = document.querySelector('#result-copy');
const scoreNameInput = document.querySelector('#score-name');
const saveScoreButton = document.querySelector('#save-score');
const scoreSaveMessage = document.querySelector('#score-save-message');
const playAgainButton = document.querySelector('#play-again');
const returnHomeButton = document.querySelector('#return-home');
const leaderboardList = document.querySelector('#leaderboard-list');
const leaderboardBackButton = document.querySelector('#leaderboard-back');

const challengeState = {
  phase: CHALLENGE_PHASE.READY,
  conversions: 0,
  points: 0,
  power: 0,
  accuracy: 0,
  meter: 0,
  meterDirection: 1,
  meterFrame: null,
  meterLastTime: 0,
  ballAnimation: null,
  resultTimer: null,
  scoreSaved: false,
  failedShot: false,
};

const CROWD_COLOURS = [
  '#2DA94F', '#F7D117', '#FF1E3C', '#E1251B', '#2F3ED6', '#8A1538', '#FF8A00', '#1E7FF0',
  '#157A52', '#93BFEA', '#FFFFFF', '#2437C6', '#F20D1B', '#00A86B', '#7CB5E8', '#F7C600',
  '#E10600', '#1A22C9', '#9B003F', '#D50000', '#FF3B30', '#3131E8',
];
const CROWD_SKIN_TONES = ['#c98f65', '#8f5f3f', '#e0b184', '#6f4632'];

function renderCrowd() {
  if (!crowdBackdrop || crowdBackdrop.dataset.ready === 'true') return;

  const terraceTops = [6, 16, 28, 41, 55, 70, 85];
  const terraceHeights = [6, 7, 8, 9, 10, 11, 10];
  terraceTops.forEach((top, index) => {
    const line = document.createElement('span');
    line.className = 'crowd-terrace-line';
    line.style.top = `${top}%`;
    line.style.height = `${terraceHeights[index]}%`;
    crowdBackdrop.append(line);
  });

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const rowCount = 16;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const t = rowCount <= 1 ? 1 : rowIndex / (rowCount - 1);
    const y = 2.5 + 94 * Math.pow(t, 1.24);
    const baseCount = 62 - t * 34;
    const count = Math.max(10, Math.round(baseCount));
    const step = 1.68 + t * 2.45;
    const stagger = 0.18 + t * 1.04;
    const centredStartX = 50 - (((count - 1) * step) + stagger) / 2;

    for (let personIndex = 0; personIndex < count; personIndex += 1) {
      const x = centredStartX + personIndex * step + (personIndex % 2 ? stagger : 0);
      const personY = y + (personIndex % 3) * (0.12 + t * 0.8);
      const scale = 0.26 + t * 0.78;
      const shirt = CROWD_COLOURS[((personIndex * 7) + rowIndex) % CROWD_COLOURS.length];
      const skin = CROWD_SKIN_TONES[(personIndex + rowIndex) % CROWD_SKIN_TONES.length];
      const poseUp = personIndex % 4 === 0 || personIndex % 7 === 0;
      const opacity = 0.16 + t * 0.84;

      const svg = document.createElementNS(svgNamespace, 'svg');
      svg.setAttribute('viewBox', '0 0 18 30');
      svg.setAttribute('aria-hidden', 'true');
      svg.classList.add('crowd-person');
      svg.style.left = `${x}%`;
      svg.style.top = `${personY}%`;
      svg.style.width = `${18 * scale}px`;
      svg.style.height = `${30 * scale}px`;
      svg.style.opacity = String(opacity);

      const leftArm = poseUp ? 'M5 13 L1 6' : 'M5 13 L2 20';
      const rightArm = poseUp ? 'M13 13 L17 6' : 'M13 13 L16 20';
      svg.innerHTML = `
        <path d="${leftArm}" fill="none" stroke="${shirt}" stroke-width="3" stroke-linecap="round" />
        <path d="${rightArm}" fill="none" stroke="${shirt}" stroke-width="3" stroke-linecap="round" />
        <circle cx="9" cy="6" r="4" fill="${skin}" />
        <rect x="4" y="11" width="10" height="12" rx="3" fill="${shirt}" />
        <rect x="5" y="22" width="3" height="8" rx="1.5" fill="#0b2d1d" />
        <rect x="10" y="22" width="3" height="8" rx="1.5" fill="#0b2d1d" />
      `;
      crowdBackdrop.append(svg);
    }
  }

  crowdBackdrop.dataset.ready = 'true';
}

function clearChallengeTimers() {
  if (challengeState.meterFrame) {
    cancelAnimationFrame(challengeState.meterFrame);
    challengeState.meterFrame = null;
  }

  if (challengeState.resultTimer) {
    window.clearTimeout(challengeState.resultTimer);
    challengeState.resultTimer = null;
  }

  if (challengeState.ballAnimation) {
    challengeState.ballAnimation.cancel();
    challengeState.ballAnimation = null;
  }
}

function setTicker(copy, tone = 'neutral') {
  challengeTickerText.textContent = copy;
  challengeTicker.classList.remove('is-success', 'is-miss');

  if (tone === 'success') {
    void challengeTicker.offsetWidth;
    challengeTicker.classList.add('is-success');
  } else if (tone === 'miss') {
    challengeTicker.classList.add('is-miss');
  }
}

function updateScoreboard() {
  leighScore.textContent = String(challengeState.points);
  kickMarkers.replaceChildren();

  const markerCount = challengeState.conversions + 1;
  for (let index = 0; index < markerCount; index += 1) {
    const marker = document.createElement('span');
    const isCompleted = index < challengeState.conversions;
    const isFinalMarker = index === markerCount - 1;
    marker.className = 'kick-marker';

    if (isCompleted) {
      marker.classList.add('is-goal');
    } else if (isFinalMarker && challengeState.failedShot) {
      marker.classList.add('is-miss');
    } else {
      marker.classList.add('is-next');
    }

    kickMarkers.append(marker);
  }

  kickMarkers.setAttribute('aria-label', `${challengeState.conversions} successful conversions`);
}

function setBallAtSpot() {
  if (challengeState.ballAnimation) {
    challengeState.ballAnimation.cancel();
    challengeState.ballAnimation = null;
  }

  rugbyBall.style.opacity = '1';
  rugbyBall.style.transform = 'translate(-50%, -50%) scale(1)';
}

function setReadyControls(buttonText = 'Start Kick') {
  meterPanel.hidden = true;
  meterNeedle.style.left = '0%';
  meterValue.textContent = '0';
  kickButton.disabled = false;
  kickButton.textContent = buttonText;
}

function resetChallenge() {
  clearChallengeTimers();
  renderCrowd();
  challengeState.phase = CHALLENGE_PHASE.READY;
  challengeState.conversions = 0;
  challengeState.points = 0;
  challengeState.power = 0;
  challengeState.accuracy = 0;
  challengeState.meter = 0;
  challengeState.meterDirection = 1;
  challengeState.scoreSaved = false;
  challengeState.failedShot = false;

  updateScoreboard();
  setBallAtSpot();
  setTicker('Leigh to kick');
  kickInstruction.textContent = 'Start the challenge, then stop the power and accuracy meters.';
  setReadyControls('Start Kick');
  closeChallengeModal();
}

function accuracySweepMsForPower(power) {
  const safePower = Math.max(0, Math.min(100, Math.round(power)));

  if (safePower >= 40 && safePower <= 60) return 1125;
  if ((safePower >= 30 && safePower < 40) || (safePower > 60 && safePower <= 70)) return 1000;
  if ((safePower >= 10 && safePower < 30) || (safePower > 70 && safePower <= 90)) return 900;
  return 800;
}

function targetForPhase(phase) {
  return phase === CHALLENGE_PHASE.POWER ? POWER_TARGET : ACCURACY_TARGET;
}

function meterDurationForPhase(phase) {
  return phase === CHALLENGE_PHASE.POWER ? POWER_SWEEP_MS : accuracySweepMsForPower(challengeState.power);
}

function updateMeterVisual(value) {
  const safeValue = Math.max(0, Math.min(100, value));
  challengeState.meter = safeValue;
  meterValue.textContent = String(Math.round(safeValue));

  const trackWidth = kickMeter.clientWidth - 8;
  if (trackWidth > 0) {
    meterNeedle.style.left = '4px';
    meterNeedle.style.transform = `translate3d(${(safeValue / 100) * trackWidth}px, 0, 0) translateX(-50%)`;
  } else {
    meterNeedle.style.left = `${safeValue}%`;
    meterNeedle.style.transform = 'translateX(-50%)';
  }
}

function stopMeter() {
  if (challengeState.meterFrame) {
    cancelAnimationFrame(challengeState.meterFrame);
    challengeState.meterFrame = null;
  }
}

function startMeter(phase) {
  stopMeter();
  challengeState.phase = phase;
  challengeState.meter = 0;
  challengeState.meterDirection = 1;
  challengeState.meterLastTime = performance.now();

  const target = targetForPhase(phase);
  meterTarget.style.left = `calc(4px + ${(target.start / 100) * 100}% - ${(target.start / 100) * 8}px)`;
  meterTarget.style.width = `calc(${target.end - target.start}% - ${(target.end - target.start) / 100 * 8}px)`;
  meterPanel.hidden = false;
  meterLabel.textContent = phase === CHALLENGE_PHASE.POWER ? 'Kick Power' : 'Kick Accuracy';
  kickButton.textContent = phase === CHALLENGE_PHASE.POWER ? 'Tap for Power' : 'Tap for Accuracy';
  kickInstruction.textContent = `Stop the ${phase} meter inside the highlighted zone.`;
  updateMeterVisual(0);

  const duration = meterDurationForPhase(phase);
  const unitsPerMs = 100 / Math.max(1, duration / 2);

  function animateMeter(now) {
    const delta = Math.min(34, Math.max(0, now - challengeState.meterLastTime));
    challengeState.meterLastTime = now;
    let next = challengeState.meter + challengeState.meterDirection * delta * unitsPerMs;

    if (next >= 100) {
      next = 100;
      challengeState.meterDirection = -1;
    } else if (next <= 0) {
      next = 0;
      challengeState.meterDirection = 1;
    }

    updateMeterVisual(next);
    challengeState.meterFrame = requestAnimationFrame(animateMeter);
  }

  challengeState.meterFrame = requestAnimationFrame(animateMeter);
}

function valueInsideTarget(value, target) {
  const displayed = Math.round(Math.max(0, Math.min(100, value)));
  return displayed >= target.start && displayed <= target.end;
}

function finishKick() {
  const powerGood = valueInsideTarget(challengeState.power, POWER_TARGET);
  const accuracyGood = valueInsideTarget(challengeState.accuracy, ACCURACY_TARGET);
  const converted = powerGood && accuracyGood;

  challengeState.phase = CHALLENGE_PHASE.FLIGHT;
  challengeState.failedShot = false;
  kickButton.disabled = true;
  kickButton.textContent = 'Kick in Progress';
  kickInstruction.textContent = 'Watch the kick.';
  meterPanel.hidden = true;

  animateRugbyBall({ converted, powerGood, accuracyGood });

  challengeState.resultTimer = window.setTimeout(() => {
    challengeState.resultTimer = null;

    if (converted) {
      challengeState.conversions += 1;
      challengeState.points = challengeState.conversions * 2;
      challengeState.failedShot = false;
      updateScoreboard();
      setTicker('Conversion!', 'success');
      kickInstruction.textContent = `${challengeState.conversions} successful ${challengeState.conversions === 1 ? 'conversion' : 'conversions'}.`;

      challengeState.resultTimer = window.setTimeout(() => {
        challengeState.resultTimer = null;
        challengeState.phase = CHALLENGE_PHASE.READY;
        setBallAtSpot();
        setTicker('Leigh to kick');
        setReadyControls('Next Kick');
        kickInstruction.textContent = 'One miss ends the run.';
      }, 900);
      return;
    }

    challengeState.failedShot = true;
    updateScoreboard();
    setTicker(powerGood ? 'Missed!' : 'Short!', 'miss');
    challengeState.phase = CHALLENGE_PHASE.END;
    kickButton.disabled = false;
    kickButton.textContent = 'View Result';
    kickInstruction.textContent = 'Challenge complete.';

    challengeState.resultTimer = window.setTimeout(() => {
      challengeState.resultTimer = null;
      openChallengeModal();
    }, 700);
  }, 920);
}

function animateRugbyBall({ converted, powerGood, accuracyGood }) {
  const pitchRect = rugbyPitch.getBoundingClientRect();
  const postsRect = rugbyPitch.querySelector('.rugby-posts').getBoundingClientRect();
  const ballRect = rugbyBall.getBoundingClientRect();

  const startCenterY = ballRect.top - pitchRect.top + ballRect.height / 2;
  const crossbarY = postsRect.top - pitchRect.top + postsRect.height * 0.60;
  const targetY = powerGood ? crossbarY - Math.max(28, postsRect.height * 0.16) : crossbarY + 38;
  const travelY = targetY - startCenterY;

  const halfPostGap = postsRect.width * 0.19;
  const rawAccuracyOffset = ((challengeState.accuracy - 50) / 50) * (halfPostGap + 72);
  let targetX = rawAccuracyOffset;

  if (converted) {
    targetX = Math.max(-halfPostGap + 12, Math.min(halfPostGap - 12, rawAccuracyOffset));
  } else if (!accuracyGood) {
    const side = challengeState.accuracy < 50 ? -1 : 1;
    targetX = side * Math.max(halfPostGap + 26, Math.abs(rawAccuracyOffset));
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reducedMotion ? 120 : 850;

  challengeState.ballAnimation = rugbyBall.animate(
    [
      {
        transform: 'translate(-50%, -50%) translate(0, 0) scale(1)',
        opacity: 1,
        offset: 0,
      },
      {
        transform: `translate(-50%, -50%) translate(${targetX * 0.48}px, ${travelY * 0.58 - 52}px) scale(0.72) rotate(185deg)`,
        opacity: 1,
        offset: 0.56,
      },
      {
        transform: `translate(-50%, -50%) translate(${targetX}px, ${travelY}px) scale(0.46) rotate(390deg)`,
        opacity: converted ? 0.94 : 0.86,
        offset: 1,
      },
    ],
    {
      duration,
      easing: 'cubic-bezier(.18,.72,.2,1)',
      fill: 'forwards',
    },
  );
}

function handleKickButton() {
  if (challengeState.phase === CHALLENGE_PHASE.READY) {
    startMeter(CHALLENGE_PHASE.POWER);
    return;
  }

  if (challengeState.phase === CHALLENGE_PHASE.POWER) {
    stopMeter();
    challengeState.power = Math.round(challengeState.meter);
    kickButton.disabled = true;
    kickButton.textContent = 'Power Locked';
    kickInstruction.textContent = `Power ${challengeState.power}. Get ready for accuracy.`;

    window.setTimeout(() => {
      kickButton.disabled = false;
      startMeter(CHALLENGE_PHASE.ACCURACY);
    }, 260);
    return;
  }

  if (challengeState.phase === CHALLENGE_PHASE.ACCURACY) {
    stopMeter();
    challengeState.accuracy = Math.round(challengeState.meter);
    finishKick();
    return;
  }

  if (challengeState.phase === CHALLENGE_PHASE.END) {
    openChallengeModal();
  }
}

function readLeaderboard() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEADERBOARD_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Could not read the Turley Challenge leaderboard.', error);
    return [];
  }
}

function writeLeaderboard(rows) {
  try {
    window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(rows));
    return true;
  } catch (error) {
    console.warn('Could not save the Turley Challenge leaderboard.', error);
    return false;
  }
}

function normaliseLeaderboardName(value) {
  const cleaned = String(value || 'GUEST')
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, '')
    .trim()
    .slice(0, 12);
  return cleaned || 'GUEST';
}

function sortedLeaderboard(rows) {
  return [...rows]
    .map((row) => ({
      name: normaliseLeaderboardName(row.name),
      conversions: Math.max(0, Math.floor(Number(row.conversions) || 0)),
      points: Math.max(0, Math.floor(Number(row.points) || 0)),
      createdAt: Number(row.createdAt) || Date.now(),
    }))
    .sort((a, b) => b.conversions - a.conversions || a.createdAt - b.createdAt)
    .slice(0, LEADERBOARD_LIMIT);
}

function renderLeaderboard() {
  const rows = sortedLeaderboard(readLeaderboard());
  leaderboardList.replaceChildren();

  for (let index = 0; index < 5; index += 1) {
    const row = rows[index];
    const item = document.createElement('li');

    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = `#${index + 1}`;

    const name = document.createElement('span');
    name.className = 'leaderboard-name';
    name.textContent = row?.name || '---';

    const score = document.createElement('span');
    score.className = 'leaderboard-score';
    score.textContent = row ? String(row.conversions) : '—';

    item.append(rank, name, score);
    leaderboardList.append(item);
  }
}

function saveCurrentScore() {
  if (challengeState.scoreSaved) return;

  const name = normaliseLeaderboardName(scoreNameInput.value);
  const rows = readLeaderboard();
  rows.push({
    name,
    conversions: challengeState.conversions,
    points: challengeState.points,
    createdAt: Date.now(),
  });

  const saved = writeLeaderboard(sortedLeaderboard(rows));
  if (!saved) {
    scoreSaveMessage.textContent = 'This browser could not save the score.';
    return;
  }

  challengeState.scoreSaved = true;
  scoreNameInput.value = name;
  scoreNameInput.disabled = true;
  saveScoreButton.disabled = true;
  saveScoreButton.textContent = 'Score Saved';
  scoreSaveMessage.textContent = 'Added to the local leaderboard.';
  renderLeaderboard();
}

function selectModalTab(tabName) {
  const showResult = tabName === 'result';
  resultPanel.hidden = !showResult;
  leaderboardPanel.hidden = showResult;
  resultTab.classList.toggle('is-active', showResult);
  leaderboardTab.classList.toggle('is-active', !showResult);
  resultTab.setAttribute('aria-selected', String(showResult));
  leaderboardTab.setAttribute('aria-selected', String(!showResult));

  if (!showResult) renderLeaderboard();
}

function openChallengeModal() {
  resultScore.textContent = String(challengeState.points);
  resultCopy.textContent = `You scored ${challengeState.conversions} ${challengeState.conversions === 1 ? 'conversion' : 'conversions'} for ${challengeState.points} points.`;
  scoreSaveMessage.textContent = '';
  scoreNameInput.disabled = challengeState.scoreSaved;
  saveScoreButton.disabled = challengeState.scoreSaved;
  saveScoreButton.textContent = challengeState.scoreSaved ? 'Score Saved' : 'Save Score';
  selectModalTab('result');
  challengeModal.hidden = false;
  document.body.style.overflow = 'hidden';
  modalCloseButton.focus({ preventScroll: true });
}

function closeChallengeModal() {
  challengeModal.hidden = true;
  document.body.style.overflow = activeView === 'turley' ? 'hidden' : '';
}

function exitChallenge() {
  clearChallengeTimers();
  closeChallengeModal();
  window.location.hash = 'home';
}

closeChallengeButton.addEventListener('click', exitChallenge);
kickButton.addEventListener('click', handleKickButton);
modalCloseButton.addEventListener('click', closeChallengeModal);
resultTab.addEventListener('click', () => selectModalTab('result'));
leaderboardTab.addEventListener('click', () => selectModalTab('leaderboard'));
leaderboardBackButton.addEventListener('click', () => selectModalTab('result'));
saveScoreButton.addEventListener('click', saveCurrentScore);
playAgainButton.addEventListener('click', () => {
  closeChallengeModal();
  resetChallenge();
});
returnHomeButton.addEventListener('click', exitChallenge);

challengeModal.addEventListener('click', (event) => {
  if (event.target === challengeModal) closeChallengeModal();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !challengeModal.hidden) {
    closeChallengeModal();
  }
});

window.addEventListener('hashchange', routeFromHash);
window.addEventListener('beforeunload', () => {
  clearChallengeTimers();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});

renderCrowd();
routeFromHash();

