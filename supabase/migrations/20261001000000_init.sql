-- 체험픽 Supabase 스키마 (초안)
-- Supabase 프로젝트에 한 번 실행합니다. 테이블, 권한 규칙(RLS), 상태 변경 규칙, 파일 저장소를 만듭니다.
-- 관리자 계정은 가입 후 아래 문장으로 직접 지정합니다.
--   update public.profiles set role = 'admin' where id = (select id from auth.users where email = '관리자 이메일');

-- ---------- 테이블 ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('influencer', 'owner', 'admin')),
  name text not null,
  sns_type text,
  sns_url text,
  store_name text,
  created_at timestamptz not null default now()
);

-- 연락처는 따로 보관: 본인, 관리자, 그리고 선정한 뒤의 사장님만 볼 수 있음
create table public.contacts (
  user_id uuid primary key references public.profiles on delete cascade,
  email text not null,
  phone text not null
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  store_name text not null,
  menu text not null,
  amount integer not null check (amount >= 0),
  region text not null,
  category text not null,
  channel text not null,
  capacity integer not null check (capacity >= 1),
  image text not null,
  deadline date not null,
  period_start date not null,
  period_end date not null,
  visit_start date not null,
  visit_end date not null,
  description text not null,
  conditions text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  status text not null default 'applied' check (status in ('applied', 'selected', 'rejected', 'submitted', 'done')),
  review_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id) -- 한 모집글에는 한 번만 신청
);

-- 관리자 페이지 "사이트 설정"의 문구와 영상·사진 주소
create table public.settings (
  key text primary key,
  value text not null
);

-- ---------- 도우미 함수 ----------
create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create function public.owns_campaign(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.campaigns where id = c and owner_id = auth.uid())
$$;

-- 모집글별 선정 인원 (누구나 볼 수 있는 숫자만 공개)
create function public.picked_counts() returns table (campaign_id uuid, picked bigint)
language sql stable security definer set search_path = public as $$
  select campaign_id, count(*) from public.applications
  where status in ('selected', 'submitted', 'done') group by campaign_id
$$;

-- ---------- 회원가입 시 프로필 자동 생성 ----------
-- 가입 화면에서 보낸 정보로 프로필을 만듭니다. 관리자 유형은 가입으로 만들 수 없습니다.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := new.raw_user_meta_data;
  r text := case when m->>'role' = 'owner' then 'owner' else 'influencer' end;
begin
  insert into public.profiles (id, role, name, sns_type, sns_url, store_name)
  values (new.id, r, coalesce(m->>'name', ''),
          case when r = 'influencer' then m->>'snsType' end,
          case when r = 'influencer' then m->>'snsUrl' end,
          case when r = 'owner' then m->>'storeName' end);
  insert into public.contacts (user_id, email, phone)
  values (new.id, new.email, coalesce(m->>'phone', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- 신청 상태 변경 규칙 ----------
-- 사장님: 선정·탈락과 그 취소 / 인플루언서: 리뷰 링크 제출 / 관리자: 완료 처리·재제출 요청·완료 취소
create function public.check_application_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cap integer;
  picked integer;
  step text := old.status || '>' || new.status;
begin
  if new.campaign_id <> old.campaign_id or new.user_id <> old.user_id then
    raise exception '신청 대상은 바꿀 수 없습니다.';
  end if;
  new.updated_at := now();
  if new.status = old.status and new.review_url = old.review_url then
    return new;
  end if;

  if public.is_admin() and step in ('submitted>done', 'submitted>selected', 'done>submitted') then
    null;
  elsif public.owns_campaign(old.campaign_id)
        and step in ('applied>selected', 'applied>rejected', 'selected>applied', 'rejected>applied') then
    if new.review_url <> old.review_url then raise exception '리뷰 링크는 바꿀 수 없습니다.'; end if;
    if new.status = 'selected' then
      select capacity into cap from public.campaigns where id = old.campaign_id;
      select count(*) into picked from public.applications
        where campaign_id = old.campaign_id and status in ('selected', 'submitted', 'done');
      if picked >= cap then raise exception '모집 인원이 이미 모두 선정되었습니다.'; end if;
    end if;
  elsif old.user_id = auth.uid() and step = 'selected>submitted' and new.review_url ~* '^https?://' then
    null;
  else
    raise exception '지금 상태에서는 처리할 수 없습니다.';
  end if;
  return new;
end $$;

create trigger applications_check_update before update on public.applications
for each row execute function public.check_application_update();

-- 선정 인원이 모집 인원에 도달하면 자동으로 모집 마감
create function public.close_when_full() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.campaigns c set status = 'closed'
  where c.id = new.campaign_id and c.status = 'open'
    and (select count(*) from public.applications a
         where a.campaign_id = c.id and a.status in ('selected', 'submitted', 'done')) >= c.capacity;
  return null;
end $$;

create trigger applications_close_when_full after update on public.applications
for each row execute function public.close_when_full();

-- ---------- 권한 규칙 (RLS) ----------
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.campaigns enable row level security;
alter table public.applications enable row level security;
alter table public.settings enable row level security;

-- 프로필: 본인, 관리자, 그리고 내 모집글에 신청한 사람의 프로필
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or public.is_admin()
  or exists (select 1 from public.applications a
             where a.user_id = profiles.id and public.owns_campaign(a.campaign_id))
);
create policy profiles_delete on public.profiles for delete using (public.is_admin() and role <> 'admin');

-- 연락처: 본인, 관리자, 그리고 내가 선정한 사람의 연락처
create policy contacts_select on public.contacts for select using (
  user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.applications a
             where a.user_id = contacts.user_id and a.status in ('selected', 'submitted', 'done')
               and public.owns_campaign(a.campaign_id))
);

-- 모집글: 누구나 보기, 사장님이 등록, 본인 글 또는 관리자가 수정·삭제
create policy campaigns_select on public.campaigns for select using (true);
create policy campaigns_insert on public.campaigns for insert
  with check (owner_id = auth.uid() and public.my_role() = 'owner');
create policy campaigns_update on public.campaigns for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy campaigns_delete on public.campaigns for delete
  using (owner_id = auth.uid() or public.is_admin());

-- 신청: 본인·해당 사장님·관리자가 보기, 인플루언서가 모집 중인 글에 신청
create policy applications_select on public.applications for select using (
  user_id = auth.uid() or public.is_admin() or public.owns_campaign(campaign_id)
);
create policy applications_insert on public.applications for insert with check (
  user_id = auth.uid() and public.my_role() = 'influencer' and status = 'applied' and review_url = ''
  and exists (select 1 from public.campaigns c
              where c.id = campaign_id and c.status = 'open' and c.deadline >= current_date)
);
-- 수정은 관련자만 시도할 수 있고, 허용되는 상태 변경은 위 트리거가 검사
create policy applications_update on public.applications for update using (
  user_id = auth.uid() or public.is_admin() or public.owns_campaign(campaign_id)
);

-- 사이트 설정: 누구나 보기, 관리자만 수정
create policy settings_select on public.settings for select using (true);
create policy settings_insert on public.settings for insert with check (public.is_admin());
create policy settings_update on public.settings for update using (public.is_admin());
create policy settings_delete on public.settings for delete using (public.is_admin());

-- ---------- 파일 저장소 ----------
-- media 버킷: site/ 는 관리자가 올리는 메인 영상·사진, campaigns/<회원 id>/ 는 사장님의 모집글 대표 이미지
insert into storage.buckets (id, name, public) values ('media', 'media', true);

create policy media_read on storage.objects for select using (bucket_id = 'media');
create policy media_insert on storage.objects for insert with check (
  bucket_id = 'media' and (
    public.is_admin()
    or ((storage.foldername(name))[1] = 'campaigns' and (storage.foldername(name))[2] = auth.uid()::text
        and public.my_role() = 'owner')
  )
);
create policy media_update on storage.objects for update using (
  bucket_id = 'media' and (public.is_admin() or owner = auth.uid())
);
create policy media_delete on storage.objects for delete using (
  bucket_id = 'media' and (public.is_admin() or owner = auth.uid())
);
