LEIGH LEOPARDS MATCHDAY — PASS 5B CORRECTION

Changes
-------
1. TAKE PHOTO now opens an in-browser live camera when camera access is
   available. On browsers without getUserMedia support it falls back to the
   mobile capture input.
2. A selected/taken photo now replaces the ADD A MATCHDAY PHOTO panel instead
   of creating a separate preview card below the source buttons.
3. The app checks that the current Warrington event exists and is open before
   uploading.
4. If the event document does not exist, the app creates the single locked
   Warrington event document using the exact values allowed by the updated
   Firestore rules.
5. Firebase error messages now distinguish missing event configuration,
   closed uploads, Storage rejection and Firestore rejection.

Required Firebase step
----------------------
The updated Firestore rules must be published once because they permit the app
only to create the exact current event document:

  events/leigh-v-warrington-2026

No arbitrary event data can be created by supporters. Once the event exists,
only a moderator can update or delete it.

Deploy from the project root:

  npx firebase-tools deploy --only firestore,storage --project leigh-leopards

Or copy firestore.rules into Firebase Console > Firestore Database > Rules and
click Publish. The Storage rules are unchanged but are included for a clean
combined deploy.

Run locally
-----------
  npm install
  npm run dev

Camera notes
------------
Live camera access requires HTTPS or localhost and browser camera permission.
On a desktop it uses the webcam. On a phone it requests the rear-facing camera.
If permission is denied, Choose Photo remains available.
