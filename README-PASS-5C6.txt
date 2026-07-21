PASS 5C.6 — SINGLE-PAGE MODERATOR AUTH

/admin is now one page with three locked stages:
1. PIN 1239
2. Firebase moderator email/password
3. Live moderation dashboard

The PIN code cannot display the dashboard. It only reveals the moderator login form.
The dashboard only opens after successful Firebase Authentication and verification of adminUsers/{uid}.

Run:
  npm install
  npm run dev

Open:
  http://localhost:5173/admin
