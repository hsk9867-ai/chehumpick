/* 체험픽 화면·라우팅. 데이터는 store.js(Store)를 통해서만 읽고 씁니다. */
(function () {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  const toastEl = document.getElementById('toast');

  const CHANNELS = ['인스타 릴스', '인스타 피드', '블로그', '블로그 + 인스타'];
  const SNS_TYPES = ['인스타그램', '네이버 블로그', '유튜브', '기타'];
  const HERO_CLIPS = ['food', 'cafe', 'beauty', 'stay'].map(n => `assets/video/${n}.mp4`);
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

  const state = { cat: '전체', q: '', adminTab: 'apps', afterLogin: null, pendingImage: null };

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

  const badge = status => `<span class="badge badge-${STATUS[status].cls}">${STATUS[status].label}</span>`;
  const openBadge = c => Store.isOpen(c)
    ? '<span class="badge badge-ok">모집 중</span>'
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
      html += `<span class="nav-user">${esc(u.name)}님 · ${ROLE_LABEL[u.role]}</span>`;
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

  function filtered(onlyOpen) {
    const q = state.q.trim().toLowerCase();
    return Store.campaigns()
      .filter(c => !onlyOpen || Store.isOpen(c))
      .filter(c => state.cat === '전체' || c.category === state.cat)
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
      : '<p class="empty">이 카테고리에는 모집 중인 체험단이 아직 없습니다.</p>';
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
    return `
    <section class="hero" style="background-image:url('assets/video/poster.jpg')">
      <div class="hero-media" aria-hidden="true">
        <video muted playsinline preload="auto"></video>
        <video muted playsinline preload="auto"></video>
      </div>
      <div class="container hero-inner">
        <div>
          <h1>${nl2br(S.heroTitle)}</h1>
          <p>${nl2br(S.heroSub)}</p>
          <a class="btn btn-yellow btn-lg" href="#/campaigns">${esc(S.heroButton)} ${ICON.arrow}</a>
        </div>
        <p class="hand hero-note">${nl2br(S.heroNote)}</p>
      </div>
    </section>

    <section class="container section">
      <div class="section-head"><h2>${esc(S.homeListTitle)}</h2><a href="#/campaigns" class="more">전체보기 ${ICON.arrow}</a></div>
      ${pills()}
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
        <a class="btn btn-pink" href="#/owner">${esc(S.ctaOwnerButton)} ${ICON.arrow}</a></div>
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
    <section class="hero hero-sm" style="background-image:url('assets/img/hero.jpg')">
      <div class="container"><h1>체험단</h1><p>다양한 매장의 체험단을 지금 바로 만나보세요.</p></div>
    </section>
    <section class="container section narrow">
      <label class="search">
        <input type="search" id="search" placeholder="매장명, 메뉴, 지역으로 검색해 보세요" value="${esc(state.q)}">
        <span class="search-btn">${ICON.search}</span>
      </label>
      ${pills()}
      <div id="list-results" class="rows">${listResults()}</div>
    </section>`;
  }

  /* ---------- 2. 모집글 상세 ---------- */
  function detail(id) {
    const c = Store.campaign(id);
    if (!c) return notFound();
    const u = Store.currentUser();
    const open = Store.isOpen(c);
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
        <div><dt>체험 기간</dt><dd>${esc(c.periodStart)} ~ ${esc(c.periodEnd)}</dd></div>
        <div><dt>방문 가능 기간</dt><dd>${esc(c.visitStart)} ~ ${esc(c.visitEnd)}</dd></div>
      </dl>
      <div class="block"><h2>체험 내용</h2><p>${nl2br(c.description)}</p></div>
      <div class="block"><h2>리뷰 조건</h2><p>${nl2br(c.conditions)}</p></div>
      <div class="sticky-action">${action}</div>
    </section>`;
  }

  /* ---------- 3. 로그인 ---------- */
  function login() {
    if (Store.currentUser()) { go('/my'); return ''; }
    const demo = (label, email, pw) =>
      `<button type="button" class="btn btn-soft btn-sm" data-action="demo-login" data-email="${email}" data-pw="${pw}">${label}</button>`;
    return `
    <section class="container section form-page">
      <h1>로그인</h1>
      <form data-form="login" class="form" data-role="influencer" novalidate>
        <div class="role-switch">
          <label><input type="radio" name="role" value="influencer" checked><span>🙋 인플루언서로 로그인<small>체험단에 신청해요</small></span></label>
          <label><input type="radio" name="role" value="owner"><span>👩‍🍳 사장님으로 로그인<small>체험단을 모집해요</small></span></label>
        </div>
        <label>이메일<input type="email" name="email" autocomplete="email" placeholder="example@email.com"></label>
        <label>비밀번호<input type="password" name="password" autocomplete="current-password" placeholder="비밀번호"></label>
        <button class="btn btn-dark btn-block btn-lg">로그인</button>
      </form>
      <p class="form-foot">아직 회원이 아니신가요? <a href="#/signup/influencer">인플루언서로 가입</a> · <a href="#/signup/owner">사장님으로 가입</a></p>
      <div class="demo-box">
        <p><b>데모 계정으로 둘러보기</b> (시연용 · 오픈 시 삭제)</p>
        <div class="demo-btns">
          ${demo('인플루언서', 'review@chehumpick.kr', 'review1234')}
          ${demo('사장님', 'owner@chehumpick.kr', 'owner1234')}
          ${demo('관리자', 'admin@chehumpick.kr', 'admin1234')}
        </div>
        <button type="button" class="link-btn" data-action="reset-demo">데모 데이터 초기화</button>
      </div>
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
        <label>이메일<input type="email" name="email" autocomplete="email" placeholder="example@email.com"></label>
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

  function influencerMy(u) {
    const apps = Store.applicationsByUser(u.id);
    const item = a => {
      const c = Store.campaign(a.campaignId);
      if (!c) return '';
      let body = '';
      if (a.status === 'applied') body = '<p class="note">사장님이 신청 내용을 확인하고 있습니다. 선정 결과는 이 화면에 표시됩니다.</p>';
      if (a.status === 'rejected') body = '<p class="note">아쉽지만 이번 체험단에는 선정되지 않았습니다.</p>';
      if (a.status === 'selected') body = `
        <div class="visit"><b>🎉 선정되었습니다!</b> 방문 가능 기간: <b>${esc(c.visitStart)} ~ ${esc(c.visitEnd)}</b><br>기간 안에 방문한 뒤 리뷰 링크를 제출해 주세요.</div>
        <form data-form="review" data-id="${a.id}" class="inline-form" novalidate>
          <input type="url" name="url" placeholder="리뷰 게시물 주소 (https://...)" value="${esc(a.reviewUrl)}">
          <button class="btn btn-dark">리뷰 링크 제출</button>
        </form>`;
      if (a.status === 'submitted') body = `<p class="note">제출한 링크: <a href="${safeUrl(a.reviewUrl)}" target="_blank" rel="noopener">${esc(a.reviewUrl)}</a><br>관리자가 리뷰를 확인하고 있습니다.</p>`;
      if (a.status === 'done') body = `<p class="note">체험이 완료되었습니다. 감사합니다! <a href="${safeUrl(a.reviewUrl)}" target="_blank" rel="noopener">제출한 리뷰 보기</a></p>`;
      return `<article class="my-item">
        <a class="my-thumb" href="#/campaign/${c.id}"><img src="${esc(c.image)}" alt=""></a>
        <div class="my-body">
          <div class="my-top"><h3><a href="#/campaign/${c.id}">${esc(c.storeName)}</a></h3><span class="badge badge-${STATUS[a.status].cls}">${STATUS[a.status].inf}</span></div>
          <p class="menu">${esc(c.menu)} · 신청일 ${esc(a.createdAt)}</p>
          ${a.status === 'rejected' ? '' : stepper(a.status)}
          ${body}
        </div>
      </article>`;
    };
    return `
    <section class="container section narrow">
      <div class="section-head"><h1>마이페이지</h1><a class="more" href="#/campaigns">체험단 더 찾아보기 ${ICON.arrow}</a></div>
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
      <thead><tr><th>이름</th><th>SNS 채널</th><th>신청일</th><th>상태</th><th>연락처</th><th></th></tr></thead>
      <tbody>${apps.map(a => {
        const inf = Store.user(a.userId) || {};
        const picked = ['selected', 'submitted', 'done'].includes(a.status);
        return `<tr>
          <td>${esc(inf.name)}</td>
          <td><a href="${safeUrl(inf.snsUrl)}" target="_blank" rel="noopener">${esc(inf.snsType || '채널')} 보기</a></td>
          <td>${esc(a.createdAt)}</td>
          <td>${badge(a.status)}</td>
          <td>${picked ? esc(inf.phone) : '<span class="muted">선정 후 공개</span>'}</td>
          <td class="nowrap">${OWNER_BUTTONS[a.status].filter(([to]) => to !== 'selected' || !full).map(([to, label, dark]) =>
            `<button class="btn ${dark ? 'btn-dark' : 'btn-soft'} btn-sm" data-action="owner-status" data-id="${a.id}" data-status="${to}" data-label="${label}">${label}</button>`).join(' ')}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
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
      <div class="section-head"><h1>사장님 마이페이지</h1><a class="btn btn-dark" href="#/post/new">+ 모집글 등록</a></div>
      <p class="sub">${esc(u.storeName || u.name)} · 등록한 모집글 ${mine.length}건</p>
      ${mine.length ? mine.map(item).join('') : '<p class="empty">아직 등록한 모집글이 없습니다.<br><a href="#/post/new">첫 체험단 모집글 등록하기</a></p>'}
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
      <h1>${c ? '모집글 수정' : '모집글 등록'}</h1>
      <form data-form="post" data-id="${c ? c.id : ''}" class="form" novalidate>
        <label>매장명 <i>*</i><input name="storeName" value="${c ? v('storeName') : esc(u.storeName || '')}" placeholder="매장명을 입력해 주세요"></label>
        <label>체험 메뉴 <i>*</i><input name="menu" value="${v('menu')}" placeholder="예: 황금치킨 + 수제맥주"></label>
        <div class="cols">
          <label>제공 금액(원) <i>*</i><input type="number" name="amount" min="0" step="1000" value="${v('amount')}" placeholder="35000"></label>
          <label>모집 인원(명) <i>*</i><input type="number" name="capacity" min="1" value="${v('capacity')}" placeholder="10"></label>
        </div>
        <div class="cols">
          <label>지역 <i>*</i><input name="region" value="${v('region')}" placeholder="예: 아산"></label>
          <label>카테고리<select name="category">${opts(c && !cats().includes(c.category) ? cats().concat(c.category) : cats(), c && c.category)}</select></label>
        </div>
        <div class="cols">
          <label>체험단 유형<select name="channel">${opts(CHANNELS, c && c.channel)}</select></label>
          <label>모집 마감일 <i>*</i><input type="date" name="deadline" value="${v('deadline')}"></label>
        </div>
        <div class="cols">
          <label>체험 기간 시작 <i>*</i><input type="date" name="periodStart" value="${v('periodStart')}"></label>
          <label>체험 기간 종료 <i>*</i><input type="date" name="periodEnd" value="${v('periodEnd')}"></label>
        </div>
        <div class="cols">
          <label>방문 가능 기간 시작 <i>*</i><input type="date" name="visitStart" value="${v('visitStart')}"></label>
          <label>방문 가능 기간 종료 <i>*</i><input type="date" name="visitEnd" value="${v('visitEnd')}"></label>
        </div>
        <label>체험 내용 <i>*</i><textarea name="description" rows="4" placeholder="제공 내역, 방문 시 안내 사항 등을 적어 주세요">${v('description')}</textarea></label>
        <label>리뷰 조건 <i>*</i><textarea name="conditions" rows="4" placeholder="예: 매장 방문 후 릴스 1건 업로드">${v('conditions')}</textarea></label>
        <label>대표 이미지 (1장) <i>*</i><input type="file" id="post-image" accept="image/*"></label>
        <div id="image-preview" class="image-preview">${c ? `<img src="${v('image')}" alt="현재 대표 이미지">` : ''}</div>
        <button class="btn btn-dark btn-block btn-lg">${c ? '수정 내용 저장' : '모집글 등록하기'}</button>
        ${c ? `<button type="button" class="btn btn-soft btn-block danger" data-action="delete-campaign" data-id="${c.id}">이 모집글 삭제</button>` : ''}
      </form>
    </section>`;
  }

  /* ---------- 8. 관리자 페이지 ---------- */
  function admin(tab) {
    if (tab) state.adminTab = tab;
    const tabs = [['apps', '신청·선정 현황'], ['campaigns', '모집글'], ['users', '회원'], ['site', '사이트 설정']];
    let body = '';
    if (state.adminTab === 'site') {
      body = siteSettings();
    } else if (state.adminTab === 'users') {
      body = `<div class="table-wrap"><table>
        <thead><tr><th>유형</th><th>이름</th><th>이메일</th><th>연락처</th><th>SNS 채널 / 매장명</th><th>가입일</th><th></th></tr></thead>
        <tbody>${Store.users().map(u => `<tr>
          <td>${ROLE_LABEL[u.role]}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td>
          <td>${u.role === 'influencer' ? `<a href="${safeUrl(u.snsUrl)}" target="_blank" rel="noopener">${esc(u.snsType)}</a>` : esc(u.storeName || '-')}</td>
          <td>${esc(u.createdAt)}</td>
          <td>${u.role === 'admin' ? '' : `<button class="btn btn-soft btn-sm danger" data-action="delete-user" data-id="${u.id}">삭제</button>`}</td>
        </tr>`).join('')}</tbody></table></div>`;
    } else if (state.adminTab === 'campaigns') {
      body = `<div class="table-wrap"><table>
        <thead><tr><th>매장명</th><th>사장님</th><th>상태</th><th>마감일</th><th>신청</th><th>선정</th><th></th></tr></thead>
        <tbody>${Store.campaigns().map(c => `<tr>
          <td><a href="#/campaign/${c.id}">${esc(c.storeName)}</a></td>
          <td>${esc((Store.user(c.ownerId) || {}).name || '-')}</td>
          <td>${openBadge(c)}</td><td>${esc(c.deadline)}</td>
          <td>${Store.applicationsByCampaign(c.id).length}명</td><td>${Store.pickedCount(c.id)}/${c.capacity}명</td>
          <td class="nowrap">
            <button class="btn btn-soft btn-sm" data-action="toggle-campaign" data-id="${c.id}">${c.status === 'open' ? '마감 처리' : '모집 재개'}</button>
            <a class="btn btn-soft btn-sm" href="#/post/${c.id}/edit">수정</a>
            <button class="btn btn-soft btn-sm danger" data-action="delete-campaign" data-id="${c.id}">삭제</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`;
    } else {
      const apps = Store.applications();
      const count = s => apps.filter(a => a.status === s).length;
      body = `<div class="stats">${Object.keys(STATUS).map(s => `<div><b>${count(s)}</b><span>${STATUS[s].label}</span></div>`).join('')}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>모집글</th><th>인플루언서</th><th>신청일</th><th>상태</th><th>리뷰 링크</th><th></th></tr></thead>
        <tbody>${apps.map(a => {
          const c = Store.campaign(a.campaignId) || {};
          const inf = Store.user(a.userId) || {};
          return `<tr>
            <td><a href="#/campaign/${c.id}">${esc(c.storeName)}</a></td>
            <td>${esc(inf.name)} <a class="muted" href="${safeUrl(inf.snsUrl)}" target="_blank" rel="noopener">(${esc(inf.snsType || 'SNS')})</a></td>
            <td>${esc(a.createdAt)}</td>
            <td>${badge(a.status)}</td>
            <td>${a.reviewUrl ? `<a href="${safeUrl(a.reviewUrl)}" target="_blank" rel="noopener">링크 확인</a>` : '<span class="muted">-</span>'}</td>
            <td class="nowrap">${ADMIN_BUTTONS[a.status].map(([to, label, dark]) =>
              `<button class="btn ${dark ? 'btn-dark' : 'btn-soft'} btn-sm" data-action="set-status" data-id="${a.id}" data-status="${to}" data-label="${label}">${label}</button>`).join(' ')}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="6" class="muted">신청 내역이 없습니다.</td></tr>'}</tbody></table></div>`;
    }
    return `
    <section class="container section">
      <h1>관리자 페이지</h1>
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
    <section class="hero hero-md" style="background-image:url('assets/img/owner.jpg')">
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
      <p class="sub">${esc(S.faqIntro)}</p>
      <div class="faq">${rows(S.faq).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
      <div class="contact"><h3>문의하기</h3><p>해결되지 않은 문의는 아래 연락처로 보내 주세요.</p>
      <a class="btn btn-dark" href="mailto:${esc(S.contactEmail)}">${esc(S.contactEmail)}</a></div>
    </section>`;
  }

  // 약관 본문: # 으로 시작하는 줄은 제목, 나머지는 문단. 기본 초안 그대로면 검토 안내를 함께 표시
  function docPage(title, key) {
    const draft = S[key] === Store.defaultSettings()[key]
      ? '<p class="draft">※ 표준 양식 기반 초안입니다. 운영자 검토 후 확정본으로 교체해 주세요.</p>' : '';
    const body = lines(S[key]).map(l => l.startsWith('#') ? `<h3>${esc(l.replace(/^#+\s*/, ''))}</h3>` : `<p>${esc(l)}</p>`).join('');
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
      ['faqIntro', '안내 문구'],
      ['faq', '자주 묻는 질문 (한 줄에 하나씩: 질문 | 답변)', 9],
      ['contactEmail', '문의 이메일']
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
    return `
    <p class="draft">지금은 시연용이라 수정 내용이 이 브라우저에만 저장됩니다. 서버를 연결하면 모든 방문자 화면에 반영됩니다.</p>
    <form data-form="settings" class="form settings-form" novalidate>
      ${SETTING_GROUPS.map(([title, fields], i) => `<details class="setting-group" ${i === 0 ? 'open' : ''}>
        <summary>${title}</summary><div class="setting-fields">${fields.map(field).join('')}</div></details>`).join('')}
      <div class="settings-actions">
        <button class="btn btn-dark btn-lg">저장하기</button>
        <button type="button" class="btn btn-soft danger" data-action="reset-settings">기본 문구로 되돌리기</button>
      </div>
    </form>`;
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
    [/^\/faq$/, faq],
    [/^\/terms$/, terms],
    [/^\/privacy$/, privacy]
  ];

  function render(keepScroll) {
    const path = location.hash.slice(1) || '/';
    S = Store.settings();
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
    start(vids[0], HERO_CLIPS[0]);
    heroTimer = setInterval(() => {
      if (!document.body.contains(box)) return clearInterval(heroTimer);
      clip = (clip + 1) % HERO_CLIPS.length;
      start(vids[1 - cur], HERO_CLIPS[clip]);
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
    logout: () => { Store.logout(); toast('로그아웃되었습니다.'); location.hash === '#/' ? render() : go('/'); },
    cat: el => {
      state.cat = el.dataset.cat;
      document.querySelectorAll('.pill').forEach(p => p.classList.toggle('on', p.dataset.cat === state.cat));
      const grid = document.getElementById('home-grid');
      const rows = document.getElementById('list-results');
      if (grid) grid.innerHTML = homeGrid();
      if (rows) rows.innerHTML = listResults();
    },
    apply: el => {
      const u = me();
      if (!u) { state.afterLogin = '/campaign/' + el.dataset.id; toast('로그인 후 신청할 수 있습니다.'); return go('/login'); }
      if (u.role !== 'influencer') return toast('인플루언서 회원만 신청할 수 있습니다.');
      Store.apply(el.dataset.id, u.id);
      toast('신청이 완료되었습니다. 마이페이지에서 진행 상태를 확인하세요.');
      refresh();
    },
    'demo-login': el => finishLogin(Store.login(el.dataset.email, el.dataset.pw)),
    'reset-demo': () => {
      if (!confirm('모든 데이터를 처음 상태로 되돌릴까요?')) return;
      Store.reset(); toast('데모 데이터를 초기화했습니다.'); render();
    },
    'owner-status': el => {
      const u = me();
      const a = Store.applications().find(x => x.id === el.dataset.id);
      const c = a && Store.campaign(a.campaignId);
      if (!u || !c || c.ownerId !== u.id) return toast('권한이 없습니다.');
      changeStatus(a, c, el, OWNER_BUTTONS);
    },
    'close-selection': el => {
      if (!canManage(el.dataset.id)) return toast('권한이 없습니다.');
      if (!confirm('선정을 마감할까요?\n아직 선정하지 않은 신청은 모두 미선정 처리되고 모집이 마감됩니다.')) return;
      Store.closeSelection(el.dataset.id);
      toast('선정을 마감했습니다.');
      refresh();
    },
    'delete-campaign': el => {
      if (!canManage(el.dataset.id)) return toast('권한이 없습니다.');
      if (!confirm('이 모집글을 삭제할까요?\n신청 내역도 함께 삭제되며 되돌릴 수 없습니다.')) return;
      Store.deleteCampaign(el.dataset.id);
      toast('모집글을 삭제했습니다.');
      if (/^#\/post\//.test(location.hash)) go(me().role === 'admin' ? '/admin' : '/my'); else refresh();
    },
    'toggle-campaign': el => {
      if (!isAdmin()) return;
      const c = Store.campaign(el.dataset.id);
      Store.setCampaignStatus(c.id, c.status === 'open' ? 'closed' : 'open');
      refresh();
    },
    'delete-user': el => {
      if (!isAdmin()) return;
      if (!confirm('이 회원을 삭제할까요?\n해당 회원의 모집글과 신청 내역도 함께 삭제됩니다.')) return;
      Store.deleteUser(el.dataset.id);
      toast('회원을 삭제했습니다.');
      refresh();
    },
    'admin-tab': el => go('/admin/' + el.dataset.tab),
    'reset-settings': () => {
      if (!isAdmin()) return toast('권한이 없습니다.');
      if (!confirm('수정한 문구를 모두 지우고 기본 문구로 되돌릴까요?')) return;
      Store.resetSettings();
      toast('기본 문구로 되돌렸습니다.');
      refresh();
    },
    'set-status': el => {
      if (!isAdmin()) return toast('권한이 없습니다.');
      const a = Store.applications().find(x => x.id === el.dataset.id);
      if (!a) return;
      changeStatus(a, Store.campaign(a.campaignId) || {}, el, ADMIN_BUTTONS);
    }
  };
  // 허용된 상태 변경인지 확인하고, 확인 창을 거친 뒤 반영
  function changeStatus(a, c, el, table) {
    const btn = table[a.status].find(([to]) => to === el.dataset.status);
    if (!btn) return toast('지금 상태에서는 처리할 수 없습니다.');
    const name = (Store.user(a.userId) || {}).name || '신청자';
    if (!confirm(`[${c.storeName || ''}] ${name}님을 "${btn[1]}" 처리할까요?`)) return;
    Store.setApplicationStatus(a.id, btn[0]);
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
    login: f => {
      if (!f.email.value || !f.password.value) throw new Error('이메일과 비밀번호를 입력해 주세요.');
      finishLogin(Store.login(f.email.value, f.password.value, f.role.value));
    },
    signup: f => {
      const role = f.role.value;
      const need = (cond, msg) => { if (!cond) throw new Error(msg); };
      need(f.name.value.trim(), '이름을 입력해 주세요.');
      need(/^\S+@\S+\.\S+$/.test(f.email.value.trim()), '올바른 이메일 주소를 입력해 주세요.');
      need(f.password.value.length >= 8, '비밀번호는 8자 이상으로 입력해 주세요.');
      need(/^[0-9-]{9,13}$/.test(f.phone.value.trim()), '연락처를 정확히 입력해 주세요.');
      if (role === 'influencer') need(/^https?:\/\/\S+\.\S+/.test(f.snsUrl.value.trim()), 'SNS 채널 주소를 https://로 시작하는 주소로 입력해 주세요.');
      else need(f.storeName.value.trim(), '매장명을 입력해 주세요.');
      need(f.agree.checked, '약관에 동의해 주세요.');
      const u = Store.signup({
        role, name: f.name.value, email: f.email.value, password: f.password.value, phone: f.phone.value,
        snsType: f.snsType.value, snsUrl: f.snsUrl.value, storeName: f.storeName.value
      });
      finishLogin(u);
    },
    settings: f => {
      if (!isAdmin()) throw new Error('권한이 없습니다.');
      const values = {};
      SETTING_GROUPS.forEach(([, fields]) => fields.forEach(([key]) => { values[key] = f[key].value.replace(/\r\n/g, '\n').trim(); }));
      if (!values.heroTitle) throw new Error('메인 첫 문구를 입력해 주세요.');
      if (!values.categories.split(',').some(c => c.trim())) throw new Error('카테고리를 하나 이상 입력해 주세요.');
      if (!/^\S+@\S+\.\S+$/.test(values.contactEmail)) throw new Error('문의 이메일을 올바르게 입력해 주세요.');
      if (!confirm('수정한 내용을 사이트에 반영할까요?')) return;
      Store.saveSettings(values);
      toast('사이트 설정을 저장했습니다.');
      refresh();
    },
    review: f => {
      const url = f.url.value.trim();
      if (!/^https?:\/\/\S+\.\S+/.test(url)) throw new Error('리뷰 게시물 주소를 https://로 시작하는 주소로 입력해 주세요.');
      const a = Store.applications().find(x => x.id === f.dataset.id);
      if (!a || a.userId !== me().id) throw new Error('권한이 없습니다.');
      Store.submitReview(a.id, url);
      toast('리뷰 링크를 제출했습니다. 관리자 확인 후 완료됩니다.');
      refresh();
    },
    post: f => {
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
      need(t('region'), '지역을 입력해 주세요.');
      need(t('deadline'), '모집 마감일을 선택해 주세요.');
      need(t('periodStart') && t('periodEnd') && t('periodStart') <= t('periodEnd'), '체험 기간을 올바르게 선택해 주세요.');
      need(t('visitStart') && t('visitEnd') && t('visitStart') <= t('visitEnd'), '방문 가능 기간을 올바르게 선택해 주세요.');
      need(t('description'), '체험 내용을 입력해 주세요.');
      need(t('conditions'), '리뷰 조건을 입력해 주세요.');
      const image = state.pendingImage || (old && old.image);
      need(image, '대표 이미지를 1장 등록해 주세요.');
      const data = {
        storeName: t('storeName'), menu: t('menu'), amount: Number(f.amount.value), capacity: Number(f.capacity.value),
        region: t('region'), category: f.category.value, channel: f.channel.value, deadline: t('deadline'),
        periodStart: t('periodStart'), periodEnd: t('periodEnd'), visitStart: t('visitStart'), visitEnd: t('visitEnd'),
        description: t('description'), conditions: t('conditions'), image
      };
      if (!old) data.ownerId = u.id;
      const saved = Store.saveCampaign(data, id || undefined);
      state.pendingImage = null;
      toast(old ? '모집글을 수정했습니다.' : '모집글을 등록했습니다.');
      go('/campaign/' + saved.id);
    }
  };

  // 대표 이미지를 가로 900px 이하 JPEG로 줄여서 저장
  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('이미지 파일만 등록할 수 있습니다.'));
        img.onload = () => {
          const scale = Math.min(1, 900 / img.width);
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
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    try { actions[el.dataset.action](el); } catch (err) { toast(err.message); }
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    try { forms[f.dataset.form](f); } catch (err) { toast(err.message); }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'search') {
      state.q = e.target.value;
      document.getElementById('list-results').innerHTML = listResults();
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'role' && t.form) t.form.dataset.role = t.value;
    if (t.id === 'post-image' && t.files[0]) {
      readImage(t.files[0]).then(data => {
        state.pendingImage = data;
        document.getElementById('image-preview').innerHTML = `<img src="${data}" alt="대표 이미지 미리보기">`;
      }).catch(err => { t.value = ''; toast(err.message); });
    }
  });
  window.addEventListener('hashchange', () => render());

  render();
})();
