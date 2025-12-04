/* BloomMap — FINAL FIXED VERSION (no 31/31, sessions & topics OK) */

(function () {
  const STORAGE = "bloommap_dashboard_state";
  const PROFILE = "bloommap_user_profile";

  const SECONDS_PER_SEED = 25 * 60;
  const GRID_DAYS = 31;
  const DEFAULT_STREAK = 11; // initial visible blooms once

  // ---------- state helpers ----------
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE)); } catch (_) { return null; }
  }
  function saveState(s) { localStorage.setItem(STORAGE, JSON.stringify(s)); }

  function defaultState() {
    return {
      subjects: [
        { id: 1, name: "Math",              topics: ["General"] },
        { id: 2, name: "Machine Learning",  topics: ["General"] },
        { id: 3, name: "DSA",               topics: ["General"] },
        { id: 4, name: "Web Dev",           topics: ["General"] },
      ],
      lastSubjectId: 4,
      sessions: [],
      seeds: 1000,
      month: new Date().getMonth(),
      streakInitialized: false,           // ensures default streak runs once
      mapTiles: Array(GRID_DAYS).fill(false),
    };
  }

  let state = loadState() || defaultState();

  // Month rollover: reset tiles only (keep history)
  const thisMonth = new Date().getMonth();
  if (state.month !== thisMonth) {
    state.month = thisMonth;
    state.mapTiles = Array(GRID_DAYS).fill(false);
    state.streakInitialized = false;
    saveState(state);
  }

  // Apply initial 11-day streak once
  if (!state.streakInitialized) {
    for (let i = 0; i < DEFAULT_STREAK; i++) state.mapTiles[i] = true;
    state.streakInitialized = true;
    saveState(state);
  }

  // ---------- timer ----------
  let timer = null;
  let running = false;
  let seconds = 0;

  // current selections
  let currentSubject = state.subjects[0]?.id || 1;
  let currentTopic = "General";

  // ---------- utils ----------
  function fmt(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  function awardStreakTiles(n) {
    let given = 0;
    for (let i = 0; i < GRID_DAYS && given < n; i++) {
      if (!state.mapTiles[i]) { state.mapTiles[i] = true; given++; }
    }
    return given;
  }

  // ---------- renders ----------
  function renderSeeds() {
    const el = document.getElementById("seedsDisplay");
    if (el) el.textContent = state.seeds;
  }

  function renderMap() {
    const grid = document.getElementById("mapGrid");
    if (!grid) return;
    grid.innerHTML = "";
    let bloomed = 0;

    state.mapTiles.forEach(t => {
      const tile = document.createElement("div");
      tile.className = "tile" + (t ? " bloom" : "");
      tile.innerHTML = t ? "<span class='seed'>🌱</span>" : "";
      grid.appendChild(tile);
      if (t) bloomed++;
    });

    const mp = document.getElementById("mapProgress");
    if (mp) mp.textContent = `${bloomed} / ${GRID_DAYS} days bloomed`;
  }

  function renderHistory() {
    const list = document.getElementById("sessionsList");
    if (!list) return;

    if (!state.sessions.length) {
      list.innerHTML = '<div class="small muted">No sessions yet</div>';
      return;
    }

    list.innerHTML = state.sessions.slice().reverse().map(s =>
      `<div style="padding:6px 0;display:flex;justify-content:space-between;">
         <strong>${s.subject} → ${s.topic}</strong>
         <span>${Math.round(s.seconds/60)} min</span>
       </div>`
    ).join("");
  }

  function renderSubjectDropdown() {
    const sel = document.getElementById("subjectSelect");
    if (!sel) return;

    sel.innerHTML = state.subjects
      .map(s => `<option value="${s.id}">${s.name}</option>`)
      .join("");

    // keep previous selection if still present
    if (!state.subjects.some(s => s.id === currentSubject)) {
      currentSubject = state.subjects[0]?.id || 1;
    }
    sel.value = currentSubject;

    sel.onchange = () => {
      currentSubject = Number(sel.value);
      const sub = state.subjects.find(s => s.id == currentSubject);
      currentTopic = sub?.topics?.[0] || "General";
      renderTopicDropdown();
    };
  }

  function renderTopicDropdown() {
    const sel = document.getElementById("topicSelect");
    if (!sel) return;

    const sub = state.subjects.find(s => s.id == currentSubject) || { topics: ["General"] };
    if (!sub.topics.includes(currentTopic)) currentTopic = sub.topics[0] || "General";

    sel.innerHTML = sub.topics.map(t => `<option>${t}</option>`).join("");
    sel.value = currentTopic;

    sel.onchange = () => { currentTopic = sel.value; };
  }

  function updateTimeUI() {
    const td = document.getElementById("timeDisplay");
    if (td) td.textContent = fmt(seconds);
  }

  function updateControls() {
    const pauseBtn = document.getElementById("pauseTimer");
    if (pauseBtn) pauseBtn.disabled = !running;

    const saveBtn = document.getElementById("saveSession");
    if (saveBtn) saveBtn.disabled = seconds < 60;
  }

  function updateVisualProgress() {
    const progress = (seconds % SECONDS_PER_SEED) / SECONDS_PER_SEED;

    const ring = document.getElementById("ringProg");
    if (ring) {
      const circ = 2 * Math.PI * 190;
      ring.style.strokeDashoffset = circ * (1 - progress);
    }

    const fill = document.getElementById("liquidFill");
    if (fill) fill.style.transform = `translateY(${(1 - progress) * 100}%)`;
  }

  // ---------- timer loop ----------
  function tick() {
    seconds++;
    updateTimeUI();
    updateControls();
    updateVisualProgress();

    if (seconds % SECONDS_PER_SEED === 0) {
      state.seeds += 1;
      awardStreakTiles(1);
      saveState(state);
      renderSeeds();
      renderMap();
    }
  }

  // ===== FOCUS / FULLSCREEN HELPERS (ADDED) =====
  let _focusVisibilityHandler = null;

  function _enterFullscreenSafe() {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) return el.requestFullscreen().catch(()=>{});
      if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen().catch(()=>{});
      if (el.msRequestFullscreen) return el.msRequestFullscreen().catch(()=>{});
    } catch(e) {}
    return Promise.resolve();
  }

  function _exitFullscreenSafe() {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
        if (document.exitFullscreen) return document.exitFullscreen().catch(()=>{});
        if (document.webkitExitFullscreen) return document.webkitExitFullscreen().catch(()=>{});
        if (document.msExitFullscreen) return document.msExitFullscreen().catch(()=>{});
      }
    } catch(e) {}
    return Promise.resolve();
  }

  function _attachVisibilityHandler() {
    _detachVisibilityHandler();
    _focusVisibilityHandler = function() {
      if (document.hidden) {
        // Pause timer when user leaves the tab
        try {
          running = false;
          clearInterval(timer);
          updateTimeUI();
          updateControls();
          updateVisualProgress();
        } catch(e){}
        try {
          const host = document.getElementById('toastArea');
          if(host){
            const tmp = document.createElement('div');
            tmp.className = 'toast show error';
            tmp.textContent = 'Timer paused because you switched tabs — stay focused 🌱';
            host.appendChild(tmp);
            setTimeout(()=> tmp.remove(), 1800);
          } else {
            console.warn('Timer paused due to visibility change');
          }
        } catch(e){}
      }
    };
    document.addEventListener('visibilitychange', _focusVisibilityHandler);
  }

  function _detachVisibilityHandler() {
    if (_focusVisibilityHandler) {
      document.removeEventListener('visibilitychange', _focusVisibilityHandler);
      _focusVisibilityHandler = null;
    }
  }
  // ===== END ADDED HELPERS =====

  // ---------- exposed actions ----------
  function startTimer() {
    if (running) return;
    running = true;
    timer = setInterval(tick, 1000);
    updateControls();
    // NEW: enter fullscreen + attach visibility handler
    _enterFullscreenSafe().then(()=>{/* ignore errors */});
    _attachVisibilityHandler();
  }

  function pauseTimer() {
    running = false;
    clearInterval(timer);
    updateControls();
    // NEW: exit fullscreen + detach handler
    _exitFullscreenSafe().then(()=>{/* ignore errors */});
    _detachVisibilityHandler();
  }

  function resetTimer() {
    running = false;
    clearInterval(timer);
    seconds = 0;
    updateTimeUI();
    updateControls();
    updateVisualProgress();
    // NEW: exit fullscreen + detach handler
    _exitFullscreenSafe().then(()=>{/* ignore errors */});
    _detachVisibilityHandler();
  }

function saveSession() {
  if (seconds < 60) return;

  const subj = state.subjects.find(s => s.id == currentSubject);

  // ---------- FIXED SESSION SAVE ----------
  state.sessions = state.sessions || [];
  state.sessions.push({
    subject: subj?.name || "Unknown",
    topic: currentTopic,
    seconds,
    date: Date.now(),
  });

  const earned = Math.floor(seconds / SECONDS_PER_SEED);
  if (earned > 0) {
    state.seeds += earned;
    awardStreakTiles(earned);
  }

  // 🔥 MAIN FIX: Proper save ensures analytics reads it
  saveState(state);

  resetTimer();
  renderSeeds();
  renderMap();
  renderHistory();  // refresh on dashboard immediately

  _exitFullscreenSafe().then(()=>{});
  _detachVisibilityHandler();
}


  // ---------- add subject/topic ----------
  function addSubject(name) {
    name = (name || "").trim();
    if (!name) return;

    // no duplicates (case-insensitive)
    if (state.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      window.BloomMap?.toast?.("Subject already exists ✅", "info");
      return;
    }

    const id = ++state.lastSubjectId;
    state.subjects.push({ id, name, topics: ["General"] });
    currentSubject = id;
    currentTopic = "General";

    saveState(state);
    renderSubjectDropdown();
    renderTopicDropdown();
  }

  function addTopic(name) {
    name = (name || "").trim();
    if (!name) return;

    const sub = state.subjects.find(s => s.id == currentSubject);
    if (!sub) return;

    // prevent duplicates (case-insensitive)
    const exists = sub.topics.some(t => t.toLowerCase() === name.toLowerCase());
    if (exists) {
      window.BloomMap?.toast?.("Topic already exists ✅", "info");
      return;
    }

    sub.topics.push(name);
    currentTopic = name;

    saveState(state);
    renderTopicDropdown();
  }

  // ---------- boot ----------
  window.BloomMap = {
    initDashboard() {
      // greeting
      const profile = JSON.parse(localStorage.getItem(PROFILE) || "{}");
      if (profile.name) {
        const g = document.getElementById("greetText");
        if (g) g.textContent = `Hey ${profile.name} 👋`;
      }

      renderSubjectDropdown();
      renderTopicDropdown();
      renderSeeds();
      renderMap();
      renderHistory();
      updateTimeUI();
      updateControls();
      updateVisualProgress();
    },

    // timer actions
    startTimer, pauseTimer, resetTimer, saveSession,

    // subject/topic actions
    addSubject, addTopic,
  };
})();

/* -------- ANALYTICS PAGE FIXED -------- */
window.BloomMap.initAnalytics = function () {
  const state = JSON.parse(localStorage.getItem("bloommap_dashboard_state") || "{}");

  // name + seeds
  const user = JSON.parse(localStorage.getItem("bloommap_user_profile") || "{}");
  if (user.name) {
    const w = document.getElementById("welcomeA");
    if (w) w.textContent = `Hey ${user.name} 👋`;
  }
  const totalSeedsA = document.getElementById("totalSeedsA");
  if (totalSeedsA) totalSeedsA.textContent = state.seeds ?? 0;

  // subject totals (minutes)
  const subTotals = {};
  (state.sessions || []).forEach(s => {
    subTotals[s.subject] = (subTotals[s.subject] || 0) + s.seconds / 60;
  });

  const labels = Object.keys(subTotals);
  const data = Object.values(subTotals);

  const pieCanvas = document.getElementById("pieChart");
  // If a fallback element exists, we'll hide/show it but we will always render a chart
  const pieFallback = document.getElementById("pieFallback");

  // If there are no subjects/data, create a placeholder single-slice chart and show a small popup
  let renderLabels = labels.slice();
  let renderData = data.slice();
  let renderBg = ["#ffbf66","#ffd88a","#ffc34d","#ffb13c","#ff9f2b","#ffe3a6"];

  let showNoInfoPopup = false;
  if (!renderData.length || renderData.every(v => v === 0)) {
    renderLabels = ["No info yet"];
    renderData = [1];
    renderBg = ["#f3c1c1"];
    showNoInfoPopup = true;
  }

  if (pieFallback) pieFallback.style.display = "none";
  if (pieCanvas) pieCanvas.style.display = "block";

  // Destroy existing chart instance if present to avoid duplicates
  try { if (window._pieChartInstance) { window._pieChartInstance.destroy(); window._pieChartInstance = null; } } catch(e){}

  if (pieCanvas) window._pieChartInstance = // create pie chart with legend positioned at bottom
    new Chart(pieCanvas, {
      type: "pie",
      data: {
        labels: renderLabels,
        datasets: [{
          data: renderData,
          backgroundColor: renderBg
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            align: 'center',
            labels: {
              usePointStyle: false,
              boxWidth: 14,
              padding: 12,
              color: '#ffffff'
            }
          },
          tooltip: {
            enabled: true
          }
        }
      }
    });

  // show popup/toast near the pie if no real data
  if (showNoInfoPopup) {
    try {
      const area = document.getElementById('pieRow') || document.body;
      const popup = document.createElement('div');
      popup.className = 'small muted pie-noinfo-popup';
      popup.textContent = 'No study sessions yet — add a session to see analytics.';
      popup.style.position = 'absolute';
      popup.style.zIndex = 9999;
      popup.style.padding = '8px 10px';
      popup.style.borderRadius = '8px';
      popup.style.background = 'rgba(0,0,0,0.7)';
      popup.style.color = '#fff';
      // position it near the pieCanvas
      const rect = pieCanvas ? pieCanvas.getBoundingClientRect() : null;
      if (rect) {
        // convert viewport coords to page coords and set top/right
        popup.style.top = (rect.top + window.scrollY + 10) + 'px';
        popup.style.left = (rect.left + window.scrollX + rect.width + 12) + 'px';
      } else {
        popup.style.top = '80px';
        popup.style.right = '40px';
      }
      document.body.appendChild(popup);
      setTimeout(()=> popup.remove(), 3800);
    } catch(e){ /* ignore */ }
  }
  
  // last 7 days line (minutes)
  const daily = Array(7).fill(0);
  const now = Date.now();
  (state.sessions || []).forEach(s => {
    const diff = Math.floor((now - s.date) / 86400000);
    if (diff >= 0 && diff < 7) daily[6 - diff] += s.seconds / 60;
  });

  const lineCanvas = document.getElementById("lineChart");
  if (lineCanvas) {
    new Chart(lineCanvas, {
      type: "line",
      data: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        datasets: [{
          data: daily,
          borderWidth: 3,
          tension: 0.4,
          borderColor: "#ffbf66",
          pointBackgroundColor: "#ffffff"
        }]
      },
      options: {
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } },
        responsive: true
      }
    });
  }
};