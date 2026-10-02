-- 관리자 계정 교체: 새 계정(wjdgmlqkek)을 관리자로 지정한 뒤 기존 관리자(admin123)를 삭제
-- 새 계정이 아직 가입되지 않았으면 아무것도 바꾸지 않고 중단합니다.
do $$
declare
  new_id uuid;
  old_id uuid;
begin
  select id into new_id from public.profiles where username = 'wjdgmlqkek';
  if new_id is null then
    raise exception '새 관리자 계정(wjdgmlqkek)이 아직 가입되지 않았습니다.';
  end if;
  update public.profiles set role = 'admin' where id = new_id;

  select id into old_id from public.profiles where username = 'admin123';
  if old_id is not null then
    delete from auth.users where id = old_id;
  end if;
end $$;
