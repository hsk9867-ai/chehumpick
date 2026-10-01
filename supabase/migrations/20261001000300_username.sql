-- 이메일 대신 아이디로 가입·로그인
-- Supabase 로그인은 이메일 형식이 필요해서, 화면에서 받은 아이디를 내부용 주소(아이디@id.chehumpick.kr)로 바꿔 씁니다.
-- 이 주소로는 메일을 보내지 않습니다.

alter table public.profiles add column username text;
update public.profiles p set username = split_part(c.email, '@', 1) from public.contacts c where c.user_id = p.id;
alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_key unique (username);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := new.raw_user_meta_data;
  r text := case when m->>'role' = 'owner' then 'owner' else 'influencer' end;
begin
  -- 아이디는 로그인 주소의 앞부분으로 정함 (가입 정보로 다른 값을 보내도 무시)
  insert into public.profiles (id, role, name, username, sns_type, sns_url, store_name, sns_links)
  values (new.id, r, coalesce(m->>'name', ''), split_part(new.email, '@', 1),
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
