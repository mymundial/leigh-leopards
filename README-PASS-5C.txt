LEIGH LEOPARDS MATCHDAY — PASS 5C
LIVE ADMIN APPROVAL QUEUE

WHAT IS NOW WORKING
- /admin remains a four-digit PIN screen.
- The Firebase moderator email/password never appears in the browser.
- The moderator account is used server-side through the Firebase Auth REST API.
- Pending, approved, rejected and all queues refresh automatically every four seconds.
- Approve updates the Firestore submission to approved.
- Approved photos immediately become available to the fan gallery.
- Reject and return-to-pending controls are included.
- Delete removes both the Storage image and Firestore record.
- Pending images can be safely previewed through an authenticated server route.
- Stats and live/offline status update automatically.

LOCAL SETUP
1. Duplicate .env.example as .env.
2. Enter the Firebase moderator email/password created in Authentication.
3. Set ADMIN_PIN=1239.
4. Set ADMIN_SESSION_SECRET to a long random value.
5. Run:
   npm install
   npm run dev
6. Open:
   http://localhost:5173/admin

VERCEL SETUP
Add these under Project Settings > Environment Variables:
- ADMIN_PIN
- ADMIN_SESSION_SECRET
- FIREBASE_MODERATOR_EMAIL
- FIREBASE_MODERATOR_PASSWORD
- FIREBASE_PROJECT_ID
- FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_API_KEY

Redeploy after adding the variables.

IMPORTANT
The moderator Firebase user must still have an active document at:
adminUsers/{FIREBASE_USER_UID}
with:
active: true
role: "moderator"

The PIN remains the only visible login. The hidden moderator credentials are server-only and must not be placed in browser JavaScript or committed to Git.
