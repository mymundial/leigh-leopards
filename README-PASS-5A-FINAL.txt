PASS 5A — FINAL CODE PATCH

This ZIP is intentionally root-level. Copy/extract its contents directly into the root of the existing Leigh Matchday project.

It contains:
- Firebase app configuration and anonymous authentication
- Real photo upload helper aligned with the published Firestore/Storage rules
- Current Warrington event configuration
- Firestore and Storage rule source files
- Firestore indexes
- Working npm scripts for Firebase deployment and emulators
- No create-event script and no moderator-email prompt

After copying:
  npm install
  npm run dev

The Firebase console setup, published rules and events/leigh-v-warrington-2026 document must already exist.
