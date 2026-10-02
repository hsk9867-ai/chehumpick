/* 체험픽 화면·라우팅. 데이터는 store.js(Store)를 통해서만 읽고 씁니다. */
(function () {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  const toastEl = document.getElementById('toast');

  const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
  const sidoOf = region => String(region || '').split(' ')[0];
  const CHANNELS = ['인스타 릴스', '인스타 피드', '블로그', '블로그 + 인스타', '유튜브', '상관없음'];
  // 체험단 유형별로 보여 줄 미션: 유형 → [설정 키, 채널 이름] 목록
  const MISSIONS = { blog: ['missionBlog', '네이버 블로그'], feed: ['missionFeed', '인스타그램 피드'], reels: ['missionReels', '인스타그램 릴스'] };
  const CHANNEL_MISSIONS = {
    '인스타 릴스': ['reels'], '인스타 피드': ['feed'], '블로그': ['blog'],
    '블로그 + 인스타': ['blog', 'feed', 'reels'], '상관없음': ['blog', 'feed', 'reels']
  };
  const MAX_MESSAGE = 200;
  const SNS_TYPES = ['인스타그램', '네이버 블로그', '유튜브', '기타'];
  // 관리자가 바꿀 수 있는 영상·사진 자리: [키, 이름, 종류, 기본 파일]
  const MEDIA_SLOTS = [
    ['video1', '메인 영상 1', 'video', 'assets/video/food.mp4'],
    ['video2', '메인 영상 2', 'video', 'assets/video/cafe.mp4'],
    ['video3', '메인 영상 3', 'video', 'assets/video/food2.mp4'],
    ['video4', '메인 영상 4', 'video', 'assets/video/cafe2.mp4'],
    ['poster', '메인 영상이 뜨기 전 보이는 사진', 'image', 'assets/video/poster.jpg'],
    ['listBg', '체험단 목록 상단 사진', 'image', 'assets/img/hero.jpg'],
    ['ownerBg', '사장님 안내 상단 사진', 'image', 'assets/img/owner.jpg']
  ];
  const MAX_VIDEO_MB = 50;
  const media = key => Store.media.url(key) || MEDIA_SLOTS.find(s => s[0] === key)[3];
  const heroClips = () => MEDIA_SLOTS.filter(s => s[2] === 'video').map(s => media(s[0]));
  const STATUS = {
    applied: { label: '신청', inf: '선정 대기 중', cls: 'wait' },
    selected: { label: '선정', inf: '선정됨', cls: 'ok' },
    rejected: { label: '미선정', inf: '미선정', cls: 'no' },
    submitted: { label: '링크 제출', inf: '검수 대기 중', cls: 'wait' },
    done: { label: '완료', inf: '완료', cls: 'done' }
  };
  // 상태별로 보여 줄 버튼: [바꿀 상태, 버튼 이름, 강조 여부]
  // 선정·탈락은 사장님이, 리뷰 확인(완료 처리)은 관리자가 담당
  const OWNER_BUTTONS = {
    applied: [['selected', '선정', true], ['rejected', '탈락']],
    selected: [['applied', '선정 취소']],
    rejected: [['applied', '탈락 취소']],
    submitted: [],
    done: []
  };
  const ADMIN_BUTTONS = {
    applied: [],
    selected: [],
    rejected: [],
    submitted: [['done', '완료 처리', true], ['selected', '재제출 요청']],
    done: [['submitted', '완료 취소']]
  };
  const STEPS =['applied', 'selected', 'submitted', 'done'];
  const ROLE_LABEL = { influencer: '인플루언서', owner: '사장님', admin: '관리자' };

  const state = { cat: '전체', region: '전체', snsDraft: null, q: '', adminTab: 'apps', userQ: '', userRole: '전체', userSort: 'createdAt', userSortDesc: false, afterLogin: null, pendingImage: null };

  /* ---------- 공통 도구 ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const nl2br = s => esc(s).replace(/\n/g, '<br>');
  const won = n => Number(n || 0).toLocaleString('ko-KR') + '원';
  const md = d => { if (!d) return ''; const p = d.split('-'); return `${Number(p[1])}/${Number(p[2])}`; };
  const range = (a, b) => `${md(a)} ~ ${md(b)}`;
  const safeUrl = u => (/^https?:\/\//i.test(u || '') ? esc(u) : '#');
  const go = path => { location.hash = '#' + path; };

  // 사이트 설정(관리자가 고친 문구). 화면을 그릴 때마다 최신 값으로 갱신
  let S = Store.settings();
  const lines = text => String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  const rows = text => lines(text).map(l => l.split('|').map(p => p.trim()));
  const cats = () => S.categories.split(',').map(c => c.trim()).filter(Boolean);

  // 화면 가운데 안내 창 (확인 버튼으로 닫음)
  function showModal(title, bodyHtml) {
    closeModal();
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><h2>${esc(title)}</h2>${bodyHtml}<button type="button" class="btn btn-dark btn-block btn-lg" data-action="close-modal">확인</button></div>`;
    document.body.appendChild(el);
    el.querySelector('button').focus();
  }
  function closeModal() { document.querySelectorAll('.modal').forEach(m => m.remove()); }
  const tipHtml = () => (S.missionTip ? `<p class="mission-tip">${esc(S.missionTip)}</p>` : '');
  // 신청 창: 신청 한마디를 적고 신청
  function showApplyModal(c) {
    closeModal();
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<form data-form="apply" data-id="${c.id}" class="modal-box form" role="dialog" aria-modal="true" novalidate>
      <div><h2>체험단 신청</h2><p class="menu">${esc(c.storeName)} · ${esc(c.menu)}</p></div>
      <label>신청 한마디 (선택)<textarea name="message" rows="3" maxlength="${MAX_MESSAGE}" placeholder="예: 평소 가 보고 싶던 곳이에요! 사진과 영상으로 예쁘게 담아 볼게요."></textarea></label>
      <p class="note">사장님이 선정할 때 SNS 채널과 함께 확인합니다. (${MAX_MESSAGE}자 이내)</p>
      ${tipHtml()}
      <div class="modal-actions"><button type="button" class="btn btn-soft btn-lg" data-action="close-modal">취소</button><button class="btn btn-dark btn-lg">신청하기</button></div>
    </form>`;
    document.body.appendChild(el);
    el.querySelector('textarea').focus();
  }
  const bankHtml = () => `<div class="bank-info">${nl2br(S.bankInfo)}</div><p class="bank-notice">${nl2br(S.bankNotice)}</p>`;

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  const ICON = {
    arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    users: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.900 2 6.500 5.500M16 4.800a3.500 3.500 0 010 6.400M18.500 14.800c1.700.8 2.700 2.500 3 5.200"/></svg>',
    cal: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.500" y="5" width="17" height="15.500" rx="2.500"/><path d="M3.500 10h17M8 3v4M16 3v4"/></svg>',
    cam: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.200" cy="6.800" r=".6" fill="currentColor"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.500l2.800 2.800L16 9.500"/></svg>'
  };

  // 회원의 SNS 채널 링크 목록
  function snsLinks(u) {
    const links = u.snsLinks && u.snsLinks.length ? u.snsLinks : (u.snsUrl ? [{ type: u.snsType, url: u.snsUrl }] : []);
    return links.map(l => `<a href="${safeUrl(l.url)}" target="_blank" rel="noopener">${esc(l.type || '채널')}</a>`).join(' · ') || '<span class="muted">-</span>';
  }
  const badge = status => `<span class="badge badge-${STATUS[status].cls}">${STATUS[status].label}</span>`;
  const openBadge = c => c.approval === 'pending' ? '<span class="badge badge-wait">승인 대기</span>'
    : c.approval === 'rejected' ? '<span class="badge badge-no">반려</span>'
    : Store.isOpen(c) ? '<span class="badge badge-ok">모집 중</span>'
    : '<span class="badge badge-no">모집 마감</span>';

  /* ---------- 헤더 ---------- */
  function renderNav() {
    const u = Store.currentUser();
    const path = location.hash.slice(1) || '/';
    const link = (href, label, extra = '') =>
      `<a href="#${href}" class="${path.startsWith(href) && href !== '/' ? 'active' : ''} ${extra}">${label}</a>`;
    let html = link('/campaigns', '체험단') + link('/owner', '사장님 안내') + link('/faq', '고객센터');
    if (u) {
      html += u.role === 'admin' ? link('/admin', '관리자 페이지') : link('/my', '마이페이지');
      html += `<a class="nav-user" href="#/account" title="내 정보 · 비밀번호 변경">${esc(u.name)}님 · ${ROLE_LABEL[u.role]}</a>`;
      html += `<button type="button" class="nav-btn" data-action="logout">로그아웃</button>`;
    } else {
      html += link('/login', '로그인') + link('/signup', '회원가입', 'nav-cta');
    }
    nav.innerHTML = html;
    nav.classList.remove('open');
  }

  /* ---------- 카드·목록 조각 ---------- */
  function pills() {
    return `<div class="pills">${['전체'].concat(cats()).map(c =>
      `<button type="button" class="pill ${state.cat === c ? 'on' : ''}" data-action="cat" data-cat="${c}">${c}</button>`).join('')}</div>`;
  }

  // 지역(시·도) 선택과 카테고리 탭
  function filterBar() {
    return `<div class="filter-row">
      <select class="region-select" data-change="region" aria-label="지역 선택">${['전체'].concat(REGIONS).map(r =>
        `<option value="${r}" ${state.region === r ? 'selected' : ''}>${r === '전체' ? '전체 지역' : r}</option>`).join('')}</select>
      ${pills()}</div>`;
  }

  function filtered(onlyOpen) {
    const q = state.q.trim().toLowerCase();
    return Store.campaigns()
      .filter(c => c.approval === 'approved')
      .filter(c => !onlyOpen || Store.isOpen(c))
      .filter(c => state.cat === '전체' || c.category === state.cat)
      .filter(c => state.region === '전체' || sidoOf(c.region) === state.region)
      .filter(c => !q || [c.storeName, c.menu, c.region].join(' ').toLowerCase().includes(q))
      .sort((a, b) => Store.isOpen(b) - Store.isOpen(a));
  }

  function card(c) {
    return `<a class="card" href="#/campaign/${c.id}">
      <div class="card-img"><img src="${esc(c.image)}" alt="${esc(c.storeName)}" loading="lazy"><span class="region">${esc(c.region)}</span></div>
      <div class="card-body">
        <h3>${esc(c.storeName)}</h3>
        <p class="menu">${esc(c.menu)}</p>
        <p class="price">${won(c.amount)} 상당</p>
        <ul class="meta">
          <li>${ICON.cam}${esc(c.channel)}</li>
          <li>${ICON.users}${c.capacity}명 모집</li>
          <li>${ICON.cal}${md(c.deadline)} 마감</li>
        </ul>
        <span class="btn btn-soft btn-block">신청하기</span>
      </div>
    </a>`;
  }

  function homeGrid() {
    const items = filtered(true).slice(0, 6);
    return items.length ? `<div class="grid">${items.map(card).join('')}</div>`
      : '<p class="empty">조건에 맞는 모집 중인 체험단이 아직 없습니다.</p>';
  }

  function listResults() {
    const items = filtered(false);
    if (!items.length) return '<p class="empty">조건에 맞는 체험단이 없습니다.</p>';
    return items.map(c => `<a class="row ${Store.isOpen(c) ? '' : 'closed'}" href="#/campaign/${c.id}">
      <img src="${esc(c.image)}" alt="${esc(c.storeName)}" loading="lazy">
      <div class="row-body">
        <div class="row-tags"><span class="tag">${esc(c.region)}</span><span class="tag tag-line">${esc(c.channel)}</span>${Store.isOpen(c) ? '' : '<span class="tag tag-dark">마감</span>'}</div>
        <h3>${esc(c.storeName)}</h3>
        <p class="menu">${esc(c.menu)} · ${won(c.amount)} 상당</p>
        <ul class="meta meta-inline"><li>${ICON.users}${c.capacity}명 모집</li><li>${ICON.cal}${md(c.deadline)} 마감</li></ul>
      </div>
      <span class="row-arrow">${ICON.chevron}</span>
    </a>`).join('');
  }

  /* ---------- 1. 메인 ---------- */
  function iconCards(text, cls) {
    return rows(text).map(([icon, title, desc]) =>
      `<div class="${cls}"><span>${esc(icon)}</span><h4>${esc(title)}</h4><p>${esc(desc)}</p></div>`).join('');
  }

  function home() {
    // 사장님으로 로그인하면 메인에서 바로 모집글을 등록할 수 있게 버튼을 보여 줌
    const u = Store.currentUser();
    const owner = !!u && u.role === 'owner';
    return `
    <section class="hero" style="background-image:url('${media('poster')}')">
      <div class="hero-media" aria-hidden="true">
        <video muted playsinline preload="auto"></video>
        <video muted playsinline preload="auto"></video>
      </div>
      <div class="container hero-inner">
        <div>
          <h1>${nl2br(S.heroTitle)}</h1>
          <p>${nl2br(S.heroSub)}</p>
          <div class="hero-actions">
            <a class="btn btn-yellow btn-lg" href="#/campaigns">${esc(S.heroButton)} ${ICON.arrow}</a>
            ${owner ? '<a class="btn btn-soft btn-lg" href="#/post/new">+ 모집글 등록 신청</a>' : ''}
          </div>
        </div>
        <p class="hand hero-note">${nl2br(S.heroNote)}</p>
      </div>
    </section>

    <section class="container section">
      <div class="section-head"><h2>${esc(S.homeListTitle)}</h2><a href="#/campaigns" class="more">전체보기 ${ICON.arrow}</a></div>
      ${filterBar()}
      <div id="home-grid">${homeGrid()}</div>
    </section>

    <section class="container cta-pair">
      <div class="cta cta-blue">
        <div><h3>${esc(S.ctaInfTitle)}</h3><p>${nl2br(S.ctaInfText)}</p>
        <a class="btn btn-blue" href="#/signup/influencer">${esc(S.ctaInfButton)} ${ICON.arrow}</a></div>
        <span class="cta-emoji" aria-hidden="true">🙋</span>
      </div>
      <div class="cta cta-pink">
        <div><h3>${esc(S.ctaOwnerTitle)}</h3><p>${nl2br(S.ctaOwnerText)}</p>
        ${owner ? `<a class="btn btn-pink" href="#/post/new">모집글 등록 신청하기 ${ICON.arrow}</a>`
          : `<a class="btn btn-pink" href="#/owner">${esc(S.ctaOwnerButton)} ${ICON.arrow}</a>`}</div>
        <span class="cta-emoji" aria-hidden="true">👩‍🍳</span>
      </div>
    </section>

    <section class="container section">
      <h2>${esc(S.featuresTitle)}</h2>
      <div class="features">${iconCards(S.features, 'feature')}</div>
    </section>`;
  }

  /* ---------- 체험단 목록 ---------- */
  function list() {
    return `
    <section class="hero hero-sm" style="background-image:url('${media('listBg')}')">
      <div class="container"><h1>체험단</h1><p>다양한 매장의 체험단을 지금 바로 만나보세요.</p></div>
    </section>
    <section class="container section narrow">
      <label class="search">
        <input type="search" id="search" placeholder="매장명, 메뉴, 시·군·구로 검색해 보세요" value="${esc(state.q)}">
        <span class="search-btn">${ICON.search}</span>
      </label>
      ${filterBar()}
      <div id="list-results" class="rows">${listResults()}</div>
    </section>`;
  }

  /* ---------- 2. 모집글 상세 ---------- */
  // 체험단 미션: 채널별 아이콘 요약 + 펼쳐 보는 상세 설명
  function missionBlock(c) {
    const list = (CHANNEL_MISSIONS[c.channel] || []).map(k => MISSIONS[k]).filter(([key]) => S[key]);
    if (!list.length) return '';
    return `<div class="block mission"><h2>체험단 미션</h2>${tipHtml()}${list.map(([key, name]) => {
      const items = rows(S[key]);
      return `<div class="mission-channel"><h3>${name}</h3>
        <ul class="mission-icons">${items.map(([icon, label]) => `<li><span aria-hidden="true">${esc(icon)}</span>${esc(label)}</li>`).join('')}</ul>
        <details><summary>자세히 보기</summary>${items.filter(r => r[2]).map(([, label, desc]) => `<p><b>${esc(label)}</b> · ${esc(desc)}</p>`).join('')}</details>
      </div>`;
    }).join('')}</div>`;
  }

  function detail(id) {
    const c = Store.campaign(id);
    if (!c) return notFound();
    const u = Store.currentUser();
    const open = Store.isOpen(c);
    const approvalNote = c.approval === 'pending' ? `<div class="paid-box">관리자 승인을 기다리는 글입니다. 승인되면 사이트에 게시됩니다.${u && u.id === c.ownerId ? bankHtml() : ''}</div>`
      : c.approval === 'rejected' ? '<p class="paid-box">반려된 글입니다. 내용을 수정해 저장하면 다시 등록 신청됩니다.</p>' : '';
    let action = '';
    if (!u) {
      action = open ? `<button class="btn btn-dark btn-block btn-lg" data-action="apply" data-id="${c.id}">신청하기 ${ICON.arrow}</button>`
        : '<button class="btn btn-dark btn-block btn-lg" disabled>모집 마감</button>';
    } else if (u.role === 'influencer') {
      const a = Store.findApplication(c.id, u.id);
      if (a) action = `<a class="btn btn-soft btn-block btn-lg" href="#/my">신청 완료 · ${STATUS[a.status].inf} (마이페이지에서 확인)</a>`;
      else if (open) action = `<button class="btn btn-dark btn-block btn-lg" data-action="apply" data-id="${c.id}">신청하기 ${ICON.arrow}</button>`;
      else action = '<button class="btn btn-dark btn-block btn-lg" disabled>모집 마감</button>';
    } else if (u.role === 'admin' || c.ownerId === u.id) {
      action = `<a class="btn btn-soft btn-block" href="#/post/${c.id}/edit">모집글 수정</a>`;
    }
    return `
    <section class="container section narrow">
      <a class="back" href="#/campaigns">← 체험단 목록</a>
      ${approvalNote}
      <div class="detail">
        <div class="detail-img"><img src="${esc(c.image)}" alt="${esc(c.storeName)}"></div>
        <div class="detail-head">
          <div class="row-tags"><span class="tag">${esc(c.region)}</span><span class="tag">${esc(c.category)}</span><span class="tag tag-line">${esc(c.channel)}</span>${openBadge(c)}</div>
          <h1>${esc(c.storeName)}</h1>
          <p class="menu">${esc(c.menu)}</p>
          <p class="price price-lg">${won(c.amount)} 상당 제공</p>
        </div>
      </div>
      <dl class="info">
        <div><dt>체험 메뉴</dt><dd>${esc(c.menu)}</dd></div>
        <div><dt>제공 금액</dt><dd>${won(c.amount)}</dd></div>
        <div><dt>모집 인원</dt><dd>총 ${c.capacity}명 (${esc(c.channel)}) · 현재 ${Store.pickedCount(c.id)}명 선정</dd></div>
        <div><dt>모집 마감</dt><dd>${esc(c.deadline)}</dd></div>
        <div><dt>방문 가능 기간</dt><dd>${esc(c.visitStart)} ~ ${esc(c.visitEnd)}</dd></div>
      </dl>
      <div class="block"><h2>체험 내용</h2><p>${nl2br(c.description)}</p></div>
      <div class="block"><h2>리뷰 조건</h2><p>${nl2br(c.conditions)}</p></div>
      ${missionBlock(c)}
      ${S.guide ? `<div class="block guide doc"><h2>${esc(S.guideTitle)}</h2>${richText(S.guide)}</div>` : ''}
      <div class="sticky-action">${action}</div>
    </section>`;
  }

  /* ---------- 3. 로그인 ---------- */
  function login() {
    if (Store.currentUser()) { go('/my'); return ''; }
    return `
    <section class="container section form-page">
      <h1>로그인</h1>
      <form data-form="login" class="form" data-role="influencer" novalidate>
        <div class="role-switch">
          <label><input type="radio" name="role" value="influencer" checked><span>🙋 인플루언서로 로그인<small>체험단에 신청해요</small></span></label>
          <label><input type="radio" name="role" value="owner"><span>👩‍🍳 사장님으로 로그인<small>체험단을 모집해요</small></span></label>
        </div>
        <label>아이디<input name="username" autocomplete="username" autocapitalize="none" placeholder="아이디"></label>
        <label>비밀번호<input type="password" name="password" autocomplete="current-password" placeholder="비밀번호"></label>
        <button class="btn btn-dark btn-block btn-lg">로그인</button>
      </form>
      <p class="form-foot">아직 회원이 아니신가요? <a href="#/signup/influencer">인플루언서로 가입</a> · <a href="#/signup/owner">사장님으로 가입</a></p>
      <p class="form-foot"><a href="#/find">아이디·비밀번호 찾기</a></p>
    </section>`;
  }

  /* ---------- 4. 회원가입 ---------- */
  function signup(role) {
    if (Store.currentUser()) { go('/my'); return ''; }
    const owner = role === 'owner';
    return `
    <section class="container section form-page">
      <h1>회원가입</h1>
      <form data-form="signup" class="form" data-role="${owner ? 'owner' : 'influencer'}" novalidate>
        <div class="role-switch">
          <label><input type="radio" name="role" value="influencer" ${owner ? '' : 'checked'}><span>🙋 인플루언서로 가입<small>체험단에 신청해요</small></span></label>
          <label><input type="radio" name="role" value="owner" ${owner ? 'checked' : ''}><span>👩‍🍳 사장님으로 가입<small>체험단을 모집해요</small></span></label>
        </div>
        <label>이름<input name="name" autocomplete="name" placeholder="이름"></label>
        <label>아이디<input name="username" autocomplete="username" autocapitalize="none" placeholder="영문 소문자·숫자 4~20자"></label>
        <label>비밀번호<input type="password" name="password" autocomplete="new-password" placeholder="8자 이상"></label>
        <label>연락처<input type="tel" name="phone" autocomplete="tel" placeholder="010-0000-0000"></label>
        <div class="only-influencer">
          <label>SNS 채널 종류<select name="snsType">${SNS_TYPES.map(s => `<option>${s}</option>`).join('')}</select></label>
          <label>SNS 채널 주소<input type="url" name="snsUrl" placeholder="https://instagram.com/내계정"></label>
        </div>
        <div class="only-owner">
          <label>매장명<input name="storeName" placeholder="매장 이름"></label>
        </div>
        <label class="check"><input type="checkbox" name="agree"><span><a href="#/terms" target="_blank">이용약관</a> 및 <a href="#/privacy" target="_blank">개인정보처리방침</a>에 동의합니다. (필수)</span></label>
        <button class="btn btn-dark btn-block btn-lg">가입하기</button>
      </form>
      <p class="form-foot">이미 회원이신가요? <a href="#/login">로그인</a></p>
    </section>`;
  }

  /* ---------- 5. 인플루언서 마이페이지 ---------- */
  function stepper(status) {
    const idx = STEPS.indexOf(status);
    return `<ol class="steps">${STEPS.map((s, i) =>
      `<li class="${i < idx ? 'past' : i === idx ? 'now' : ''}">${STATUS[s].label}</li>`).join('')}</ol>`;
  }

  // 인플루언서가 자기 SNS 채널을 여러 개 등록·수정
  function snsCard(u) {
    if (!state.snsDraft) state.snsDraft = (u.snsLinks.length ? u.snsLinks : [{ type: u.snsType || SNS_TYPES[0], url: u.snsUrl || '' }]).map(l => ({ type: l.type, url: l.url }));
    return `<form data-form="sns" class="panel sns-form" novalidate>
      <h3>내 SNS 채널</h3>
      <p class="menu">사장님이 선정할 때 확인하는 채널입니다. 인스타그램, 블로그 등 최대 5개까지 등록할 수 있습니다.</p>
      ${state.snsDraft.map((l, i) => `<div class="sns-row">
        <select name="snsType${i}" aria-label="채널 종류">${SNS_TYPES.map(t => `<option ${t === l.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input type="url" name="snsUrl${i}" value="${esc(l.url)}" placeholder="https://instagram.com/내계정" aria-label="채널 주소">
        <button type="button" class="btn btn-soft btn-sm danger" data-action="sns-remove" data-index="${i}">삭제</button>
      </div>`).join('')}
      <div class="sns-actions"><button type="button" class="btn btn-soft btn-sm" data-action="sns-add">+ 채널 추가</button><button class="btn btn-dark btn-sm">저장</button></div>
    </form>`;
  }
  // 입력 중인 SNS 채널 값을 화면에서 읽어 임시 보관
  function readSnsDraft() {
    const f = document.querySelector('form[data-form="sns"]');
    if (!f || !state.snsDraft) return;
    state.snsDraft = state.snsDraft.map((l, i) => ({ type: f['snsType' + i].value, url: f['snsUrl' + i].value.trim() }));
  }

  function influencerMy(u) {
    const apps = Store.applicationsByUser(u.id);
    const item = a => {
      const c = Store.campaign(a.campaignId);
      if (!c) return '';
      let body = '';
      if (a.status === 'applied') body = `<p class="note">사장님이 신청 내용을 확인하고 있습니다. 선정 결과는 이 화면에 표시됩니다.</p>
        <button type="button" class="btn btn-soft btn-sm danger cancel-apply" data-action="cancel-apply" data-id="${a.id}">신청 취소</button>`;
      if (a.status === 'rejected') body = '<p class="note">아쉽지만 이번 체험단에는 선정되지 않았습니다.</p>';
      if (a.status === 'selected') body = `
        <div class="visit"><b>🎉 선정되었습니다!</b> 방문 가능 기간: <b>${esc(c.visitStart)} ~ ${esc(c.visitEnd)}</b><br>${Store.reservePhone(c.id) ? `예약 연락처: <a href="tel:${esc(Store.reservePhone(c.id))}"><b>${esc(Store.reservePhone(c.id))}</b></a> (방문 하루 전까지 예약 필수)<br>` : ''}기간 안에 방문한 뒤 리뷰 링크를 제출해 주세요. <a href="#/faq">방문·노쇼 안내와 체험 가이드 보기</a></div>
        <form data-form="review" data-id="${a.id}" class="inline-form" novalidate>
          <input type="url" name="url" placeholder="리뷰 게시물 주소 (https://...)" value="${esc(a.reviewUrl)}">
          <button class="btn btn-dark">리뷰 링크 제출</button>
        </form>
        <button type="button" class="btn btn-soft btn-sm danger cancel-apply" data-action="cancel-apply" data-id="${a.id}">선정 취소 (체험 포기)</button>`;
      if (a.status === 'submitted') body = `<p class="note">제출한 링크: <a href="${safeUrl(a.reviewUrl)}" target="_blank" rel="noopener">${esc(a.reviewUrl)}</a><br>관리자가 리뷰를 확인하고 있습니다.</p>`;
      if (a.status === 'done') body = `<p class="note">체험이 완료되었습니다. 감사합니다! <a href="${safeUrl(a.reviewUrl)}" target="_blank" rel="noopener">제출한 리뷰 보기</a></p>`;
      return `<article class="my-item">
        <a class="my-thumb" href="#/campaign/${c.id}"><img src="${esc(c.image)}" alt=""></a>
        <div class="my-body">
          <div class="my-top"><h3><a href="#/campaign/${c.id}">${esc(c.storeName)}</a></h3><span class="badge badge-${STATUS[a.status].cls}">${STATUS[a.status].inf}</span></div>
          <p class="menu">${esc(c.menu)} · 신청일 ${esc(a.createdAt)}</p>
          ${a.message ? `<p class="note">신청 한마디: ${esc(a.message)}</p>` : ''}
          ${a.status === 'rejected' ? '' : stepper(a.status)}
          ${body}
        </div>
      </article>`;
    };
    return `
    <section class="container section narrow">
      <div class="section-head"><h1>마이페이지</h1><span class="head-links"><a class="more" href="#/account">내 정보 · 비밀번호 변경</a><a class="more" href="#/campaigns">체험단 더 찾아보기 ${ICON.arrow}</a></span></div>
      ${snsCard(u)}
      <p class="sub">${esc(u.name)}님이 신청한 체험단 ${apps.length}건</p>
      ${apps.length ? apps.map(item).join('') : '<p class="empty">아직 신청한 체험단이 없습니다.<br><a href="#/campaigns">모집 중인 체험단 보러 가기</a></p>'}
    </section>`;
  }

  /* ---------- 6. 사장님 마이페이지 ---------- */
  function applicantTable(c) {
    const apps = Store.applicationsByCampaign(c.id);
    if (!apps.length) return '<p class="note">아직 신청자가 없습니다.</p>';
    const full = Store.pickedCount(c.id) >= c.capacity;
    return `<div class="table-wrap"><table>
      <thead><tr><th>이름</th><th>SNS 채널</th><th>신청 한마디</th><th>신청일</th><th>상태</th><th>연락처</th><th></th></tr></thead>
      <tbody>${apps.map(a => {
        const inf = Store.user(a.userId) || {};
        const picked = ['selected', 'submitted', 'done'].includes(a.status);
        return `<tr>
          <td>${esc(inf.name)}</td>
          <td>${snsLinks(inf)}</td>
          <td class="wrap">${a.message ? esc(a.message) : '<span class="muted">-</span>'}</td>
          <td>${esc(a.createdAt)}</td>
          <td>${badge(a.status)}</td>
          <td>${picked ? esc(inf.phone) : '<span class="muted">선정 후 공개</span>'}</td>
          <td class="nowrap">${OWNER_BUTTONS[a.status].filter(([to]) => to !== 'selected' || !full).map(([to, label, dark]) =>
            `<button class="btn ${dark ? 'btn-dark' : 'btn-soft'} btn-sm" data-action="owner-status" data-id="${a.id}" data-status="${to}" data-label="${label}">${label}</button>`).join(' ')}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  // 사장님 결제 안내: 등록 신청은 누구나 가능하고, 유선 결제 확인 후 관리자가 수락하면 게시됨
  function paidNotice(u) {
    return Store.isPaid(u)
      ? `<p class="paid-box ok">결제 확인됨 · 이용 기간 <b>${esc(u.paidUntil)}</b>까지</p>`
      : `<div class="paid-box">등록 신청한 모집글은 <b>입금 확인 후</b> 관리자가 승인하면 게시됩니다.${u.paidUntil ? ` (이용 기간이 ${esc(u.paidUntil)}에 끝났습니다.)` : ''}${bankHtml()}</div>`;
  }

  function ownerMy(u) {
    const mine = Store.campaigns().filter(c => c.ownerId === u.id);
    const item = c => {
      const apps = Store.applicationsByCampaign(c.id);
      const waiting = apps.some(a => a.status === 'applied');
      return `<article class="panel">
        <div class="panel-head">
          <div><h3><a href="#/campaign/${c.id}">${esc(c.storeName)}</a> ${openBadge(c)}</h3>
          <p class="menu">${esc(c.menu)} · 마감 ${esc(c.deadline)} · 신청 ${apps.length}명 · 선정 ${Store.pickedCount(c.id)}/${c.capacity}명</p></div>
          <div class="panel-actions">
            ${Store.isOpen(c) || waiting ? `<button class="btn btn-soft btn-sm" data-action="close-selection" data-id="${c.id}">선정 마감</button>` : ''}
            <a class="btn btn-soft btn-sm" href="#/post/${c.id}/edit">수정</a>
            <button class="btn btn-soft btn-sm danger" data-action="delete-campaign" data-id="${c.id}">삭제</button>
          </div>
        </div>
        ${applicantTable(c)}
      </article>`;
    };
    return `
    <section class="container section">
      <div class="section-head"><h1>사장님 마이페이지</h1><span class="head-links"><a class="more" href="#/account">내 정보 · 비밀번호 변경</a><a class="btn btn-dark" href="#/post/new">+ 모집글 등록 신청</a></span></div>
      ${paidNotice(u)}
      <p class="sub">${esc(u.storeName || u.name)} · 등록한 모집글 ${mine.length}건</p>
      ${mine.length ? mine.map(item).join('') : '<p class="empty">아직 등록한 모집글이 없습니다.<br><a href="#/post/new">첫 체험단 모집글 등록 신청하기</a></p>'}
    </section>`;
  }

  /* ---------- 7. 모집글 등록·수정 ---------- */
  function postForm(id) {
    const u = Store.currentUser();
    const c = id ? Store.campaign(id) : null;
    if (id && !c) return notFound();
    if (c && u.role !== 'admin' && c.ownerId !== u.id) return denied();
    state.pendingImage = null;
    const v = k => esc(c ? c[k] : '');
    const opts = (arr, cur) => arr.map(o => `<option ${o === cur ? 'selected' : ''}>${o}</option>`).join('');
    return `
    <section class="container section form-page wide">
      <a class="back" href="#/${u.role === 'admin' ? 'admin' : 'my'}">← 돌아가기</a>
      <h1>${c ? '모집글 수정' : '모집글 등록 신청'}</h1>
      ${c ? '' : '<p class="sub">등록 신청 후 입금 계좌를 안내해 드리며, 입금이 확인되면 관리자가 승인해 게시됩니다.</p>'}
      <form data-form="post" data-id="${c ? c.id : ''}" class="form" novalidate>
        <label>매장명 <i>*</i><input name="storeName" value="${c ? v('storeName') : esc(u.storeName || '')}" placeholder="매장명을 입력해 주세요"></label>
        <label>체험 메뉴 <i>*</i><input name="menu" value="${v('menu')}" placeholder="예: 황금치킨 + 수제맥주"></label>
        <div class="cols">
          <label>제공 금액(원) <i>*</i><input type="number" name="amount" min="0" step="1000" value="${v('amount')}" placeholder="35000"></label>
          <label>모집 인원(명) <i>*</i><input type="number" name="capacity" min="1" value="${v('capacity')}" placeholder="10"></label>
        </div>
        <div class="cols">
          <label>지역(시·도) <i>*</i><select name="regionSido"><option value="">선택</option>${opts(REGIONS, c && sidoOf(c.region))}</select></label>
          <label>시·군·구 <i>*</i><input name="regionDetail" value="${esc(c ? (REGIONS.includes(sidoOf(c.region)) ? c.region.split(' ').slice(1).join(' ') : c.region) : '')}" placeholder="예: 아산시"></label>
          <label>카테고리<select name="category">${opts(c && !cats().includes(c.category) ? cats().concat(c.category) : cats(), c && c.category)}</select></label>
        </div>
        <div class="cols">
          <label>체험단 유형<select name="channel">${opts(CHANNELS, c && c.channel)}</select></label>
          <label>모집 마감일 <i>*</i><input type="date" name="deadline" value="${v('deadline')}"></label>
        </div>
        <div class="cols">
          <label>방문 가능 기간 시작 <i>*</i><input type="date" name="visitStart" value="${v('visitStart')}"></label>
          <label>방문 가능 기간 종료 <i>*</i><input type="date" name="visitEnd" value="${v('visitEnd')}"></label>
        </div>
        <label>사장님 휴대폰 번호 <i>*</i><input type="tel" name="ownerPhone" value="${esc(c ? Store.ownerPhone(c.id) : (u.role === 'owner' ? u.phone || '' : ''))}" placeholder="입금 확인·승인 안내를 받을 번호 (관리자에게만 공개)"></label>
        <label>예약 연락처 <i>*</i><input type="tel" name="reservePhone" value="${esc(c ? Store.reservePhone(c.id) : '')}" placeholder="예약 문의를 받을 매장 전화번호 (선정된 리뷰어에게만 공개)"></label>
        <label>체험 내용 <i>*</i><textarea name="description" rows="4" placeholder="제공 내역, 방문 시 안내 사항 등을 적어 주세요">${v('description')}</textarea></label>
        <label>리뷰 조건 <i>*</i><textarea name="conditions" rows="4" placeholder="예: 매장 방문 후 릴스 1건 업로드">${v('conditions')}</textarea></label>
        <label>대표 이미지 (1장) <i>*</i><input type="file" id="post-image" accept="image/*"></label>
        <div id="image-preview" class="image-preview">${c ? `<img src="${v('image')}" alt="현재 대표 이미지">` : ''}</div>
        <button class="btn btn-dark btn-block btn-lg">${c ? (c.approval === 'rejected' && u.role !== 'admin' ? '수정하고 다시 신청하기' : '수정 내용 저장') : '등록 신청하기'}</button>
        ${c ? `<button type="button" class="btn btn-soft btn-block danger" data-action="delete-campaign" data-id="${c.id}">이 모집글 삭제</button>` : ''}
      </form>
    </section>`;
  }

  /* ---------- 8. 관리자 페이지 ---------- */
  // 결제받음(기간 지정) / 결제받지않음을 계정별로 지정
  function paidCell(u) {
    const paid = Store.isPaid(u);
    const next = new Date(); next.setMonth(next.getMonth() + 1);
    const suggested = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    return `<span class="badge ${paid ? 'badge-ok' : 'badge-no'}">${paid ? '결제받음' : u.paidUntil ? '기간 만료' : '결제받지않음'}</span>
      <input type="date" class="paid-date" data-paid-date="${u.id}" value="${esc(paid ? u.paidUntil : suggested)}" min="${Store.today()}" aria-label="이용 종료일">
      <button class="btn btn-dark btn-sm" data-action="set-paid" data-id="${u.id}">${paid ? '기간 변경' : '결제받음 처리'}</button>
      ${u.paidUntil ? `<button class="btn btn-soft btn-sm danger" data-action="unset-paid" data-id="${u.id}">결제받지않음</button>` : ''}`;
  }

  // 관리자 회원 목록: 유형 필터와 검색어(이름·아이디·연락처·매장명·SNS 주소)를 적용한 표의 줄
  // 회원별 활동 횟수: 인플루언서는 체험단 신청(참여) 수와 그중 선정된 수, 사장님은 등록한 모집글 수
  function userActivity() {
    const count = {};
    const add = (id, k) => { (count[id] = count[id] || { n: 0, picked: 0 })[k]++; };
    Store.applications().forEach(a => { add(a.userId, 'n'); if (['selected', 'submitted', 'done'].includes(a.status)) add(a.userId, 'picked'); });
    Store.campaigns().forEach(c => add(c.ownerId, 'n'));
    return id => count[id] || { n: 0, picked: 0 };
  }
  // 정렬할 수 있는 표 머리글 (누르면 정렬, 다시 누르면 반대 순서)
  const sortHead = (key, label) => `<th><button type="button" class="th-sort ${state.userSort === key ? 'on' : ''}" data-action="user-sort" data-key="${key}">${label} ${state.userSort === key ? (state.userSortDesc ? '▼' : '▲') : '↕'}</button></th>`;
  function userRows() {
    const act = userActivity();
    const dir = state.userSortDesc ? -1 : 1;
    const by = state.userSort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'ko')
      : state.userSort === 'count' ? (a, b) => act(a.id).n - act(b.id).n
      : (a, b) => a.createdAt.localeCompare(b.createdAt);
    const q = state.userQ.trim().toLowerCase();
    const digits = q.replace(/[^0-9]/g, '');
    const text = u => [u.name, u.username, u.phone, u.storeName, u.snsUrl].concat((u.snsLinks || []).map(l => l.url)).join(' ').toLowerCase();
    const list = Store.users()
      .filter(u => state.userRole === '전체' || u.role === state.userRole)
      .filter(u => !q || text(u).includes(q) || (digits.length >= 3 && String(u.phone || '').replace(/[^0-9]/g, '').includes(digits)));
    return list.sort((a, b) => dir * by(a, b)).map(u => `<tr>
          <td>${ROLE_LABEL[u.role]}</td><td>${esc(u.name)}${Store.hasResetRequest(u.id) ? ' <span class="badge badge-wait">비밀번호 재설정 요청</span>' : ''}</td><td>${esc(u.username)}</td><td>${esc(u.phone)}</td>
          <td>${u.role === 'influencer' ? snsLinks(u) : esc(u.storeName || '-')}</td>
          <td>${u.role === 'influencer' ? `참여 ${act(u.id).n}회 <span class="muted">(선정 ${act(u.id).picked})</span>` : u.role === 'owner' ? `등록 ${act(u.id).n}건` : '<span class="muted">-</span>'}</td>
          <td>${esc(u.createdAt)}</td>
          <td class="nowrap">${u.role === 'owner' ? paidCell(u) : '<span class="muted">-</span>'}</td>
          <td class="nowrap">${u.role === 'admin' ? '' : `<button class="btn btn-soft btn-sm" data-action="reset-password" data-id="${u.id}">임시 비밀번호 발급</button>
            <button class="btn btn-soft btn-sm danger" data-action="delete-user" data-id="${u.id}">삭제</button>`}</td>
        </tr>`).join('') || '<tr><td colspan="9" class="muted">조건에 맞는 회원이 없습니다.</td></tr>';
  }
  function userFilter() {
    const all = Store.users();
    const tabs = [['전체', '전체'], ['influencer', '인플루언서'], ['owner', '사장님'], ['admin', '관리자']];
    return `<label class="search">
        <input type="search" id="user-search" placeholder="이름, 아이디, 연락처, 매장명, SNS 주소로 검색" value="${esc(state.userQ)}">
        <span class="search-btn">${ICON.search}</span>
      </label>
      <div class="pills user-filter">${tabs.map(([k, l]) =>
        `<button type="button" class="pill ${state.userRole === k ? 'on' : ''}" data-action="user-role" data-role="${k}">${l} ${k === '전체' ? all.length : all.filter(u => u.role === k).length}</button>`).join('')}</div>`;
  }

  function admin(tab) {
    if (tab) state.adminTab = tab;
    const pending = Store.campaigns().filter(c => c.approval === 'pending').length;
    const tabs = [['apps', '신청·선정 현황'], ['campaigns', '모집글' + (pending ? ` (승인 대기 ${pending})` : '')], ['users', '회원'], ['site', '사이트 설정']];
    let body = '';
    if (state.adminTab === 'site') {
      body = siteSettings();
    } else if (state.adminTab === 'users') {
      body = `${userFilter()}<div class="table-wrap"><table>
        <thead><tr><th>유형</th>${sortHead('name', '이름')}<th>아이디</th><th>연락처</th><th>SNS 채널 / 매장명</th>${sortHead('count', '공고 참여 · 등록')}${sortHead('createdAt', '가입일')}<th>이용권 (유선 결제)</th><th></th></tr></thead>
        <tbody id="user-rows">${userRows()}</tbody></table></div>`;
    } else if (state.adminTab === 'campaigns') {
      body = `<div class="table-wrap"><table>
        <thead><tr><th>매장명</th><th>사장님</th><th>휴대폰</th><th>상태</th><th>마감일</th><th>신청</th><th>선정</th><th></th></tr></thead>
        <tbody>${Store.campaigns().sort((a, b) => (b.approval === 'pending') - (a.approval === 'pending')).map(c => `<tr>
          <td><a href="#/campaign/${c.id}">${esc(c.storeName)}</a></td>
          <td>${esc((Store.user(c.ownerId) || {}).name || '-')} <span class="badge ${Store.isPaid(Store.user(c.ownerId)) ? 'badge-ok' : 'badge-no'}">${Store.isPaid(Store.user(c.ownerId)) ? '결제받음' : '결제받지않음'}</span></td>
          <td>${Store.ownerPhone(c.id) ? `<a href="tel:${esc(Store.ownerPhone(c.id))}">${esc(Store.ownerPhone(c.id))}</a>` : '<span class="muted">-</span>'}</td>
          <td>${openBadge(c)}</td><td>${esc(c.deadline)}</td>
          <td>${Store.applicationsByCampaign(c.id).length}명</td><td>${Store.pickedCount(c.id)}/${c.capacity}명</td>
          <td class="nowrap">
            ${c.approval !== 'approved' ? `<button class="btn btn-dark btn-sm" data-action="set-approval" data-id="${c.id}" data-approval="approved">수락</button>` : ''}
            ${c.approval !== 'rejected' ? `<button class="btn btn-soft btn-sm danger" data-action="set-approval" data-id="${c.id}" data-approval="rejected">${c.approval === 'approved' ? '게시 취소(반려)' : '반려'}</button>` : ''}
            ${c.approval === 'approved' ? `<button class="btn btn-soft btn-sm" data-action="toggle-campaign" data-id="${c.id}">${c.status === 'open' ? '마감 처리' : '모집 재개'}</button>` : ''}
            <a class="btn btn-soft btn-sm" href="#/post/${c.id}/edit">수정</a>
            <button class="btn btn-soft btn-sm danger" data-action="delete-campaign" data-id="${c.id}">삭제</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`;
    } else {
      const apps = Store.applications();
      const count = s => apps.filter(a => a.status === s).length;
      body = `<div class="stats">${Object.keys(STATUS).map(s => `<div><b>${count(s)}</b><span>${STATUS[s].label}</span></div>`).join('')}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>모집글</th><th>인플루언서</th><th>신청 한마디</th><th>신청일</th><th>상태</th><th>리뷰 링크</th><th></th></tr></thead>
        <tbody>${apps.map(a => {
          const c = Store.campaign(a.campaignId) || {};
          const inf = Store.user(a.userId) || {};
          return `<tr>
            <td><a href="#/campaign/${c.id}">${esc(c.storeName)}</a></td>
            <td>${esc(inf.name)} · ${snsLinks(inf)}</td>
            <td class="wrap">${a.message ? esc(a.message) : '<span class="muted">-</span>'}</td>
            <td>${esc(a.createdAt)}</td>
            <td>${badge(a.status)}</td>
            <td>${a.reviewUrl ? `<a href="${safeUrl(a.reviewUrl)}" target="_blank" rel="noopener">링크 확인</a>` : '<span class="muted">-</span>'}</td>
            <td class="nowrap">${ADMIN_BUTTONS[a.status].map(([to, label, dark]) =>
              `<button class="btn ${dark ? 'btn-dark' : 'btn-soft'} btn-sm" data-action="set-status" data-id="${a.id}" data-status="${to}" data-label="${label}">${label}</button>`).join(' ')}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="7" class="muted">신청 내역이 없습니다.</td></tr>'}</tbody></table></div>`;
    }
    return `
    <section class="container section">
      <div class="section-head"><h1>관리자 페이지</h1><a class="more" href="#/account">내 정보 · 비밀번호 변경</a></div>
      <div class="tabs">${tabs.map(([k, l]) =>
        `<button type="button" class="${state.adminTab === k ? 'on' : ''}" data-action="admin-tab" data-tab="${k}">${l}</button>`).join('')}</div>
      ${body}
    </section>`;
  }

  /* ---------- 사장님 안내 ---------- */
  function ownerLanding() {
    const u = Store.currentUser();
    const cta = u && u.role === 'owner'
      ? `<a class="btn btn-dark btn-lg" href="#/post/new">모집글 등록하기 ${ICON.arrow}</a>`
      : `<a class="btn btn-dark btn-lg" href="#/signup/owner">사장님으로 가입하기 ${ICON.arrow}</a>`;
    return `
    <section class="hero hero-md" style="background-image:url('${media('ownerBg')}')">
      <div class="container hero-inner">
        <div><h1>${esc(S.ownerTitle)}</h1><p>${nl2br(S.ownerSub)}</p></div>
        <p class="hand hero-note">${nl2br(S.ownerNote)}</p>
      </div>
    </section>
    <section class="container section">
      <div class="how">${iconCards(S.ownerSteps, 'how-step')}</div>
      <div class="promise">
        <div>
          <h2>${esc(S.promiseTitle)}</h2>
          <ul>${lines(S.promises).map(p => `<li>${ICON.check}${esc(p)}</li>`).join('')}</ul>
        </div>
        <p class="hand promise-note">${nl2br(S.promiseNote)}</p>
      </div>
      <div class="center">${cta}</div>
    </section>`;
  }

  /* ---------- 9~11. 안내 화면 ---------- */
  function faq() {
    return `
    <section class="container section narrow">
      <h1>고객센터</h1>
      ${S.notice ? `<div class="notice doc" id="notice"><span class="badge badge-done">공지</span><h2>${esc(S.noticeTitle)}</h2>${richText(S.notice)}</div>` : ''}
      ${S.guide ? `<div class="notice doc" id="guide"><span class="badge badge-done">안내</span><h2>${esc(S.guideTitle)}</h2>${richText(S.guide)}</div>` : ''}
      <h2 class="faq-title">자주 묻는 질문</h2>
      <p class="sub">${esc(S.faqIntro)}</p>
      <div class="faq">${rows(S.faq).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
      <div class="contact"><h3>문의하기</h3><p>해결되지 않은 문의는 아래 연락처로 보내 주세요.</p>
      <a class="btn btn-dark" href="mailto:${esc(S.contactEmail)}">${esc(S.contactEmail)}</a></div>
    </section>`;
  }

  // 본문 서식: # 으로 시작하는 줄은 제목, * 또는 - 로 시작하는 줄은 목록, 나머지는 문단
  function richText(text) {
    return lines(text).map(l => l.startsWith('#') ? `<h3>${esc(l.replace(/^#+\s*/, ''))}</h3>`
      : /^[*-]\s+/.test(l) ? `<p class="bullet">${esc(l.replace(/^[*-]\s+/, ''))}</p>` : `<p>${esc(l)}</p>`).join('');
  }

  // 약관 본문. 기본 초안 그대로면 검토 안내를 함께 표시
  function docPage(title, key) {
    const draft = S[key] === Store.defaultSettings()[key]
      ? '<p class="draft">※ 표준 양식 기반 초안입니다. 운영자 검토 후 확정본으로 교체해 주세요.</p>' : '';
    const body = richText(S[key]);
    return `<section class="container section narrow doc"><h1>${title}</h1>${draft}${body}</section>`;
  }
  const terms = () => docPage('이용약관', 'terms');
  const privacy = () => docPage('개인정보처리방침', 'privacy');

  /* ---------- 관리자: 사이트 설정 ---------- */
  // [키, 이름, 입력칸 줄 수(생략하면 한 줄)]
  const SETTING_GROUPS = [
    ['메인 화면', [
      ['heroTitle', '첫 문구 (줄을 바꾸면 화면에서도 줄이 바뀝니다)', 3],
      ['heroSub', '첫 문구 아래 설명', 2],
      ['heroButton', '버튼 이름'],
      ['heroNote', '손글씨 문구', 2],
      ['homeListTitle', '모집글 목록 제목'],
      ['ctaInfTitle', '리뷰어 안내 카드 제목'],
      ['ctaInfText', '리뷰어 안내 카드 설명', 2],
      ['ctaInfButton', '리뷰어 안내 카드 버튼'],
      ['ctaOwnerTitle', '사장님 안내 카드 제목'],
      ['ctaOwnerText', '사장님 안내 카드 설명', 2],
      ['ctaOwnerButton', '사장님 안내 카드 버튼'],
      ['featuresTitle', '특징 영역 제목'],
      ['features', '특징 카드 (한 줄에 하나씩: 아이콘 | 제목 | 설명)', 5]
    ]],
    ['사장님 안내 화면', [
      ['ownerTitle', '제목'],
      ['ownerSub', '설명', 2],
      ['ownerNote', '손글씨 문구', 3],
      ['ownerSteps', '진행 단계 카드 (한 줄에 하나씩: 아이콘 | 제목 | 설명)', 5],
      ['promiseTitle', '약속 영역 제목'],
      ['promises', '약속 목록 (한 줄에 하나씩)', 5],
      ['promiseNote', '약속 영역 손글씨 문구', 3]
    ]],
    ['고객센터', [
      ['noticeTitle', '공지 제목'],
      ['notice', '공지 내용 (# 으로 시작하는 줄은 제목, * 로 시작하는 줄은 목록. 비우면 공지를 숨깁니다)', 12],
      ['guideTitle', '체험 가이드 제목'],
      ['guide', '체험 가이드 내용 (모집글 상세 화면과 고객센터에 표시. # 제목, * 목록. 비우면 숨깁니다)', 12],
      ['faqIntro', '자주 묻는 질문 안내 문구'],
      ['faq', '자주 묻는 질문 (한 줄에 하나씩: 질문 | 답변)', 9],
      ['contactEmail', '문의 이메일']
    ]],
    ['체험단 미션', [
      ['missionTip', '선정 팁 문구 (모집글 상세 화면과 신청 창에 표시. 비우면 숨깁니다)'],
      ['missionBlog', '네이버 블로그 미션 (한 줄에 하나씩: 아이콘 | 짧은 이름 | 설명. 비우면 숨깁니다)', 6],
      ['missionFeed', '인스타그램 피드 미션 (한 줄에 하나씩: 아이콘 | 짧은 이름 | 설명)', 5],
      ['missionReels', '인스타그램 릴스 미션 (한 줄에 하나씩: 아이콘 | 짧은 이름 | 설명)', 4]
    ]],
    ['입금 안내', [
      ['bankInfo', '입금 계좌 안내 (은행, 계좌번호, 예금주, 금액 등. 모집글 등록 신청 직후 창으로 보여 줍니다)', 4],
      ['bankNotice', '안내 문구', 2]
    ]],
    ['카테고리 · 하단', [
      ['categories', '카테고리 (쉼표로 구분, 모집글 등록 화면과 목록 탭에 쓰입니다)'],
      ['footerTagline', '하단 문구', 2],
      ['copyright', '저작권 표시']
    ]],
    ['약관 · 개인정보처리방침', [
      ['terms', '이용약관 (# 으로 시작하는 줄은 제목)', 16],
      ['privacy', '개인정보처리방침 (# 으로 시작하는 줄은 제목)', 14]
    ]]
  ];

  function siteSettings() {
    const field = ([key, label, rowsN]) => `<label>${label}${rowsN
      ? `<textarea name="${key}" rows="${rowsN}">${esc(S[key])}</textarea>`
      : `<input name="${key}" value="${esc(S[key])}">`}</label>`;
    const slot = ([key, label, kind]) => `<div class="media-slot">
      ${kind === 'video'
        ? `<video src="${esc(media(key))}" muted loop playsinline controls preload="metadata"></video>`
        : `<img src="${esc(media(key))}" alt="">`}
      <div>
        <b>${label}</b> <span class="badge ${Store.media.url(key) ? 'badge-ok' : 'badge-no'}">${Store.media.url(key) ? '직접 올린 파일' : '기본'}</span>
        <label class="btn btn-soft btn-sm">${kind === 'video' ? '영상' : '사진'} 바꾸기
          <input type="file" hidden data-change="media" data-key="${key}" accept="${kind === 'video' ? 'video/mp4,video/webm' : 'image/*'}"></label>
        ${Store.media.url(key) ? `<button type="button" class="btn btn-soft btn-sm danger" data-action="reset-media" data-key="${key}">기본으로 되돌리기</button>` : ''}
      </div>
    </div>`;
    return `
    <details class="setting-group settings-form" open>
      <summary>영상 · 사진</summary>
      <p class="note">파일을 고르면 확인 후 바로 반영됩니다. 영상은 MP4 또는 WebM, ${MAX_VIDEO_MB}MB 이하로 올려 주세요. 소리는 재생되지 않습니다.</p>
      <div class="media-slots">${MEDIA_SLOTS.map(slot).join('')}</div>
    </details>
    <form data-form="settings" class="form settings-form" novalidate>
      ${SETTING_GROUPS.map(([title, fields], i) => `<details class="setting-group" ${i === 0 ? 'open' : ''}>
        <summary>${title}</summary><div class="setting-fields">${fields.map(field).join('')}</div></details>`).join('')}
      <div class="settings-actions">
        <button class="btn btn-dark btn-lg">저장하기</button>
        <button type="button" class="btn btn-soft danger" data-action="reset-settings">기본 문구로 되돌리기</button>
      </div>
    </form>`;
  }

  /* ---------- 계정: 내 정보 수정 · 비밀번호 변경 ---------- */
  function account() {
    const u = Store.currentUser();
    return `
    <section class="container section form-page">
      <a class="back" href="#/${u.role === 'admin' ? 'admin' : 'my'}">← 돌아가기</a>
      <h1>내 정보 수정</h1>
      <form data-form="profile" class="form" novalidate>
        <label>아이디<input value="${esc(u.username)}" readonly></label>
        <label>이름 <i>*</i><input name="name" autocomplete="name" value="${esc(u.name)}"></label>
        <label>연락처 <i>*</i><input type="tel" name="phone" autocomplete="tel" value="${esc(u.phone || '')}" placeholder="010-0000-0000"></label>
        ${u.role === 'owner' ? `<label>매장명 <i>*</i><input name="storeName" value="${esc(u.storeName || '')}"></label>` : ''}
        ${u.role === 'influencer' ? '<p class="note">SNS 채널은 마이페이지의 "내 SNS 채널"에서 수정할 수 있습니다.</p>' : ''}
        <button class="btn btn-dark btn-block btn-lg">내 정보 저장</button>
      </form>
      <h1 class="second-title">비밀번호 변경</h1>
      <form data-form="password" class="form" novalidate>
        <input type="text" value="${esc(u.username)}" autocomplete="username" hidden>
        <label>현재 비밀번호<input type="password" name="current" autocomplete="current-password"></label>
        <label>새 비밀번호<input type="password" name="next" autocomplete="new-password" placeholder="8자 이상"></label>
        <label>새 비밀번호 확인<input type="password" name="next2" autocomplete="new-password"></label>
        <button class="btn btn-dark btn-block btn-lg">비밀번호 변경</button>
      </form>
    </section>`;
  }

  /* ---------- 아이디·비밀번호 찾기 ---------- */
  function find() {
    return `
    <section class="container section form-page">
      <a class="back" href="#/login">← 로그인</a>
      <h1>아이디 찾기</h1>
      <form data-form="find-id" class="form" novalidate>
        <label>이름<input name="name" autocomplete="name" placeholder="가입할 때 입력한 이름"></label>
        <label>연락처<input type="tel" name="phone" autocomplete="tel" placeholder="가입할 때 입력한 연락처"></label>
        <button class="btn btn-dark btn-block btn-lg">아이디 찾기</button>
      </form>
      <h1 class="second-title">비밀번호 찾기</h1>
      <p class="sub">재설정을 요청하면, 가입할 때 등록한 연락처로 본인 확인 후 임시 비밀번호를 안내해 드립니다.</p>
      <form data-form="find-pw" class="form" novalidate>
        <label>아이디<input name="username" autocomplete="username" autocapitalize="none"></label>
        <label>이름<input name="name" autocomplete="name"></label>
        <label>연락처<input type="tel" name="phone" autocomplete="tel"></label>
        <button class="btn btn-dark btn-block btn-lg">비밀번호 재설정 요청</button>
      </form>
    </section>`;
  }

  const notFound = () => `<section class="container section narrow"><p class="empty">페이지를 찾을 수 없습니다.<br><a href="#/">메인으로 돌아가기</a></p></section>`;
  const denied = () => `<section class="container section narrow"><p class="empty">이 화면을 볼 수 있는 권한이 없습니다.<br><a href="#/">메인으로 돌아가기</a></p></section>`;

  /* ---------- 라우터 ---------- */
  function guard(roles, view) {
    return (...args) => {
      const u = Store.currentUser();
      if (!u) { state.afterLogin = location.hash.slice(1); go('/login'); return ''; }
      if (!roles.includes(u.role)) return denied();
      return view(...args);
    };
  }
  const my = guard(['influencer', 'owner', 'admin'], () => {
    const u = Store.currentUser();
    if (u.role === 'admin') { go('/admin'); return ''; }
    return u.role === 'owner' ? ownerMy(u) : influencerMy(u);
  });

  const routes = [
    [/^\/$/, home],
    [/^\/campaigns$/, list],
    [/^\/campaign\/([\w-]+)$/, detail],
    [/^\/login$/, login],
    [/^\/signup(?:\/(influencer|owner))?$/, signup],
    [/^\/my$/, my],
    [/^\/post\/new$/, guard(['owner'], () => postForm())],
    [/^\/post\/([\w-]+)\/edit$/, guard(['owner', 'admin'], postForm)],
    [/^\/admin(?:\/(apps|campaigns|users|site))?$/, guard(['admin'], admin)],
    [/^\/owner$/, ownerLanding],
    [/^\/account$/, guard(['influencer', 'owner', 'admin'], account)],
    [/^\/find$/, find],
    [/^\/faq$/, faq],
    [/^\/terms$/, terms],
    [/^\/privacy$/, privacy]
  ];

  function render(keepScroll) {
    const path = location.hash.slice(1) || '/';
    S = Store.settings();
    if (path !== '/my') state.snsDraft = null;
    document.querySelector('.footer-tagline').innerHTML = nl2br(S.footerTagline);
    document.querySelector('.copyright').textContent = S.copyright;
    let html = notFound();
    for (const [re, view] of routes) {
      const m = path.match(re);
      if (m) { html = view(...m.slice(1)); break; }
    }
    app.innerHTML = html;
    renderNav();
    initHeroVideo();
    if (!keepScroll) window.scrollTo(0, 0);
  }
  const refresh = () => render(true);

  // 메인 배경 영상: 카테고리별 클립을 6초마다 부드럽게 전환하며 자동 재생
  let heroTimer;
  function initHeroVideo() {
    clearInterval(heroTimer);
    const box = document.querySelector('.hero-media');
    if (!box || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const vids = box.querySelectorAll('video');
    let clip = 0, cur = 0;
    const start = (v, src) => {
      v.loop = true;
      v.src = src;
      v.onplaying = () => {
        v.onplaying = null;
        vids.forEach(x => x.classList.toggle('on', x === v));
        cur = v === vids[0] ? 0 : 1;
      };
      const p = v.play();
      if (p) p.catch(() => {}); // 자동 재생이 막힌 환경에서는 포스터 이미지 유지
    };
    const clips = heroClips();
    start(vids[0], clips[0]);
    heroTimer = setInterval(() => {
      if (!document.body.contains(box)) return clearInterval(heroTimer);
      clip = (clip + 1) % clips.length;
      start(vids[1 - cur], clips[clip]);
    }, 6000);
  }

  /* ---------- 동작 ---------- */
  const me = () => Store.currentUser();
  const canManage = campaignId => {
    const u = me(), c = Store.campaign(campaignId);
    return u && c && (u.role === 'admin' || c.ownerId === u.id);
  };

  const actions = {
    'toggle-nav': () => nav.classList.toggle('open'),
    'close-modal': closeModal,
    logout: async () => { await Store.logout(); toast('로그아웃되었습니다.'); location.hash === '#/' ? render() : go('/'); },
    cat: el => {
      state.cat = el.dataset.cat;
      document.querySelectorAll('.pill').forEach(p => p.classList.toggle('on', p.dataset.cat === state.cat));
      const grid = document.getElementById('home-grid');
      const rows = document.getElementById('list-results');
      if (grid) grid.innerHTML = homeGrid();
      if (rows) rows.innerHTML = listResults();
    },
    apply: async el => {
      const u = me();
      if (!u) { state.afterLogin = '/campaign/' + el.dataset.id; toast('로그인 후 신청할 수 있습니다.'); return go('/login'); }
      if (u.role !== 'influencer') return toast('인플루언서 회원만 신청할 수 있습니다.');
      const c = Store.campaign(el.dataset.id);
      if (!c || !Store.isOpen(c)) return toast('모집이 마감된 체험단입니다.');
      showApplyModal(c);
    },
    'cancel-apply': async el => {
      const a = Store.applications().find(x => x.id === el.dataset.id);
      if (!a || !me() || a.userId !== me().id) return toast('권한이 없습니다.');
      const c = Store.campaign(a.campaignId) || {};
      if (!confirm(a.status === 'selected'
        ? `[${c.storeName || ''}] 선정된 체험을 취소할까요?
선정이 취소되며 되돌릴 수 없습니다. 이미 방문 예약을 했다면 매장에도 꼭 알려 주세요.`
        : `[${c.storeName || ''}] 체험단 신청을 취소할까요?
모집 기간 안에는 다시 신청할 수 있습니다.`)) return;
      try { await Store.cancelApplication(a.id); toast(a.status === 'selected' ? '선정된 체험을 취소했습니다.' : '신청을 취소했습니다.'); }
      finally { refresh(); }
    },
    'owner-status': el => {
      const u = me();
      const a = Store.applications().find(x => x.id === el.dataset.id);
      const c = a && Store.campaign(a.campaignId);
      if (!u || !c || c.ownerId !== u.id) return toast('권한이 없습니다.');
      return changeStatus(a, c, el, OWNER_BUTTONS);
    },
    'close-selection': async el => {
      const c = Store.campaign(el.dataset.id);
      if (!c || !me() || c.ownerId !== me().id) return toast('권한이 없습니다.');
      if (!confirm('선정을 마감할까요?\n아직 선정하지 않은 신청은 모두 미선정 처리되고 모집이 마감됩니다.')) return;
      await Store.closeSelection(el.dataset.id);
      toast('선정을 마감했습니다.');
      refresh();
    },
    'delete-campaign': async el => {
      if (!canManage(el.dataset.id)) return toast('권한이 없습니다.');
      if (!confirm('이 모집글을 삭제할까요?\n신청 내역도 함께 삭제되며 되돌릴 수 없습니다.')) return;
      await Store.deleteCampaign(el.dataset.id);
      toast('모집글을 삭제했습니다.');
      if (/^#\/post\//.test(location.hash)) go(me().role === 'admin' ? '/admin' : '/my'); else refresh();
    },
    'set-approval': async el => {
      if (!isAdmin()) return toast('권한이 없습니다.');
      const c = Store.campaign(el.dataset.id);
      const accept = el.dataset.approval === 'approved';
      if (!c || !confirm(accept ? `[${c.storeName}] 모집글을 수락해 사이트에 게시할까요?` : `[${c.storeName}] 모집글을 반려할까요?\n사이트에 보이지 않게 됩니다.`)) return;
      await Store.setApproval(c.id, accept ? 'approved' : 'rejected');
      toast(accept ? '수락했습니다. 사이트에 게시되었습니다.' : '반려했습니다.');
      refresh();
    },
    'toggle-campaign': async el => {
      if (!isAdmin()) return;
      const c = Store.campaign(el.dataset.id);
      await Store.setCampaignStatus(c.id, c.status === 'open' ? 'closed' : 'open');
      refresh();
    },
    'reset-password': async el => {
      if (!isAdmin()) return toast('권한이 없습니다.');
      const u = Store.user(el.dataset.id);
      if (!u || !confirm(`${u.name}님(${u.username})에게 임시 비밀번호를 발급할까요?\n기존 비밀번호는 더 이상 쓸 수 없게 됩니다.\n\n먼저 등록된 연락처(${u.phone || '없음'})로 본인이 맞는지 확인해 주세요.`)) return;
      const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
      const temp = Array.from(crypto.getRandomValues(new Uint8Array(10)), n => chars[n % chars.length]).join('');
      await Store.adminResetPassword(u.id, temp);
      refresh();
      showModal('임시 비밀번호 발급', `<p>${esc(u.name)}님(${esc(u.username)})의 임시 비밀번호입니다.</p><div class="bank-info">${temp}</div><p class="bank-notice">회원에게 직접 알려 주고, 로그인 후 비밀번호를 변경하도록 안내해 주세요. 이 창을 닫으면 다시 볼 수 없습니다.</p>`);
    },
    'delete-user': async el => {
      if (!isAdmin()) return;
      if (!confirm('이 회원을 삭제할까요?\n해당 회원의 모집글과 신청 내역도 함께 삭제됩니다.')) return;
      await Store.deleteUser(el.dataset.id);
      toast('회원을 삭제했습니다.');
      refresh();
    },
    'admin-tab': el => go('/admin/' + el.dataset.tab),
    'user-sort': el => {
      if (state.userSort === el.dataset.key) state.userSortDesc = !state.userSortDesc;
      else { state.userSort = el.dataset.key; state.userSortDesc = el.dataset.key === 'count'; }
      refresh();
    },
    'user-role': el => {
      state.userRole = el.dataset.role;
      document.querySelectorAll('.user-filter .pill').forEach(p => p.classList.toggle('on', p.dataset.role === state.userRole));
      document.getElementById('user-rows').innerHTML = userRows();
    },
    'set-paid': async el => {
      if (!isAdmin()) return toast('권한이 없습니다.');
      const u = Store.user(el.dataset.id);
      const until = document.querySelector(`[data-paid-date="${el.dataset.id}"]`).value;
      if (!u || !until || until < Store.today()) return toast('이용 종료일을 오늘 이후 날짜로 선택해 주세요.');
      if (!confirm(`${u.name}님(${u.storeName || '매장명 없음'})을 ${until}까지 "결제받음"으로 처리할까요?`)) return;
      await Store.setPaid(u.id, until);
      toast('결제받음으로 처리했습니다.');
      refresh();
    },
    'unset-paid': async el => {
      if (!isAdmin()) return toast('권한이 없습니다.');
      const u = Store.user(el.dataset.id);
      if (!u || !confirm(`${u.name}님을 "결제받지않음"으로 바꿀까요?\n새 모집글을 등록할 수 없게 됩니다.`)) return;
      await Store.setPaid(u.id, null);
      toast('결제받지않음으로 처리했습니다.');
      refresh();
    },
    'sns-add': () => {
      readSnsDraft();
      if (state.snsDraft.length >= 5) return toast('SNS 채널은 5개까지 등록할 수 있습니다.');
      state.snsDraft.push({ type: SNS_TYPES[0], url: '' });
      refresh();
    },
    'sns-remove': el => {
      readSnsDraft();
      if (state.snsDraft.length <= 1) return toast('SNS 채널은 1개 이상 있어야 합니다.');
      state.snsDraft.splice(Number(el.dataset.index), 1);
      refresh();
    },
    'reset-media': async el => {
      if (!isAdmin()) return toast('권한이 없습니다.');
      const key = el.dataset.key;
      if (!Store.media.url(key) || !confirm('올린 파일을 지우고 기본 파일로 되돌릴까요?')) return;
      await Store.media.remove(key);
      toast('기본 파일로 되돌렸습니다.');
      refresh();
    },
    'reset-settings': async () => {
      if (!isAdmin()) return toast('권한이 없습니다.');
      if (!confirm('수정한 문구를 모두 지우고 기본 문구로 되돌릴까요?')) return;
      await Store.resetSettings();
      toast('기본 문구로 되돌렸습니다.');
      refresh();
    },
    'set-status': el => {
      if (!isAdmin()) return toast('권한이 없습니다.');
      const a = Store.applications().find(x => x.id === el.dataset.id);
      if (!a) return;
      return changeStatus(a, Store.campaign(a.campaignId) || {}, el, ADMIN_BUTTONS);
    }
  };
  // 허용된 상태 변경인지 확인하고, 확인 창을 거친 뒤 반영
  async function changeStatus(a, c, el, table) {
    const btn = table[a.status].find(([to]) => to === el.dataset.status);
    if (!btn) return toast('지금 상태에서는 처리할 수 없습니다.');
    const name = (Store.user(a.userId) || {}).name || '신청자';
    if (!confirm(`[${c.storeName || ''}] ${name}님을 "${btn[1]}" 처리할까요?`)) return;
    await Store.setApplicationStatus(a.id, btn[0]);
    toast(`"${btn[1]}" 처리했습니다.`);
    refresh();
  }
  const isAdmin = () => { const u = me(); return !!u && u.role === 'admin'; };

  function finishLogin(u) {
    toast(`${u.name}님, 환영합니다!`);
    const next = state.afterLogin || (u.role === 'admin' ? '/admin' : u.role === 'owner' ? '/my' : '/');
    state.afterLogin = null;
    go(next);
  }

  const forms = {
    login: async f => {
      if (!f.username.value.trim() || !f.password.value) throw new Error('아이디와 비밀번호를 입력해 주세요.');
      finishLogin(await Store.login(f.username.value, f.password.value, f.role.value));
    },
    signup: async f => {
      const role = f.role.value;
      const need = (cond, msg) => { if (!cond) throw new Error(msg); };
      need(f.name.value.trim(), '이름을 입력해 주세요.');
      need(/^[a-z0-9_]{4,20}$/.test(f.username.value.trim().toLowerCase()), '아이디는 영문 소문자, 숫자, 밑줄(_)로 4~20자로 입력해 주세요.');
      need(f.password.value.length >= 8, '비밀번호는 8자 이상으로 입력해 주세요.');
      need(/^[0-9-]{9,13}$/.test(f.phone.value.trim()), '연락처를 정확히 입력해 주세요.');
      if (role === 'influencer') need(/^https?:\/\/\S+\.\S+/.test(f.snsUrl.value.trim()), 'SNS 채널 주소를 https://로 시작하는 주소로 입력해 주세요.');
      else need(f.storeName.value.trim(), '매장명을 입력해 주세요.');
      need(f.agree.checked, '약관에 동의해 주세요.');
      const u = await Store.signup({
        role, name: f.name.value, username: f.username.value, password: f.password.value, phone: f.phone.value,
        snsType: f.snsType.value, snsUrl: f.snsUrl.value, storeName: f.storeName.value
      });
      finishLogin(u);
    },
    settings: async f => {
      if (!isAdmin()) throw new Error('권한이 없습니다.');
      const values = {};
      SETTING_GROUPS.forEach(([, fields]) => fields.forEach(([key]) => { values[key] = f[key].value.replace(/\r\n/g, '\n').trim(); }));
      if (!values.heroTitle) throw new Error('메인 첫 문구를 입력해 주세요.');
      if (!values.categories.split(',').some(c => c.trim())) throw new Error('카테고리를 하나 이상 입력해 주세요.');
      if (!/^\S+@\S+\.\S+$/.test(values.contactEmail)) throw new Error('문의 이메일을 올바르게 입력해 주세요.');
      if (!confirm('수정한 내용을 사이트에 반영할까요?')) return;
      await Store.saveSettings(values);
      toast('사이트 설정을 저장했습니다.');
      refresh();
    },
    sns: async () => {
      readSnsDraft();
      const links = state.snsDraft;
      if (!links.every(l => /^https?:\/\/\S+\.\S+/.test(l.url))) throw new Error('SNS 채널 주소를 https://로 시작하는 주소로 입력해 주세요.');
      await Store.updateSns(links);
      state.snsDraft = null;
      toast('SNS 채널을 저장했습니다.');
      refresh();
    },
    profile: async f => {
      const u = me();
      if (!u) throw new Error('로그인이 필요합니다.');
      const name = f.name.value.trim(), phone = f.phone.value.trim();
      const storeName = u.role === 'owner' ? f.storeName.value.trim() : '';
      if (!name) throw new Error('이름을 입력해 주세요.');
      if (!/^[0-9-]{9,13}$/.test(phone)) throw new Error('연락처를 정확히 입력해 주세요.');
      if (u.role === 'owner' && !storeName) throw new Error('매장명을 입력해 주세요.');
      await Store.updateProfile({ name, phone, storeName });
      toast('내 정보를 저장했습니다.');
      refresh();
    },
    password: async f => {
      if (!f.current.value) throw new Error('현재 비밀번호를 입력해 주세요.');
      if (f.next.value.length < 8) throw new Error('새 비밀번호는 8자 이상으로 입력해 주세요.');
      if (f.next.value !== f.next2.value) throw new Error('새 비밀번호가 서로 다릅니다.');
      if (f.next.value === f.current.value) throw new Error('현재 비밀번호와 다른 비밀번호를 입력해 주세요.');
      await Store.changePassword(f.current.value, f.next.value);
      f.reset();
      toast('비밀번호를 변경했습니다.');
    },
    'find-id': async f => {
      if (!f.name.value.trim() || !f.phone.value.trim()) throw new Error('이름과 연락처를 입력해 주세요.');
      const ids = await Store.findUsername(f.name.value, f.phone.value);
      showModal('아이디 찾기', ids.length
        ? `<p>입력하신 정보로 가입된 아이디입니다. 일부는 가려서 보여 드립니다.</p>${ids.map(id => `<div class="bank-info">${esc(id)}</div>`).join('')}`
        : '<p>입력하신 이름과 연락처로 가입된 아이디를 찾지 못했습니다.</p>');
    },
    'find-pw': async f => {
      if (!f.username.value.trim() || !f.name.value.trim() || !f.phone.value.trim()) throw new Error('아이디, 이름, 연락처를 모두 입력해 주세요.');
      await Store.requestPasswordReset(f.username.value, f.name.value, f.phone.value);
      f.reset();
      showModal('비밀번호 재설정 요청', '<p>요청이 접수되었습니다. 입력하신 정보가 가입 정보와 일치하면, 가입할 때 등록한 연락처로 본인 확인 후 임시 비밀번호를 안내해 드립니다.</p>');
    },
    apply: async f => {
      const u = me();
      if (!u || u.role !== 'influencer') throw new Error('인플루언서 회원만 신청할 수 있습니다.');
      const message = f.message.value.replace(/\s+/g, ' ').trim();
      if (message.length > MAX_MESSAGE) throw new Error(`신청 한마디는 ${MAX_MESSAGE}자 이내로 적어 주세요.`);
      await Store.apply(f.dataset.id, message);
      closeModal();
      toast('신청이 완료되었습니다. 마이페이지에서 진행 상태를 확인하세요.');
      refresh();
    },
    review: async f => {
      const url = f.url.value.trim();
      if (!/^https?:\/\/\S+\.\S+/.test(url)) throw new Error('리뷰 게시물 주소를 https://로 시작하는 주소로 입력해 주세요.');
      const a = Store.applications().find(x => x.id === f.dataset.id);
      if (!a || a.userId !== me().id) throw new Error('권한이 없습니다.');
      await Store.submitReview(a.id, url);
      toast('리뷰 링크를 제출했습니다. 관리자 확인 후 완료됩니다.');
      refresh();
    },
    post: async f => {
      const u = me();
      const id = f.dataset.id;
      const old = id ? Store.campaign(id) : null;
      if (!u || (old ? !canManage(id) : u.role !== 'owner')) throw new Error('권한이 없습니다.');
      const need = (cond, msg) => { if (!cond) throw new Error(msg); };
      const t = k => f[k].value.trim();
      need(t('storeName'), '매장명을 입력해 주세요.');
      need(t('menu'), '체험 메뉴를 입력해 주세요.');
      need(Number(f.amount.value) > 0, '제공 금액을 입력해 주세요.');
      need(Number(f.capacity.value) >= 1, '모집 인원을 1명 이상으로 입력해 주세요.');
      need(REGIONS.includes(f.regionSido.value), '지역(시·도)을 선택해 주세요.');
      need(t('regionDetail'), '시·군·구를 입력해 주세요.');
      need(t('deadline'), '모집 마감일을 선택해 주세요.');
      need(t('visitStart') && t('visitEnd') && t('visitStart') <= t('visitEnd'), '방문 가능 기간을 올바르게 선택해 주세요.');
      need(/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(t('ownerPhone')), '사장님 휴대폰 번호를 정확히 입력해 주세요. (예: 010-1234-5678)');
      need(/^[0-9-]{8,13}$/.test(t('reservePhone')), '예약 연락처를 숫자와 하이픈(-)으로 정확히 입력해 주세요.');
      need(t('description'), '체험 내용을 입력해 주세요.');
      need(t('conditions'), '리뷰 조건을 입력해 주세요.');
      const image = state.pendingImage || (old && old.image);
      need(image, '대표 이미지를 1장 등록해 주세요.');
      const data = {
        storeName: t('storeName'), menu: t('menu'), amount: Number(f.amount.value), capacity: Number(f.capacity.value),
        region: f.regionSido.value + ' ' + t('regionDetail'), category: f.category.value, channel: f.channel.value, deadline: t('deadline'),
        periodStart: t('visitStart'), periodEnd: t('visitEnd'), visitStart: t('visitStart'), visitEnd: t('visitEnd'), // 체험 기간은 따로 받지 않고 방문 가능 기간과 같게 저장
        description: t('description'), conditions: t('conditions'), image, reservePhone: t('reservePhone'), ownerPhone: t('ownerPhone')
      };
      const saved = await Store.saveCampaign(data, id || undefined);
      state.pendingImage = null;
      toast(!old ? '등록 신청했습니다. 관리자 승인 후 게시됩니다.' : saved.approval === 'pending' && old.approval === 'rejected' ? '수정하고 다시 신청했습니다.' : '모집글을 수정했습니다.');
      go(saved.approval === 'approved' ? '/campaign/' + saved.id : u.role === 'admin' ? '/admin/campaigns' : '/my');
      if (!old) showModal('등록 신청이 접수되었습니다', bankHtml());
    }
  };

  // 관리자가 고른 영상·사진을 확인 후 저장하고 화면에 반영
  function changeMedia(input) {
    const key = input.dataset.key;
    const slot = MEDIA_SLOTS.find(s => s[0] === key);
    const file = input.files[0];
    input.value = '';
    if (!isAdmin() || !slot || !file) return;
    let ready;
    if (slot[2] === 'video') {
      if (!/^video\/(mp4|webm)$/.test(file.type)) return toast('MP4 또는 WebM 영상만 올릴 수 있습니다.');
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) return toast(`영상은 ${MAX_VIDEO_MB}MB 이하로 올려 주세요.`);
      ready = Promise.resolve(file);
    } else {
      ready = readImage(file, 1600).then(data => fetch(data)).then(r => r.blob());
    }
    ready.then(blob => {
      if (!confirm(`"${slot[1]}"을(를) 고른 파일로 바꿀까요?`)) return;
      toast('올리는 중입니다…');
      return Store.media.put(key, blob).then(() => {
        toast('바꿨습니다.');
        refresh();
      });
    }).catch(err => toast((err && err.message) || '파일을 저장하지 못했습니다.'));
  }

  // 이미지를 가로 max px 이하 JPEG로 줄여서 반환 (모집글 대표 이미지는 900px)
  function readImage(file, max = 900) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('이미지 파일만 등록할 수 있습니다.'));
        img.onload = () => {
          const scale = Math.min(1, max / img.width);
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * scale);
          cv.height = Math.round(img.height * scale);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- 이벤트 연결 ---------- */
  let busy = false;
  function run(task) {
    if (busy) return;
    busy = true;
    Promise.resolve().then(task)
      .catch(err => toast((err && err.message) || '처리하지 못했습니다.'))
      .then(() => { busy = false; });
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    run(() => actions[el.dataset.action](el));
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    run(() => forms[f.dataset.form](f));
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'user-search') {
      state.userQ = e.target.value;
      document.getElementById('user-rows').innerHTML = userRows();
    }
    if (e.target.id === 'search') {
      state.q = e.target.value;
      document.getElementById('list-results').innerHTML = listResults();
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'role' && t.form) t.form.dataset.role = t.value;
    if (t.dataset.change === 'media') changeMedia(t);
    if (t.dataset.change === 'region') {
      state.region = t.value;
      const grid = document.getElementById('home-grid');
      const rows = document.getElementById('list-results');
      if (grid) grid.innerHTML = homeGrid();
      if (rows) rows.innerHTML = listResults();
    }
    if (t.id === 'post-image' && t.files[0]) {
      readImage(t.files[0]).then(data => {
        state.pendingImage = data;
        document.getElementById('image-preview').innerHTML = `<img src="${data}" alt="대표 이미지 미리보기">`;
      }).catch(err => { t.value = ''; toast(err.message); });
    }
  });
  window.addEventListener('hashchange', () => Store.refresh().catch(() => {}).then(() => render()));

  Store.init()
    .catch(err => toast((err && err.message) || '서버에 연결하지 못했습니다.'))
    .then(() => render());
})();
