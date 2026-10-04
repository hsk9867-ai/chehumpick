-- 개발자용 관리자 계정(admin): 관리자로 지정하고 이름을 "개발자"로 표시 (회원 목록에 그대로 보임)
do $$
declare dev_id uuid;
begin
  select id into dev_id from public.profiles where username = 'admin';
  if dev_id is null then raise exception '개발자 계정(admin)이 아직 가입되지 않았습니다.'; end if;
  update public.profiles set role = 'admin', name = '개발자', store_name = null, plan = null, paid_until = null where id = dev_id;
end $$;
