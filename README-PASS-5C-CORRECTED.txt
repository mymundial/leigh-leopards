PASS 5C CORRECTION — REAL MODERATOR SIGN-IN

The previous Pass 5C only unlocked the page with PIN 1239. It did not authenticate
the browser with Firebase, so Firestore correctly blocked reads of pending photos.

Correct flow:
1. Open /admin
2. Enter PIN 1239
3. Enter the Firebase moderator email and password
4. The app verifies adminUsers/{uid} has active=true and role=moderator/admin
5. The live Firestore approval queue opens

No .env moderator credentials are required. Credentials are entered by the moderator
and handled directly by Firebase Authentication. The session lasts for the browser
session and the Lock button signs out.

Required Firebase setup:
- Email/Password Authentication enabled
- Moderator user exists in Authentication
- adminUsers/{MODERATOR_UID} contains:
  active: true
  role: moderator

The included Firestore and Storage rules are the latest upload-compatible versions.
Deploy them with:
  npx firebase-tools deploy --only firestore,storage --project leigh-leopards

Run locally:
  npm install
  npm run dev
  http://localhost:5173/admin
