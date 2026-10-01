-- 관리자가 회원을 삭제 (로그인 계정까지 함께 삭제, 모집글·신청은 연쇄 삭제)
create function public.admin_delete_user(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '권한이 없습니다.'; end if;
  if exists (select 1 from public.profiles where id = target and role = 'admin') then
    raise exception '관리자 계정은 삭제할 수 없습니다.';
  end if;
  delete from auth.users where id = target;
end $$;
