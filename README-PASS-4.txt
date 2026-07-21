LEIGH LEOPARDS MATCHDAY — PASS 4 BIG SCREEN PHOTO WALL
======================================================

RUN LOCALLY
-----------
1. Open this folder in VS Code.
2. Run:

   npm install
   npm run dev

3. Open:

   Main app:  http://localhost:5173/
   Admin:     http://localhost:5173/admin
   Big screen:http://localhost:5173/bigscreen

BIG SCREEN BEHAVIOUR
--------------------
- Designed primarily for a 1920 × 1080 landscape stadium display.
- Left panel contains Leigh branding and a placeholder QR code.
- Right panel contains six photo tiles in a 3 × 2 wall.
- Approved photos receive a Leigh Leopards crest watermark in the bottom-right.
- Portrait photos use a softly blurred version of the image behind the original,
  matching the visual approach in the supplied reference.
- Empty positions show the red leopard-print background and Leigh crest.
- More than six photos rotate automatically in pages every 10 seconds.

NO FIREBASE REQUIRED FOR THIS PASS
----------------------------------
The page currently reads an optional local test array. With no test photos it
correctly displays six branded empty tiles. Firebase can replace only the
readApprovedPhotos() function in bigscreen.js during the backend integration.

OPTIONAL LOCAL PHOTO TEST
-------------------------
Open the browser console while viewing /bigscreen and run:

localStorage.setItem('leighMatchday.approvedPhotos', JSON.stringify([
  { url: 'https://example.com/photo-1.jpg', name: 'Alex' },
  { url: 'https://example.com/photo-2.jpg', name: 'Sam' }
]));
location.reload();

Clear the test with:

localStorage.removeItem('leighMatchday.approvedPhotos');
location.reload();
