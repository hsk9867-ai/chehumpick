-- 인플루언서가 자기 신청을 취소(삭제): 선정 전(신청 상태)일 때만 가능
create policy applications_delete on public.applications for delete
  using (user_id = auth.uid() and status = 'applied');
