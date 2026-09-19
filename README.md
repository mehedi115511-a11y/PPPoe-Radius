# PPPoE Radius Integration

ISP-grade multi-tenant PPPoE, RADIUS, reseller and billing management platform.

## Current milestone


## Portable installation

Requires Node.js 18+, PostgreSQL 14+, and a database account that owns or may create the target database.

```bash
npm ci
npm run install:app
npm run build
npm run start:api
```

The installer collects database connection and first-administrator settings, applies the fresh schema and ordered additive migrations, records SHA-256 checksums, verifies connectivity, and writes an owner-only `.env`. Re-runs skip checksum-matched migrations and reject changed history. `npm run package:portable` creates a transferable archive without `.env`, dependencies, build output, or untracked secrets.
- Responsive professional dashboard frontend
- Live operations, subscriber, infrastructure and finance overview
- Desktop, tablet and mobile layouts

The installer refuses a database that already exists on first install. For a previously installed copy, run `npm run install:app -- --rerun` with the same database settings; the installer verifies the local database marker and keeps the existing JWT secret and administrator password. Secret prompts require an interactive terminal and hide typed characters.
