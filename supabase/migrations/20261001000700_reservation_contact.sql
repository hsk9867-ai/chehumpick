-- 모집글의 예약 연락처: 선정된 인플루언서에게만 공개
-- 모집글 자체는 누구나 볼 수 있으므로 연락처는 별도 표에 두고 권한을 따로 검사합니다.
create table public.campaign_contacts (
  campaign_id uuid primary key references public.campaigns on delete cascade,
  phone text not null
);
alter table public.campaign_contacts enable row level security;

create policy campaign_contacts_select on public.campaign_contacts for select using (
  public.owns_campaign(campaign_id) or public.is_admin()
  or exists (select 1 from public.applications a
             where a.campaign_id = campaign_contacts.campaign_id and a.user_id = auth.uid()
               and a.status in ('selected', 'submitted', 'done'))
);
create policy campaign_contacts_insert on public.campaign_contacts for insert
  with check (public.owns_campaign(campaign_id) or public.is_admin());
create policy campaign_contacts_update on public.campaign_contacts for update
  using (public.owns_campaign(campaign_id) or public.is_admin());
