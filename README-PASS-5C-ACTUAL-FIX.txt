PASS 5C ACTUAL FIX

This correction adds the moderator email/password form that admin.js already expected, and forces the flow:

PIN 1239 -> Firebase moderator email/password -> verified adminUsers UID -> live queue.

Files changed:
- admin.html
- admin.js

Copy both files into the project root and replace the existing versions.
Then stop and restart Vite, and hard refresh /admin.
