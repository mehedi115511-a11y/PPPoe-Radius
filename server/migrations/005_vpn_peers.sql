-- Additive, reversible application registry. No router/network changes in this migration.
create table if not exists vpn_peers (
 id bigserial primary key,
 name varchar(100) not null unique,
 public_key varchar(44) not null unique,
 tunnel_ip inet not null unique,
 status varchar(16) not null default 'Pending' check(status in ('Pending','Active','Revoked','SyncError')),
 created_by bigint not null references app_users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revoked_at timestamptz,
 constraint vpn_peer_name_valid check (length(trim(name)) >= 3),
 constraint vpn_peer_tunnel_range check (tunnel_ip <<= inet '10.78.0.0/24' and tunnel_ip <> inet '10.78.0.1')
);
create index if not exists vpn_peers_status_idx on vpn_peers(status);
create table if not exists vpn_peer_audit (
 id bigserial primary key,
 peer_id bigint not null references vpn_peers(id),
 actor_user_id bigint not null references app_users(id),
 action varchar(32) not null check(action in ('Created','Revoked')),
 created_at timestamptz not null default now()
);

-- API role permissions (tables and identity sequences).
grant select,insert,update,delete on vpn_peers,vpn_peer_audit to pppoe_app;
grant usage,select on sequence vpn_peers_id_seq,vpn_peer_audit_id_seq to pppoe_app;
