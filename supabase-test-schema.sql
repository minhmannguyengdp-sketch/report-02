create table if not exists public.test_files (
  id text primary key,
  title text not null,
  test_date date,
  sales text,
  note text,
  sync_status text default 'synced',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.test_file_products (
  id text primary key,
  file_id text not null references public.test_files(id) on delete cascade,
  product_name text not null,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.test_customers (
  id text primary key,
  file_id text not null references public.test_files(id) on delete cascade,
  customer_name text not null,
  phone text,
  area text,
  status text default 'pending',
  note text,
  sync_status text default 'synced',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.test_customer_results (
  id text primary key,
  file_id text not null references public.test_files(id) on delete cascade,
  customer_id text not null references public.test_customers(id) on delete cascade,
  product_id text,
  product_name text not null,
  status text default 'pending',
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.test_files enable row level security;
alter table public.test_file_products enable row level security;
alter table public.test_customers enable row level security;
alter table public.test_customer_results enable row level security;

create policy if not exists "anon read test files" on public.test_files for select to anon using (true);
create policy if not exists "anon insert test files" on public.test_files for insert to anon with check (true);
create policy if not exists "anon update test files" on public.test_files for update to anon using (true) with check (true);

create policy if not exists "anon read test file products" on public.test_file_products for select to anon using (true);
create policy if not exists "anon insert test file products" on public.test_file_products for insert to anon with check (true);
create policy if not exists "anon update test file products" on public.test_file_products for update to anon using (true) with check (true);

create policy if not exists "anon read test customers" on public.test_customers for select to anon using (true);
create policy if not exists "anon insert test customers" on public.test_customers for insert to anon with check (true);
create policy if not exists "anon update test customers" on public.test_customers for update to anon using (true) with check (true);

create policy if not exists "anon read test customer results" on public.test_customer_results for select to anon using (true);
create policy if not exists "anon insert test customer results" on public.test_customer_results for insert to anon with check (true);
create policy if not exists "anon update test customer results" on public.test_customer_results for update to anon using (true) with check (true);
