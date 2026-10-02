-- 회원이 자기 이름·연락처를 수정 (사장님은 매장명도). 인플루언서·사장님·관리자 모두 사용
create function public.update_my_profile(p_name text, p_phone text, p_store_name text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r text := public.my_role();
begin
  if r is null then raise exception '로그인이 필요합니다.'; end if;
  if btrim(coalesce(p_name, '')) = '' or char_length(btrim(p_name)) > 30 then
    raise exception '이름을 30자 이내로 입력해 주세요.';
  end if;
  if btrim(coalesce(p_phone, '')) !~ '^[0-9-]{9,13}$' then
    raise exception '연락처를 정확히 입력해 주세요.';
  end if;
  if r = 'owner' and btrim(coalesce(p_store_name, '')) = '' then
    raise exception '매장명을 입력해 주세요.';
  end if;
  update public.profiles
  set name = btrim(p_name),
      store_name = case when r = 'owner' then btrim(p_store_name) else store_name end
  where id = auth.uid();
  update public.contacts set phone = btrim(p_phone) where user_id = auth.uid();
end $$;
