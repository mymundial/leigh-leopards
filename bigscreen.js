import { subscribeToApprovedPhotos } from './firebase.js';

const TILE_COUNT = 6;
const MAXIMUM_PHOTOS = 60;
const PAGE_DURATION_MS = 10_000;
const FADE_DURATION_MS = 560;

const photoGrid = document.querySelector('#photo-grid');
const statusText = document.querySelector('#screen-status');

let approvedPhotos = [];
let activePage = 0;
let rotationTimer = null;
let unsubscribeFromPhotos = null;
let feedState = 'connecting';

function emptyTile() {
  const tile = document.createElement('article');
  tile.className = 'photo-tile photo-tile--empty';
  tile.setAttribute('aria-label', 'Waiting for an approved supporter photo');

  const crest = document.createElement('img');
  crest.className = 'photo-tile__empty-logo';
  crest.src = '/assets/leigh-leopards-logo.webp';
  crest.alt = '';

  tile.append(crest);
  return tile;
}

function photoTile(photo) {
  const tile = document.createElement('article');
  tile.className = 'photo-tile photo-tile--photo';
  tile.style.setProperty('--photo-url', `url("${photo.imageUrl.replace(/"/g, '%22')}")`);
  tile.setAttribute(
    'aria-label',
    photo.supporterName
      ? `Photo submitted by ${photo.supporterName}`
      : 'Approved supporter photo',
  );

  const image = document.createElement('img');
  image.className = 'photo-tile__image';
  image.src = photo.imageUrl;
  image.alt = photo.supporterName
    ? `Matchday photo submitted by ${photo.supporterName}`
    : 'Approved matchday supporter photo';
  image.decoding = 'async';
  image.loading = 'eager';
  image.addEventListener('error', () => tile.replaceWith(emptyTile()), { once: true });

  const shade = document.createElement('span');
  shade.className = 'photo-tile__shade';
  shade.setAttribute('aria-hidden', 'true');

  const crest = document.createElement('img');
  crest.className = 'photo-tile__logo';
  crest.src = '/assets/leigh-leopards-logo.webp';
  crest.alt = '';

  tile.append(image, shade, crest);
  return tile;
}

function pageCountFor(photos = approvedPhotos) {
  return Math.max(1, Math.ceil(photos.length / TILE_COUNT));
}

function pagePhotos(pageIndex) {
  const start = pageIndex * TILE_COUNT;
  return approvedPhotos.slice(start, start + TILE_COUNT);
}

function updateStatus() {
  if (feedState === 'connecting') {
    statusText.textContent = 'Connecting to approved photo feed';
    return;
  }

  if (feedState === 'error') {
    statusText.textContent = 'Photo feed temporarily unavailable';
    return;
  }

  if (approvedPhotos.length === 0) {
    statusText.textContent = 'Waiting for approved photos';
    return;
  }

  const pageCount = pageCountFor();
  if (pageCount > 1) {
    statusText.textContent = `${approvedPhotos.length} approved photos · page ${activePage + 1} of ${pageCount}`;
    return;
  }

  statusText.textContent = `${approvedPhotos.length} approved photo${approvedPhotos.length === 1 ? '' : 's'} live`;
}

function paintGrid() {
  const pageCount = pageCountFor();
  activePage %= pageCount;
  const photos = pagePhotos(activePage);

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < TILE_COUNT; index += 1) {
    fragment.append(photos[index] ? photoTile(photos[index]) : emptyTile());
  }

  photoGrid.replaceChildren(fragment);
  updateStatus();
}

function render({ animate = false } = {}) {
  if (!animate) {
    paintGrid();
    return;
  }

  photoGrid.classList.add('is-changing');
  window.setTimeout(() => {
    paintGrid();
    window.requestAnimationFrame(() => photoGrid.classList.remove('is-changing'));
  }, FADE_DURATION_MS);
}

function scheduleRotation() {
  window.clearInterval(rotationTimer);
  rotationTimer = null;

  const pageCount = pageCountFor();
  if (pageCount <= 1 || document.hidden) return;

  rotationTimer = window.setInterval(() => {
    const currentPageCount = pageCountFor();
    activePage = (activePage + 1) % currentPageCount;
    render({ animate: true });
  }, PAGE_DURATION_MS);
}

function handleApprovedPhotos(photos) {
  approvedPhotos = Array.isArray(photos) ? photos : [];
  activePage = 0;
  feedState = 'live';
  render();
  scheduleRotation();
}

function handleFeedError(error) {
  console.error('Big-screen approved photo feed failed:', error);
  feedState = 'error';
  approvedPhotos = [];
  activePage = 0;
  window.clearInterval(rotationTimer);
  rotationTimer = null;
  render();
}

function startApprovedFeed() {
  unsubscribeFromPhotos?.();
  feedState = 'connecting';
  approvedPhotos = [];
  activePage = 0;
  render();

  unsubscribeFromPhotos = subscribeToApprovedPhotos({
    maximum: MAXIMUM_PHOTOS,
    onChange: handleApprovedPhotos,
    onError: handleFeedError,
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.clearInterval(rotationTimer);
    rotationTimer = null;
  } else {
    render();
    scheduleRotation();
  }
});

window.addEventListener('beforeunload', () => {
  unsubscribeFromPhotos?.();
  window.clearInterval(rotationTimer);
});

startApprovedFeed();
