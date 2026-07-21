PASS 5C.7 — MODERATOR QUEUE AUTHORISATION FIX

This build keeps the existing top-level photoSubmissions schema and authorises the current moderator directly by Firebase Authentication UID:

Uf3s1aGgddagiK4YUEP4RequxTu2

Why: the previous rule used repeated Firestore document lookups inside a collection query. Firestore can return permission-denied when rule document-access limits are exceeded. This build removes those rule lookups from moderator requests.

Deploy both rules from the project root:

npx firebase-tools deploy --only firestore:rules,storage --project leigh-leopards

Then restart Vite and hard refresh /admin.
