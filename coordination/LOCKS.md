# Coordination Locks

A lock must include owner, scope, start time, reason, and release condition.

## Rules
- No simultaneous edit of the same shared file.
- No production migration or deployment without a deployment lock.
- Feature chats do not merge their own work into the release branch.
- Chat C owns controlled integration, smoke tests, rollback evidence, and lock release.

## Active locks
None.
