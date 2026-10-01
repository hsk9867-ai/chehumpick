-- 모집글 등록 시 입력하는 사장님 휴대폰 번호: 작성한 사장님과 관리자만 볼 수 있음
-- (예약 연락처는 선정된 인플루언서에게 공개되므로 표를 따로 둡니다)
create table public.campaign_owner_contacts (
  campaign_id uuid primary key references public.campaigns on delete cascade,
  phone text not null
);
alter table public.campaign_owner_contacts enable row level security;

create policy campaign_owner_contacts_select on public.campaign_owner_contacts for select
  using (public.owns_campaign(campaign_id) or public.is_admin());
create policy campaign_owner_contacts_insert on public.campaign_owner_contacts for insert
  with check (public.owns_campaign(campaign_id) or public.is_admin());
create policy campaign_owner_contacts_update on public.campaign_owner_contacts for update
  using (public.owns_campaign(campaign_id) or public.is_admin());
