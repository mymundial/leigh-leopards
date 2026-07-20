LEIGH LEOPARDS MATCHDAY — PASS 3: ADMIN PIN PAGE

This is an overlay patch for the existing Leigh Matchday project.

COPY INTO THE PROJECT ROOT:
- admin.html
- admin.css
- admin.js
- vercel.json

Then redeploy through Vercel.

ADMIN URL:
https://YOUR-DOMAIN/admin

ACCESS CODE:
1239

CURRENT BEHAVIOUR:
- /admin opens a four-digit code screen.
- Correct code opens the Photo Moderation dashboard.
- Access lasts for the current browser tab/session.
- Lock returns to the code screen.
- The moderation queue is intentionally empty because Firebase has not yet been connected.

IMPORTANT:
The code is stored in browser JavaScript. This is suitable as a temporary matchday gate/prototype, but it is not secure authentication. When the Firebase backend is connected, replace it with protected staff authentication or a server-side code check.
