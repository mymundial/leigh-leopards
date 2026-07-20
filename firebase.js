import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {
  collection,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytesResumable,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDOQzzi78ng1Von6nXmlpjFo-GnkRMoUco',
  authDomain: 'leigh-leopards.firebaseapp.com',
  projectId: 'leigh-leopards',
  storageBucket: 'leigh-leopards.firebasestorage.app',
  messagingSenderId: '961503509129',
  appId: '1:961503509129:web:de8f65cf1a68f1ad15e458',
  measurementId: 'G-B57X2VV68V',
};

// Change this single value for each matchday activation.
export const MATCHDAY_EVENT_ID = 'leigh-v-warrington-2026';

const CONSENT_VERSION = '2026-07-19';
const CLIENT_VERSION = 'share-photos-pass-2';
const MAX_UPLOAD_DIMENSION = 2400;
const COMPRESSION_THRESHOLD = 3 * 1024 * 1024;
const JPEG_QUALITY = 0.88;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let signInPromise = null;

function waitForExistingAuthState() {
  return new Promise((resolve) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function ensureAnonymousUser() {
  if (auth.currentUser) return auth.currentUser;
  if (signInPromise) return signInPromise;

  signInPromise = (async () => {
    const existingUser = await waitForExistingAuthState();
    if (existingUser) return existingUser;

    const credential = await signInAnonymously(auth);
    return credential.user;
  })();

  try {
    return await signInPromise;
  } finally {
    signInPromise = null;
  }
}

function normaliseFileName(fileName) {
  return String(fileName || 'matchday-photo')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 160);
}

function extensionForType(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The selected image could not be prepared.'));
    };

    image.src = objectUrl;
  });
}

async function optimisePhoto(file) {
  if (file.size <= COMPRESSION_THRESHOLD) return file;

  const image = await loadImage(file);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, MAX_UPLOAD_DIMENSION / largestSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return file;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
  });

  if (!blob || blob.size >= file.size) return file;

  const baseName = normaliseFileName(file.name).replace(/\.[^.]+$/, '') || 'matchday-photo';
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

function uploadFile(storageReference, file, metadata, onProgress) {
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageReference, file, metadata);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = snapshot.totalBytes > 0
          ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          : 0;
        onProgress?.(Math.min(100, Math.max(0, progress)));
      },
      reject,
      () => resolve(uploadTask.snapshot),
    );
  });
}

export async function submitPhotoForModeration({
  file,
  supporterName = '',
  onStatus,
  onProgress,
}) {
  if (!(file instanceof File)) {
    throw new TypeError('A photo file is required.');
  }

  onStatus?.('Connecting securely…');
  const user = await ensureAnonymousUser();

  onStatus?.('Preparing photo…');
  const uploadFileData = await optimisePhoto(file);

  const submissionReference = doc(collection(db, 'photoSubmissions'));
  const extension = extensionForType(uploadFileData.type);
  const storagePath = `photoSubmissions/${MATCHDAY_EVENT_ID}/${user.uid}/${submissionReference.id}.${extension}`;
  const storageReference = ref(storage, storagePath);

  const metadata = {
    contentType: uploadFileData.type,
    customMetadata: {
      submissionId: submissionReference.id,
      ownerId: user.uid,
      eventId: MATCHDAY_EVENT_ID,
      moderationStatus: 'pending',
    },
  };

  onStatus?.('Uploading photo…');
  await uploadFile(storageReference, uploadFileData, metadata, onProgress);

  onStatus?.('Adding to approval queue…');
  await setDoc(submissionReference, {
    id: submissionReference.id,
    ownerId: user.uid,
    eventId: MATCHDAY_EVENT_ID,
    status: 'pending',
    supporterName: String(supporterName || '').trim().slice(0, 30),
    storagePath,
    originalFileName: normaliseFileName(file.name),
    contentType: uploadFileData.type,
    fileSize: uploadFileData.size,
    createdAt: serverTimestamp(),
    consentVersion: CONSENT_VERSION,
    source: 'leigh-matchday-web',
    clientVersion: CLIENT_VERSION,
  });

  onProgress?.(100);
  onStatus?.('Photo submitted');

  return {
    submissionId: submissionReference.id,
    eventId: MATCHDAY_EVENT_ID,
    storagePath,
  };
}
