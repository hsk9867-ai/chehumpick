-- 선정된 인플루언서가 스스로 취소한 인원 수를 모집글에 기록 (사장님이 빈자리만큼 다시 모집할 때 사용)
alter table public.campaigns add column cancelled integer not null default 0;

create function public.count_selection_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'selected' and old.user_id = auth.uid() then
    update public.campaigns set cancelled = cancelled + 1 where id = old.campaign_id;
  end if;
  return null;
end $$;

create trigger applications_count_cancel after delete on public.applications
for each row execute function public.count_selection_cancel();
