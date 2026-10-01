-- 아이디 찾기, 비밀번호 재설정 요청, 관리자의 임시 비밀번호 발급
-- 이메일·문자 인증이 없으므로 비밀번호는 회원이 직접 재설정하지 못하고,
-- 관리자가 가입 시 등록된 연락처로 본인 확인을 한 뒤 임시 비밀번호를 발급합니다.

create table public.password_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  done boolean not null default false
);
alter table public.password_requests enable row level security;
create policy password_requests_select on public.password_requests for select using (public.is_admin());

create function public.digits(t text) returns text
language sql immutable as $$ select regexp_replace(coalesce(t, ''), '\D', '', 'g') $$;

-- 아이디 찾기: 이름과 연락처가 일치하는 회원의 아이디를 뒤쪽 절반을 가려서 돌려줌
create function public.find_username(p_name text, p_phone text) returns setof text
language sql stable security definer set search_path = public as $$
  select left(p.username, ceil(length(p.username) / 2.0)::int)
         || repeat('*', length(p.username) - ceil(length(p.username) / 2.0)::int)
  from public.profiles p join public.contacts c on c.user_id = p.id
  where p.role <> 'admin' and p.name = btrim(p_name)
    and public.digits(p_phone) <> '' and public.digits(c.phone) = public.digits(p_phone)
$$;

-- 비밀번호 재설정 요청: 아이디·이름·연락처가 모두 일치하면 요청을 남김 (일치 여부는 알려 주지 않음)
create function public.request_password_reset(p_username text, p_name text, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  select p.id into uid
  from public.profiles p join public.contacts c on c.user_id = p.id
  where p.role <> 'admin' and p.username = lower(btrim(p_username)) and p.name = btrim(p_name)
    and public.digits(p_phone) <> '' and public.digits(c.phone) = public.digits(p_phone);
  if uid is not null and not exists (select 1 from public.password_requests where user_id = uid and not done) then
    insert into public.password_requests (user_id) values (uid);
  end if;
end $$;

-- 관리자가 임시 비밀번호 발급 (관리자 계정은 대상에서 제외)
create function public.admin_reset_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception '권한이 없습니다.'; end if;
  if length(coalesce(new_password, '')) < 8 then raise exception '비밀번호는 8자 이상이어야 합니다.'; end if;
  if not exists (select 1 from public.profiles where id = target and role <> 'admin') then
    raise exception '이 계정의 비밀번호는 바꿀 수 없습니다.';
  end if;
  update auth.users set encrypted_password = crypt(new_password, gen_salt('bf')), updated_at = now() where id = target;
  update public.password_requests set done = true where user_id = target and not done;
end $$;
