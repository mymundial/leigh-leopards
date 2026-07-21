import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const EVENT_ID = 'leigh-v-warrington-2026';
const SESSION_COOKIE = 'leigh_admin_session';
const SESSION_SECONDS = 12 * 60 * 60;
const PHOTO_LIMIT = 250;

let cachedModeratorToken = null;
const failedPinAttempts = new Map();

function json(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(body));
}

function text(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function getHeader(req, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (key.toLowerCase() === target) return Array.isArray(value) ? value[0] : value;
  }
  return '';
}

function requestIp(req) {
  const forwarded = String(getHeader(req, 'x-forwarded-for') || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64 * 1024) throw new Error('Request body too large.');
  }

  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON request body.');
  }
}

function parseCookies(req) {
  const cookieHeader = String(getHeader(req, 'cookie') || '');
  const cookies = {};

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function secureCompare(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function envValue(env, key, fallback = '') {
  const value = env?.[key] ?? process.env[key] ?? fallback;
  return typeof value === 'string' ? value.trim() : value;
}

function requiredConfig(env) {
  const apiKey = envValue(env, 'VITE_FIREBASE_API_KEY', 'AIzaSyDOQzzi78ng1Von6nXmlpjFo-GnkRMoUco');
  const projectId = envValue(env, 'FIREBASE_PROJECT_ID', envValue(env, 'VITE_FIREBASE_PROJECT_ID', 'leigh-leopards'));
  const storageBucket = envValue(env, 'FIREBASE_STORAGE_BUCKET', envValue(env, 'VITE_FIREBASE_STORAGE_BUCKET', 'leigh-leopards.firebasestorage.app'));
  const moderatorEmail = envValue(env, 'FIREBASE_MODERATOR_EMAIL');
  const moderatorPassword = envValue(env, 'FIREBASE_MODERATOR_PASSWORD');
  const adminPin = envValue(env, 'ADMIN_PIN', '1239');
  const sessionSecret = envValue(env, 'ADMIN_SESSION_SECRET', moderatorPassword);

  const missing = [];
  if (!moderatorEmail) missing.push('FIREBASE_MODERATOR_EMAIL');
  if (!moderatorPassword) missing.push('FIREBASE_MODERATOR_PASSWORD');
  if (!sessionSecret) missing.push('ADMIN_SESSION_SECRET');

  return {
    apiKey,
    projectId,
    storageBucket,
    moderatorEmail,
    moderatorPassword,
    adminPin,
    sessionSecret,
    missing,
  };
}

function createSessionToken(secret) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    nonce: randomBytes(12).toString('hex'),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token, secret) {
  if (!token || !secret) return false;
  const [encodedPayload, suppliedSignature] = String(token).split('.');
  if (!encodedPayload || !suppliedSignature) return false;

  const expectedSignature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  if (!secureCompare(suppliedSignature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    return Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function sessionCookie(req, token) {
  const forwardedProto = String(getHeader(req, 'x-forwarded-proto') || '');
  const secure = forwardedProto === 'https' || Boolean(process.env.VERCEL);
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_SECONDS}`,
    'HttpOnly',
    'SameSite=Strict',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

function expiredSessionCookie(req) {
  const forwardedProto = String(getHeader(req, 'x-forwarded-proto') || '');
  const secure = forwardedProto === 'https' || Boolean(process.env.VERCEL);
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Strict',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

function hasAdminSession(req, env) {
  const config = requiredConfig(env);
  if (!config.sessionSecret) return false;
  const token = parseCookies(req)[SESSION_COOKIE];
  return verifySessionToken(token, config.sessionSecret);
}

function enforceSession(req, res, env) {
  if (hasAdminSession(req, env)) return true;
  json(res, 401, { error: 'admin/session-required', message: 'Admin session required.' });
  return false;
}

function pinAttemptAllowed(req) {
  const ip = requestIp(req);
  const now = Date.now();
  const record = failedPinAttempts.get(ip);
  if (!record) return { allowed: true, ip };
  if (record.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, ip, retryAfter: Math.ceil((record.blockedUntil - now) / 1000) };
  }
  if (record.blockedUntil && record.blockedUntil <= now) failedPinAttempts.delete(ip);
  return { allowed: true, ip };
}

function recordFailedPin(ip) {
  const now = Date.now();
  const record = failedPinAttempts.get(ip) || { count: 0, firstAt: now, blockedUntil: 0 };
  if (now - record.firstAt > 10 * 60 * 1000) {
    record.count = 0;
    record.firstAt = now;
  }
  record.count += 1;
  if (record.count >= 5) record.blockedUntil = now + 5 * 60 * 1000;
  failedPinAttempts.set(ip, record);
}

function clearPinFailures(ip) {
  failedPinAttempts.delete(ip);
}

async function firebaseRequest(url, options, token) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.ok) return response;

  let details = '';
  try {
    details = JSON.stringify(await response.json());
  } catch {
    details = await response.text();
  }

  const error = new Error(`Firebase request failed (${response.status}): ${details}`);
  error.status = response.status;
  throw error;
}

async function getModeratorToken(env) {
  const config = requiredConfig(env);
  if (config.missing.length) {
    const error = new Error(`Missing server environment variables: ${config.missing.join(', ')}`);
    error.code = 'admin/server-not-configured';
    throw error;
  }

  if (cachedModeratorToken && cachedModeratorToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedModeratorToken;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: config.moderatorEmail,
        password: config.moderatorPassword,
        returnSecureToken: true,
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Moderator sign-in failed.');
    error.code = 'admin/moderator-sign-in-failed';
    throw error;
  }

  cachedModeratorToken = {
    idToken: payload.idToken,
    localId: payload.localId,
    expiresAt: Date.now() + Math.max(60, Number(payload.expiresIn) || 3600) * 1000,
  };

  return cachedModeratorToken;
}

function firestoreValue(value) {
  if (value === null || value === undefined) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  return null;
}

function photoFromDocument(document) {
  const fields = document?.fields || {};
  const id = String(document?.name || '').split('/').pop();
  return {
    id,
    supporterName: firestoreValue(fields.supporterName) || '',
    storagePath: firestoreValue(fields.storagePath) || '',
    status: firestoreValue(fields.status) || 'pending',
    createdAt: firestoreValue(fields.createdAt),
    approvedAt: firestoreValue(fields.approvedAt),
    rejectedAt: firestoreValue(fields.rejectedAt),
  };
}

function firestoreBase(config) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents`;
}

async function fetchPhotos(env) {
  const config = requiredConfig(env);
  const moderator = await getModeratorToken(env);
  const url = `${firestoreBase(config)}/events/${encodeURIComponent(EVENT_ID)}:runQuery`;
  const response = await firebaseRequest(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'photos' }],
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit: PHOTO_LIMIT,
        },
      }),
    },
    moderator.idToken,
  );

  const rows = await response.json();
  return rows
    .map((row) => row.document ? photoFromDocument(row.document) : null)
    .filter(Boolean);
}

async function fetchPhotoDocument(env, id) {
  const config = requiredConfig(env);
  const moderator = await getModeratorToken(env);
  const url = `${firestoreBase(config)}/events/${encodeURIComponent(EVENT_ID)}/photos/${encodeURIComponent(id)}`;
  const response = await firebaseRequest(url, { method: 'GET' }, moderator.idToken);
  return { document: await response.json(), moderator, config };
}

async function updatePhotoStatus(env, id, status) {
  const config = requiredConfig(env);
  const moderator = await getModeratorToken(env);
  const now = new Date().toISOString();
  const fields = {
    status: { stringValue: status },
    moderatedAt: { timestampValue: now },
    moderatedBy: { stringValue: moderator.localId || 'moderator' },
  };
  const masks = ['status', 'moderatedAt', 'moderatedBy'];

  if (status === 'approved') {
    fields.approvedAt = { timestampValue: now };
    fields.approvedBy = { stringValue: moderator.localId || 'moderator' };
    masks.push('approvedAt', 'approvedBy');
  }
  if (status === 'rejected') {
    fields.rejectedAt = { timestampValue: now };
    fields.rejectedBy = { stringValue: moderator.localId || 'moderator' };
    masks.push('rejectedAt', 'rejectedBy');
  }

  const maskQuery = masks.map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&');
  const url = `${firestoreBase(config)}/events/${encodeURIComponent(EVENT_ID)}/photos/${encodeURIComponent(id)}?${maskQuery}`;
  await firebaseRequest(
    url,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    },
    moderator.idToken,
  );
}

async function deletePhoto(env, id) {
  const { document, moderator, config } = await fetchPhotoDocument(env, id);
  const photo = photoFromDocument(document);

  if (photo.storagePath) {
    const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(config.storageBucket)}/o/${encodeURIComponent(photo.storagePath)}`;
    try {
      await firebaseRequest(storageUrl, { method: 'DELETE' }, moderator.idToken);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }

  const documentUrl = `${firestoreBase(config)}/events/${encodeURIComponent(EVENT_ID)}/photos/${encodeURIComponent(id)}`;
  await firebaseRequest(documentUrl, { method: 'DELETE' }, moderator.idToken);
}

function validPhotoId(id) {
  return /^[A-Za-z0-9_-]{8,128}$/.test(String(id || ''));
}

export async function handleAdminSession(req, res, env = process.env) {
  const method = String(req.method || 'GET').toUpperCase();
  const config = requiredConfig(env);

  if (method === 'GET') {
    json(res, 200, {
      authenticated: hasAdminSession(req, env),
      configured: config.missing.length === 0,
    });
    return;
  }

  if (method === 'DELETE') {
    json(res, 200, { authenticated: false }, { 'Set-Cookie': expiredSessionCookie(req) });
    return;
  }

  if (method !== 'POST') {
    json(res, 405, { error: 'method/not-allowed' }, { Allow: 'GET, POST, DELETE' });
    return;
  }

  const attempt = pinAttemptAllowed(req);
  if (!attempt.allowed) {
    res.setHeader('Retry-After', String(attempt.retryAfter));
    json(res, 429, {
      error: 'admin/too-many-attempts',
      message: 'Too many incorrect attempts. Try again in a few minutes.',
    });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const pin = String(body.pin || '').replace(/\D/g, '').slice(0, 8);

    if (!secureCompare(pin, config.adminPin)) {
      recordFailedPin(attempt.ip);
      json(res, 401, { error: 'admin/incorrect-pin', message: 'Incorrect code.' });
      return;
    }

    if (config.missing.length) {
      json(res, 503, {
        error: 'admin/server-not-configured',
        message: `Admin server setup is incomplete: ${config.missing.join(', ')}`,
      });
      return;
    }

    // Confirm the hidden Firebase moderator credentials work before opening the dashboard.
    await getModeratorToken(env);
    clearPinFailures(attempt.ip);

    const token = createSessionToken(config.sessionSecret);
    json(
      res,
      200,
      { authenticated: true },
      { 'Set-Cookie': sessionCookie(req, token) },
    );
  } catch (error) {
    console.error('Admin session error:', error);
    json(res, 500, {
      error: error.code || 'admin/session-failed',
      message: error.code === 'admin/moderator-sign-in-failed'
        ? 'The hidden Firebase moderator credentials were rejected.'
        : 'Could not open the moderation dashboard.',
    });
  }
}

export async function handleAdminPhotos(req, res, env = process.env) {
  if (String(req.method || 'GET').toUpperCase() !== 'GET') {
    json(res, 405, { error: 'method/not-allowed' }, { Allow: 'GET' });
    return;
  }
  if (!enforceSession(req, res, env)) return;

  try {
    const photos = await fetchPhotos(env);
    json(res, 200, { eventId: EVENT_ID, photos });
  } catch (error) {
    console.error('Admin photo queue error:', error);
    json(res, error.status === 403 ? 403 : 500, {
      error: error.code || 'admin/queue-failed',
      message: error.status === 403
        ? 'The Firebase moderator account does not have adminUsers permission.'
        : 'Could not load the photo queue.',
    });
  }
}

export async function handleAdminPhotoMedia(req, res, env = process.env) {
  if (String(req.method || 'GET').toUpperCase() !== 'GET') {
    text(res, 405, 'Method not allowed');
    return;
  }
  if (!hasAdminSession(req, env)) {
    text(res, 401, 'Admin session required');
    return;
  }

  try {
    const requestUrl = new URL(req.url, 'http://localhost');
    const id = requestUrl.searchParams.get('id');
    if (!validPhotoId(id)) {
      text(res, 400, 'Invalid photo ID');
      return;
    }

    const { document, moderator, config } = await fetchPhotoDocument(env, id);
    const photo = photoFromDocument(document);
    if (!photo.storagePath) {
      text(res, 404, 'Photo file not found');
      return;
    }

    const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(config.storageBucket)}/o/${encodeURIComponent(photo.storagePath)}?alt=media`;
    const response = await firebaseRequest(storageUrl, { method: 'GET' }, moderator.idToken);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(arrayBuffer.byteLength));
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Admin photo media error:', error);
    text(res, error.status === 404 ? 404 : 500, 'Could not load photo');
  }
}

export async function handleAdminPhotoAction(req, res, env = process.env) {
  if (String(req.method || 'POST').toUpperCase() !== 'POST') {
    json(res, 405, { error: 'method/not-allowed' }, { Allow: 'POST' });
    return;
  }
  if (!enforceSession(req, res, env)) return;

  try {
    const body = await readJsonBody(req);
    const id = String(body.id || '');
    const action = String(body.action || '').toLowerCase();

    if (!validPhotoId(id)) {
      json(res, 400, { error: 'admin/invalid-photo', message: 'Invalid photo ID.' });
      return;
    }

    if (action === 'delete') {
      await deletePhoto(env, id);
      json(res, 200, { ok: true, id, action });
      return;
    }

    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      pending: 'pending',
    };
    const status = statusMap[action];
    if (!status) {
      json(res, 400, { error: 'admin/invalid-action', message: 'Invalid moderation action.' });
      return;
    }

    await updatePhotoStatus(env, id, status);
    json(res, 200, { ok: true, id, action, status });
  } catch (error) {
    console.error('Admin photo action error:', error);
    json(res, error.status === 403 ? 403 : 500, {
      error: error.code || 'admin/action-failed',
      message: error.status === 403
        ? 'The Firebase moderator account is not authorised.'
        : 'The moderation action failed.',
    });
  }
}
