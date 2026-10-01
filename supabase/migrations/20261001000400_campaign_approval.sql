-- 모집글 승인제: 사장님이 등록 신청 → 관리자가 수락하면 게시
alter table public.campaigns
  add column approval text not null default 'pending' check (approval in ('pending', 'approved', 'rejected'));

-- 게시된(승인된) 글만 누구나 볼 수 있고, 승인 전 글은 작성한 사장님과 관리자만 봄
drop policy campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns for select
  using (approval = 'approved' or owner_id = auth.uid() or public.is_admin());

-- 등록은 항상 승인 대기 상태로만
drop policy campaigns_insert on public.campaigns;
create policy campaigns_insert on public.campaigns for insert
  with check (owner_id = auth.uid() and public.is_paid_owner() and approval = 'pending');

-- 승인 상태는 관리자만 바꿀 수 있음. 사장님은 반려된 글을 고쳐서 다시 신청(반려 → 승인 대기)만 가능
create function public.check_campaign_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id <> old.owner_id then raise exception '작성자는 바꿀 수 없습니다.'; end if;
  if new.approval <> old.approval and not public.is_admin()
     and not (old.approval = 'rejected' and new.approval = 'pending') then
    raise exception '승인 상태는 관리자만 바꿀 수 있습니다.';
  end if;
  return new;
end $$;

create trigger campaigns_check_update before update on public.campaigns
for each row execute function public.check_campaign_update();

-- 신청은 게시된 글에만
drop policy applications_insert on public.applications;
create policy applications_insert on public.applications for insert with check (
  user_id = auth.uid() and public.my_role() = 'influencer' and status = 'applied' and review_url = ''
  and exists (select 1 from public.campaigns c
              where c.id = campaign_id and c.approval = 'approved' and c.status = 'open' and c.deadline >= current_date)
);
