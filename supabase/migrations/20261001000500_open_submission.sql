-- 결제 여부와 관계없이 사장님이면 누구나 모집글 등록 신청 가능 (게시는 관리자 수락 후)
-- 결제받음/결제받지않음 표시는 관리자가 수락 여부를 판단할 때 참고하는 정보로 남김
drop policy campaigns_insert on public.campaigns;
create policy campaigns_insert on public.campaigns for insert
  with check (owner_id = auth.uid() and public.my_role() = 'owner' and approval = 'pending');
