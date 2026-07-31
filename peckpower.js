/* PeckPower shared local state and global UI. */
window.PeckPower = (() => {
  const STORE_KEY = 'peckpower.unified.v1';
  const LEGACY_STORE_KEY = ['pea', 'kpower.unified.v1'].join('');
  const NAV_ITEMS = [
    ['dashboard.html', '🏠', '首页', 'dashboard'],
    ['index.html', '📚', '词库', 'words'],
    ['pomodoro-todo.html', '⏳', '专注', 'focus'],
    ['profile.html', '👤', '我的', 'profile']
  ];
  let cachedState = null;
  let sharedAudioContext = null;
  let pageTransitionsBound = false;
  let dockIdleTimer = null;
  let lastDockActivityAt = 0;
  const DOCK_IDLE_DELAY = 3200;
  const initialState = {
    profile: { name: 'PeckPower 学习者', points: 1280 },
    wordProgress: { masteredToday: 0, weeklyWords: 68, date: '', masteredWords: [], favorites: [] },
    todos: [
      { id: 'task-reading', title: '完成英语阅读真题', priority: 'high', completed: false, actualPomodoros: 0 },
      { id: 'task-words', title: '复习 20 个高考核心词', priority: 'medium', completed: false, actualPomodoros: 0 }
    ],
    sessions: [], activeTodoId: null
  };
  const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  // PeckPower 逻辑：统一读取数据，并为旧版本地数据做最小迁移。
  function getState() {
    if (cachedState) return cachedState;
    try {
      let serializedState = localStorage.getItem(STORE_KEY);
      let shouldPersist = false;
      if (!serializedState) {
        serializedState = localStorage.getItem(LEGACY_STORE_KEY);
        shouldPersist = Boolean(serializedState);
      }
      const saved = JSON.parse(serializedState);
      const state = { ...initialState, ...saved, profile: { ...initialState.profile, ...saved?.profile }, wordProgress: { ...initialState.wordProgress, ...saved?.wordProgress } };
      const legacyBrand = ['Pea', 'kPower'].join('');
      if (typeof state.profile.name === 'string' && state.profile.name.includes(legacyBrand)) {
        state.profile.name = state.profile.name.replaceAll(legacyBrand, 'PeckPower');
        shouldPersist = true;
      }
      if (state.wordProgress.date !== localDate()) {
        state.wordProgress = { ...state.wordProgress, masteredToday: 0, date: localDate() };
        shouldPersist = true;
      }
      cachedState = state;
      if (shouldPersist) localStorage.setItem(STORE_KEY, JSON.stringify(state));
      return cachedState;
    } catch (error) {
      console.warn('PeckPower 数据读取失败：', error);
      cachedState = { ...initialState, wordProgress: { ...initialState.wordProgress, date: localDate() } };
      return cachedState;
    }
  }
  function saveState(state) {
    cachedState = state;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (error) { console.warn('PeckPower 数据保存失败：', error); }
  }
  function update(mutator) { const state = getState(); mutator(state); saveState(state); return state; }
  // PeckPower 逻辑：顶部通知在三秒后自动收起。
  function notify(message) { const el = document.querySelector('#global-notice'); if (!el) return; el.textContent = message; el.classList.add('show'); clearTimeout(window.__peckNoticeTimer); window.__peckNoticeTimer = setTimeout(() => el.classList.remove('show'), 3000); }
  // PeckPower 逻辑：切换全局啄木鸟的 idle、pecking、happy 三种状态。
  function bird(state = 'idle') { const el = document.querySelector('#site-bird'); if (!el) return; el.classList.remove('pecking', 'happy'); if (state !== 'idle') { void el.offsetWidth; el.classList.add(state); } }
  // PeckPower 逻辑：复用单一 AudioContext，避免连续点击时反复分配音频系统资源。
  function peckSound() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      sharedAudioContext ||= new Audio();
      if (sharedAudioContext.state === 'suspended') sharedAudioContext.resume().catch(() => {});
      const t = sharedAudioContext.currentTime;
      [0, .06].forEach((offset, index) => {
        const osc = sharedAudioContext.createOscillator();
        const gain = sharedAudioContext.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(index ? 150 : 116, t + offset);
        osc.frequency.exponentialRampToValueAtTime(55, t + offset + .05);
        gain.gain.setValueAtTime(.11, t + offset);
        gain.gain.exponentialRampToValueAtTime(.001, t + offset + .06);
        osc.connect(gain).connect(sharedAudioContext.destination);
        osc.start(t + offset);
        osc.stop(t + offset + .065);
      });
    } catch (error) {
      console.warn('音效播放失败：', error);
    }
  }
  function currentRouteIndex() {
    const fileName = decodeURIComponent(window.location.pathname.split('/').pop() || 'dashboard.html');
    const index = NAV_ITEMS.findIndex(([href]) => href === fileName);
    return index < 0 ? 0 : index;
  }
  // PeckPower 逻辑：读取上一页留下的方向，在新页面播放 iOS 弹性滑入动画。
  function preparePageEntrance() {
    try {
      const direction = sessionStorage.getItem('peckpower.transition-direction');
      sessionStorage.removeItem('peckpower.transition-direction');
      if (!direction) return;
      document.body.classList.add(direction === 'forward' ? 'page-enter-forward' : 'page-enter-back');
      window.setTimeout(() => document.body.classList.remove('page-enter-forward', 'page-enter-back'), 410);
    } catch (error) {
      console.warn('页面进入动画状态读取失败：', error);
    }
  }
  // PeckPower 逻辑：跨页面跳转时记录导航连续状态，新页面不再重复播放底栏入场。
  function consumeDockContinuity() {
    try {
      const continuous = sessionStorage.getItem('peckpower.dock-continuity') === '1';
      sessionStorage.removeItem('peckpower.dock-continuity');
      return continuous;
    } catch (error) {
      console.warn('导航连续状态读取失败：', error);
      return false;
    }
  }
  function scheduleDockHide() {
    window.clearTimeout(dockIdleTimer);
    dockIdleTimer = window.setTimeout(() => {
      const dock = document.querySelector('.tab-bar');
      if (!dock || document.body.classList.contains('page-is-leaving')) return;
      if (dock.contains(document.activeElement)) {
        scheduleDockHide();
        return;
      }
      dock.classList.add('is-idle-hidden');
    }, DOCK_IDLE_DELAY);
  }
  // PeckPower 逻辑：页面有滚动、触摸、按键等操作时唤回导航，无操作后自动下沉隐藏。
  function revealDock() {
    const dock = document.querySelector('.tab-bar');
    if (!dock || document.body.classList.contains('page-is-leaving')) return;
    const now = performance.now();
    const isHidden = dock.classList.contains('is-idle-hidden');
    if (!isHidden && now - lastDockActivityAt < 180) return;
    lastDockActivityAt = now;
    dock.classList.remove('is-idle-hidden');
    scheduleDockHide();
  }
  function bindDockAutoHide() {
    const passiveOptions = { passive: true };
    ['pointerdown', 'touchstart', 'wheel', 'scroll'].forEach((eventName) => {
      document.addEventListener(eventName, revealDock, passiveOptions);
    });
    document.addEventListener('keydown', revealDock);
    document.addEventListener('focusin', revealDock);
    document.addEventListener('pointermove', revealDock, passiveOptions);
    scheduleDockHide();
  }
  // PeckPower 逻辑：跳转前让液态高亮胶囊先滑向目标槽位，并同步交接文字状态。
  function animateDockSelection(targetIndex) {
    const dock = document.querySelector('.tab-bar');
    const home = dock?.querySelector('.tab-home');
    const pill = dock?.querySelector('.tab-pill');
    if (!dock || !home || !pill) return;
    home.classList.toggle('active', targetIndex === 0);
    home.setAttribute('aria-current', targetIndex === 0 ? 'page' : 'false');
    pill.dataset.activeIndex = targetIndex === 0 ? '-1' : String(targetIndex - 1);
    pill.querySelectorAll('.tab-item').forEach((item, itemIndex) => {
      const isTarget = itemIndex === targetIndex - 1;
      item.classList.toggle('active', isTarget);
      item.setAttribute('aria-current', isTarget ? 'page' : 'false');
    });
  }
  // PeckPower 逻辑：离开当前页时根据 Tab 顺序决定向左或向右滑动，再执行跳转。
  function navigateWithTransition(targetUrl, targetIndex) {
    if (document.body.classList.contains('page-is-leaving')) return;
    const direction = targetIndex > currentRouteIndex() ? 'forward' : 'back';
    window.clearTimeout(dockIdleTimer);
    document.querySelector('.tab-bar')?.classList.remove('is-idle-hidden');
    animateDockSelection(targetIndex);
    try {
      sessionStorage.setItem('peckpower.transition-direction', direction);
      sessionStorage.setItem('peckpower.dock-continuity', '1');
    } catch (error) {
      console.warn('页面切换状态保存失败：', error);
    }
    document.body.classList.add('page-is-leaving', direction === 'forward' ? 'page-exit-forward' : 'page-exit-back');
    window.setTimeout(() => { window.location.href = targetUrl; }, 205);
  }
  // PeckPower 逻辑：所有站内页面链接共享同一套方向感转场，快捷入口也会生效。
  function bindPageTransitions() {
    if (pageTransitionsBound) return;
    pageTransitionsBound = true;
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest('a[href$=".html"]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, window.location.href);
      const fileName = decodeURIComponent(url.pathname.split('/').pop());
      const targetIndex = NAV_ITEMS.findIndex(([href]) => href === fileName);
      if (targetIndex < 0 || targetIndex === currentRouteIndex()) return;
      event.preventDefault();
      navigateWithTransition(url.href, targetIndex);
    });
  }
  // PeckPower 逻辑：注入全局角色、通知和参考示例风格的“圆形主页 + 液态胶囊”导航。
  function mountGlobal(active) {
    preparePageEntrance();
    const keepDockContinuous = consumeDockContinuity();
    document.body.insertAdjacentHTML('afterbegin', '<div id="global-notice" class="global-notice" role="status" aria-live="polite"></div><div id="site-bird" class="site-bird" aria-label="PeckPower 啄木鸟">🐦</div>');
    const [home, ...pillItems] = NAV_ITEMS;
    const activeIndex = NAV_ITEMS.findIndex(([, , , key]) => key === active);
    const pillActiveIndex = activeIndex > 0 ? activeIndex - 1 : -1;
    const homeLink = `<a href="${home[0]}" class="tab-home ${home[3] === active ? 'active' : ''}" aria-current="${home[3] === active ? 'page' : 'false'}"><span class="tab-icon">${home[1]}</span><span>${home[2]}</span></a>`;
    const pillLinks = pillItems.map(([href, icon, label, key]) => `<a href="${href}" class="tab-item ${key === active ? 'active' : ''}" aria-current="${key === active ? 'page' : 'false'}"><span class="tab-icon">${icon}</span><span class="tab-label">${label}</span></a>`).join('');
    document.body.insertAdjacentHTML('beforeend', `<nav class="tab-bar ${keepDockContinuous ? 'is-continuous' : ''}" aria-label="主导航">${homeLink}<div class="tab-pill" data-active-index="${pillActiveIndex}"><span class="tab-slider" aria-hidden="true"></span>${pillLinks}</div></nav>`);
    bindPageTransitions();
    bindDockAutoHide();
  }
  window.addEventListener('storage', (event) => {
    if (event.key === STORE_KEY) cachedState = null;
  });
  return { getState, saveState, update, notify, bird, peckSound, mountGlobal, localDate };
})();
