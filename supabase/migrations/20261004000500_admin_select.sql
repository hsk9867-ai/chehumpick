-- 관리자도 사장님 대신 선정·탈락(과 취소)을 처리할 수 있게 함 (모집 인원 초과는 동일하게 차단)
create or replace function public.check_application_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cap integer;
  picked integer;
  step text := old.status || '>' || new.status;
  manager boolean := public.owns_campaign(old.campaign_id) or public.is_admin();
begin
  if new.campaign_id <> old.campaign_id or new.user_id <> old.user_id then
    raise exception '신청 대상은 바꿀 수 없습니다.';
  end if;
  if new.visited_at is distinct from old.visited_at then
    if old.status not in ('selected', 'submitted', 'done') then raise exception '선정된 신청만 사용 완료 처리할 수 있습니다.'; end if;
    if not manager and not (old.user_id = auth.uid() and old.visited_at is null and new.visited_at is not null) then
      raise exception '체험권 사용 완료는 본인이 한 번만 처리할 수 있습니다.';
    end if;
  end if;
  new.updated_at := now();
  if new.status = old.status and new.review_url = old.review_url then
    return new;
  end if;

  if public.is_admin() and step in ('submitted>done', 'submitted>selected', 'done>submitted') then
    null;
  elsif public.owns_campaign(old.campaign_id) and step = 'submitted>done' then
    null; -- 사장님이 제출된 리뷰를 확인하고 완료 처리
  elsif manager and step in ('applied>selected', 'applied>rejected', 'selected>applied', 'rejected>applied') then
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
