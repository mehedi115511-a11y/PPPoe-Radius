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

-- Legacy rows retain NULL owner until explicitly reconciled; never infer owner by role.
alter table app_clients add column if not exists owner_user_id bigint references app_users(id);
create index if not exists app_clients_owner_user_idx on app_clients(owner_user_id);

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

create table if not exists app_packages(
  id bigserial primary key,
  name text not null,
  download_mbps integer not null check(download_mbps>0),
  upload_mbps integer not null check(upload_mbps>0),
  price numeric(12,2) not null check(price>=0),
  validity_days integer not null default 30 check(validity_days>0),
  owner_role text not null check(owner_role in('Admin','Reseller','Sub-reseller')),
  status text not null default 'Active' check(status in('Active','Disabled')),
  created_at timestamptz not null default now()
);
create index if not exists app_packages_owner_idx on app_packages(owner_role,status);
-- NULL means unresolved legacy ownership; API must deny access until mapping.
alter table app_packages add column if not exists owner_user_id bigint references app_users(id);
create index if not exists app_packages_owner_user_idx on app_packages(owner_user_id,status);
create unique index if not exists app_packages_owner_name_unique
  on app_packages(owner_user_id,name) where owner_user_id is not null;

-- Exact package identity remains NULL on legacy clients pending explicit mapping.
alter table app_clients add column if not exists package_id bigint references app_packages(id);
create index if not exists app_clients_package_id_idx on app_clients(package_id);

-- Seed only unresolved legacy examples without relying on a removed role-wide constraint.
insert into app_packages(name,download_mbps,upload_mbps,price,validity_days,owner_role)
select seed.name,seed.download_mbps,seed.upload_mbps,seed.price,30,'Admin'
from (values ('10 Mbps',10,10,500),('20 Mbps',20,20,800),('50 Mbps',50,50,2000)) as seed(name,download_mbps,upload_mbps,price)
where not exists (select 1 from app_packages p where p.name=seed.name and p.owner_role='Admin' and p.owner_user_id is null);

insert into app_clients(name,username,phone,package_name,router_name,ip_address,expires_at,monthly_bill,status,owner_role)
values
 ('Saifan Net 1021','saifan-net-1021','01700-000001','20 Mbps','Dhaka-Core-01','10.22.4.18','2026-10-17',800,'Online','Reseller'),
 ('Rahim Home','rahim-home-77','01800-000077','10 Mbps','Gazipur-NAS-02','10.23.8.201','2026-10-12',500,'Offline','Reseller'),
 ('Hasan Office','hasan-office-12','01900-000012','30 Mbps','Narayanganj-01','10.24.1.94','2026-09-28',1200,'Online','Sub-reseller'),
 ('Mim Enterprise','mim-enterprise','01600-000009','50 Mbps','Dhaka-Core-01','10.22.9.11','2026-09-15',2000,'Expired','Reseller'),
 ('Jahid Telecom','jahid-tel-08','01300-000008','20 Mbps','Comilla-NAS-01','10.25.7.32','2026-10-03',800,'Offline','Sub-reseller')
on conflict(username) do nothing;
