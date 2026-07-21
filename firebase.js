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
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';
import { MATCHDAY_EVENT_ID } from './event-config.js';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDOQzzi78ng1Von6nXmlpjFo-GnkRMoUco',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'leigh-leopards.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'leigh-leopards',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'leigh-leopards.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '961503509129',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:961503509129:web:de8f65cf1a68f1ad15e458',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-B57X2VV68V',
};

const MAX_STORED_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_DIMENSION = 1600;
const COMPRESSION_THRESHOLD = 1024 * 1024;
const JPEG_QUALITY = 0.82;

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export { MATCHDAY_EVENT_ID };

let signInPromise = null;

function waitForInitialAuthState() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function ensureAnonymousUser() {
  if (auth.currentUser) return auth.currentUser;
  if (signInPromise) return signInPromise;

  signInPromise = (async () => {
    const existingUser = await waitForInitialAuthState();
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

function extensionForType(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

function safeBaseName(fileName) {
  return String(fileName || 'matchday-photo')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'matchday-photo';
}

function normaliseFileName(fileName) {
  return String(fileName || 'matchday-photo')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 160) || 'matchday-photo';
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
  if (file.size <= COMPRESSION_THRESHOLD && file.size <= MAX_STORED_BYTES) {
    return file;
  }

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

  if (!blob) return file;

  return new File([blob], `${safeBaseName(file.name)}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}



function uploadFile(storageReference, file, metadata, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageReference, file, metadata);

    task.on(
      'state_changed',
      (snapshot) => {
        const progress = snapshot.totalBytes > 0
          ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          : 0;
        onProgress?.(Math.min(100, Math.max(0, progress)));
      },
      reject,
      () => resolve(task.snapshot),
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
  const preparedFile = await optimisePhoto(file);

  if (preparedFile.size > MAX_STORED_BYTES) {
    const error = new Error('The prepared image is still larger than 8MB.');
    error.code = 'storage/file-too-large';
    throw error;
  }

  const submissionReference = doc(collection(db, 'photoSubmissions'));
  const extension = extensionForType(preparedFile.type);
  const storagePath = `photoSubmissions/${MATCHDAY_EVENT_ID}/${user.uid}/${submissionReference.id}.${extension}`;
  const storageReference = ref(storage, storagePath);

  const metadata = {
    contentType: preparedFile.type,
    cacheControl: 'public,max-age=3600',
    customMetadata: {
      submissionId: submissionReference.id,
      ownerId: user.uid,
      eventId: MATCHDAY_EVENT_ID,
      moderationStatus: 'pending',
    },
  };

  onStatus?.('Uploading photo…');
  await uploadFile(storageReference, preparedFile, metadata, onProgress);

  try {
    onStatus?.('Adding to approval queue…');
    await setDoc(submissionReference, {
      id: submissionReference.id,
      ownerId: user.uid,
      eventId: MATCHDAY_EVENT_ID,
      status: 'pending',
      supporterName: String(supporterName || '').trim().slice(0, 30),
      storagePath,
      originalFileName: normaliseFileName(file.name),
      contentType: preparedFile.type,
      fileSize: preparedFile.size,
      createdAt: serverTimestamp(),
      consentVersion: '2026-07-19',
      source: 'leigh-matchday-web',
      clientVersion: 'share-photos-pass-5c',
    });
  } catch (error) {
    try {
      await deleteObject(storageReference);
    } catch (cleanupError) {
      console.warn('Could not remove orphaned photo upload:', cleanupError);
    }
    throw error;
  }

  onProgress?.(100);
  onStatus?.('Photo submitted');

  return {
    submissionId: submissionReference.id,
    eventId: MATCHDAY_EVENT_ID,
    storagePath,
  };
}


const approvedPhotoUrlCache = new Map();

async function approvedPhotoFromSnapshot(photoSnapshot) {
  const data = photoSnapshot.data();
  const storagePath = String(data.storagePath || '');

  if (!storagePath) {
    console.warn(`Approved photo ${photoSnapshot.id} has no storagePath.`);
    return null;
  }

  let imageUrl = approvedPhotoUrlCache.get(storagePath);
  if (!imageUrl) {
    imageUrl = await getDownloadURL(ref(storage, storagePath));
    approvedPhotoUrlCache.set(storagePath, imageUrl);
  }

  const createdAt = data.createdAt?.toDate?.() || null;
  const approvedAt = data.approvedAt?.toDate?.() || null;

  return {
    id: photoSnapshot.id,
    imageUrl,
    storagePath,
    supporterName: String(data.supporterName || '').trim().slice(0, 40),
    createdAt,
    approvedAt,
  };
}

export function subscribeToApprovedPhotos({
  maximum = 18,
  onChange,
  onError,
} = {}) {
  const safeMaximum = Math.min(120, Math.max(1, Number(maximum) || 18));
  const approvedPhotosQuery = query(
    collection(db, 'photoSubmissions'),
    where('eventId', '==', MATCHDAY_EVENT_ID),
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc'),
    limit(safeMaximum),
  );

  let revision = 0;

  return onSnapshot(
    approvedPhotosQuery,
    async (snapshot) => {
      const currentRevision = ++revision;

      try {
        const results = await Promise.all(snapshot.docs.map(async (photoSnapshot) => {
          try {
            return await approvedPhotoFromSnapshot(photoSnapshot);
          } catch (error) {
            console.warn(`Could not load approved photo ${photoSnapshot.id}:`, error);
            return null;
          }
        }));

        if (currentRevision !== revision) return;
        onChange?.(results.filter(Boolean));
      } catch (error) {
        if (currentRevision === revision) onError?.(error);
      }
    },
    (error) => {
      revision += 1;
      onError?.(error);
    },
  );
}
