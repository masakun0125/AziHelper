-- items テーブル
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon_url text not null,
  lore_url text not null,
  created_at timestamptz default now()
);

-- recipes テーブル
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  item_name text not null unique references items(name) on delete cascade,
  grid_image_url text not null,
  ingredients jsonb not null default '[]',
  created_at timestamptz default now()
);

-- admins テーブル
create table if not exists admins (
  discord_id text primary key,
  added_at timestamptz default now()
);

-- RLS を無効化（Botのanon keyからフルアクセスできるよう）
alter table items enable row level security;
alter table recipes enable row level security;
alter table admins enable row level security;

create policy "allow all" on items for all using (true) with check (true);
create policy "allow all" on recipes for all using (true) with check (true);
create policy "allow all" on admins for all using (true) with check (true);
