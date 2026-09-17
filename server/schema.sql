create table if not exists app_clients(
  id bigserial primary key,
  name text not null,
  username text not null unique,
  phone text not null,
  package_name text not null,
  router_name text not null,
  ip_address inet,
  expires_at date not null,
  monthly_bill numeric(12,2) not null check(monthly_bill>=0),
  status text not null check(status in('Online','Offline','Expired')),
  owner_role text not null check(owner_role in('Admin','Reseller','Sub-reseller')),
  created_at timestamptz not null default now()
);
create index if not exists app_clients_status_idx on app_clients(status);
create index if not exists app_clients_owner_role_idx on app_clients(owner_role);

create table if not exists app_users(
  id bigserial primary key,
  name text not null,
  username text not null unique,
  password_hash text not null,
  role text not null check(role in('Admin','Reseller','Sub-reseller')),
  parent_user_id bigint references app_users(id),
  status text not null default 'Active' check(status in('Active','Suspended')),
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists app_impersonation_audit(
  id bigserial primary key,
  admin_user_id bigint not null references app_users(id),
  target_user_id bigint not null references app_users(id),
  started_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);
create index if not exists app_impersonation_audit_admin_idx on app_impersonation_audit(admin_user_id,started_at desc);

create table if not exists app_client_history(
  id bigserial primary key,
  client_id bigint not null,
  action text not null check(action in('Created','Updated','Deleted')),
  snapshot jsonb not null,
  actor_user_id bigint references app_users(id),
  created_at timestamptz not null default now()
);
create index if not exists app_client_history_client_idx on app_client_history(client_id,created_at desc);

insert into app_clients(name,username,phone,package_name,router_name,ip_address,expires_at,monthly_bill,status,owner_role)
values
 ('Saifan Net 1021','saifan-net-1021','01700-000001','20 Mbps','Dhaka-Core-01','10.22.4.18','2026-10-17',800,'Online','Reseller'),
 ('Rahim Home','rahim-home-77','01800-000077','10 Mbps','Gazipur-NAS-02','10.23.8.201','2026-10-12',500,'Offline','Reseller'),
 ('Hasan Office','hasan-office-12','01900-000012','30 Mbps','Narayanganj-01','10.24.1.94','2026-09-28',1200,'Online','Sub-reseller'),
 ('Mim Enterprise','mim-enterprise','01600-000009','50 Mbps','Dhaka-Core-01','10.22.9.11','2026-09-15',2000,'Expired','Reseller'),
 ('Jahid Telecom','jahid-tel-08','01300-000008','20 Mbps','Comilla-NAS-01','10.25.7.32','2026-10-03',800,'Offline','Sub-reseller')
on conflict(username) do nothing;
