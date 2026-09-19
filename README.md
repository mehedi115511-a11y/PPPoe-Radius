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

The installer accepts an empty pre-created database and needs database creation permission only when the target does not exist. A database with existing tables is refused on first install. For a previously installed copy, run `npm run install:app -- --rerun` with the same database settings; the installer verifies the local database marker and keeps the existing JWT secret and administrator password. Secret prompts require an interactive terminal and hide typed characters.

After starting the API, run `npm run smoke:install`. It checks the installed database, migration ledger, active administrator and the local API health endpoint. It exits nonzero on failure and never prints credentials.

For a Linux host, see `deploy/pppoe-api.service.example` and `deploy/nginx.conf.example`. Replace each placeholder, set a dedicated OS user, configure TLS at the reverse proxy, and point the web origin/CORS setting to the installed domain. The API binds to loopback. These templates are examples and are never installed automatically.

The installer also accepts the VPN public endpoint, CHR WireGuard public key/port (RouterOS 7), and L2TP/IPsec shared secret (RouterOS 6). Provide settings for the RouterOS versions you use. The generated VPN script is returned only once; retain it securely.

Migration 013 creates the FreeRADIUS credential tables for a new database. Configure FreeRADIUS SQL and CHR L2TP/RADIUS separately for live RouterOS 6 authentication; the installer does not alter a router.

The portable packaging command emits both `.zip` and `.tar.gz` from the committed Git revision. Extract either archive, run `npm ci`, then complete the interactive installer.

Portable fresh installations start with empty client and package tables. Historical demonstration rows in `server/schema.sql` are skipped by the installer; existing databases are never backfilled or cleared.
