-- 체험단 신청 시 남기는 "신청 한마디": 신청자 본인, 해당 사장님, 관리자가 봄
alter table public.applications
  add column message text not null default '' check (char_length(message) <= 200);

-- 신청한 뒤에는 한마디를 바꿀 수 없음
create function public.keep_application_message() returns trigger
language plpgsql as $$
begin
  new.message := old.message;
  return new;
end $$;

create trigger applications_keep_message before update on public.applications
for each row execute function public.keep_application_message();
