import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { CURRENT_EVENT } from '../event-config.js';

const FIREBASE_API_KEY = 'AIzaSyDOQzzi78ng1Von6nXmlpjFo-GnkRMoUco';
const FIREBASE_PROJECT_ID = 'leigh-leopards';
const DATABASE_ID = '(default)';

function encodePathSegment(value) {
  return encodeURIComponent(String(value));
}

function firestoreDocumentUrl(...segments) {
  const path = segments.map(encodePathSegment).join('/');
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${DATABASE_ID}/documents/${path}`;
}

async function readHidden(promptText) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    const rl = createInterface({ input, output });
    try {
      return await rl.question(promptText);
    } finally {
      rl.close();
    }
  }

  output.write(promptText);
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');

  return new Promise((resolve, reject) => {
    let value = '';

    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Cancelled.'));
          return;
        }

        if (character === '\r' || character === '\n') {
          cleanup();
          resolve(value);
          return;
        }

        if (character === '\u007f' || character === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write('\b \b');
          }
          continue;
        }

        if (character >= ' ') {
          value += character;
          output.write('*');
        }
      }
    };

    input.on('data', onData);
  });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  return { response, body };
}

function firebaseErrorMessage(body, fallback) {
  return body?.error?.message || body?.message || fallback;
}

async function signIn(email, password) {
  const { response, body } = await requestJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );

  if (!response.ok) {
    throw new Error(`Moderator sign-in failed: ${firebaseErrorMessage(body, response.statusText)}`);
  }

  return {
    uid: body.localId,
    idToken: body.idToken,
  };
}

async function verifyModerator(uid, idToken) {
  const { response, body } = await requestJson(
    firestoreDocumentUrl('adminUsers', uid),
    { headers: { Authorization: `Bearer ${idToken}` } },
  );

  if (!response.ok) {
    throw new Error(
      'This Firebase user is not authorised as a moderator. Check that adminUsers/'
      + `${uid} exists with active=true and role="moderator".`,
    );
  }

  const active = body?.fields?.active?.booleanValue === true;
  const role = body?.fields?.role?.stringValue;

  if (!active || !['moderator', 'admin'].includes(role)) {
    throw new Error(`Moderator record is inactive or has an invalid role (${role || 'missing'}).`);
  }
}

async function eventAlreadyExists(idToken) {
  const { response } = await requestJson(
    firestoreDocumentUrl('events', CURRENT_EVENT.id),
    { headers: { Authorization: `Bearer ${idToken}` } },
  );

  if (response.ok) return true;
  if (response.status === 404) return false;
  throw new Error(`Could not check the current event document (${response.status}).`);
}

async function createEvent(idToken) {
  const body = {
    fields: {
      active: { booleanValue: true },
      uploadsOpen: { booleanValue: true },
      challengeOpen: { booleanValue: true },
      homeTeam: { stringValue: CURRENT_EVENT.homeTeam },
      homeCode: { stringValue: CURRENT_EVENT.homeCode },
      awayTeam: { stringValue: CURRENT_EVENT.awayTeam },
      awayCode: { stringValue: CURRENT_EVENT.awayCode },
      status: { stringValue: CURRENT_EVENT.status },
    },
  };

  const { response, body: responseBody } = await requestJson(
    firestoreDocumentUrl('events', CURRENT_EVENT.id),
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(`Event creation failed: ${firebaseErrorMessage(responseBody, response.statusText)}`);
  }
}

async function main() {
  console.log(`Create Firebase event: ${CURRENT_EVENT.homeTeam} v ${CURRENT_EVENT.awayTeam}`);
  console.log(`Document: events/${CURRENT_EVENT.id}\n`);

  const rl = createInterface({ input, output });
  const email = (await rl.question('Moderator email: ')).trim();
  rl.close();

  const password = await readHidden('Moderator password: ');
  if (!email || !password) throw new Error('Email and password are required.');

  const { uid, idToken } = await signIn(email, password);
  await verifyModerator(uid, idToken);

  if (await eventAlreadyExists(idToken)) {
    console.log(`\nAlready exists: events/${CURRENT_EVENT.id}`);
    return;
  }

  await createEvent(idToken);
  console.log(`\nCreated: events/${CURRENT_EVENT.id}`);
  console.log('Uploads and the Turley Challenge are both open.');
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
