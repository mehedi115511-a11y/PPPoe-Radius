# PPPOE-01 router removal verification

Integration branch checkpoint `660d17be0d2f1648de0f6418bc77e00d94975226` was fast-forward synced to the isolated integration worktree (`/opt/pppoe-radius-chat-c`), with clean status. Tests: `npm test -- --run server/routers/delete-gate.test.js` -> 3/3 pass; earlier `npm test -- --run` at `e15140fb8991a485e1406080fccf20053410fd57` -> 126/126 pass and `npm run build` -> pass. No claim of full suite run at this document commit.

Deletion is intentionally disabled (409 for an owned existing record), not dependency-aware. Invalid IDs: 422; inaccessible or missing rows: 404. The regression tests check that the database is read only for rejected deletions. Real PostgreSQL migration test, credential encryption, RADIUS secret lifecycle, safe reference mapping and authorized RouterOS health checks are outstanding. Production, router configuration and `/opt/project-two` were not changed.
