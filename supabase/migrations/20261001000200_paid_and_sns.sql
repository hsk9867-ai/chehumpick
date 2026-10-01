-- 사장님 이용권(유선 결제 후 관리자가 기간 지정)과 인플루언서 SNS 채널 여러 개 등록

alter table public.profiles
  add column paid_until date,                              -- 이 날짜까지 모집글 등록 가능 (비어 있으면 미결제)
  add column sns_links jsonb not null default '[]'::jsonb; -- [{ "type": "인스타그램", "url": "https://..." }, ...]

update public.profiles set sns_links = jsonb_build_array(jsonb_build_object('type', sns_type, 'url', sns_url))
where role = 'influencer' and sns_url is not null and sns_links = '[]'::jsonb;

-- 가입 시 입력한 SNS 채널을 목록의 첫 항목으로 저장
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := new.raw_user_meta_data;
  r text := case when m->>'role' = 'owner' then 'owner' else 'influencer' end;
begin
  insert into public.profiles (id, role, name, sns_type, sns_url, store_name, sns_links)
  values (new.id, r, coalesce(m->>'name', ''),
          case when r = 'influencer' then m->>'snsType' end,
          case when r = 'influencer' then m->>'snsUrl' end,
          case when r = 'owner' then m->>'storeName' end,
          case when r = 'influencer' and coalesce(m->>'snsUrl', '') <> ''
               then jsonb_build_array(jsonb_build_object('type', m->>'snsType', 'url', m->>'snsUrl'))
               else '[]'::jsonb end);
  insert into public.contacts (user_id, email, phone)
  values (new.id, new.email, coalesce(m->>'phone', ''));
  return new;
end $$;

-- 이용 기간이 남아 있는 사장님인지
create function public.is_paid_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'owner' and paid_until >= current_date)
$$;

-- 모집글 등록은 결제 확인된 사장님만
drop policy campaigns_insert on public.campaigns;
create policy campaigns_insert on public.campaigns for insert
  with check (owner_id = auth.uid() and public.is_paid_owner());

-- 관리자가 계정별로 결제 처리(기간 지정) 또는 해제(until = null)
create function public.admin_set_paid(target uuid, until date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '권한이 없습니다.'; end if;
  update public.profiles set paid_until = until where id = target and role = 'owner';
  if not found then raise exception '사장님 계정만 결제 처리할 수 있습니다.'; end if;
end $$;

-- 인플루언서가 자기 SNS 채널 목록을 수정 (최대 5개, http(s) 주소만)
create function public.update_my_sns(links jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
begin
  if jsonb_typeof(links) <> 'array' or jsonb_array_length(links) < 1 or jsonb_array_length(links) > 5 then
    raise exception 'SNS 채널은 1개 이상 5개 이하로 등록해 주세요.';
  end if;
  for item in select * from jsonb_array_elements(links) loop
    if coalesce(item->>'type', '') = '' or coalesce(item->>'url', '') !~* '^https?://\S+\.\S+' then
      raise exception 'SNS 채널 주소를 https://로 시작하는 주소로 입력해 주세요.';
    end if;
  end loop;
  update public.profiles
  set sns_links = links, sns_type = links->0->>'type', sns_url = links->0->>'url'
  where id = auth.uid() and role = 'influencer';
  if not found then raise exception '인플루언서 계정만 SNS 채널을 수정할 수 있습니다.'; end if;
end $$;
