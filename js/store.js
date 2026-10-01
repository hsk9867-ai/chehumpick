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

    /* 데모 데이터 초기화 */
    reset() {
      db = seed();
      save();
      this.logout();
    }
  };

  window.Store = Store;
})();
