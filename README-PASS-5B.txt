LEIGH LEOPARDS MATCHDAY — PASS 5B
PHOTO UPLOADER + LIVE FAN GALLERY

WHAT IS CONNECTED
- Camera and gallery photo selection
- Client-side resizing/compression before upload
- Anonymous Firebase Authentication
- Firebase Storage upload with progress
- Firestore moderation record created as status: pending
- Live fan gallery on the Share Photos page
- Gallery query only requests approved photos
- Approved Storage images are resolved after the secured Firestore query
- Gallery updates automatically using a Firestore realtime listener
- Empty, loading, offline/error and retry states
- Full-screen tap-to-view photo lightbox
- Latest 18 approved photos shown to control reads and image transfer

RUN LOCALLY
1. npm install
2. npm run dev
3. Open the local URL shown by Vite
4. Click Share Photos

HOW TO TEST BEFORE PASS 5C
The admin page is not connected to Firebase until Pass 5C.

1. Upload a photo in the app.
2. In Firebase Console open:
   Firestore Database > events > leigh-v-warrington-2026 > photos
3. Open the new photo document.
4. Change status from pending to approved.
5. Return to the Share Photos page. The gallery updates automatically.

The photo itself is stored under:
matchday-events/leigh-v-warrington-2026/uploads/{ownerUid}/{photoId}/{fileName}

FIREBASE INDEX
The gallery uses:
status ASC + createdAt DESC

That index is already present in firestore.indexes.json. If Firebase reports that
the index is still building, wait until it becomes Enabled in the Firebase console.

VALIDATION COMPLETED
- node --check script.js
- node --check firebase.js
- npm run build
