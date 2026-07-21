Leigh Leopards Matchday App — Pass 5D

Run locally:
  npm install
  npm run dev

Routes:
  /              Matchday app and fan gallery
  /admin         PIN and Firebase moderator approval queue
  /bigscreen     Live approved-photo wall

Pass 5D connects /bigscreen directly to the same Firebase photoSubmissions feed used by the fan gallery and moderation page. Approved photos appear automatically without refreshing. Empty spaces retain the Leigh leopard-print fallback tiles.
