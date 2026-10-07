-- 관리자 계정 추가: admin3 (표시 이름 "개발자")
-- 가입 화면을 거치지 않고 인증 계정을 직접 만들고 관리자로 지정합니다.
-- 비밀번호는 해시만 기록되어 있으며(원문은 저장소에 없음), 처음 로그인한 뒤 "비밀번호 변경"에서 바꿔 주세요.
-- 이미 같은 아이디가 있으면 계정을 새로 만들지 않고 관리자로만 지정합니다.
do $$
declare
  uid uuid;
begin
  select id into uid from public.profiles where username = 'admin3';
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'admin3@id.chehumpick.kr',
      '$2a$10$IT0YD6zkbHC8INXdcygvxu.28MY/xJfIANoo2qR5N/3OFjFFau6Ja', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"role":"influencer","name":"개발자","phone":""}'::jsonb, now(), now(),
      '', '', '', '', '', false);
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, 'email',
      jsonb_build_object('sub', uid::text, 'email', 'admin3@id.chehumpick.kr', 'email_verified', true, 'phone_verified', false),
      now(), now(), now());
  end if;
  -- 프로필은 auth.users 삽입 트리거(handle_new_user)가 만들어 줌. 여기서 관리자로 지정
  update public.profiles set role = 'admin', name = '개발자', sns_type = null, sns_url = null, sns_links = '[]'::jsonb,
    store_name = null, plan = null, paid_until = null where id = uid;
end $$;
