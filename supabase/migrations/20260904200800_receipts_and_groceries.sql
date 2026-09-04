create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  store_label text,
  purchased_on date,
  subtotal_cents bigint,
  tax_cents bigint,
  total_cents bigint,
  -- Path within the private "receipts" storage bucket, e.g. "{user_id}/{uuid}.jpg".
  image_storage_path text,
  ai_extraction_status text not null default 'pending'
    check (ai_extraction_status in ('pending', 'confirmed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index receipts_user_id_idx on public.receipts (user_id);

create trigger set_receipts_updated_at
  before update on public.receipts
  for each row execute function public.set_updated_at();

alter table public.receipts enable row level security;

create policy "receipts_all_own" on public.receipts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_id is denormalized here (not just reachable via receipt_id) so its
-- RLS policy doesn't need a join — a standard Supabase performance pattern.
create table public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  label text not null,
  category text,
  price_cents bigint not null,
  quantity numeric(10, 2) not null default 1,
  created_at timestamptz not null default now()
);

create index receipt_items_user_id_idx on public.receipt_items (user_id);
create index receipt_items_receipt_id_idx on public.receipt_items (receipt_id);

alter table public.receipt_items enable row level security;

create policy "receipt_items_all_own" on public.receipt_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.pantry_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  image_storage_path text,
  ai_extraction_status text not null default 'pending'
    check (ai_extraction_status in ('pending', 'confirmed', 'failed')),
  created_at timestamptz not null default now()
);

create index pantry_scans_user_id_idx on public.pantry_scans (user_id);

alter table public.pantry_scans enable row level security;

create policy "pantry_scans_all_own" on public.pantry_scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Grocery List',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index grocery_lists_user_id_idx on public.grocery_lists (user_id);

create trigger set_grocery_lists_updated_at
  before update on public.grocery_lists
  for each row execute function public.set_updated_at();

alter table public.grocery_lists enable row level security;

create policy "grocery_lists_all_own" on public.grocery_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  grocery_list_id uuid not null references public.grocery_lists (id) on delete cascade,
  label text not null,
  estimated_price_cents bigint,
  is_checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index grocery_items_user_id_idx on public.grocery_items (user_id);
create index grocery_items_list_id_idx on public.grocery_items (grocery_list_id);

create trigger set_grocery_items_updated_at
  before update on public.grocery_items
  for each row execute function public.set_updated_at();

alter table public.grocery_items enable row level security;

create policy "grocery_items_all_own" on public.grocery_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
