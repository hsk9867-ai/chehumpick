-- 사장님 요금제(Standard / Pro): 관리자가 지정. 요금제가 유효한 사장님의 모집글은 승인 없이 바로 게시
alter table public.profiles add column plan text check (plan in ('standard', 'pro'));

-- 요금제가 있고 이용 기간이 남은 사장님인지
create function public.has_plan() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'owner' and plan is not null and paid_until >= current_date)
$$;

-- 관리자가 요금제와 이용 종료일을 함께 지정 (plan이 비면 요금제 해제)
create function public.admin_set_plan(target uuid, new_plan text, until date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '권한이 없습니다.'; end if;
  if new_plan is not null and new_plan not in ('standard', 'pro') then raise exception '요금제는 standard 또는 pro만 가능합니다.'; end if;
  update public.profiles set plan = new_plan, paid_until = case when new_plan is null then null else until end
  where id = target and role = 'owner';
  if not found then raise exception '사장님 계정만 요금제를 지정할 수 있습니다.'; end if;
end $$;

-- 등록: 승인 대기로 등록하거나, 요금제가 유효하면 바로 게시 상태로 등록
drop policy campaigns_insert on public.campaigns;
create policy campaigns_insert on public.campaigns for insert
  with check (owner_id = auth.uid() and public.my_role() = 'owner'
              and (approval = 'pending' or (approval = 'approved' and public.has_plan())));
