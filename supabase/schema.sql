-- Kiki Shop Items Schema
-- Tables for items, render properties, assets, slots, crates

-- Slots table (predefined equipment slots)
create table if not exists slots (
  id text primary key check (id in ('hair','hat','glasses','mask','shirt','jacket','backpack','cape','wings'))
);

-- Main items table
create table if not exists items (
  id          bigserial primary key,
  name        text not null,
  slot_id     text not null references slots(id),
  rarity      text check (rarity in ('common','rare','epic','legendary')),
  price       integer not null default 0,
  tags        text[] not null default '{}',
  is_published boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Item rendering properties for overlay system
create table if not exists item_render_props (
  item_id     bigint primary key references items(id) on delete cascade,
  socket      text not null default 'head',
  dx          real not null default 0,
  dy          real not null default 0,
  scale       real not null default 1,
  base_deg    real not null default 0,
  bias_deg    real not null default 0,
  pivot_dx    real not null default 0,
  pivot_dy    real not null default 0,
  extras      jsonb not null default '{}'  -- e.g. { "animationType": "physics" }
);

-- Item assets (thumbnails, front/back views)
create table if not exists item_assets (
  item_id     bigint references items(id) on delete cascade,
  kind        text not null check (kind in ('thumb','front','back')),
  url         text not null,
  primary key (item_id, kind)
);

-- Crates (loot boxes)
create table if not exists crates (
  id          bigserial primary key,
  name        text not null,
  is_published boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Items within crates with weights for drop rates
create table if not exists crate_items (
  crate_id    bigint references crates(id) on delete cascade,
  item_id     bigint references items(id) on delete cascade,
  weight      real not null check (weight > 0),
  primary key (crate_id, item_id)
);

-- Indexes for performance
create index if not exists items_published_idx on items (is_published);
create index if not exists items_slot_idx on items (slot_id, is_published);
create index if not exists items_created_idx on items (created_at desc);
create index if not exists items_tags_idx on items using gin (tags);

-- Row Level Security (RLS)
alter table items enable row level security;
create policy read_published_items on items
  for select using (is_published = true);

alter table item_render_props enable row level security;
create policy read_props_published on item_render_props
  for select using (
    exists (select 1 from items i where i.id = item_id and i.is_published)
  );

alter table item_assets enable row level security;
create policy read_assets_published on item_assets
  for select using (
    exists (select 1 from items i where i.id = item_id and i.is_published)
  );

alter table crates enable row level security;
create policy read_published_crates on crates
  for select using (is_published = true);

alter table crate_items enable row level security;
create policy read_crate_items_published on crate_items
  for select using (
    exists (select 1 from crates c where c.id = crate_id and c.is_published)
  );

-- Insert default slots
insert into slots (id) values 
  ('hair'), ('hat'), ('glasses'), ('mask'), ('shirt'), 
  ('jacket'), ('backpack'), ('cape'), ('wings')
on conflict (id) do nothing;