/*
 * 데이터 계층 (프로토타입)
 * 지금은 브라우저 localStorage에 저장합니다. 실제 오픈 시에는 이 파일의 함수 내용만
 * 서버 DB(Supabase 등) 호출로 바꾸면 화면 코드(app.js)는 그대로 쓸 수 있습니다.
 * 주의: localStorage 방식은 비밀번호가 브라우저에 그대로 저장되므로 데모 용도로만 사용하세요.
 */
(function () {
  const KEY = 'chehumpick.v1';
  const SESSION_KEY = 'chehumpick.session';

  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // 선정 인원으로 집계하는 상태
  const PICKED = ['selected', 'submitted', 'done'];

  // 관리자 페이지 "사이트 설정"에서 고칠 수 있는 문구의 기본값
  // 목록 항목은 한 줄에 하나씩, 칸은 | 로 구분합니다. 약관은 # 으로 시작하는 줄이 제목입니다.
  const DEFAULT_SETTINGS = {
    heroTitle: '맛집을 경험하고\n나만의 콘텐츠로\n남겨보세요!',
    heroSub: '체험픽은 사장님과 리뷰어를 연결하는\n체험단 플랫폼입니다.',
    heroButton: '체험단 둘러보기',
    heroNote: '좋은 경험이\n특별한 콘텐츠가 되는 곳 :)',
    homeListTitle: '지금 모집 중인 체험단',
    ctaInfTitle: '리뷰어로 참여하기',
    ctaInfText: '맛집, 카페, 뷰티 등 다양한\n체험단에 참여해 보세요!',
    ctaInfButton: '리뷰어 가입하기',
    ctaOwnerTitle: '사장님이신가요?',
    ctaOwnerText: '체험단 모집부터 관리까지\n체험픽이 도와드립니다.',
    ctaOwnerButton: '사장님 안내 보기',
    featuresTitle: '체험픽은 이런 점이 달라요!',
    features: [
      '📷 | 다양한 체험단 | 맛집, 카페, 뷰티, 숙박 등 다양한 카테고리',
      '🛡️ | 검증된 리뷰어 | SNS 채널을 확인하고 직접 선정',
      '💛 | 간편한 신청 | 복잡한 절차 없이 버튼 한 번으로 신청',
      '📍 | 지역 기반 매칭 | 아산·천안 지역 중심의 맞춤형 체험단'
    ].join('\n'),
    ownerTitle: '사장님 안내',
    ownerSub: '체험픽과 함께\n우리 매장 체험단을 모집해 보세요.',
    ownerNote: '사장님의 매장이\n더 많은 사람들에게\n알려질 수 있도록!',
    ownerSteps: [
      '📣 | 체험단 모집 | 원하는 조건으로 모집글을 직접 등록해요.',
      '👥 | 참여자 선정 | 신청자의 SNS 채널을 확인하고 선정해요.',
      '🗓️ | 방문 일정 안내 | 선정된 리뷰어에게 방문 가능 기간이 안내돼요.',
      '📝 | 후기 확인 | 리뷰 링크 제출과 완료까지 확인해요.'
    ].join('\n'),
    promiseTitle: '체험픽이 드리는 약속',
    promises: [
      '지역 기반의 신뢰도 높은 리뷰어 매칭',
      '체험단 모집부터 완료까지 한 곳에서 관리',
      '실제 방문한 리뷰어의 퀄리티 높은 콘텐츠',
      '합리적인 비용으로 높은 마케팅 효과'
    ].join('\n'),
    promiseNote: '사장님의\n성공적인 마케팅을\n응원합니다! :)',
    faqIntro: '자주 묻는 질문을 먼저 확인해 보세요.',
    faq: [
      '체험단은 어떻게 신청하나요? | 인플루언서로 회원가입한 뒤, 원하는 모집글 상세 화면에서 신청하기 버튼을 누르면 됩니다. 한 모집글에는 한 번만 신청할 수 있습니다.',
      '선정 결과는 어디서 확인하나요? | 마이페이지의 신청 목록에서 진행 상태(선정 대기 중 · 선정됨 · 미선정)를 확인할 수 있습니다.',
      '방문 일정은 어떻게 정하나요? | 선정되면 마이페이지에 방문 가능 기간이 표시됩니다. 기간 안에 매장과 연락해 방문해 주세요.',
      '리뷰는 어떻게 제출하나요? | 방문 후 리뷰를 게시하고, 마이페이지에서 게시물 주소(링크)를 입력해 제출합니다. 관리자가 확인하면 완료 처리됩니다.',
      '리뷰가 조건에 맞지 않으면 어떻게 되나요? | 관리자가 재제출을 요청하며, 마이페이지에서 링크를 다시 제출할 수 있습니다.',
      '사장님은 어떻게 체험단을 모집하나요? | 사장님으로 회원가입한 뒤 마이페이지에서 모집글을 등록하고, 신청자의 SNS 채널을 확인해 선정하시면 됩니다.'
    ].join('\n'),
    contactEmail: 'help@chehumpick.kr',
    categories: '맛집, 카페, 뷰티, 숙박, 기타',
    footerTagline: '좋은 경험이\n특별한 콘텐츠가 되는 곳',
    copyright: '© 2026 체험픽. All rights reserved.',
    terms: [
      '# 제1조 (목적)',
      '이 약관은 체험픽(이하 "회사")이 제공하는 체험단 매칭 서비스(이하 "서비스")의 이용 조건과 절차, 회사와 회원의 권리·의무를 정하는 것을 목적으로 합니다.',
      '# 제2조 (회원의 종류)',
      '회원은 체험단에 신청하는 인플루언서 회원과 체험단을 모집하는 사장님 회원으로 구분합니다.',
      '# 제3조 (회원가입)',
      '회원가입은 이용자가 약관에 동의하고 가입 양식에 정보를 입력한 뒤 회사가 이를 승낙함으로써 성립합니다. 허위 정보를 입력한 경우 서비스 이용이 제한될 수 있습니다.',
      '# 제4조 (체험단 신청과 선정)',
      '인플루언서 회원은 모집글에 신청할 수 있으며, 선정 여부는 사장님 회원이 결정합니다. 선정된 회원은 방문 가능 기간 안에 매장을 방문하고 리뷰 조건에 맞는 콘텐츠를 게시해야 합니다.',
      '# 제5조 (리뷰 작성 의무)',
      '선정된 회원은 체험 후 정해진 기간 안에 리뷰 링크를 제출해야 하며, 관련 법령에 따라 경제적 대가를 받았음을 콘텐츠에 표시해야 합니다. 정당한 사유 없이 방문하지 않거나 리뷰를 제출하지 않으면 이후 이용이 제한될 수 있습니다.',
      '# 제6조 (모집글 등록)',
      '사장님 회원은 사실에 근거한 모집글을 등록해야 하며, 모집글에 적은 제공 내역을 선정된 회원에게 제공해야 합니다.',
      '# 제7조 (서비스의 변경·중단)',
      '회사는 운영상 필요한 경우 서비스의 전부 또는 일부를 변경하거나 중단할 수 있으며, 이 경우 사전에 공지합니다.',
      '# 제8조 (책임의 제한)',
      '회사는 회원 간의 매칭을 중개하며, 회원 사이에서 발생한 분쟁에 대해서는 회사의 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.'
    ].join('\n'),
    privacy: [
      '# 1. 수집하는 개인정보 항목',
      '공통: 이름, 이메일, 비밀번호, 연락처',
      '인플루언서: SNS 채널 주소',
      '사장님: 매장명',
      '# 2. 수집·이용 목적',
      '회원 식별 및 가입 관리, 체험단 신청·선정·진행 관리, 서비스 관련 안내와 문의 응대',
      '# 3. 보유 및 이용 기간',
      '회원 탈퇴 시까지 보유하며, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.',
      '# 4. 제3자 제공',
      '체험단 진행을 위해 인플루언서 회원의 이름, SNS 채널 주소, 연락처(선정 시)가 해당 모집글의 사장님 회원에게 제공됩니다. 그 밖에는 법령에 근거가 있는 경우를 제외하고 제3자에게 제공하지 않습니다.',
      '# 5. 이용자의 권리',
      '회원은 언제든지 본인의 개인정보 열람·정정·삭제를 요청할 수 있습니다.',
      '# 6. 개인정보 보호책임자',
      '문의: help@chehumpick.kr'
    ].join('\n')
  };

  function seed() {
    const users = [
      { id: 'u_admin', role: 'admin', name: '운영자', email: 'admin@chehumpick.kr', password: 'admin1234', phone: '010-0000-0000', createdAt: addDays(-30) },
      { id: 'u_owner1', role: 'owner', name: '김사장', email: 'owner@chehumpick.kr', password: 'owner1234', phone: '010-1111-2222', storeName: '탕광맥주 탕정역점', createdAt: addDays(-20) },
      { id: 'u_owner2', role: 'owner', name: '이사장', email: 'owner2@chehumpick.kr', password: 'owner1234', phone: '010-3333-4444', storeName: '카페, 오늘은', createdAt: addDays(-18) },
      { id: 'u_inf1', role: 'influencer', name: '박리뷰', email: 'review@chehumpick.kr', password: 'review1234', phone: '010-5555-6666', snsType: '인스타그램', snsUrl: 'https://instagram.com/review_park', createdAt: addDays(-10) },
      { id: 'u_inf2', role: 'influencer', name: '최맛집', email: 'review2@chehumpick.kr', password: 'review1234', phone: '010-7777-8888', snsType: '네이버 블로그', snsUrl: 'https://blog.naver.com/choi_matzip', createdAt: addDays(-8) }
    ];
    const c = (id, ownerId, storeName, menu, amount, region, category, channel, capacity, image, dl, description, conditions) => ({
      id, ownerId, storeName, menu, amount, region, category, channel, capacity, image,
      deadline: addDays(dl), periodStart: addDays(dl + 1), periodEnd: addDays(dl + 14),
      visitStart: addDays(dl + 1), visitEnd: addDays(dl + 10),
      description, conditions, status: 'open', createdAt: addDays(-5)
    });
    const campaigns = [
      c('c1', 'u_owner1', '탕광맥주 탕정역점', '황금치킨 + 수제맥주', 35000, '아산', '맛집', '인스타 릴스', 10, 'assets/img/chicken.jpg', 9,
        '황금치킨 1마리와 수제맥주 2잔을 제공합니다. 2인 방문 기준이며, 방문 전 매장으로 예약 연락을 부탁드립니다.',
        '매장 방문 후 릴스 1건 업로드\n매장 위치 태그와 #탕광맥주 #탕정맛집 해시태그 포함\n게시물 3개월 이상 유지'),
      c('c2', 'u_owner2', '카페, 오늘은', '아메리카노 + 디저트', 18000, '천안', '카페', '인스타 릴스', 8, 'assets/img/coffee.jpg', 11,
        '음료 2잔과 시그니처 디저트 1종을 제공합니다. 평일 방문을 권장합니다.',
        '매장 방문 후 릴스 또는 피드 1건 업로드\n음료와 디저트가 함께 나오는 사진 3장 이상'),
      c('c3', 'u_owner1', '스모크 바비큐 하우스', '폭립 플래터 2인 세트', 62000, '아산', '맛집', '블로그 + 인스타', 5, 'assets/img/meat.jpg', 14,
        '폭립 플래터 2인 세트와 음료 2잔을 제공합니다.',
        '블로그 리뷰 1건(사진 10장 이상, 1,000자 이상)\n인스타그램 피드 1건 업로드'),
      c('c4', 'u_owner2', '달콤한 하루', '와플 + 음료 2잔', 21000, '천안', '카페', '인스타 릴스', 7, 'assets/img/waffle.jpg', 15,
        '수제 와플 1종과 음료 2잔을 제공합니다.',
        '매장 방문 후 릴스 1건 업로드\n매장 위치 태그 포함'),
      c('c5', 'u_owner1', '뷰티스킨', '기초화장품 3종 세트', 45000, '아산', '뷰티', '블로그', 10, 'assets/img/beauty.jpg', 19,
        '기초화장품 3종 세트를 매장에서 수령 후 2주간 사용해 보는 체험입니다.',
        '블로그 사용 후기 1건(사진 8장 이상)\n2주 사용 후 작성'),
      c('c6', 'u_owner2', '스테이 온양', '주중 1박 숙박권', 120000, '아산', '숙박', '블로그 + 인스타', 3, 'assets/img/stay.jpg', 19,
        '주중(일~목) 1박 숙박권을 제공합니다. 2인 기준이며 조식이 포함됩니다.',
        '블로그 숙박 후기 1건(사진 15장 이상)\n인스타그램 피드 1건 업로드')
    ];
    const applications = [
      { id: 'a1', campaignId: 'c1', userId: 'u_inf1', status: 'selected', reviewUrl: '', createdAt: addDays(-3), updatedAt: addDays(-1) },
      { id: 'a2', campaignId: 'c2', userId: 'u_inf1', status: 'applied', reviewUrl: '', createdAt: addDays(-2), updatedAt: addDays(-2) },
      { id: 'a3', campaignId: 'c1', userId: 'u_inf2', status: 'applied', reviewUrl: '', createdAt: addDays(-2), updatedAt: addDays(-2) },
      { id: 'a4', campaignId: 'c3', userId: 'u_inf2', status: 'submitted', reviewUrl: 'https://blog.naver.com/choi_matzip/223000000001', createdAt: addDays(-4), updatedAt: addDays(-1) }
    ];
    return { users, campaigns, applications };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 저장소를 쓸 수 없으면 메모리에서만 동작 */ }
    const db = seed();
    persist(db);
    return db;
  }
  function persist(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { throw new Error('저장 공간이 부족합니다. 이미지 용량을 줄여 다시 시도해 주세요.'); }
  }
  let db = load();
  const save = () => persist(db);

  const fail = msg => { throw new Error(msg); };
  const pickedCount = campaignId =>
    db.applications.filter(a => a.campaignId === campaignId && PICKED.includes(a.status)).length;

  // 선정 인원이 모집 인원에 도달하면 자동으로 모집 마감
  function syncCampaignStatus(campaignId) {
    const c = db.campaigns.find(x => x.id === campaignId);
    if (c && pickedCount(campaignId) >= c.capacity) c.status = 'closed';
  }

  const Store = {
    today,

    /* ---------- 회원 ---------- */
    currentUser() {
      let id = null;
      try { id = localStorage.getItem(SESSION_KEY); } catch (e) {}
      return db.users.find(u => u.id === id) || null;
    },
    // role을 넘기면 해당 유형의 회원만 로그인 (관리자는 어느 쪽에서든 가능)
    login(email, password, role) {
      const u = db.users.find(x => x.email === email.trim().toLowerCase() && x.password === password);
      if (!u) fail('이메일 또는 비밀번호가 올바르지 않습니다.');
      if (role && u.role !== 'admin' && u.role !== role) {
        fail(u.role === 'owner' ? '사장님 계정입니다. "사장님으로 로그인"을 선택해 주세요.'
          : '인플루언서 계정입니다. "인플루언서로 로그인"을 선택해 주세요.');
      }
      try { localStorage.setItem(SESSION_KEY, u.id); } catch (e) {}
      return u;
    },
    logout() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} },
    signup(data) {
      const email = data.email.trim().toLowerCase();
      if (!['influencer', 'owner'].includes(data.role)) fail('회원 유형을 선택해 주세요.');
      if (db.users.some(u => u.email === email)) fail('이미 가입된 이메일입니다.');
      const u = {
        id: uid('u_'), role: data.role, name: data.name.trim(), email, password: data.password,
        phone: data.phone.trim(), createdAt: today()
      };
      if (data.role === 'influencer') { u.snsType = data.snsType; u.snsUrl = data.snsUrl.trim(); }
      else u.storeName = data.storeName.trim();
      db.users.push(u);
      save();
      try { localStorage.setItem(SESSION_KEY, u.id); } catch (e) {}
      return u;
    },
    users() { return db.users.slice(); },
    user(id) { return db.users.find(u => u.id === id) || null; },
    deleteUser(id) {
      const u = this.user(id);
      if (!u) return;
      if (u.role === 'admin') fail('관리자 계정은 삭제할 수 없습니다.');
      const ownCampaigns = db.campaigns.filter(c => c.ownerId === id).map(c => c.id);
      db.applications = db.applications.filter(a => a.userId !== id && !ownCampaigns.includes(a.campaignId));
      db.campaigns = db.campaigns.filter(c => c.ownerId !== id);
      db.users = db.users.filter(x => x.id !== id);
      save();
    },

    /* ---------- 모집글 ---------- */
    campaigns() { return db.campaigns.slice().sort((a, b) => a.deadline.localeCompare(b.deadline)); },
    campaign(id) { return db.campaigns.find(c => c.id === id) || null; },
    isOpen(c) { return c.status === 'open' && c.deadline >= today(); },
    pickedCount,
    saveCampaign(data, id) {
      if (id) {
        const c = this.campaign(id);
        if (!c) fail('모집글을 찾을 수 없습니다.');
        Object.assign(c, data);
        syncCampaignStatus(id);
        save();
        return c;
      }
      const c = Object.assign({ id: uid('c_'), status: 'open', createdAt: today() }, data);
      db.campaigns.push(c);
      save();
      return c;
    },
    setCampaignStatus(id, status) {
      const c = this.campaign(id);
      if (!c) return;
      c.status = status;
      save();
    },
    deleteCampaign(id) {
      db.campaigns = db.campaigns.filter(c => c.id !== id);
      db.applications = db.applications.filter(a => a.campaignId !== id);
      save();
    },

    /* ---------- 신청 ---------- */
    applications() { return db.applications.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    applicationsByUser(userId) { return this.applications().filter(a => a.userId === userId); },
    applicationsByCampaign(campaignId) { return this.applications().filter(a => a.campaignId === campaignId); },
    findApplication(campaignId, userId) {
      return db.applications.find(a => a.campaignId === campaignId && a.userId === userId) || null;
    },
    apply(campaignId, userId) {
      const c = this.campaign(campaignId);
      if (!c || !this.isOpen(c)) fail('모집이 마감된 체험단입니다.');
      if (this.findApplication(campaignId, userId)) fail('이미 신청한 체험단입니다.');
      const a = { id: uid('a_'), campaignId, userId, status: 'applied', reviewUrl: '', createdAt: today(), updatedAt: today() };
      db.applications.push(a);
      save();
      return a;
    },
    setApplicationStatus(id, status) {
      const a = db.applications.find(x => x.id === id);
      if (!a) fail('신청 내역을 찾을 수 없습니다.');
      const c = this.campaign(a.campaignId);
      if (PICKED.includes(status) && !PICKED.includes(a.status) && c && pickedCount(c.id) >= c.capacity) {
        fail('모집 인원이 이미 모두 선정되었습니다.');
      }
      a.status = status;
      a.updatedAt = today();
      syncCampaignStatus(a.campaignId);
      save();
      return a;
    },
    // 선정 마감: 남은 신청을 미선정으로 처리하고 모집을 마감
    closeSelection(campaignId) {
      db.applications.forEach(a => {
        if (a.campaignId === campaignId && a.status === 'applied') { a.status = 'rejected'; a.updatedAt = today(); }
      });
      const c = this.campaign(campaignId);
      if (c) c.status = 'closed';
      save();
    },
    submitReview(id, url) {
      const a = db.applications.find(x => x.id === id);
      if (!a || a.status !== 'selected') fail('리뷰 링크를 제출할 수 없는 상태입니다.');
      a.reviewUrl = url;
      a.status = 'submitted';
      a.updatedAt = today();
      save();
      return a;
    },

    /* ---------- 사이트 설정 ---------- */
    defaultSettings() { return Object.assign({}, DEFAULT_SETTINGS); },
    settings() { return Object.assign({}, DEFAULT_SETTINGS, db.settings || {}); },
    saveSettings(values) {
      const next = {};
      Object.keys(DEFAULT_SETTINGS).forEach(k => {
        if (typeof values[k] === 'string' && values[k] !== DEFAULT_SETTINGS[k]) next[k] = values[k];
      });
      db.settings = next;
      save();
    },
    resetSettings() { delete db.settings; save(); },

    /* 데모 데이터 초기화 */
    reset() {
      db = seed();
      save();
      this.logout();
    }
  };

  /* ---------- 영상·사진 파일 ----------
   * 용량이 커서 localStorage 대신 브라우저의 IndexedDB에 저장합니다. (키 → 파일) */
  function mediaTx(mode, run) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('chehumpick-media', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('files');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const idb = open.result;
        const tx = idb.transaction('files', mode);
        const req = run(tx.objectStore('files'));
        tx.oncomplete = () => { idb.close(); resolve(req.result); };
        tx.onerror = tx.onabort = () => { idb.close(); reject(tx.error); };
      };
    });
  }
  Store.media = {
    get: key => mediaTx('readonly', s => s.get(key)),
    put: (key, blob) => mediaTx('readwrite', s => s.put(blob, key)),
    remove: key => mediaTx('readwrite', s => s.delete(key))
  };

  window.Store = Store;
})();
