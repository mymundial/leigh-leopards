PASS 5C FINAL FIX

/admin now rewrites to moderation.html and loads moderation-v3.js.
These new filenames bypass all previous admin.html/admin.js cache and overwrite issues.

Flow is hard locked to:
PIN 1239 -> moderator email/password -> Firebase moderator verification -> dashboard.

The PIN handler contains no code path to the dashboard.
