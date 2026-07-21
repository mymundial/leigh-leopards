import {
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import {
  deleteObject,
  getDownloadURL,
  ref,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';
import {
  auth,
  db,
  MATCHDAY_EVENT_ID,
  storage,
} from './firebase.js';

const MODERATOR_UID = 'Uf3s1aGgddagiK4YUEP4RequxTu2';
const PHOTO_LIMIT = 150;

const pinView = document.querySelector('#pin-view');
const loginView = document.querySelector('#login-view');
const dashboardView = document.querySelector('#dashboard-view');
const pinForm = document.querySelector('#pin-form');
const pinInput = document.querySelector('#pin-input');
const pinMessage = document.querySelector('#pin-message');
const loginForm = document.querySelector('#login-form');
const moderatorEmail = document.querySelector('#moderator-email');
const moderatorPassword = document.querySelector('#moderator-password');
const loginMessage = document.querySelector('#login-message');
const loginButton = document.querySelector('#login-button');
const backToPinButton = document.querySelector('#back-to-pin-button');
const lockButton = document.querySelector('#lock-button');
const liveIndicator = document.querySelector('#live-indicator');
const liveIndicatorText = liveIndicator.querySelector('span');
const pendingCount = document.querySelector('#pending-count');
const approvedCount = document.querySelector('#approved-count');
const rejectedCount = document.querySelector('#rejected-count');
const totalCount = document.querySelector('#total-count');
const queueSummary = document.querySelector('#queue-summary');
const queueMessage = document.querySelector('#queue-message');
const photoQueue = document.querySelector('#photo-queue');
const filterTabs = [...document.querySelectorAll('.filter-tab')];
const photoDialog = document.querySelector('#photo-dialog');
const dialogClose = document.querySelector('#dialog-close');
const dialogImage = document.querySelector('#dialog-image');
const dialogName = document.querySelector('#dialog-name');
const dialogTime = document.querySelector('#dialog-time');

let photos = [];
let activeFilter = 'pending';
let unsubscribeQueue = null;
let currentModerator = null;
let viewGeneration = 0;
const photoUrlCache = new Map();

function hideViews() {
  pinView.hidden = true;
  loginView.hidden = true;
  dashboardView.hidden = true;
}

function stopQueue() {
  if (typeof unsubscribeQueue === 'function') unsubscribeQueue();
  unsubscribeQueue = null;
  viewGeneration += 1;
}

function showPin(message = '') {
  stopQueue();
  hideViews();
  pinView.hidden = false;
  pinForm.reset();
  pinMessage.textContent = message;
  window.setTimeout(() => pinInput.focus(), 30);
}

function showLogin(message = '') {
  stopQueue();
  hideViews();
  loginView.hidden = false;
  loginMessage.textContent = message;
  loginButton.disabled = false;
  moderatorPassword.value = '';
  window.setTimeout(() => moderatorEmail.focus(), 30);
}

function showDashboard(user) {
  currentModerator = user;
  hideViews();
  dashboardView.hidden = false;
  setLiveState('connecting', 'Connecting');
  showQueueMessage('Loading submissions', 'Connecting to the live matchday approval queue.', 'loading');
  subscribeToQueue();
}

function setLiveState(state, label) {
  liveIndicator.classList.remove('is-live', 'is-connecting', 'is-error');
  liveIndicator.classList.add(`is-${state}`);
  liveIndicatorText.textContent = label;
}

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  if (!value) return 'Time unavailable';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function relativeTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  let unit = 'second';
  let divisor = 1;
  if (absolute >= 86400) {
    unit = 'day';
    divisor = 86400;
  } else if (absolute >= 3600) {
    unit = 'hour';
    divisor = 3600;
  } else if (absolute >= 60) {
    unit = 'minute';
    divisor = 60;
  }
  return new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })
    .format(Math.round(seconds / divisor), unit);
}

function friendlyAuthError(error) {
  const code = String(error?.code || '');
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) {
    return 'The moderator email or password is incorrect.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many failed attempts. Wait a moment and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Could not reach Firebase. Check the connection and try again.';
  }
  return error?.message || 'Moderator sign-in failed.';
}

function showQueueMessage(title, message, type = 'empty') {
  photoQueue.hidden = true;
  queueMessage.hidden = false;
  queueMessage.className = `empty-state empty-state--${type}`;
  queueMessage.replaceChildren();

  if (type === 'loading') {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    queueMessage.append(spinner);
  } else {
    const icon = document.createElement('div');
    icon.className = 'empty-icon';
    icon.textContent = type === 'error' ? '!' : '✓';
    icon.setAttribute('aria-hidden', 'true');
    queueMessage.append(icon);
  }

  const heading = document.createElement('h3');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = message;
  queueMessage.append(heading, copy);
}

function updateStats() {
  const counts = photos.reduce((result, photo) => {
    const status = ['pending', 'approved', 'rejected'].includes(photo.status)
      ? photo.status
      : 'pending';
    result[status] += 1;
    return result;
  }, { pending: 0, approved: 0, rejected: 0 });

  pendingCount.textContent = String(counts.pending);
  approvedCount.textContent = String(counts.approved);
  rejectedCount.textContent = String(counts.rejected);
  totalCount.textContent = String(photos.length);
}

function filteredPhotos() {
  const list = activeFilter === 'all'
    ? [...photos]
    : photos.filter((photo) => photo.status === activeFilter);

  if (activeFilter === 'pending') {
    return list.sort((left, right) => (left.createdAt?.getTime() || 0) - (right.createdAt?.getTime() || 0));
  }
  return list.sort((left, right) => (right.createdAt?.getTime() || 0) - (left.createdAt?.getTime() || 0));
}

function actionButton(label, action, modifier = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `action-button ${modifier}`.trim();
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function openPhoto(photo) {
  if (!photo.imageUrl) return;
  dialogImage.src = photo.imageUrl;
  dialogName.textContent = photo.supporterName || 'Anonymous fan';
  dialogTime.textContent = formatDate(photo.createdAt);
  if (typeof photoDialog.showModal === 'function') photoDialog.showModal();
}

function createPhotoCard(photo) {
  const article = document.createElement('article');
  article.className = `submission-card submission-card--${photo.status}`;
  article.dataset.id = photo.id;

  const mediaButton = document.createElement('button');
  mediaButton.type = 'button';
  mediaButton.className = 'submission-media';
  mediaButton.setAttribute('aria-label', `Open ${photo.supporterName || 'fan'} photo`);

  const image = document.createElement('img');
  image.loading = 'lazy';
  image.alt = photo.supporterName ? `Photo submitted by ${photo.supporterName}` : 'Submitted fan photo';
  image.src = photo.imageUrl || '';
  image.hidden = !photo.imageUrl;

  const imageError = document.createElement('span');
  imageError.className = 'image-error';
  imageError.textContent = 'Photo unavailable';
  imageError.hidden = Boolean(photo.imageUrl);

  image.addEventListener('error', () => {
    image.hidden = true;
    imageError.hidden = false;
  });

  const status = document.createElement('span');
  status.className = `status-badge status-badge--${photo.status}`;
  status.textContent = photo.status;

  mediaButton.append(image, imageError, status);
  mediaButton.addEventListener('click', () => openPhoto(photo));

  const content = document.createElement('div');
  content.className = 'submission-content';
  const details = document.createElement('div');
  details.className = 'submission-details';
  const name = document.createElement('h3');
  name.textContent = photo.supporterName || 'Anonymous fan';
  const time = document.createElement('p');
  const relative = relativeTime(photo.createdAt);
  time.textContent = `${formatDate(photo.createdAt)}${relative ? ` · ${relative}` : ''}`;
  details.append(name, time);

  const actions = document.createElement('div');
  actions.className = 'submission-actions';
  if (photo.status !== 'approved') actions.append(actionButton('Approve', 'approve', 'action-button--approve'));
  if (photo.status !== 'rejected') actions.append(actionButton('Reject', 'reject', 'action-button--reject'));
  if (photo.status !== 'pending') actions.append(actionButton('Pending', 'pending'));
  actions.append(actionButton('Delete', 'delete', 'action-button--delete'));

  actions.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'delete' && !window.confirm('Permanently delete this photo and its submission record?')) return;
    await moderatePhoto(photo, action, article);
  });

  content.append(details, actions);
  article.append(mediaButton, content);
  return article;
}

function renderQueue() {
  updateStats();
  const list = filteredPhotos();
  const labels = {
    pending: 'pending submission',
    approved: 'approved photo',
    rejected: 'rejected photo',
    all: 'submission',
  };
  queueSummary.textContent = `${list.length} ${labels[activeFilter]}${list.length === 1 ? '' : 's'}`;

  if (!list.length) {
    const emptyCopy = {
      pending: ['Queue clear', 'There are no photos waiting for approval.'],
      approved: ['No approved photos', 'Approved submissions will appear here and in the fan gallery.'],
      rejected: ['No rejected photos', 'Rejected submissions will be kept here until deleted or returned to pending.'],
      all: ['No submissions yet', 'Fan photo submissions will appear here automatically.'],
    }[activeFilter];
    showQueueMessage(emptyCopy[0], emptyCopy[1]);
    return;
  }

  queueMessage.hidden = true;
  photoQueue.hidden = false;
  photoQueue.replaceChildren(...list.map(createPhotoCard));
}

async function imageUrlForPath(storagePath) {
  if (!storagePath) return '';
  if (photoUrlCache.has(storagePath)) return photoUrlCache.get(storagePath);
  try {
    const url = await getDownloadURL(ref(storage, storagePath));
    photoUrlCache.set(storagePath, url);
    return url;
  } catch (error) {
    console.error('Moderation image failed:', { storagePath, code: error?.code, message: error?.message });
    return '';
  }
}

function queueErrorMessage(error) {
  const code = String(error?.code || 'unknown');
  if (code.includes('permission-denied')) {
    return `Signed in successfully, but the deployed Firestore rules blocked photoSubmissions (${code}).`;
  }
  if (code.includes('failed-precondition')) {
    return `Firestore needs an index for this queue (${code}).`;
  }
  return `${error?.message || 'Unknown Firebase error'} (${code}).`;
}

function subscribeToQueue() {
  stopQueue();
  const generation = viewGeneration;
  const submissionsQuery = query(
    collection(db, 'photoSubmissions'),
    where('eventId', '==', MATCHDAY_EVENT_ID),
    limit(PHOTO_LIMIT),
  );

  unsubscribeQueue = onSnapshot(
    submissionsQuery,
    async (snapshot) => {
      const nextPhotos = await Promise.all(snapshot.docs.map(async (photoDocument) => {
        const data = photoDocument.data() || {};
        const storagePath = String(data.storagePath || '');
        return {
          id: photoDocument.id,
          supporterName: String(data.supporterName || ''),
          storagePath,
          status: ['pending', 'approved', 'rejected'].includes(data.status) ? data.status : 'pending',
          createdAt: timestampToDate(data.createdAt),
          approvedAt: timestampToDate(data.approvedAt),
          rejectedAt: timestampToDate(data.rejectedAt),
          imageUrl: await imageUrlForPath(storagePath),
        };
      }));

      if (generation !== viewGeneration || dashboardView.hidden) return;
      photos = nextPhotos;
      setLiveState('live', 'Live');
      renderQueue();
    },
    (error) => {
      console.error('Moderation queue failed:', {
        collection: 'photoSubmissions',
        eventId: MATCHDAY_EVENT_ID,
        uid: auth.currentUser?.uid,
        code: error?.code,
        message: error?.message,
      });
      setLiveState('error', 'Error');
      showQueueMessage('Could not load queue', queueErrorMessage(error), 'error');
    },
  );
}

async function moderatePhoto(photo, action, card) {
  const buttons = [...card.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  card.classList.add('is-working');

  try {
    if (action === 'delete') {
      if (photo.storagePath) {
        try {
          await deleteObject(ref(storage, photo.storagePath));
        } catch (error) {
          if (error?.code !== 'storage/object-not-found') throw error;
        }
      }
      await deleteDoc(doc(db, 'photoSubmissions', photo.id));
      photoUrlCache.delete(photo.storagePath);
      return;
    }

    const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
    const changes = {
      status,
      moderatedAt: serverTimestamp(),
      moderatedBy: currentModerator?.uid || '',
    };

    if (status === 'approved') {
      changes.approvedAt = serverTimestamp();
      changes.approvedBy = currentModerator?.uid || '';
      changes.rejectedAt = deleteField();
      changes.rejectedBy = deleteField();
    } else if (status === 'rejected') {
      changes.rejectedAt = serverTimestamp();
      changes.rejectedBy = currentModerator?.uid || '';
      changes.approvedAt = deleteField();
      changes.approvedBy = deleteField();
    } else {
      changes.approvedAt = deleteField();
      changes.approvedBy = deleteField();
      changes.rejectedAt = deleteField();
      changes.rejectedBy = deleteField();
    }

    await updateDoc(doc(db, 'photoSubmissions', photo.id), changes);
  } catch (error) {
    console.error('Moderation action failed:', error);
    window.alert(`${error?.message || 'The moderation action could not be completed.'} (${error?.code || 'unknown'})`);
    buttons.forEach((button) => { button.disabled = false; });
    card.classList.remove('is-working');
  }
}

pinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (pinInput.value !== '1239') {
    pinInput.setAttribute('aria-invalid', 'true');
    pinMessage.textContent = 'Incorrect matchday code.';
    pinInput.select();
    return;
  }
  pinInput.removeAttribute('aria-invalid');
  showLogin();
});

pinInput.addEventListener('input', () => {
  pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
  pinInput.removeAttribute('aria-invalid');
  pinMessage.textContent = '';
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = moderatorEmail.value.trim();
  const password = moderatorPassword.value;
  if (!email || !password) {
    loginMessage.textContent = 'Enter the moderator email and password.';
    return;
  }

  loginButton.disabled = true;
  loginMessage.textContent = 'Signing in…';

  try {
    await setPersistence(auth, browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (credential.user.uid !== MODERATOR_UID) {
      await signOut(auth);
      throw new Error('This Firebase account is not the configured moderator account.');
    }
    loginForm.reset();
    loginMessage.textContent = '';
    showDashboard(credential.user);
  } catch (error) {
    console.error('Moderator sign-in failed:', error);
    loginMessage.textContent = friendlyAuthError(error);
    loginButton.disabled = false;
    moderatorPassword.select();
  }
});

backToPinButton.addEventListener('click', async () => {
  await signOut(auth).catch(() => {});
  showPin();
});

lockButton.addEventListener('click', async () => {
  stopQueue();
  currentModerator = null;
  await signOut(auth).catch(() => {});
  showPin();
});

filterTabs.forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter || 'pending';
    filterTabs.forEach((tab) => tab.classList.toggle('is-active', tab === button));
    renderQueue();
  });
});

dialogClose.addEventListener('click', () => photoDialog.close());
photoDialog.addEventListener('click', (event) => {
  if (event.target === photoDialog) photoDialog.close();
});
photoDialog.addEventListener('close', () => dialogImage.removeAttribute('src'));

// Always require a fresh moderator login after the PIN.
await signOut(auth).catch(() => {});
showPin();
