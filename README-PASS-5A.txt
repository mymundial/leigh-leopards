LEIGH LEOPARDS MATCHDAY — PASS 5A
Firebase collections, Storage and security rules

WHAT THIS PASS DOES
-------------------
- Moves photo records into: events/{eventId}/photos/{photoId}
- Moves image files into: matchday-events/{eventId}/uploads/{uid}/{photoId}/{photoId}.ext
- Adds the scores collection ready for the Turley Challenge leaderboard
- Adds adminUsers-based moderator permissions
- Allows public reads of approved photos only
- Allows public reads of leaderboard scores
- Blocks supporters from approving photos, editing scores or reading other pending photos
- Adds Firestore indexes for moderation, gallery, big-screen and leaderboard queries
- Adds Firebase emulator and deployment scripts
- Rolls back an uploaded Storage object if the matching Firestore record fails

CURRENT EVENT
-------------
leigh-v-warrington-2026

ONE FIRESTORE DOCUMENT STILL REQUIRED
-------------------------------------
In Firebase Console > Firestore Database > Data:

1. Start collection: events
2. Document ID: leigh-v-warrington-2026
3. Add these fields:

active          boolean   true
uploadsOpen     boolean   true
challengeOpen   boolean   true
homeTeam        string    Leigh Leopards
homeCode        string    LEI
awayTeam        string    Warrington Wolves
awayCode        string    WAR
status          string    active

The existing adminUsers/{moderator UID} document remains in place.

INSTALL AND TEST THE WEB APP
----------------------------
npm install
npm run dev

DEPLOY FIREBASE RULES AND INDEXES
---------------------------------
npm run firebase:login
npm run firebase:deploy

Firebase may ask for permission for Storage Rules to read Firestore. Approve it.
Rules can take a few minutes to propagate after deployment.

IMPORTANT
---------
/admin and /bigscreen are not connected to Firebase in Pass 5A. That happens in Passes 5C and 5D.
The fan gallery is added in Pass 5B.
The Turley Challenge score write and live leaderboard are added in Pass 5E.
The visible admin PIN is not the Firebase security boundary. Moderator permissions come from Authentication plus adminUsers/{uid}.
