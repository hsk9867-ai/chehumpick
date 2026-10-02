-- 신청 취소를 선정된 뒤에도 허용: 리뷰 링크를 제출하기 전(신청·선정 상태)까지 본인이 취소 가능
drop policy applications_delete on public.applications;
create policy applications_delete on public.applications for delete
  using (user_id = auth.uid() and status in ('applied', 'selected'));
