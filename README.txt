LEIGH LEOPARDS MATCHDAY CENTRE — TURLEY CHALLENGE PASS 2
========================================================

OPENING THE PROJECT
-------------------
1. Extract the ZIP.
2. Open the extracted folder in VS Code.
3. In the VS Code terminal run:

   python3 -m http.server 5500

4. Open http://localhost:5500

PASS 2 MATCH-SCREEN UPDATE
--------------------------
The Turley Challenge match screen has been rebuilt around the actual Monday Cup
WeeklyChallengeMatchScreen layout values and styles supplied in mondaycup-main 20.zip.

Matched Monday Cup layout values:
- 448px maximum mobile game frame
- 45px top bar
- Scoreboard height: 15.6% of the available screen beneath the top bar
- Ticker height: 24% of the scoreboard
- Pitch camera: goal/post top 8%, height 30%, width 80%, left 10%
- Advertising board: 8% pitch height immediately above the 38% field line
- Ball position: 50% x / 54.5% y
- Controls: bottom safe-area position, 4% outer inset, maximum 176px control zone
- Monday Cup power and accuracy meter dimensions, target zones and sweep speeds

Leigh rugby conversion changes retained:
- Top bar reads MATCH CENTRE
- Scoreboard label reads TURLEY CHALLENGE
- Scoreboard reads LEI 0 WAR
- Leigh and Warrington crest positions replace flag positions
- Red leopard-print Leigh top bar, ticker and advertising board
- LEIGH LEOPARDS advertising-board copy
- Rugby posts replace the football goal
- Goalkeeper removed
- Rugby ball replaces the football
- Horizontal mowing stripes
- Straight horizontal field line instead of the penalty-area curve
- Direction controls removed
- START KICK begins the power and accuracy sequence
- Successful conversions add two Leigh points
- One miss ends the run
- Result and local prototype leaderboard remain available in the end modal

SUPPLIED MONDAY CUP RESOURCES USED
----------------------------------
- SportsDIN Bold and Regular fonts
- Into Dot Matrix scoreboard font
- WeeklyChallengeMatchScreen sizing and scoreboard proportions
- Monday Cup crowd-generation geometry
- Monday Cup meter styling, target zones and meter speeds

CURRENT LIMITATIONS
-------------------
- assets/warrington-placeholder.svg is still a placeholder and should be replaced
  with the approved Warrington Wolves crest.
- Leaderboard scores are stored locally in the browser until Firebase is connected.
- Share Photos remains a front-end demonstration until the Firebase upload pass.
