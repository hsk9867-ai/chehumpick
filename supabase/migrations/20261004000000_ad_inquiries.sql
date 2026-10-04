-- 광고주 센터 상담 문의: 누구나(로그인 없이) 남길 수 있고, 관리자만 보고 처리함
create table public.ad_inquiries (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text not null default '',
  phone text not null,
  source text not null default '',   -- 체험픽을 알게 된 경로
  message text not null default '',
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.ad_inquiries enable row level security;

create policy ad_inquiries_insert on public.ad_inquiries for insert with check (
  char_length(company) between 1 and 100 and char_length(contact_name) <= 50
  and phone ~ '^[0-9-]{9,13}$' and char_length(source) <= 50 and char_length(message) <= 1000 and done = false
);
create policy ad_inquiries_select on public.ad_inquiries for select using (public.is_admin());
create policy ad_inquiries_update on public.ad_inquiries for update using (public.is_admin());
create policy ad_inquiries_delete on public.ad_inquiries for delete using (public.is_admin());
