# Shared Contracts

Before changing a shared API, schema, migration, RADIUS policy, router contract, or deployment interface:

1. Record owner, consumers, compatibility impact, and migration order.
2. Do not test a dependent module before its producer is READY_FOR_REVIEW.
3. Preserve backward compatibility or document the coordinated cutover.
4. Chat C owns final integration and production release.
5. Secrets remain outside Git in root-only configuration paths.
