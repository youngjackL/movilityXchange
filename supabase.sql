-- MobilityXchange database. Paste into Supabase > SQL Editor > Run.

create extension if not exists pgcrypto;

-- ---------- Cars (public read, published only) ----------
create table if not exists public.cars (
  id             uuid primary key default gen_random_uuid(),
  reg            text not null unique check (reg = upper(reg) and reg ~ '^[A-Z0-9]+$'),
  make           text not null,
  model          text not null,
  year           int  not null check (year between 1980 and 2100),
  price          int  not null check (price > 0),
  town           text not null,
  meeting_point  text,
  mileage_km     int,
  transmission   text,
  fuel           text,
  description    text,
  tiktok_url     text,                       -- full TikTok video URL (.../video/123456789...)
  photos         text[] not null default '{}', -- https URLs, e.g. from the car-photos bucket
  logbook_status text not null default 'pending' check (logbook_status in ('pending','clear')),
  owner_verified boolean not null default false,
  tims_checked   boolean not null default false,
  status         text not null default 'draft' check (status in ('draft','published','sold')),
  created_at     timestamptz not null default now()
);

alter table public.cars enable row level security;

drop policy if exists "public reads published cars" on public.cars;
create policy "public reads published cars"
  on public.cars for select to anon
  using (status = 'published');

-- ---------- Seller submissions (public can only INSERT, never read) ----------
create table if not exists public.seller_submissions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name)  between 2 and 120),
  phone        text not null check (char_length(phone) between 9 and 15),
  reg          text not null check (char_length(reg)   between 5 and 10),
  price        int  not null check (price > 0),
  town         text not null check (char_length(town) <= 60),
  logbook_path text not null,
  id_path      text not null,
  consent      boolean not null check (consent = true),
  status       text not null default 'new',
  created_at   timestamptz not null default now()
);

alter table public.seller_submissions enable row level security;

drop policy if exists "anyone can submit a car" on public.seller_submissions;
create policy "anyone can submit a car"
  on public.seller_submissions for insert to anon
  with check (consent = true and status = 'new');
-- No select policy for anon on purpose: only you (dashboard / service role) can read submissions.

-- ---------- Storage ----------
-- Private bucket for logbooks + IDs (upload-only for the public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seller-docs', 'seller-docs', false, 5242880,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "anon uploads seller docs" on storage.objects;
create policy "anon uploads seller docs"
  on storage.objects for insert to anon
  with check (bucket_id = 'seller-docs');

-- Public bucket for car photos (you upload from the dashboard, everyone can view)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('car-photos', 'car-photos', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
