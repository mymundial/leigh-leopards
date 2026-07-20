LEIGH LEOPARDS MATCHDAY CENTRE — SHARE PHOTOS FIREBASE PASS 2
==============================================================

WHAT THIS PASS ADDS
-------------------
The Share Photos form now connects to the Firebase project:

  leigh-leopards

The working flow is:

  supporter selects or takes a photo
  -> anonymous Firebase sign-in
  -> large photos are reduced in the browser where useful
  -> resumable upload to Firebase Storage
  -> Firestore document created with status "pending"
  -> upload progress and errors shown in the app
  -> supporter sees the Photo Received confirmation screen

The Turley Challenge from the previous pass is unchanged.

FIREBASE DATA CREATED
---------------------
Firestore collection:

  photoSubmissions

Storage path:

  photoSubmissions/leigh-v-warrington-2026/{anonymousUserId}/{submissionId}.jpg

Each Firestore submission includes:
- ownerId
- eventId
- status: pending
- optional supporterName
- storagePath
- file type and size
- creation timestamp
- consent version

The current event is controlled by one line in firebase.js:

  export const MATCHDAY_EVENT_ID = 'leigh-v-warrington-2026';

Change that value for each future matchday before deployment.

REQUIRED FIREBASE CONSOLE SETUP
-------------------------------
Before testing uploads, confirm all three are enabled:

1. Authentication
   Authentication -> Sign-in method -> Anonymous -> Enable

2. Firestore Database
   Create the default Firestore database.

3. Storage
   Create the default Cloud Storage bucket.

DEPLOY THE INCLUDED SECURITY RULES
----------------------------------
Vercel deploys the website, but it does not deploy Firebase security rules.
Run this once from the extracted project folder:

  npx firebase-tools login
  npx firebase-tools deploy --only firestore:rules,storage --project leigh-leopards

Included files:
- firebase.json
- .firebaserc
- firestore.rules
- storage.rules

The Pass 2 rules allow an authenticated anonymous supporter to:
- upload JPG, PNG or WEBP images up to 15MB
- create only a pending submission owned by their Firebase user ID

The rules do not allow supporters to:
- read the approval queue
- approve or reject photos
- edit submissions
- read uploaded images

Staff access and approved-photo reads will be added with the moderation and gallery passes.

LOCAL TEST
----------
Do not open index.html directly as a file. Use a local web server because the
Firebase SDK is loaded as JavaScript modules.

In VS Code Terminal:

  python3 -m http.server 5500

Then open:

  http://localhost:5500

VERCEL DEPLOYMENT
-----------------
Copy these files over the current Leigh Matchday project, then commit and push:

  git add .
  git commit -m "Connect Share Photos to Firebase"
  git push

Vercel will rebuild the website. The browser then connects directly to Firebase.

PASS 2 FILES
------------
- index.html               upload progress interface added
- styles.css               upload progress and disabled-state styling
- script.js                live Firebase submission flow and error handling
- firebase.js              Firebase configuration and upload/database logic
- firestore.rules          pending-submission database permissions
- storage.rules            image upload permissions and validation
- firebase.json            Firebase CLI rule deployment configuration
- .firebaserc              Firebase project mapping

CURRENT LIMITATIONS
-------------------
- There is not yet a staff approval page.
- There is not yet a public approved-photo gallery.
- There is not yet a big-screen carousel.
- Uploaded photos and Firestore submissions are deliberately private under the
  current rules until the moderation pass is built.
- The Turley Challenge leaderboard is still stored locally in the browser.

LOCAL DEVELOPMENT WITH VS CODE / VITE
--------------------------------------
Open this project folder in VS Code, then run:

  npm install
  npm run dev

Open the URL shown in the terminal, normally:

  http://localhost:5173

The moderation page is available at:

  http://localhost:5173/admin

PIN: 1239

Create a production build with:

  npm run build

Preview that build locally with:

  npm run preview
