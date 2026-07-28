/* PeakPower shared local state and global UI. */
window.PeakPower = (() => {
  const STORE_KEY = 'peakpower.unified.v1';
  const initialState = {
    profile: { name: 'PeakPower 学习者', points: 1280 },
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
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      const state = { ...initialState, ...saved, profile: { ...initialState.profile, ...saved?.profile }, wordProgress: { ...initialState.wordProgress, ...saved?.wordProgress } };
      if (state.wordProgress.date !== localDate()) state.wordProgress = { ...initialState.wordProgress, date: localDate() };
      return state;
    } catch (error) { console.warn('PeakPower 数据读取失败：', error); return { ...initialState, wordProgress: { ...initialState.wordProgress, date: localDate() } }; }
  }
  function saveState(state) { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (error) { console.warn('PeakPower 数据保存失败：', error); } }
  function update(mutator) { const state = getState(); mutator(state); saveState(state); return state; }
  // PeckPower 逻辑：顶部通知在三秒后自动收起。
  function notify(message) { const el = document.querySelector('#global-notice'); if (!el) return; el.textContent = message; el.classList.add('show'); clearTimeout(window.__peakNoticeTimer); window.__peakNoticeTimer = setTimeout(() => el.classList.remove('show'), 3000); }
  // PeckPower 逻辑：切换全局啄木鸟的 idle、pecking、happy 三种状态。
  function bird(state = 'idle') { const el = document.querySelector('#site-bird'); if (!el) return; el.classList.remove('pecking', 'happy'); if (state !== 'idle') { void el.offsetWidth; el.classList.add(state); } }
  function peckSound() { try { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; const ctx = new Audio(); const t = ctx.currentTime; [0, .06].forEach((offset, index) => { const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'triangle'; osc.frequency.setValueAtTime(index ? 150 : 116, t + offset); osc.frequency.exponentialRampToValueAtTime(55, t + offset + .05); gain.gain.setValueAtTime(.11, t + offset); gain.gain.exponentialRampToValueAtTime(.001, t + offset + .06); osc.connect(gain).connect(ctx.destination); osc.start(t + offset); osc.stop(t + offset + .065); }); setTimeout(() => ctx.close().catch(() => {}), 200); } catch (error) { console.warn('音效播放失败：', error); } }
  // PeckPower 逻辑：注入全局角色、通知和固定 Tab Bar。
  function mountGlobal(active) {
    document.body.insertAdjacentHTML('afterbegin', '<div id="global-notice" class="global-notice" role="status" aria-live="polite"></div><div id="site-bird" class="site-bird" aria-label="PeakPower 啄木鸟">🐦</div>');
    const nav = [['dashboard.html','🏠','首页','dashboard'], ['index.html','📚','词库','words'], ['pomodoro-todo.html','⏳','专注','focus'], ['profile.html','👤','我的','profile']];
    document.body.insertAdjacentHTML('beforeend', `<nav class="tab-bar" aria-label="主导航">${nav.map(([href, icon, label, key]) => `<a href="${href}" class="${key === active ? 'active' : ''}"><span>${icon}</span>${label}</a>`).join('')}</nav>`);
  }
  return { getState, saveState, update, notify, bird, peckSound, mountGlobal, localDate };
})();
