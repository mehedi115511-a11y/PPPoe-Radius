# PPPoE Radius Integration — Delivery Roadmap

## Working rule
Complete, test, deploy, and commit each chapter before moving to the next. Do not request approval for routine reversible implementation. Stop only for missing authority, provider restrictions, destructive operations, or required business choices.

## Chapter 1 — Platform foundation (completed)
- Ubuntu VPS, PostgreSQL, Redis, Nginx, FreeRADIUS
- React management panel and role dashboards
- System services, Git checkpoints, health checks

## Chapter 2 — Central MikroTik CHR (completed)
- CHR RouterOS VM, private RADIUS LAN, WireGuard interface
- PPP AAA/RADIUS connection and public Winbox proxy
- Dedicated full-access Winbox operator

## Chapter 3 — Authentication and hierarchy (completed)
- Admin, Reseller, Sub-reseller roles
- Secure login, rate limiting and signed sessions
- Admin impersonation with audit trail and return-to-admin

## Chapter 4 — Client and package management (completed)
- Role-scoped clients and packages
- Add/Edit/Delete UI and API
- Duplicate protection and immutable history
- PPPoE password, static IP, expiration and simultaneous-use
- FreeRADIUS password/rate-limit/static-IP synchronization

## Chapter 5 — VPN orchestration (in progress)
- Central WireGuard peer registry
- Create/revoke/download remote MikroTik peer configuration
- Unique tunnel IP allocation and QR/config export
- CHR peer synchronization, handshake/health status
- Restrict RADIUS and management traffic to VPN subnets

## Chapter 6 — PPPoE network services
- IP pools, local/remote address policies and pool exhaustion alerts
- NAS/router CRUD, shared-secret rotation and health monitoring
- PPPoE server profiles and RADIUS attributes
- Multi-router routing and failover

## Chapter 7 — Sessions and accounting
- radacct-backed online sessions
- Upload/download usage, uptime, NAS and assigned IP
- CoA/Disconnect and reconnect-ready actions
- Stale-session cleanup and interim-update monitoring

## Chapter 8 — Recharge, expiry and billing
- Full Cycle and Custom Days recharge
- Prorated package price calculation
- Expiry transition, restricted/expiry pool and restoration
- Invoices, collections, due, discounts and receipts

## Chapter 9 — Wallet and reseller business
- Admin/reseller/sub-reseller wallets
- Credit/debit ledger, package cost and profit
- Recharge authorization, balance limits and reversals
- Settlement and financial reports

## Chapter 10 — Customer portal and communication
- Customer login, profile, package, usage, invoices and payments
- SMS/WhatsApp/email notification adapters
- Expiry, recharge and payment reminders

## Chapter 11 — Operations and security
- RBAC permission matrix, MFA option and password rotation
- TLS/domain, firewall, backup/restore and secret management
- Audit logs, alerts, rate limits and abuse protection
- Performance, concurrency and database indexes

## Chapter 12 — Acceptance and production deployment
- Second CHR remote-site VPN test
- PPPoE dial, authentication, accounting, disconnect and recharge tests
- Failure/recovery and load tests
- Production runbook, administrator guide and final backup
