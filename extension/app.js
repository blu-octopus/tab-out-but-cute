/* ================================================================
   Tab Out ??? Dashboard App (Pure Extension Edition)

   This file is the brain of the dashboard. Now that the dashboard
   IS the extension page (not inside an iframe), it can call
   chrome.tabs and chrome.storage directly ??? no postMessage bridge needed.

   What this file does:
   1. Reads open browser tabs directly via chrome.tabs.query()
   2. Groups tabs by domain with a landing pages category
   3. Renders domain cards, banners, and stats
   4. Handles all user actions (close tabs, save for later, focus tab)
   5. Stores "Saved for Later" tabs in chrome.storage.sync (no server)
   ================================================================ */

'use strict';


/* ================================================================
   DOMAIN  -- CATEGORY MAPPING
   ================================================================ */

const DOMAIN_CATEGORY_MAP = {
  // Work
  'notion.so':'work','slack.com':'work','zoom.us':'work','teams.microsoft.com':'work',
  'outlook.live.com':'work','outlook.office365.com':'work','outlook.office.com':'work',
  'calendar.google.com':'work','drive.google.com':'work','docs.google.com':'work',
  'sheets.google.com':'work','slides.google.com':'work','airtable.com':'work',
  'asana.com':'work','trello.com':'work','monday.com':'work','linear.app':'work',
  'clickup.com':'work','dropbox.com':'work','box.com':'work','loom.com':'work',
  'gmail.com':'work','google.com':'work',
  // School
  'canvas.instructure.com':'school','blackboard.com':'school',
  'coursera.org':'school','khanacademy.org':'school','edx.org':'school',
  'udemy.com':'school','chegg.com':'school','quizlet.com':'school',
  'piazza.com':'school','overleaf.com':'school','scholar.google.com':'school',
  'jstor.org':'school','gatech.edu':'school','udacity.com':'school',
  'omscentral.com':'school','gradescope.com':'school',
  // Jobs / Career
  'linkedin.com':'jobs','indeed.com':'jobs','glassdoor.com':'jobs',
  'lever.co':'jobs','greenhouse.io':'jobs','workday.com':'jobs',
  'handshake.com':'jobs','wellfound.com':'jobs','angellist.com':'jobs',
  'ziprecruiter.com':'jobs','monster.com':'jobs','hired.com':'jobs',
  'myworkdayjobs.com':'jobs','icims.com':'jobs',
  // Art / Design
  'figma.com':'art','dribbble.com':'art','behance.net':'art',
  'pinterest.com':'art','canva.com':'art','adobe.com':'art',
  'unsplash.com':'art','pexels.com':'art','deviantart.com':'art',
  'artstation.com':'art','coolors.co':'art','awwwards.com':'art',
  // Social
  'twitter.com':'social','x.com':'social','instagram.com':'social',
  'facebook.com':'social','tiktok.com':'social','snapchat.com':'social',
  'discord.com':'social','telegram.org':'social','threads.net':'social',
  // Relax / Entertainment
  'youtube.com':'relax','netflix.com':'relax','hulu.com':'relax',
  'spotify.com':'relax','twitch.tv':'relax','reddit.com':'relax',
  'disneyplus.com':'relax','crunchyroll.com':'relax','primevideo.com':'relax',
  'tumblr.com':'relax','webtoons.com':'relax',
  // Dev
  'github.com':'dev','gitlab.com':'dev','stackoverflow.com':'dev',
  'codepen.io':'dev','codesandbox.io':'dev','replit.com':'dev',
  'vercel.com':'dev','netlify.com':'dev','npmjs.com':'dev',
  'developer.mozilla.org':'dev','localhost':'dev',
  // Finance
  'chase.com':'finance','bankofamerica.com':'finance','wellsfargo.com':'finance',
  'paypal.com':'finance','venmo.com':'finance','robinhood.com':'finance',
  'coinbase.com':'finance','mint.com':'finance','nerdwallet.com':'finance',
  'fidelity.com':'finance','vanguard.com':'finance',
  // AI
  'chat.openai.com':'ai','openai.com':'ai','claude.ai':'ai',
  'perplexity.ai':'ai','gemini.google.com':'ai','copilot.microsoft.com':'ai',
  // Housing
  'zillow.com':'housing','apartments.com':'housing','apartmentlist.com':'housing',
  'trulia.com':'housing','redfin.com':'housing','rentatlasapts.com':'housing',
  // Health
  'myfitnesspal.com':'health','headspace.com':'health','calm.com':'health',
  'zocdoc.com':'health','webmd.com':'health',
  // Shopping
  'amazon.com':'shopping','ebay.com':'shopping','etsy.com':'shopping',
  'target.com':'shopping','walmart.com':'shopping',
};

const CATEGORY_CONFIG = {
  work:     { color: '#889df0', textColor: '#1e2d6e', label: 'Work' },
  school:   { color: '#f7cd67', textColor: '#5a3c00', label: 'School' },
  jobs:     { color: '#e59266', textColor: '#5a2500', label: 'Jobs' },
  art:      { color: '#f8a6b2', textColor: '#6b1535', label: 'Art' },
  social:   { color: '#b77dee', textColor: '#3d1060', label: 'Social' },
  relax:    { color: '#82d5bb', textColor: '#0d4a35', label: 'Relax' },
  dev:      { color: '#8ac68a', textColor: '#133d13', label: 'Dev' },
  finance:  { color: '#6fba2c', textColor: '#1a4400', label: 'Finance' },
  ai:       { color: '#19c8b9', textColor: '#083530', label: 'AI' },
  housing:  { color: '#e18c6f', textColor: '#4a1a08', label: 'Housing' },
  health:   { color: '#fc736d', textColor: '#4a0808', label: 'Health' },
  shopping: { color: '#f7cd67', textColor: '#5a3c00', label: 'Shopping' },
};

function getDomainCategory(domain) {
  if (!domain) return null;
  const d = domain.toLowerCase().replace(/^www\./, '');
  if (DOMAIN_CATEGORY_MAP[d]) return CATEGORY_CONFIG[DOMAIN_CATEGORY_MAP[d]];
  for (const [key, cat] of Object.entries(DOMAIN_CATEGORY_MAP)) {
    if (d.endsWith('.' + key) || d.includes(key + '.')) return CATEGORY_CONFIG[cat];
  }
  return null;
}


/* ================================================================
   STORAGE LAYER
   Reads from chrome.storage.sync (persists + syncs across devices).
   Falls back to localStorage so data survives even when the
   chrome.* API is unavailable (e.g. local-server preview).
   Every write mirrors to localStorage as an offline backup.
   ================================================================ */

const LS_PREFIX = 'island_tab_';

async function storageGet(key) {
  try {
    const result = await chrome.storage.sync.get([key]);
    if (result[key] !== undefined) return result[key];
  } catch { /* chrome API unavailable */ }
  // Fallback: localStorage
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : undefined;
  } catch { return undefined; }
}

async function storageSet(key, value) {
  try { await chrome.storage.sync.set({ [key]: value }); } catch {}
  // Always mirror to localStorage so data is never lost
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch {}
}

/* ================================================================
   EISENHOWER MATRIX  - Focus Panel
   ================================================================ */

const MATRIX_KEY  = 'matrixTasks';
const METRICS_KEY = 'tabOutMetrics';

async function loadMatrixTasks() {
  return (await storageGet(MATRIX_KEY)) || [];
}

async function saveMatrixTasks(tasks) {
  await storageSet(MATRIX_KEY, tasks);
}

/* ============================================================
   METRICS  -  lifetime usage stats
   ============================================================ */
async function loadMetrics() {
  const d = await storageGet(METRICS_KEY);
  return Object.assign({ tabsClosed: 0, tabsSaved: 0, sessions: 0, groupsMerged: 0 }, d || {});
}

async function incrementMetric(field, n = 1) {
  const m = await loadMetrics();
  m[field] = (m[field] || 0) + n;
  await storageSet(METRICS_KEY, m);
}

/* ============================================================
   TAB SCORE  -  rates the user's tab hygiene in real time
   ============================================================ */
async function computeTabScore(openTabCount, windowCount) {
  let score = 100;

  // Chaos penalties
  score -= Math.max(0, openTabCount - 8) * 2;   // -2 per tab over 8
  score -= Math.max(0, windowCount  - 2) * 5;   // -5 per extra window

  // Organisation bonuses
  try {
    const tasks = await loadMatrixTasks();
    score += Math.min(12, tasks.length * 2);                          // using the matrix
    score += Math.min(8,  tasks.filter(t => t.done).length * 2);     // actually completing tasks
  } catch {}

  try {
    const merges = await loadGroupMerges();
    score += Math.min(10, merges.length * 4);                        // tidying groups
  } catch {}

  try {
    const deferred = (await storageGet(DEFERRED_KEY)) || [];
    const saved = deferred.filter(t => !t.dismissed).length;
    score += Math.min(8, saved * 2);                                 // saving instead of piling up
  } catch {}

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getScoreRating(score) {
  if (score >= 90) return { grade: 'S',  label: 'Nook Miles Earned!',  color: '#6fba2c' };
  if (score >= 75) return { grade: 'A',  label: 'Resident Rep.',       color: '#19c8b9' };
  if (score >= 55) return { grade: 'B',  label: 'Still Settling In',   color: '#f7cd67' };
  if (score >= 35) return { grade: 'C',  label: 'Behind on Rent',      color: '#e59266' };
  return                  { grade: 'D',  label: 'Isabelle Needs Help', color: '#fc736d' };
}

async function renderMetrics(openTabCount) {
  const el = document.getElementById('tabMetrics');
  if (!el) return;

  let windowCount = 0;
  try {
    const wins = await chrome.windows.getAll({ populate: false });
    windowCount = wins.length;
  } catch {}

  const score  = await computeTabScore(openTabCount, windowCount);
  const rating = getScoreRating(score);

  el.style.gridTemplateColumns = 'repeat(3, 1fr)';
  el.innerHTML = `
    <div class="tab-metrics-item">
      <div class="tab-metrics-num">${openTabCount}</div>
      <div class="tab-metrics-label">open<br>tabs</div>
    </div>
    <div class="tab-metrics-item">
      <div class="tab-metrics-num">${windowCount}</div>
      <div class="tab-metrics-label">open<br>window${windowCount !== 1 ? 's' : ''}</div>
    </div>
    <div class="tab-metrics-item tab-metrics-score-cell">
      <div class="tab-metrics-num tab-metrics-score-num" style="color:${rating.color}">${score}</div>
      <div class="tab-metrics-score-grade" style="color:${rating.color}">${rating.grade}</div>
      <div class="tab-metrics-label">tab health<br>${rating.label}</div>
    </div>`;
}

const Q_CONFIG = {
  do:       { icon: '\u{1F534}', label: 'Do',       sub: 'urgent \u00B7 important',       color: '#f8a6b2', text: '#6b1535' },
  schedule: { icon: '\u{1F535}', label: 'Schedule', sub: 'not urgent \u00B7 important',   color: '#889df0', text: '#1e2d6e' },
  delegate: { icon: '\u{1F7E1}', label: 'Delegate', sub: 'urgent \u00B7 less important',  color: '#f7cd67', text: '#5a3c00' },
  cut:      { icon: '\u26AA',    label: 'Cut',       sub: 'eliminate',                     color: '#e6dfc9', text: '#7a6855' },
};

/* ============================================================
   VILLAGER DANCER - cycles through GIFs in assets/villager dancing/
   ============================================================ */
const VILLAGER_CAST = [
  {
    file: 'ankha-egyptian-cat.gif', name: 'Ankha',
    lines: [
      'I am ancient, and I am fabulous.',
      'The pharaohs themselves approved this choreography.',
      'Do not stare. Well... actually, you may stare.',
    ]
  },
  {
    file: 'bill-duck.gif', name: 'Bill',
    lines: [
      'BAM! That\'s how you do it, broccoflower!',
      'I\'m on FIRE today, for real for real!',
      'Nothing beats a good groove, broccoflower!',
    ]
  },
  {
    file: 'chillaxing.gif', name: 'Villager',
    lines: [
      'Just vibin\'... no stress here.',
      'Life is good when you just let it flow.',
      'Chill mode: permanently activated.',
    ]
  },
  {
    file: 'eugene-koala.gif', name: 'Eugene',
    lines: [
      'Cool of you to notice, sugarplum.',
      'I make this look completely effortless. Obviously.',
      'Some are simply born with it, gorgeous.',
    ]
  },
  {
    file: 'fauna-deer.gif', name: 'Fauna',
    lines: [
      'Oh goodness! Dancing is toadally fun, dearie!',
      'Every step is a little gift to the world!',
      'I just love a good twirl, toadally!',
    ]
  },
  {
    file: 'isabelle.gif', name: 'Isabelle',
    lines: [
      'Oh! Tom Nook said I could take a short break...',
      'Just one more song! Then back to the reports!',
      'Everything is just wonderful, sir/ma\'am!',
    ]
  },
  {
    file: 'katt-animal-crossing.gif', name: 'Katt',
    lines: [
      'What? I wasn\'t dancing. I was... exercising.',
      'Don\'t get the wrong idea, punk.',
      'Fine. MAYBE I\'m having fun. A little. Whatever.',
    ]
  },
  {
    file: 'mrksza.gif', name: 'Villager',
    lines: [
      'Best. Day. Ever!',
      'Nook miles, here I come!',
      'Living my best island life right now!',
    ]
  },
  {
    file: 'punchy-explode.gif', name: 'Punchy',
    lines: [
      'WOAH-- okay that was a lot, lazy boy.',
      'Did you see that?! Even I\'m impressed, lazy boy.',
      'I don\'t know what just happened but I\'m into it.',
    ]
  },
  {
    file: 'punchy.gif', name: 'Punchy',
    lines: [
      'Yo... I\'m kinda tired but this helps, lazy boy.',
      'One more song, then I\'m napping. Promise, lazy boy.',
      'Z z z... wait, was I dancing? Cool, lazy boy.',
    ]
  },
  {
    file: 'quinn.gif', name: 'Quinn',
    lines: [
      'Magnificent, isn\'t it? I\'ve been training, gorgeous.',
      'Eagles were born to soar AND to dance, gorgeous.',
      'Observe and learn. This is artistry, gorgeous.',
    ]
  },
  {
    file: 'rudy.gif', name: 'Rudy',
    lines: [
      'YEAH! Feel the BURN, ace!',
      'Rudy NEVER stops! NEVER, ace!',
      'THIS IS MY CARDIO, ACE! WOOOOO!',
    ]
  },
  {
    file: 'sasha.gif', name: 'Sasha',
    lines: [
      'I\'ll need a snack after this... cupcake?',
      'Dancing AND cookies. That is my entire plan, cupcake.',
      'I\'m adorable AND talented. You\'re welcome, cupcake~',
    ]
  },
  {
    file: 'villager.gif', name: 'Villager',
    lines: [
      'Nook miles... here I come!',
      'Island life is the best life!',
      'Tom Nook would be so proud right now, yes yes!',
    ]
  },
];

/**
 * initVillagerDancer() - cycles through villager GIFs near the footer,
 * showing in-character dialogue on hover.
 */
function initVillagerDancer() {
  const img    = document.getElementById('villagerDancer');
  const bubble = document.getElementById('villagerBubble');
  const wrap   = document.getElementById('villagerFooter');
  if (!img || !bubble || !wrap) return;

  let idx = Math.floor(Math.random() * VILLAGER_CAST.length);

  function setVillager(i) {
    const v = VILLAGER_CAST[i];
    img.src = 'assets/villager dancing/' + v.file;
    img.alt = v.name;
  }

  setVillager(idx);

  // Click: switch to next villager (same logic as matrix villager)
  wrap.addEventListener('click', () => {
    img.style.opacity = '0';
    bubble.classList.remove('visible');
    setTimeout(() => {
      idx = (idx + 1) % VILLAGER_CAST.length;
      setVillager(idx);
      img.style.opacity = '1';
    }, 340);
  });

  // Hover: show a random dialogue line for the current villager
  wrap.addEventListener('mouseenter', () => {
    const v = VILLAGER_CAST[idx];
    bubble.textContent = v.lines[Math.floor(Math.random() * v.lines.length)];
    bubble.classList.add('visible');
  });
  wrap.addEventListener('mouseleave', () => {
    bubble.classList.remove('visible');
  });
}

/**
 * initMatrixVillager()  -  tiny villager in To-Do panel
 * Starts on a random villager, hover shows dialogue, click switches character.
 * Called after renderMatrixColumn() re-renders the DOM.
 */
let _matrixVillagerIdx = Math.floor(Math.random() * VILLAGER_CAST.length);

function initMatrixVillager() {
  const wrap   = document.getElementById('matrixVillagerWrap');
  const img    = document.getElementById('matrixVillagerImg');
  const bubble = document.getElementById('matrixVillagerBubble');
  if (!wrap || !img || !bubble) return;

  function setVillager(i) {
    const v = VILLAGER_CAST[i];
    img.src = 'assets/villager dancing/' + v.file;
    img.alt = v.name;
  }
  setVillager(_matrixVillagerIdx);

  wrap.addEventListener('mouseenter', () => {
    const v = VILLAGER_CAST[_matrixVillagerIdx];
    bubble.textContent = v.lines[Math.floor(Math.random() * v.lines.length)];
    bubble.classList.add('visible');
  });
  wrap.addEventListener('mouseleave', () => {
    bubble.classList.remove('visible');
  });
  wrap.addEventListener('click', () => {
    img.style.opacity = '0';
    bubble.classList.remove('visible');
    setTimeout(() => {
      _matrixVillagerIdx = (_matrixVillagerIdx + 1) % VILLAGER_CAST.length;
      setVillager(_matrixVillagerIdx);
      img.style.opacity = '1';
    }, 280);
  });
}

/** Escape text for HTML content */
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** Render task text, highlighting @mentions as styled chips */
function renderTaskText(raw) {
  return esc(raw).replace(/@(\S+)/g, '<span class="at-tag">@$1</span>');
}

async function renderMatrixColumn() {
  const panel = document.getElementById('matrixColumn');
  if (!panel) return;
  const tasks = await loadMatrixTasks();

  // Whole-row is the click target for toggle; delete button stops propagation
  const renderItem = (t) => `
    <div class="matrix-item${t.done ? ' done' : ''}"
         data-action="toggle-matrix-task" data-task-id="${t.id}">
      <span class="matrix-cb-visual${t.done ? ' checked' : ''}"></span>
      <span class="matrix-item-text">${renderTaskText(t.text)}</span>
      <button class="matrix-item-del" data-action="delete-matrix-task"
              data-task-id="${t.id}" title="Remove">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             stroke-width="2.5" stroke="currentColor" width="10" height="10">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>`;

  const renderQ = (q) => {
    const c = Q_CONFIG[q];
    const items = tasks.filter(t => t.quadrant === q);
    return `
      <div class="matrix-quadrant q-${q}" style="--qc:${c.color};--qt:${c.text}">
        <div class="matrix-q-hd">
          <span>${c.icon}</span><strong>${c.label}</strong>
          <span class="matrix-q-sub">${c.sub}</span>
        </div>
        <div class="matrix-q-list">
          ${items.length ? items.map(renderItem).join('') : '<span class="matrix-q-empty">\u2014</span>'}
        </div>
      </div>`;
  };

  // Preserve active pill selection across re-renders
  const prevActive = document.querySelector('#matrixQPills .q-pill.active')?.dataset.q || 'do';

  panel.innerHTML = `
    <div class="section-header" style="margin-bottom:10px">
      <h2>To-Do</h2>
      <div class="section-line"></div>
    </div>
    <div class="matrix-q-pills" id="matrixQPills">
      ${Object.entries(Q_CONFIG).map(([q,c]) => `
        <button class="q-pill${q===prevActive?' active':''}" data-q="${q}"
                data-action="select-matrix-q"
                style="--qc:${c.color};--qt:${c.text}">${c.label}</button>`).join('')}
    </div>
    <div class="matrix-input-wrap">
      <input id="matrixInput" class="matrix-input" placeholder="Add a task\u2026" autocomplete="off">
      <span class="matrix-input-hint">enter to add</span>
      <div class="at-mention-dropdown" id="atMentionDropdown" style="display:none"></div>
    </div>
    <div class="matrix-grid">
      ${['do','schedule','delegate','cut'].map(renderQ).join('')}
    </div>
    <div class="matrix-villager-wrap" id="matrixVillagerWrap" title="Click to meet someone new!">
      <div class="matrix-villager-bubble" id="matrixVillagerBubble"></div>
      <img class="matrix-villager-img" id="matrixVillagerImg" src="" alt="">
    </div>`;

  // Re-attach villager events after DOM re-render
  initMatrixVillager();
}

async function addMatrixTask(text, quadrant) {
  if (!text.trim()) return;
  const tasks = await loadMatrixTasks();
  tasks.push({ id: Date.now().toString(36), text: text.trim(), quadrant, done: false, at: Date.now() });
  await saveMatrixTasks(tasks);
  await renderMatrixColumn();
}

async function toggleMatrixTask(id) {
  const tasks = await loadMatrixTasks();
  const t = tasks.find(t => t.id === id);
  if (t) t.done = !t.done;
  await saveMatrixTasks(tasks);
  await renderMatrixColumn();
}

async function deleteMatrixTask(id) {
  await saveMatrixTasks((await loadMatrixTasks()).filter(t => t.id !== id));
  await renderMatrixColumn();
}


/* ================================================================
   @ MENTION AUTOCOMPLETE
   ================================================================ */

let _atStart = -1; // index of '@' in current input value

function _getAtQuery(input) {
  const val = input.value;
  const cur = input.selectionStart;
  // Walk left from cursor looking for '@' without spaces
  for (let i = cur - 1; i >= 0; i--) {
    if (val[i] === '@') return { start: i, query: val.slice(i + 1, cur).toLowerCase() };
    if (val[i] === ' ') break;
  }
  return null;
}

function showAtMentionDropdown(input) {
  const info = _getAtQuery(input);
  const dropdown = document.getElementById('atMentionDropdown');
  if (!info || !dropdown) { hideAtMentionDropdown(); return; }

  _atStart = info.start;
  const q = info.query;

  // Build candidate list from openTabs
  const seen = new Set();
  const groups = new Map();
  for (const tab of openTabs) {
    try {
      const host = new URL(tab.url).hostname.replace(/^www\./, '');
      if (!groups.has(host)) groups.set(host, { tabs: [] });
      groups.get(host).tabs.push(tab);
    } catch {}
  }

  const options = [];

  // Domain groups first (no query OR query matches domain/friendly name)
  for (const [host, grp] of groups) {
    const friendly = FRIENDLY_DOMAINS[host] || FRIENDLY_DOMAINS['www.' + host] || host;
    const matchKey = (friendly + ' ' + host).toLowerCase();
    if (!q || matchKey.includes(q)) {
      options.push({ type: 'group', label: friendly, domain: host, count: grp.tabs.length });
      seen.add('group:' + host);
    }
  }

  // Individual tabs (only when user has typed something after @)
  if (q.length >= 1) {
    for (const tab of openTabs) {
      const key = 'tab:' + tab.url;
      if (seen.has(key)) continue;
      const titleLow = (tab.title || '').toLowerCase();
      const urlLow   = (tab.url  || '').toLowerCase();
      if (titleLow.includes(q) || urlLow.includes(q)) {
        let host = '';
        try { host = new URL(tab.url).hostname.replace(/^www\./, ''); } catch {}
        options.push({ type: 'tab', label: tab.title || tab.url, domain: host, url: tab.url });
        seen.add(key);
      }
    }
  }

  if (options.length === 0) { hideAtMentionDropdown(); return; }

  dropdown.innerHTML = options.slice(0, 8).map(opt => {
    const fav = opt.domain
      ? `<img class="at-favicon" src="https://www.google.com/s2/favicons?domain=${esc(opt.domain)}&sz=16" onerror="this.style.opacity=0" alt="">`
      : '';
    const badge = opt.type === 'group'
      ? `<span class="at-mention-badge">${opt.count} tab${opt.count !== 1 ? 's' : ''}</span>`
      : `<span class="at-mention-badge at-mention-badge--tab">tab</span>`;
    return `<button class="at-mention-item" data-action="insert-at-mention"
                    data-at-label="${esc(opt.label)}">${fav}
              <span class="at-mention-label">${esc(opt.label)}</span>${badge}
            </button>`;
  }).join('');

  dropdown.style.display = 'block';
}

function hideAtMentionDropdown() {
  const d = document.getElementById('atMentionDropdown');
  if (d) d.style.display = 'none';
  _atStart = -1;
}

function insertAtMention(label) {
  const input = document.getElementById('matrixInput');
  if (!input || _atStart < 0) return;
  const before = input.value.slice(0, _atStart);
  const after  = input.value.slice(input.selectionStart).replace(/^\S*/, ''); // remove partial token
  input.value  = before + '@' + label + ' ' + after.trimStart();
  hideAtMentionDropdown();
  input.focus();
  const pos = before.length + label.length + 2;
  input.setSelectionRange(pos, pos);
}


/* ----------------------------------------------------------------
   CHROME TABS ??? Direct API Access

   Since this page IS the extension's new tab page, it has full
   access to chrome.tabs and chrome.storage. No middleman needed.
   ---------------------------------------------------------------- */

// All open tabs ??? populated by fetchOpenTabs()
let openTabs = [];

/**
 * fetchOpenTabs()
 *
 * Reads all currently open browser tabs directly from Chrome.
 * Sets the extensionId flag so we can identify Tab Out's own pages.
 */
async function fetchOpenTabs() {
  try {
    const extensionId = chrome.runtime.id;
    // The new URL for this page is now index.html (not newtab.html)
    const newtabUrl = `chrome-extension://${extensionId}/index.html`;

    const tabs = await chrome.tabs.query({});
    openTabs = tabs.map(t => ({
      id:       t.id,
      url:      t.url,
      title:    t.title,
      windowId: t.windowId,
      active:   t.active,
      // Flag Tab Out's own pages so we can detect duplicate new tabs
      isTabOut: t.url === newtabUrl || t.url === 'chrome://newtab/',
    }));
  } catch {
    // chrome.tabs API unavailable (shouldn't happen in an extension page)
    openTabs = [];
  }
}

/**
 * closeTabsByUrls(urls)
 *
 * Closes all open tabs whose hostname matches any of the given URLs.
 * After closing, re-fetches the tab list to keep our state accurate.
 *
 * Special case: file:// URLs are matched exactly (they have no hostname).
 */
async function closeTabsByUrls(urls) {
  if (!urls || urls.length === 0) return;

  // Separate file:// URLs (exact match) from regular URLs (hostname match)
  const targetHostnames = [];
  const exactUrls = new Set();

  for (const u of urls) {
    if (u.startsWith('file://')) {
      exactUrls.add(u);
    } else {
      try { targetHostnames.push(new URL(u).hostname); }
      catch { /* skip unparseable */ }
    }
  }

  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs
    .filter(tab => {
      const tabUrl = tab.url || '';
      if (tabUrl.startsWith('file://') && exactUrls.has(tabUrl)) return true;
      try {
        const tabHostname = new URL(tabUrl).hostname;
        return tabHostname && targetHostnames.includes(tabHostname);
      } catch { return false; }
    })
    .map(tab => tab.id);

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabsExact(urls)
 *
 * Closes tabs by exact URL match (not hostname). Used for landing pages
 * so closing "Gmail inbox" doesn't also close individual email threads.
 */
async function closeTabsExact(urls) {
  if (!urls || urls.length === 0) return;
  const urlSet = new Set(urls);
  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs.filter(t => urlSet.has(t.url)).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * focusTab(url)
 *
 * Switches Chrome to the tab with the given URL (exact match first,
 * then hostname fallback). Also brings the window to the front.
 */
async function focusTab(url) {
  if (!url) return;
  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();

  // Try exact URL match first
  let matches = allTabs.filter(t => t.url === url);

  // Fall back to hostname match
  if (matches.length === 0) {
    try {
      const targetHost = new URL(url).hostname;
      matches = allTabs.filter(t => {
        try { return new URL(t.url).hostname === targetHost; }
        catch { return false; }
      });
    } catch {}
  }

  if (matches.length === 0) return;

  // Prefer a match in a different window so it actually switches windows
  const match = matches.find(t => t.windowId !== currentWindow.id) || matches[0];
  await chrome.tabs.update(match.id, { active: true });
  await chrome.windows.update(match.windowId, { focused: true });
}

/**
 * closeDuplicateTabs(urls, keepOne)
 *
 * Closes duplicate tabs for the given list of URLs.
 * keepOne=true ??? keep one copy of each, close the rest.
 * keepOne=false ??? close all copies.
 */
async function closeDuplicateTabs(urls, keepOne = true) {
  const allTabs = await chrome.tabs.query({});
  const toClose = [];

  for (const url of urls) {
    const matching = allTabs.filter(t => t.url === url);
    if (keepOne) {
      const keep = matching.find(t => t.active) || matching[0];
      for (const tab of matching) {
        if (tab.id !== keep.id) toClose.push(tab.id);
      }
    } else {
      for (const tab of matching) toClose.push(tab.id);
    }
  }

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabOutDupes()
 *
 * Closes all duplicate Tab Out new-tab pages except the current one.
 */
async function closeTabOutDupes() {
  const extensionId = chrome.runtime.id;
  const newtabUrl = `chrome-extension://${extensionId}/index.html`;

  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();
  const tabOutTabs = allTabs.filter(t =>
    t.url === newtabUrl || t.url === 'chrome://newtab/'
  );

  if (tabOutTabs.length <= 1) return;

  // Keep the active Tab Out tab in the CURRENT window ??? that's the one the
  // user is looking at right now. Falls back to any active one, then the first.
  const keep =
    tabOutTabs.find(t => t.active && t.windowId === currentWindow.id) ||
    tabOutTabs.find(t => t.active) ||
    tabOutTabs[0];
  const toClose = tabOutTabs.filter(t => t.id !== keep.id).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}


/* ----------------------------------------------------------------
   SAVED FOR LATER ??? chrome.storage.sync

   Replaces the old server-side SQLite + REST API with Chrome's
   built-in key-value storage. Data persists across browser sessions
   and doesn't require a running server.

   Data shape stored under the "deferred" key:
   [
     {
       id: "1712345678901",          // timestamp-based unique ID
       url: "https://example.com",
       title: "Example Page",
       savedAt: "2026-04-04T10:00:00.000Z",  // ISO date string
       completed: false,             // true = checked off (archived)
       dismissed: false              // true = dismissed without reading
     },
     ...
   ]
   ---------------------------------------------------------------- */

/**
 * saveTabForLater(tab)
 *
 * Saves a single tab to the "Saved for Later" list in chrome.storage.sync.
 * @param {{ url: string, title: string }} tab
 */
const DEFERRED_KEY = 'deferred';

async function _loadDeferred() {
  return (await storageGet(DEFERRED_KEY)) || [];
}
async function _saveDeferred(list) {
  await storageSet(DEFERRED_KEY, list);
}

async function saveTabForLater(tab) {
  const deferred = await _loadDeferred();
  deferred.push({
    id:        Date.now().toString(),
    url:       tab.url,
    title:     tab.title,
    savedAt:   new Date().toISOString(),
    completed: false,
    dismissed: false,
  });
  await _saveDeferred(deferred);
}

/**
 * getSavedTabs()
 *
 * Returns all saved tabs, split into active and archived.
 */
async function getSavedTabs() {
  const deferred = await _loadDeferred();
  const visible = deferred.filter(t => !t.dismissed);
  return {
    active:   visible.filter(t => !t.completed),
    archived: visible.filter(t => t.completed),
  };
}

/**
 * checkOffSavedTab(id)  -  marks a tab as completed ¡÷ moves to archive.
 */
async function checkOffSavedTab(id) {
  const deferred = await _loadDeferred();
  const tab = deferred.find(t => t.id === id);
  if (tab) {
    tab.completed   = true;
    tab.completedAt = new Date().toISOString();
    await _saveDeferred(deferred);
  }
}

/**
 * dismissSavedTab(id)  -  removes a tab from all lists.
 */
async function dismissSavedTab(id) {
  const deferred = await _loadDeferred();
  const tab = deferred.find(t => t.id === id);
  if (tab) {
    tab.dismissed = true;
    await _saveDeferred(deferred);
  }
}


/* ----------------------------------------------------------------
   UI HELPERS
   ---------------------------------------------------------------- */

/**
 * playCloseSound()
 *
 * Plays a clean "swoosh" sound when tabs are closed.
 * Built entirely with the Web Audio API ??? no sound files needed.
 * A filtered noise sweep that descends in pitch, like air moving.
 */
function playCloseSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;

    // Swoosh: shaped white noise through a sweeping bandpass filter
    const duration = 0.25;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate noise with a natural envelope (quick attack, smooth decay)
    for (let i = 0; i < data.length; i++) {
      const pos = i / data.length;
      // Envelope: ramps up fast in first 10%, then fades out smoothly
      const env = pos < 0.1 ? pos / 0.1 : Math.pow(1 - (pos - 0.1) / 0.9, 1.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter sweeps from high to low ??? creates the "swoosh" character
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.0;
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + duration);

    // Volume
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(t);

    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio not supported ??? fail silently
  }
}

/**
 * shootConfetti(x, y)
 *
 * Shoots a burst of colorful confetti particles from the given screen
 * coordinates (typically the center of a card being closed).
 * Pure CSS + JS, no libraries.
 */
function shootConfetti(x, y) {
  // NookPhone app palette  - Animal Crossing style
  const colors = [
    '#19c8b9', // mint teal
    '#6fba2c', // leaf green
    '#86d67a', // switch-on green
    '#f7cd67', // sunshine yellow
    '#e59266', // warm orange
    '#fc736d', // coral red
    '#f8a6b2', // app pink
    '#889df0', // sky blue
    '#b77dee', // lavender purple
    '#82d5bb', // seafoam
  ];

  const particleCount = 17;

  for (let i = 0; i < particleCount; i++) {
    const el = document.createElement('div');

    const isCircle = Math.random() > 0.5;
    const size = 5 + Math.random() * 6; // 5???11px
    const color = colors[Math.floor(Math.random() * colors.length)];

    el.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${isCircle ? '50%' : '2px'};
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      opacity: 1;
    `;
    document.body.appendChild(el);

    // Physics: random angle and speed for the outward burst
    const angle   = Math.random() * Math.PI * 2;
    const speed   = 60 + Math.random() * 120;
    const vx      = Math.cos(angle) * speed;
    const vy      = Math.sin(angle) * speed - 80; // bias upward
    const gravity = 200;

    const startTime = performance.now();
    const duration  = 700 + Math.random() * 200; // 700???900ms

    function frame(now) {
      const elapsed  = (now - startTime) / 1000;
      const progress = elapsed / (duration / 1000);

      if (progress >= 1) { el.remove(); return; }

      const px = vx * elapsed;
      const py = vy * elapsed + 0.5 * gravity * elapsed * elapsed;
      const opacity = progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2;
      const rotate  = elapsed * 200 * (isCircle ? 0 : 1);

      el.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) rotate(${rotate}deg)`;
      el.style.opacity = opacity;

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }
}

/**
 * animateCardOut(card)
 *
 * Smoothly removes a mission card: fade + scale down, then confetti.
 * After the animation, checks if the grid is now empty.
 */
function animateCardOut(card) {
  if (!card) return;

  const rect = card.getBoundingClientRect();
  shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);

  card.classList.add('closing');
  setTimeout(() => {
    card.remove();
    checkAndShowEmptyState();
  }, 300);
}

/**
 * showToast(message)
 *
 * Brief pop-up notification at the bottom of the screen.
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

/**
 * checkAndShowEmptyState()
 *
 * Shows a cheerful "Inbox zero" message when all domain cards are gone.
 */
function checkAndShowEmptyState() {
  const missionsEl = document.getElementById('openTabsMissions');
  if (!missionsEl) return;

  const remaining = missionsEl.querySelectorAll('.mission-card:not(.closing)').length;
  if (remaining > 0) return;

  missionsEl.innerHTML = `
    <div class="missions-empty-state">
      <div class="empty-checkmark">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <div class="empty-title">Inbox zero, but for tabs.</div>
      <div class="empty-subtitle">You're free.</div>
    </div>
  `;

  const countEl = document.getElementById('openTabsSectionCount');
  if (countEl) countEl.textContent = '0 domains';
}

/**
 * timeAgo(dateStr)
 *
 * Converts an ISO date string into a human-friendly relative time.
 * "2026-04-04T10:00:00Z" ??? "2 hrs ago" or "yesterday"
 */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr);
  const now  = new Date();
  const diffMins  = Math.floor((now - then) / 60000);
  const diffHours = Math.floor((now - then) / 3600000);
  const diffDays  = Math.floor((now - then) / 86400000);

  if (diffMins < 1)   return 'just now';
  if (diffMins < 60)  return diffMins + ' min ago';
  if (diffHours < 24) return diffHours + ' hr' + (diffHours !== 1 ? 's' : '') + ' ago';
  if (diffDays === 1) return 'yesterday';
  return diffDays + ' days ago';
}

/* ================================================================
   AC-STYLE GREETING + WEATHER
   Uses Open-Meteo (free, no API key) + browser geolocation.
   All dialogue is written in Tom Nook / villager cadence.
   ================================================================ */

// Seeded pick: changes every hour so refresh doesn't flicker the message
function acPick(arr) {
  const d = new Date();
  const seed = d.getFullYear() * 100000 + (d.getMonth() + 1) * 1000 + d.getDate() * 24 + d.getHours();
  return arr[seed % arr.length];
}

const AC_LINES = {
  morning: [
    'Rise and shine, yes yes!',
    'Up bright and early, hm~',
    "Don't forget to water your flowers, hm?",
    "Isabelle says good morning, yes yes!",
    'A brand-new day in the village, hm hm!',
    'The early bird catches the sea bass, yes yes!',
    'Morning! Check the bulletin board, hm?',
  ],
  afternoon: [
    'Turnip prices are in, yes yes!',
    'The Able Sisters are open, hm~',
    'Perfect day for the museum, yes yes!',
    'Have you caught any rare fish today, hm?',
    "Afternoon! Don't let the day slip by, hm hm!",
    'A fine afternoon in the village, yes yes!',
    'Check your mailbox  - packages waiting, hm?',
  ],
  evening: [
    'K.K. Slider plays on Saturdays, yes yes!',
    'The stars come out soon, hm~',
    "Don't forget to check your mail, hm?",
    'Evening strolls are the best, yes yes!',
    'Celeste might be out tonight, hm hm!',
    'A peaceful evening in the village, yes yes!',
  ],
  night: [
    'Up late, hm hm? Even Nook Inc. rests!',
    'The shooting stars are lovely tonight, yes yes!',
    'Still awake? Blathers approves, hm~',
    'Night owl energy, yes yes! hm hm!',
    "Past bedtime, hm... but who's counting?",
    'Even Tom Nook sleeps eventually, hm~',
  ],
};

/**
 * getGreeting()  - time-based greeting, AC style
 */
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Good morning!';
  if (h >= 12 && h < 17) return 'Good afternoon!';
  if (h >= 17 && h < 21) return 'Good evening!';
  return 'Good night~';
}

/**
 * getGreetingSub()  - rotating AC villager dialogue for the current time slot
 */
function getGreetingSub() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return acPick(AC_LINES.morning);
  if (h >= 12 && h < 17) return acPick(AC_LINES.afternoon);
  if (h >= 17 && h < 21) return acPick(AC_LINES.evening);
  return acPick(AC_LINES.night);
}

/**
 * WMO weather code  -- AC-style weather description.
 * pct = precipitation probability (0-100), tempF = temperature in \u00B0F
 */
function buildWeatherLine(code, pct, tempF) {
  const t = Math.round(tempF);
  const tempStr = `${t}\u00B0F`;
  const warmth = t < 40 ? 'Bundle up tight, hm!' : t > 88 ? 'Stay hydrated, yes yes!' : t < 55 ? 'Grab a jacket, hm~' : null;

  // Weather icons via JS Unicode escapes - immune to file encoding corruption
  const W = {
    sun:   '\u2600\uFE0F',   // ??
    part:  '\u26C5',          // ?
    cloud: '\u2601\uFE0F',   // ??
    fog:   '\u{1F32B}\uFE0F',// ??
    rain1: '\u{1F326}\uFE0F',// ??
    rain2: '\u{1F327}\uFE0F',// ??
    snow:  '\u2744\uFE0F',   // ??
    storm: '\u26C8\uFE0F',   // ??
    part2: '\u{1F324}\uFE0F',// ??
  };

  let icon, desc;
  if      (code === 0)                      { icon = W.sun;   desc = acPick(['Clear skies - perfect for bug-catching!', 'Sunny and bright, yes yes!', 'Beautiful day out there, hm~']); }
  else if (code <= 2)                       { icon = W.part;  desc = acPick(['Partly cloudy, hm~ nice for a stroll!', 'Mostly sunny with clouds, yes yes!']); }
  else if (code === 3)                      { icon = W.cloud; desc = acPick(['Overcast today, hm... The Roost is cozy!', 'Gray skies, yes yes! Good fishing weather~']); }
  else if (code <= 48)                      { icon = W.fog;   desc = acPick(['Foggy out there, hm! Very mysterious~', 'Fog rolling in, yes yes! Stay on the paths!']); }
  else if (code <= 55)                      { icon = W.rain1; desc = `Light drizzle today - ${pct}% chance, hm~`; }
  else if (code <= 65 || (code <= 82 && code >= 80)) {
    icon = W.rain2;
    desc = pct >= 70
      ? `${pct}% chance of rain! Grab that umbrella, yes yes!`
      : `${pct}% chance of rain today, hm~ maybe bring a brolly!`;
  }
  else if (code <= 77 || (code >= 85 && code <= 86)) { icon = W.snow;  desc = acPick(['Snow today! Time to build a snowboy, yes yes!', "It's snowing, hm hm! Bundle up tight!"]); }
  else if (code >= 95)                               { icon = W.storm; desc = acPick(['Thunderstorm! Even Tom Nook stays inside, hm!', 'Lightning today - stay cozy, yes yes!']); }
  else {
    icon = pct > 50 ? W.rain1 : W.part2;
    desc = pct > 50 ? `${pct}% chance of rain, hm! Umbrella time~` : 'Decent weather today, yes yes!';
  }

  return [icon + ' ' + desc, tempStr, warmth].filter(Boolean).join('  \u00B7  ');
}

/**
 * Fetch weather from Open-Meteo (free, no API key) using browser geolocation.
 * Updates #weatherLine in the header.
 */
async function initWeather() {
  const el = document.getElementById('weatherLine');
  if (!el) return;

  const FALLBACKS = [
    '\u{1F343} Check outside - Isabelle has no signal today, hm~',
    '\u{1F33F} Weather unknown! Tom Nook says venture out, yes yes!',
    '\u{1F989} Blathers suggests: observe nature directly, hm~',
  ];

  // Show AC-style striped Loading button while fetching
  el.textContent = 'Loading...';
  el.classList.add('is-loading');
  el.style.display = 'block';

  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 })
    );
    const { latitude: lat, longitude: lon } = pos.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,precipitation_probability,weathercode&temperature_unit=fahrenheit&timezone=auto`;
    const data = await (await fetch(url)).json();
    const cur = data.current;
    el.textContent = buildWeatherLine(cur.weathercode, cur.precipitation_probability ?? 0, cur.temperature_2m);
  } catch {
    el.textContent = acPick(FALLBACKS);
  }
  el.classList.remove('is-loading');
}

/**
 * getDateDisplay() ??? "Friday, April 4, 2026"
 */
function getDateDisplay() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}


/* ----------------------------------------------------------------
   DOMAIN & TITLE CLEANUP HELPERS
   ---------------------------------------------------------------- */

// Map of known hostnames ??? friendly display names.
const FRIENDLY_DOMAINS = {
  'github.com':           'GitHub',
  'www.github.com':       'GitHub',
  'gist.github.com':      'GitHub Gist',
  'youtube.com':          'YouTube',
  'www.youtube.com':      'YouTube',
  'music.youtube.com':    'YouTube Music',
  'x.com':                'X',
  'www.x.com':            'X',
  'twitter.com':          'X',
  'www.twitter.com':      'X',
  'reddit.com':           'Reddit',
  'www.reddit.com':       'Reddit',
  'old.reddit.com':       'Reddit',
  'substack.com':         'Substack',
  'www.substack.com':     'Substack',
  'medium.com':           'Medium',
  'www.medium.com':       'Medium',
  'linkedin.com':         'LinkedIn',
  'www.linkedin.com':     'LinkedIn',
  'stackoverflow.com':    'Stack Overflow',
  'www.stackoverflow.com':'Stack Overflow',
  'news.ycombinator.com': 'Hacker News',
  'google.com':           'Google',
  'www.google.com':       'Google',
  'mail.google.com':      'Gmail',
  'docs.google.com':      'Google Docs',
  'drive.google.com':     'Google Drive',
  'calendar.google.com':  'Google Calendar',
  'meet.google.com':      'Google Meet',
  'gemini.google.com':    'Gemini',
  'chatgpt.com':          'ChatGPT',
  'www.chatgpt.com':      'ChatGPT',
  'chat.openai.com':      'ChatGPT',
  'claude.ai':            'Claude',
  'www.claude.ai':        'Claude',
  'code.claude.com':      'Claude Code',
  'notion.so':            'Notion',
  'www.notion.so':        'Notion',
  'figma.com':            'Figma',
  'www.figma.com':        'Figma',
  'slack.com':            'Slack',
  'app.slack.com':        'Slack',
  'discord.com':          'Discord',
  'www.discord.com':      'Discord',
  'wikipedia.org':        'Wikipedia',
  'en.wikipedia.org':     'Wikipedia',
  'amazon.com':           'Amazon',
  'www.amazon.com':       'Amazon',
  'netflix.com':          'Netflix',
  'www.netflix.com':      'Netflix',
  'spotify.com':          'Spotify',
  'open.spotify.com':     'Spotify',
  'vercel.com':           'Vercel',
  'www.vercel.com':       'Vercel',
  'npmjs.com':            'npm',
  'www.npmjs.com':        'npm',
  'developer.mozilla.org':'MDN',
  'arxiv.org':            'arXiv',
  'www.arxiv.org':        'arXiv',
  'huggingface.co':       'Hugging Face',
  'www.huggingface.co':   'Hugging Face',
  'producthunt.com':      'Product Hunt',
  'www.producthunt.com':  'Product Hunt',
  'xiaohongshu.com':      'RedNote',
  'www.xiaohongshu.com':  'RedNote',
  'local-files':          'Local Files',
};

function friendlyDomain(hostname) {
  if (!hostname) return '';
  if (FRIENDLY_DOMAINS[hostname]) return FRIENDLY_DOMAINS[hostname];

  if (hostname.endsWith('.substack.com') && hostname !== 'substack.com') {
    return capitalize(hostname.replace('.substack.com', '')) + "'s Substack";
  }
  if (hostname.endsWith('.github.io')) {
    return capitalize(hostname.replace('.github.io', '')) + ' (GitHub Pages)';
  }

  let clean = hostname
    .replace(/^www\./, '')
    .replace(/\.(com|org|net|io|co|ai|dev|app|so|me|xyz|info|us|uk|co\.uk|co\.jp)$/, '');

  return clean.split('.').map(part => capitalize(part)).join(' ');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function stripTitleNoise(title) {
  if (!title) return '';
  // Strip leading notification count: "(2) Title"
  title = title.replace(/^\(\d+\+?\)\s*/, '');
  // Strip inline counts like "Inbox (16,359)"
  title = title.replace(/\s*\([\d,]+\+?\)\s*/g, ' ');
  // Strip email addresses (privacy + cleaner display)
  title = title.replace(/\s*[\-\u2010-\u2015]\s*[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  title = title.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  // Clean X/Twitter format
  title = title.replace(/\s+on X:\s*/, ': ');
  title = title.replace(/\s*\/\s*X\s*$/, '');
  return title.trim();
}

function cleanTitle(title, hostname) {
  if (!title || !hostname) return title || '';

  const friendly = friendlyDomain(hostname);
  const domain   = hostname.replace(/^www\./, '');
  const seps     = [' - ', ' | ', ' ??? ', ' Â· ', ' ??? '];

  for (const sep of seps) {
    const idx = title.lastIndexOf(sep);
    if (idx === -1) continue;
    const suffix     = title.slice(idx + sep.length).trim();
    const suffixLow  = suffix.toLowerCase();
    if (
      suffixLow === domain.toLowerCase() ||
      suffixLow === friendly.toLowerCase() ||
      suffixLow === domain.replace(/\.\w+$/, '').toLowerCase() ||
      domain.toLowerCase().includes(suffixLow) ||
      friendly.toLowerCase().includes(suffixLow)
    ) {
      const cleaned = title.slice(0, idx).trim();
      if (cleaned.length >= 5) return cleaned;
    }
  }
  return title;
}

function smartTitle(title, url) {
  if (!url) return title || '';
  let pathname = '', hostname = '';
  try { const u = new URL(url); pathname = u.pathname; hostname = u.hostname; }
  catch { return title || ''; }

  const titleIsUrl = !title || title === url || title.startsWith(hostname) || title.startsWith('http');

  if ((hostname === 'x.com' || hostname === 'twitter.com' || hostname === 'www.x.com') && pathname.includes('/status/')) {
    const username = pathname.split('/')[1];
    if (username) return titleIsUrl ? `Post by @${username}` : title;
  }

  if (hostname === 'github.com' || hostname === 'www.github.com') {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const [owner, repo, ...rest] = parts;
      if (rest[0] === 'issues' && rest[1]) return `${owner}/${repo} Issue #${rest[1]}`;
      if (rest[0] === 'pull'   && rest[1]) return `${owner}/${repo} PR #${rest[1]}`;
      if (rest[0] === 'blob' || rest[0] === 'tree') return `${owner}/${repo} ??? ${rest.slice(2).join('/')}`;
      if (titleIsUrl) return `${owner}/${repo}`;
    }
  }

  if ((hostname === 'www.youtube.com' || hostname === 'youtube.com') && pathname === '/watch') {
    if (titleIsUrl) return 'YouTube Video';
  }

  if ((hostname === 'www.reddit.com' || hostname === 'reddit.com' || hostname === 'old.reddit.com') && pathname.includes('/comments/')) {
    const parts  = pathname.split('/').filter(Boolean);
    const subIdx = parts.indexOf('r');
    if (subIdx !== -1 && parts[subIdx + 1]) {
      if (titleIsUrl) return `r/${parts[subIdx + 1]} post`;
    }
  }

  return title || url;
}


/* ----------------------------------------------------------------
   SVG ICON STRINGS
   ---------------------------------------------------------------- */
const ICONS = {
  tabs:    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18" /></svg>`,
  close:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`,
  archive: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`,
  focus:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" /></svg>`,
  grip:    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="7" r="1.5"/><circle cx="8" cy="7" r="1.5"/><circle cx="2" cy="12" r="1.5"/><circle cx="8" cy="12" r="1.5"/></svg>`,
};


/* ================================================================
   DRAG-AND-DROP  - Tab reassignment + Group merge
   ================================================================ */

const TAB_REASSIGN_KEY = 'tabReassignments';
const GROUP_MERGE_KEY  = 'groupMerges';

async function loadTabReassignments() {
  return (await storageGet(TAB_REASSIGN_KEY)) || {};
}
async function saveTabReassignments(data) {
  await storageSet(TAB_REASSIGN_KEY, data);
}
async function loadGroupMerges() {
  return (await storageGet(GROUP_MERGE_KEY)) || [];
}
async function saveGroupMerges(data) {
  await storageSet(GROUP_MERGE_KEY, data);
}

async function reassignTab(url, targetDomain) {
  const data = await loadTabReassignments();
  data[url] = targetDomain;
  await saveTabReassignments(data);
}

async function mergeGroupDomains(domain1, domain2) {
  const merges = await loadGroupMerges();
  const m1 = merges.find(m => m.domains.includes(domain1));
  const m2 = merges.find(m => m.domains.includes(domain2));
  let mergedDomains;
  if (m1 && m2 && m1 !== m2) {
    m1.domains.push(...m2.domains.filter(d => !m1.domains.includes(d)));
    merges.splice(merges.indexOf(m2), 1);
    mergedDomains = m1.domains;
  } else if (m1) {
    if (!m1.domains.includes(domain2)) m1.domains.push(domain2);
    mergedDomains = m1.domains;
  } else if (m2) {
    if (!m2.domains.includes(domain1)) m2.domains.push(domain1);
    mergedDomains = m2.domains;
  } else {
    const entry = { id: Date.now().toString(36), domains: [domain1, domain2] };
    merges.push(entry);
    mergedDomains = entry.domains;
  }
  await saveGroupMerges(merges);
  // Mirror the merge as a Chrome tab group
  await applyChromeMergeGroup(mergedDomains);
  await incrementMetric('groupsMerged', 1);
}

/**
 * applyChromeMergeGroup(domains)
 *
 * Finds all currently open tabs belonging to any of the given domains,
 * groups them in Chrome with a matching colour, and names the group.
 */
async function applyChromeMergeGroup(domains) {
  if (!chrome.tabs?.group || !chrome.tabGroups?.update) return;

  // Map category ¡÷ Chrome tab group colour (limited palette)
  const CAT_TO_CHROME_COLOR = {
    work:'blue', school:'yellow', jobs:'orange', art:'pink',
    social:'purple', relax:'green', dev:'cyan', finance:'green',
    ai:'cyan', housing:'orange', health:'red', shopping:'yellow',
  };

  try {
    const allTabs = await chrome.tabs.query({});
    const tabIds = allTabs
      .filter(t => {
        try {
          const host = new URL(t.url).hostname.replace(/^www\./, '');
          return domains.some(d => host === d || host.endsWith('.' + d));
        } catch { return false; }
      })
      .map(t => t.id);

    if (tabIds.length < 1) return;

    const groupId = await chrome.tabs.group({ tabIds });

    // Pick a colour from the first domain's category
    const firstCat = DOMAIN_CATEGORY_MAP[domains[0].replace(/^www\./, '')] || null;
    const color = (firstCat && CAT_TO_CHROME_COLOR[firstCat]) || 'grey';
    const title = domains.map(d => friendlyDomain(d)).join(' + ');

    await chrome.tabGroups.update(groupId, { title, color });
  } catch (err) {
    console.warn('[tab-out] Chrome tab group update failed:', err);
  }
}

async function unmergeGroup(mergeId) {
  await saveGroupMerges((await loadGroupMerges()).filter(m => m.id !== mergeId));
}

/**
 * Apply stored tab reassignments and group merges to the live domainGroups array.
 * Mutates the array in-place.
 */
async function applyDragCustomizations(groups) {
  const reassign = await loadTabReassignments();
  const merges   = await loadGroupMerges();

  // --- Tab reassignments: move individual tabs to different cards ---
  for (const [url, targetDomain] of Object.entries(reassign)) {
    const src = groups.find(g => g.tabs.some(t => t.url === url));
    const tgt = groups.find(g => g.domain === targetDomain);
    if (!src || !tgt || src === tgt) continue;
    const tab = src.tabs.find(t => t.url === url);
    if (!tab) continue;
    src.tabs = src.tabs.filter(t => t.url !== url);
    tgt.tabs.push(tab);
  }
  // Remove cards that lost all their tabs via reassignment
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i].tabs.length === 0) groups.splice(i, 1);
  }

  // --- Group merges: combine multiple domain cards into one ---
  for (const merge of merges) {
    const targets = groups.filter(g => merge.domains.includes(g.domain));
    if (targets.length < 2) continue;
    const primary = targets[0];
    for (const g of targets.slice(1)) {
      primary.tabs.push(...g.tabs);
      groups.splice(groups.indexOf(g), 1);
    }
    primary.label        = targets.map(g => friendlyDomain(g.domain)).join(' + ');
    primary.mergeId      = merge.id;
    primary.mergedDomains = merge.domains;
  }
}

// --- Drag state ---
let currentDrag   = null; // { type:'tab'|'group', url?, fromDomain?, domain? }
let dragOverCard  = null; // current hovered .mission-card
let mergeTimer    = null; // setTimeout handle for shake trigger

function _showDragHint(text) {
  const el = document.getElementById('dragHint');
  if (el) { el.textContent = text; el.classList.add('visible'); }
}
function _hideDragHint() {
  const el = document.getElementById('dragHint');
  if (el) el.classList.remove('visible');
}
function _clearDragOverCard() {
  if (dragOverCard) {
    dragOverCard.classList.remove('drop-target', 'merge-target', 'merge-shake');
    dragOverCard = null;
  }
  clearTimeout(mergeTimer);
  mergeTimer = null;
}
function _clearDragState() {
  document.querySelectorAll('.drag-source').forEach(el => el.classList.remove('drag-source'));
  _clearDragOverCard();
  _hideDragHint();
  currentDrag = null;
}


/* ----------------------------------------------------------------
   IN-MEMORY STORE FOR OPEN-TAB GROUPS
   ---------------------------------------------------------------- */
let domainGroups = [];


/* ----------------------------------------------------------------
   HELPER: filter out browser-internal pages
   ---------------------------------------------------------------- */

/**
 * getRealTabs()
 *
 * Returns tabs that are real web pages ??? no chrome://, extension
 * pages, about:blank, etc.
 */
function getRealTabs() {
  return openTabs.filter(t => {
    const url = t.url || '';
    return (
      !url.startsWith('chrome://') &&
      !url.startsWith('chrome-extension://') &&
      !url.startsWith('about:') &&
      !url.startsWith('edge://') &&
      !url.startsWith('brave://')
    );
  });
}

/**
 * checkTabOutDupes()
 *
 * Counts how many Tab Out pages are open. If more than 1,
 * shows a banner offering to close the extras.
 */
function checkTabOutDupes() {
  const tabOutTabs = openTabs.filter(t => t.isTabOut);
  const banner  = document.getElementById('tabOutDupeBanner');
  const countEl = document.getElementById('tabOutDupeCount');
  if (!banner) return;

  if (tabOutTabs.length > 1) {
    if (countEl) countEl.textContent = tabOutTabs.length;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}


/* ----------------------------------------------------------------
   OVERFLOW CHIPS ("+N more" expand button in domain cards)
   ---------------------------------------------------------------- */

function buildOverflowChips(hiddenTabs, urlCounts = {}, sourceDomain = '') {
  const hiddenChips = hiddenTabs.map(tab => {
    const label     = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), '');
    const count     = urlCounts[tab.url] || 1;
    const dupeTag   = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const safeUrl   = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    let domain = '';
    try { domain = new URL(tab.url).hostname; } catch {}
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : '';
    return `<div class="page-chip clickable${chipClass}"
         draggable="true"
         data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}"
         data-drag-type="tab" data-drag-url="${safeUrl}" data-drag-from="${esc(sourceDomain)}">
      <img class="chip-favicon" src="${faviconUrl || 'icons/leaf-favicon.svg'}" alt="" onerror="this.src='icons/leaf-favicon.svg'">
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="Save for later">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="Close this tab">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="page-chips-overflow" style="display:none">${hiddenChips}</div>
    <div class="page-chip page-chip-overflow clickable" data-action="expand-chips">
      <span class="chip-text">+${hiddenTabs.length} more</span>
    </div>`;
}


/* ----------------------------------------------------------------
   DOMAIN CARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderDomainCard(group, groupIndex)
 *
 * Builds the HTML for one domain group card.
 * group = { domain: string, tabs: [{ url, title, id, windowId, active }] }
 */
function renderDomainCard(group) {
  const tabs      = group.tabs || [];
  const tabCount  = tabs.length;
  const isLanding = group.domain === '__landing-pages__';
  const stableId  = 'domain-' + group.domain.replace(/[^a-z0-9]/g, '-');

  // Count duplicates (exact URL match)
  const urlCounts = {};
  for (const tab of tabs) urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1;
  const dupeUrls   = Object.entries(urlCounts).filter(([, c]) => c > 1);
  const hasDupes   = dupeUrls.length > 0;
  const totalExtras = dupeUrls.reduce((s, [, c]) => s + c - 1, 0);

  const tabBadge = `<span class="open-tabs-badge">
    ${ICONS.tabs}
    ${tabCount} tab${tabCount !== 1 ? 's' : ''} open
  </span>`;

  const dupeBadge = hasDupes
    ? `<span class="open-tabs-badge dupe-badge">
        ${totalExtras} dupe${totalExtras !== 1 ? 's' : ''}
      </span>`
    : '';

  // Deduplicate for display: show each URL once, with (Nx) badge if duped
  const seen = new Set();
  const uniqueTabs = [];
  for (const tab of tabs) {
    if (!seen.has(tab.url)) { seen.add(tab.url); uniqueTabs.push(tab); }
  }

  const visibleTabs = uniqueTabs.slice(0, 8);
  const extraCount  = uniqueTabs.length - visibleTabs.length;

  const pageChips = visibleTabs.map(tab => {
    let label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), group.domain);
    try {
      const parsed = new URL(tab.url);
      if (parsed.hostname === 'localhost' && parsed.port) label = `${parsed.port} ${label}`;
    } catch {}
    const count     = urlCounts[tab.url];
    const dupeTag   = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const safeUrl   = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    let domain = '';
    try { domain = new URL(tab.url).hostname; } catch {}
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : '';
    return `<div class="page-chip clickable${chipClass}"
         draggable="true"
         data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}"
         data-drag-type="tab" data-drag-url="${safeUrl}" data-drag-from="${esc(group.domain)}">
      <img class="chip-favicon" src="${faviconUrl || 'icons/leaf-favicon.svg'}" alt="" onerror="this.src='icons/leaf-favicon.svg'">
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="Save for later">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="Close this tab">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('') + (extraCount > 0 ? buildOverflowChips(uniqueTabs.slice(8), urlCounts, group.domain) : '');

  // Only show "Close all" when there are 2+ tabs  - single-tab close lives on the chip itself
  let actionsHtml = '';
  if (tabCount > 1) {
    actionsHtml += `
      <button class="action-btn close-tabs" data-action="close-domain-tabs" data-domain-id="${stableId}">
        ${ICONS.close}
        Close all ${tabCount} tabs
      </button>`;
  }
  if (hasDupes) {
    const dupeUrlsEncoded = dupeUrls.map(([url]) => encodeURIComponent(url)).join(',');
    actionsHtml += `
      <button class="action-btn" data-action="dedup-keep-one" data-dupe-urls="${dupeUrlsEncoded}">
        Remove ${totalExtras} duplicate${totalExtras !== 1 ? 's' : ''}
      </button>`;
  }

  // Category color coding
  const cat = getDomainCategory(group.domain);
  const borderColor = cat ? cat.color : (hasDupes ? '#f7cd67' : '#c4b89e');
  const catLabel = cat ? `<span class="category-pill" style="background:${cat.color};color:${cat.textColor}">${cat.label}</span>` : '';

  const unmergeBtn = group.mergeId
    ? `<button class="unmerge-btn" data-action="unmerge-group" data-merge-id="${group.mergeId}" title="Split this merged group">split</button>`
    : '';

  return `
    <div class="mission-card domain-card" data-domain-id="${stableId}"
         data-drag-domain="${esc(group.domain)}"
         style="border-top-color:${borderColor}">
      <div class="mission-content">
        <div class="mission-top">
          <span class="drag-handle" draggable="true"
                data-drag-type="group" data-drag-domain="${esc(group.domain)}"
                title="Drag onto another group to merge">${ICONS.grip}</span>
          <span class="mission-name">${isLanding ? 'Homepages' : (group.label || friendlyDomain(group.domain))}</span>
          ${tabBadge}
          ${catLabel}
          ${dupeBadge}
          ${unmergeBtn}
        </div>
        <div class="mission-pages">
          ${pageChips}
          <div class="drop-zone-hint">Drop tab here</div>
        </div>
        ${actionsHtml ? `<div class="actions">${actionsHtml}</div>` : ''}
      </div>
    </div>`;
}


/* ----------------------------------------------------------------
   SAVED FOR LATER ??? Render Checklist Column
   ---------------------------------------------------------------- */

/**
 * renderDeferredColumn()
 *
 * Reads saved tabs from chrome.storage.sync and renders the right-side
 * "Saved for Later" checklist column. Shows active items as a checklist
 * and completed items in a collapsible archive.
 */
async function renderDeferredColumn() {
  const column         = document.getElementById('deferredColumn');
  const list           = document.getElementById('deferredList');
  const empty          = document.getElementById('deferredEmpty');
  const countEl        = document.getElementById('deferredCount');
  const archiveEl      = document.getElementById('deferredArchive');
  const archiveCountEl = document.getElementById('archiveCount');
  const archiveList    = document.getElementById('archiveList');

  if (!column) return;

  try {
    const { active, archived } = await getSavedTabs();

    // Hide the entire column if there's nothing to show
    if (active.length === 0 && archived.length === 0) {
      column.style.display = 'none';
      return;
    }

    column.style.display = 'block';

    // Render active checklist items
    if (active.length > 0) {
      countEl.textContent = `${active.length} item${active.length !== 1 ? 's' : ''}`;
      list.innerHTML = active.map(item => renderDeferredItem(item)).join('');
      list.style.display = 'block';
      empty.style.display = 'none';
    } else {
      list.style.display = 'none';
      countEl.textContent = '';
      empty.style.display = 'block';
    }

    // Render archive section
    if (archived.length > 0) {
      archiveCountEl.textContent = `(${archived.length})`;
      archiveList.innerHTML = archived.map(item => renderArchiveItem(item)).join('');
      archiveEl.style.display = 'block';
    } else {
      archiveEl.style.display = 'none';
    }

  } catch (err) {
    console.warn('[tab-out] Could not load saved tabs:', err);
    column.style.display = 'none';
  }
}

/**
 * renderDeferredItem(item)
 *
 * Builds HTML for one active checklist item: checkbox, title link,
 * domain, time ago, dismiss button.
 */
function renderDeferredItem(item) {
  let domain = '';
  try { domain = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  const ago = timeAgo(item.savedAt);

  return `
    <div class="deferred-item" data-deferred-id="${item.id}">
      <input type="checkbox" class="deferred-checkbox" data-action="check-deferred" data-deferred-id="${item.id}">
      <div class="deferred-info">
        <a href="${item.url}" target="_blank" rel="noopener" class="deferred-title" title="${(item.title || '').replace(/"/g, '&quot;')}">
          <img src="${faviconUrl}" alt="" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px" onerror="this.style.display='none'">${item.title || item.url}
        </a>
        <div class="deferred-meta">
          <span>${domain}</span>
          <span>${ago}</span>
        </div>
      </div>
      <button class="deferred-dismiss" data-action="dismiss-deferred" data-deferred-id="${item.id}" title="Dismiss">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>`;
}

/**
 * renderArchiveItem(item)
 *
 * Builds HTML for one completed/archived item (simpler: just title + date).
 */
function renderArchiveItem(item) {
  const ago = item.completedAt ? timeAgo(item.completedAt) : timeAgo(item.savedAt);
  return `
    <div class="archive-item">
      <a href="${item.url}" target="_blank" rel="noopener" class="archive-item-title" title="${(item.title || '').replace(/"/g, '&quot;')}">
        ${item.title || item.url}
      </a>
      <span class="archive-item-date">${ago}</span>
    </div>`;
}


/* ----------------------------------------------------------------
   MAIN DASHBOARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderStaticDashboard()
 *
 * The main render function:
 * 1. Paints greeting + date
 * 2. Fetches open tabs via chrome.tabs.query()
 * 3. Groups tabs by domain (with landing pages pulled out to their own group)
 * 4. Renders domain cards
 * 5. Updates footer stats
 * 6. Renders the "Saved for Later" checklist
 */
async function renderStaticDashboard() {
  // --- Header ---
  const greetingEl = document.getElementById('greeting');
  const subEl      = document.getElementById('greetingSub');
  const dateEl     = document.getElementById('dateDisplay');
  if (greetingEl) greetingEl.textContent = getGreeting();
  if (subEl)      subEl.textContent      = getGreetingSub();
  if (dateEl)     dateEl.textContent     = getDateDisplay();
  initWeather();         // async, updates #weatherLine when ready
  initVillagerDancer();  // footer GIF cycle + hover dialogue

  // --- Fetch tabs ---
  await fetchOpenTabs();
  const realTabs = getRealTabs();

  // --- Group tabs by domain ---
  // Landing pages (Gmail inbox, Twitter home, etc.) get their own special group
  // so they can be closed together without affecting content tabs on the same domain.
  const LANDING_PAGE_PATTERNS = [
    { hostname: 'mail.google.com', test: (p, h) =>
        !h.includes('#inbox/') && !h.includes('#sent/') && !h.includes('#search/') },
    { hostname: 'x.com',               pathExact: ['/home'] },
    { hostname: 'www.linkedin.com',    pathExact: ['/'] },
    { hostname: 'github.com',          pathExact: ['/'] },
    { hostname: 'www.youtube.com',     pathExact: ['/'] },
    // Merge personal patterns from config.local.js (if it exists)
    ...(typeof LOCAL_LANDING_PAGE_PATTERNS !== 'undefined' ? LOCAL_LANDING_PAGE_PATTERNS : []),
  ];

  function isLandingPage(url) {
    try {
      const parsed = new URL(url);
      return LANDING_PAGE_PATTERNS.some(p => {
        // Support both exact hostname and suffix matching (for wildcard subdomains)
        const hostnameMatch = p.hostname
          ? parsed.hostname === p.hostname
          : p.hostnameEndsWith
            ? parsed.hostname.endsWith(p.hostnameEndsWith)
            : false;
        if (!hostnameMatch) return false;
        if (p.test)       return p.test(parsed.pathname, url);
        if (p.pathPrefix) return parsed.pathname.startsWith(p.pathPrefix);
        if (p.pathExact)  return p.pathExact.includes(parsed.pathname);
        return parsed.pathname === '/';
      });
    } catch { return false; }
  }

  domainGroups = [];
  const groupMap    = {};
  const landingTabs = [];

  // Custom group rules from config.local.js (if any)
  const customGroups = typeof LOCAL_CUSTOM_GROUPS !== 'undefined' ? LOCAL_CUSTOM_GROUPS : [];

  // Check if a URL matches a custom group rule; returns the rule or null
  function matchCustomGroup(url) {
    try {
      const parsed = new URL(url);
      return customGroups.find(r => {
        const hostMatch = r.hostname
          ? parsed.hostname === r.hostname
          : r.hostnameEndsWith
            ? parsed.hostname.endsWith(r.hostnameEndsWith)
            : false;
        if (!hostMatch) return false;
        if (r.pathPrefix) return parsed.pathname.startsWith(r.pathPrefix);
        return true; // hostname matched, no path filter
      }) || null;
    } catch { return null; }
  }

  for (const tab of realTabs) {
    try {
      if (isLandingPage(tab.url)) {
        landingTabs.push(tab);
        continue;
      }

      // Check custom group rules first (e.g. merge subdomains, split by path)
      const customRule = matchCustomGroup(tab.url);
      if (customRule) {
        const key = customRule.groupKey;
        if (!groupMap[key]) groupMap[key] = { domain: key, label: customRule.groupLabel, tabs: [] };
        groupMap[key].tabs.push(tab);
        continue;
      }

      let hostname;
      if (tab.url && tab.url.startsWith('file://')) {
        hostname = 'local-files';
      } else {
        hostname = new URL(tab.url).hostname;
      }
      if (!hostname) continue;

      if (!groupMap[hostname]) groupMap[hostname] = { domain: hostname, tabs: [] };
      groupMap[hostname].tabs.push(tab);
    } catch {
      // Skip malformed URLs
    }
  }

  if (landingTabs.length > 0) {
    groupMap['__landing-pages__'] = { domain: '__landing-pages__', tabs: landingTabs };
  }

  // Sort: landing pages first, then domains from landing page sites, then by tab count
  // Collect exact hostnames and suffix patterns for priority sorting
  const landingHostnames = new Set(LANDING_PAGE_PATTERNS.map(p => p.hostname).filter(Boolean));
  const landingSuffixes = LANDING_PAGE_PATTERNS.map(p => p.hostnameEndsWith).filter(Boolean);
  function isLandingDomain(domain) {
    if (landingHostnames.has(domain)) return true;
    return landingSuffixes.some(s => domain.endsWith(s));
  }
  domainGroups = Object.values(groupMap).sort((a, b) => {
    const aIsLanding = a.domain === '__landing-pages__';
    const bIsLanding = b.domain === '__landing-pages__';
    if (aIsLanding !== bIsLanding) return aIsLanding ? -1 : 1;

    const aIsPriority = isLandingDomain(a.domain);
    const bIsPriority = isLandingDomain(b.domain);
    if (aIsPriority !== bIsPriority) return aIsPriority ? -1 : 1;

    return b.tabs.length - a.tabs.length;
  });

  // --- Apply drag-drop customizations (tab reassignments + group merges) ---
  await applyDragCustomizations(domainGroups);

  // --- Render domain cards ---
  const openTabsSection      = document.getElementById('openTabsSection');
  const openTabsMissionsEl   = document.getElementById('openTabsMissions');
  const openTabsSectionCount = document.getElementById('openTabsSectionCount');
  const openTabsSectionTitle = document.getElementById('openTabsSectionTitle');

  if (domainGroups.length > 0 && openTabsSection) {
    if (openTabsSectionTitle) openTabsSectionTitle.textContent = 'Open tabs';
    openTabsSectionCount.innerHTML = `${domainGroups.length} domain${domainGroups.length !== 1 ? 's' : ''} &nbsp;&middot;&nbsp; ${realTabs.length} tab${realTabs.length !== 1 ? 's' : ''}`;
    openTabsMissionsEl.innerHTML = domainGroups.map(g => renderDomainCard(g)).join('');
    openTabsSection.style.display = 'block';
  } else if (openTabsSection) {
    openTabsSection.style.display = 'none';
  }

  // --- Footer stats ---
  const statTabs = document.getElementById('statTabs');
  if (statTabs) statTabs.textContent = openTabs.length;

  // --- Metrics dashboard ---
  await renderMetrics(openTabs.length);

  // --- Increment session counter ---
  await incrementMetric('sessions');

  // --- Check for duplicate Tab Out tabs ---
  checkTabOutDupes();

  // --- Render "Saved for Later" column ---
  await renderDeferredColumn();

  // --- Render Focus / Eisenhower matrix ---
  await renderMatrixColumn();
}

async function renderDashboard() {
  await renderStaticDashboard();
}


/* ----------------------------------------------------------------
   EVENT HANDLERS ??? using event delegation

   One listener on document handles ALL button clicks.
   Think of it as one security guard watching the whole building
   instead of one per door.
   ---------------------------------------------------------------- */

document.addEventListener('click', async (e) => {
  // Walk up the DOM to find the nearest element with data-action
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  // ---- Matrix: select quadrant pill ----
  if (action === 'select-matrix-q') {
    document.querySelectorAll('#matrixQPills .q-pill').forEach(p => p.classList.remove('active'));
    actionEl.classList.add('active');
    return;
  }

  // ---- Matrix: toggle task done (whole row is the target) ----
  if (action === 'toggle-matrix-task') {
    await toggleMatrixTask(actionEl.dataset.taskId);
    return;
  }

  // ---- Matrix: delete task (stop propagation so row-toggle doesn't fire) ----
  if (action === 'delete-matrix-task') {
    e.stopPropagation();
    await deleteMatrixTask(actionEl.dataset.taskId);
    return;
  }

  // ---- @ mention: insert selected suggestion ----
  if (action === 'insert-at-mention') {
    e.stopPropagation();
    insertAtMention(actionEl.dataset.atLabel);
    return;
  }

  // ---- Unmerge a merged group ----
  if (action === 'unmerge-group') {
    e.stopPropagation();
    await unmergeGroup(actionEl.dataset.mergeId);
    await renderDashboard();
    return;
  }

  // ---- Close duplicate Tab Out tabs ----
  if (action === 'close-tabout-dupes') {
    await closeTabOutDupes();
    playCloseSound();
    const banner = document.getElementById('tabOutDupeBanner');
    if (banner) {
      banner.style.transition = 'opacity 0.4s';
      banner.style.opacity = '0';
      setTimeout(() => { banner.style.display = 'none'; banner.style.opacity = '1'; }, 400);
    }
    showToast('Closed extra Tab Out tabs');
    return;
  }

  const card = actionEl.closest('.mission-card');

  // ---- Expand overflow chips ("+N more") ----
  if (action === 'expand-chips') {
    const overflowContainer = actionEl.parentElement.querySelector('.page-chips-overflow');
    if (overflowContainer) {
      overflowContainer.style.display = 'contents';
      actionEl.remove();
    }
    return;
  }

  // ---- Focus a specific tab ----
  if (action === 'focus-tab') {
    const tabUrl = actionEl.dataset.tabUrl;
    if (tabUrl) await focusTab(tabUrl);
    return;
  }

  // ---- Close a single tab ----
  if (action === 'close-single-tab') {
    e.stopPropagation(); // don't trigger parent chip's focus-tab
    const tabUrl = actionEl.dataset.tabUrl;
    if (!tabUrl) return;

    // Close the tab in Chrome directly
    const allTabs = await chrome.tabs.query({});
    const match   = allTabs.find(t => t.url === tabUrl);
    if (match) await chrome.tabs.remove(match.id);
    await fetchOpenTabs();

    playCloseSound();

    // Animate the chip row out
    const chip = actionEl.closest('.page-chip');
    if (chip) {
      const rect = chip.getBoundingClientRect();
      shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      chip.style.transition = 'opacity 0.2s, transform 0.2s';
      chip.style.opacity    = '0';
      chip.style.transform  = 'scale(0.8)';
      setTimeout(() => {
        chip.remove();
        // If the card now has no tabs, remove it too
        const parentCard = document.querySelector('.mission-card:has(.mission-pages:empty)');
        if (parentCard) animateCardOut(parentCard);
        document.querySelectorAll('.mission-card').forEach(c => {
          if (c.querySelectorAll('.page-chip[data-action="focus-tab"]').length === 0) {
            animateCardOut(c);
          }
        });
      }, 200);
    }

    // Update footer
    await incrementMetric('tabsClosed', 1);
    const statTabs = document.getElementById('statTabs');
    if (statTabs) statTabs.textContent = openTabs.length;
    await renderMetrics(openTabs.length);

    showToast('Tab closed');
    return;
  }

  // ---- Save a single tab for later (then close it) ----
  if (action === 'defer-single-tab') {
    e.stopPropagation();
    const tabUrl   = actionEl.dataset.tabUrl;
    const tabTitle = actionEl.dataset.tabTitle || tabUrl;
    if (!tabUrl) return;

    // Save to chrome.storage.sync
    try {
      await saveTabForLater({ url: tabUrl, title: tabTitle });
    } catch (err) {
      console.error('[tab-out] Failed to save tab:', err);
      showToast('Failed to save tab');
      return;
    }

    // Close the tab in Chrome
    const allTabs = await chrome.tabs.query({});
    const match   = allTabs.find(t => t.url === tabUrl);
    if (match) await chrome.tabs.remove(match.id);
    await fetchOpenTabs();

    // Animate chip out
    const chip = actionEl.closest('.page-chip');
    if (chip) {
      chip.style.transition = 'opacity 0.2s, transform 0.2s';
      chip.style.opacity    = '0';
      chip.style.transform  = 'scale(0.8)';
      setTimeout(() => chip.remove(), 200);
    }

    await incrementMetric('tabsSaved', 1);
    showToast('Saved for later');
    await renderDeferredColumn();
    return;
  }

  // ---- Check off a saved tab (moves it to archive) ----
  if (action === 'check-deferred') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await checkOffSavedTab(id);

    // Animate: strikethrough first, then slide out
    const item = actionEl.closest('.deferred-item');
    if (item) {
      item.classList.add('checked');
      setTimeout(() => {
        item.classList.add('removing');
        setTimeout(() => {
          item.remove();
          renderDeferredColumn(); // refresh counts and archive
        }, 300);
      }, 800);
    }
    return;
  }

  // ---- Dismiss a saved tab (removes it entirely) ----
  if (action === 'dismiss-deferred') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await dismissSavedTab(id);

    const item = actionEl.closest('.deferred-item');
    if (item) {
      item.classList.add('removing');
      setTimeout(() => {
        item.remove();
        renderDeferredColumn();
      }, 300);
    }
    return;
  }

  // ---- Close all tabs in a domain group ----
  if (action === 'close-domain-tabs') {
    const domainId = actionEl.dataset.domainId;
    const group    = domainGroups.find(g => {
      return 'domain-' + g.domain.replace(/[^a-z0-9]/g, '-') === domainId;
    });
    if (!group) return;

    const urls      = group.tabs.map(t => t.url);
    // Landing pages and custom groups (whose domain key isn't a real hostname)
    // must use exact URL matching to avoid closing unrelated tabs
    const useExact  = group.domain === '__landing-pages__' || !!group.label;

    if (useExact) {
      await closeTabsExact(urls);
    } else {
      await closeTabsByUrls(urls);
    }

    if (card) {
      playCloseSound();
      animateCardOut(card);
    }

    // Remove from in-memory groups
    const idx = domainGroups.indexOf(group);
    if (idx !== -1) domainGroups.splice(idx, 1);

    const groupLabel = group.domain === '__landing-pages__' ? 'Homepages' : (group.label || friendlyDomain(group.domain));
    showToast(`Closed ${urls.length} tab${urls.length !== 1 ? 's' : ''} from ${groupLabel}`);

    await incrementMetric('tabsClosed', urls.length);
    const statTabs = document.getElementById('statTabs');
    if (statTabs) statTabs.textContent = openTabs.length;
    await renderMetrics(openTabs.length);
    return;
  }

  // ---- Close duplicates, keep one copy ----
  if (action === 'dedup-keep-one') {
    const urlsEncoded = actionEl.dataset.dupeUrls || '';
    const urls = urlsEncoded.split(',').map(u => decodeURIComponent(u)).filter(Boolean);
    if (urls.length === 0) return;

    await closeDuplicateTabs(urls, true);
    playCloseSound();

    // Hide the dedup button
    actionEl.style.transition = 'opacity 0.2s';
    actionEl.style.opacity    = '0';
    setTimeout(() => actionEl.remove(), 200);

    // Remove dupe badges from the card
    if (card) {
      card.querySelectorAll('.chip-dupe-badge').forEach(b => {
        b.style.transition = 'opacity 0.2s';
        b.style.opacity    = '0';
        setTimeout(() => b.remove(), 200);
      });
      card.querySelectorAll('.open-tabs-badge').forEach(badge => {
        if (badge.textContent.includes('duplicate')) {
          badge.style.transition = 'opacity 0.2s';
          badge.style.opacity    = '0';
          setTimeout(() => badge.remove(), 200);
        }
      });
      // Revert border to neutral (category color stays from inline style)
    }

    showToast('Closed duplicates, kept one copy each');
    return;
  }

  // ---- Close ALL open tabs ----
  if (action === 'close-all-open-tabs') {
    const allUrls = openTabs
      .filter(t => t.url && !t.url.startsWith('chrome') && !t.url.startsWith('about:'))
      .map(t => t.url);
    await closeTabsByUrls(allUrls);
    playCloseSound();

    document.querySelectorAll('#openTabsMissions .mission-card').forEach(c => {
      shootConfetti(
        c.getBoundingClientRect().left + c.offsetWidth / 2,
        c.getBoundingClientRect().top  + c.offsetHeight / 2
      );
      animateCardOut(c);
    });

    showToast('All tabs closed. Fresh start.');
    return;
  }
});

// ---- Archive toggle ??? expand/collapse the archive section ----
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('#archiveToggle');
  if (!toggle) return;

  toggle.classList.toggle('open');
  const body = document.getElementById('archiveBody');
  if (body) {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
  }
});

// ---- Archive search ??? filter archived items as user types ----
document.addEventListener('input', async (e) => {
  if (e.target.id !== 'archiveSearch') return;

  const q = e.target.value.trim().toLowerCase();
  const archiveList = document.getElementById('archiveList');
  if (!archiveList) return;

  try {
    const { archived } = await getSavedTabs();

    if (q.length < 2) {
      // Show all archived items
      archiveList.innerHTML = archived.map(item => renderArchiveItem(item)).join('');
      return;
    }

    // Filter by title or URL containing the query string
    const results = archived.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.url  || '').toLowerCase().includes(q)
    );

    archiveList.innerHTML = results.map(item => renderArchiveItem(item)).join('')
      || '<div style="font-size:12px;color:var(--muted);padding:8px 0">No results</div>';
  } catch (err) {
    console.warn('[tab-out] Archive search failed:', err);
  }
});


/* ================================================================
   DRAG-AND-DROP EVENT HANDLERS
   ================================================================ */

document.addEventListener('dragstart', e => {
  const chip = e.target.closest('[data-drag-type="tab"]');
  const grip = e.target.closest('[data-drag-type="group"]');

  if (chip && !grip) {
    // Dragging an individual tab chip
    currentDrag = { type: 'tab', url: chip.dataset.dragUrl, fromDomain: chip.dataset.dragFrom };
    e.dataTransfer.setData('text/plain', JSON.stringify(currentDrag));
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => chip.classList.add('drag-source'), 0);
    _showDragHint('Drop onto a group to move this tab, hm~');
  } else if (grip) {
    // Dragging a group card via its grip handle
    currentDrag = { type: 'group', domain: grip.dataset.dragDomain };
    e.dataTransfer.setData('text/plain', JSON.stringify(currentDrag));
    e.dataTransfer.effectAllowed = 'move';
    const card = grip.closest('.mission-card');
    setTimeout(() => card?.classList.add('drag-source'), 0);
    _showDragHint('Drop onto another group to merge them, yes yes!');
  }
});

document.addEventListener('dragover', e => {
  if (!currentDrag) return;
  const card = e.target.closest('.mission-card');
  if (!card) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  // New target card entered
  if (card !== dragOverCard) {
    _clearDragOverCard();
    dragOverCard = card;
    const targetDomain = card.dataset.dragDomain;

    if (currentDrag.type === 'tab' && targetDomain !== currentDrag.fromDomain) {
      card.classList.add('drop-target');
    } else if (currentDrag.type === 'group' && targetDomain && targetDomain !== currentDrag.domain) {
      card.classList.add('merge-target');
      // After 500ms shake the target to signal "release to merge"
      mergeTimer = setTimeout(() => {
        if (dragOverCard === card) {
          card.classList.add('merge-shake');
          card.addEventListener('animationend', () => card.classList.remove('merge-shake'), { once: true });
        }
      }, 500);
    }
  }
});

document.addEventListener('dragleave', e => {
  if (!dragOverCard) return;
  // Only clear when leaving the card entirely, not just entering a child
  const related = e.relatedTarget;
  if (related && dragOverCard.contains(related)) return;
  _clearDragOverCard();
});

document.addEventListener('drop', async e => {
  e.preventDefault();
  if (!currentDrag || !dragOverCard) { _clearDragState(); return; }
  const targetDomain = dragOverCard.dataset.dragDomain;

  if (currentDrag.type === 'tab') {
    if (targetDomain && targetDomain !== currentDrag.fromDomain && currentDrag.url) {
      await reassignTab(currentDrag.url, targetDomain);
      showToast('Tab moved!');
    }
  } else if (currentDrag.type === 'group') {
    if (targetDomain && targetDomain !== currentDrag.domain) {
      await mergeGroupDomains(currentDrag.domain, targetDomain);
      showToast('Groups merged!');
    }
  }

  _clearDragState();
  await renderDashboard();
});

document.addEventListener('dragend', () => {
  _clearDragState();
});

// ---- Matrix input: live @ mention trigger ----
document.addEventListener('input', (e) => {
  const input = e.target.closest('#matrixInput');
  if (!input) return;
  showAtMentionDropdown(input);
  // Show/hide the "enter to add" hint based on whether the input has content
  const hint = input.closest('.matrix-input-wrap')?.querySelector('.matrix-input-hint');
  if (hint) hint.style.opacity = input.value.length ? '0' : '';
});

// Close @ dropdown when clicking anywhere outside it
document.addEventListener('click', (e) => {
  if (!e.target.closest('#atMentionDropdown') && !e.target.closest('#matrixInput')) {
    hideAtMentionDropdown();
  }
});

// ---- Matrix: keyboard in input ----
document.addEventListener('keydown', async (e) => {
  const input = e.target.closest('#matrixInput');
  if (!input) return;

  const dropdown = document.getElementById('atMentionDropdown');
  const dropOpen = dropdown && dropdown.style.display !== 'none';

  // Escape closes dropdown
  if (e.key === 'Escape' && dropOpen) {
    e.preventDefault();
    hideAtMentionDropdown();
    return;
  }

  // Arrow keys navigate dropdown items
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && dropOpen) {
    e.preventDefault();
    const items = [...dropdown.querySelectorAll('.at-mention-item')];
    const focused = document.activeElement;
    let idx = items.indexOf(focused);
    idx = e.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
    items[idx]?.focus();
    return;
  }

  // Enter: select focused dropdown item OR add task
  if (e.key === 'Enter') {
    if (dropOpen && document.activeElement?.dataset.action === 'insert-at-mention') {
      e.preventDefault();
      insertAtMention(document.activeElement.dataset.atLabel);
      return;
    }
    if (dropOpen) {
      // Pick first item
      e.preventDefault();
      const first = dropdown.querySelector('.at-mention-item');
      if (first) { insertAtMention(first.dataset.atLabel); return; }
    }
    const activePill = document.querySelector('#matrixQPills .q-pill.active');
    const quadrant   = activePill ? activePill.dataset.q : 'do';
    await addMatrixTask(input.value, quadrant);
    input.value = '';
    hideAtMentionDropdown();
    // Restore hint opacity
    const hint = input.closest('.matrix-input-wrap')?.querySelector('.matrix-input-hint');
    if (hint) hint.style.opacity = '';
  }
});


/* ----------------------------------------------------------------
   CLICK PARTICLE SHARDS
   SVG geometric shards with colored borders that burst from every click.
   ---------------------------------------------------------------- */
(function initClickParticles() {
  const COLORS = [
    '#f8a6b2', '#889df0', '#f7cd67', '#82d5bb',
    '#8ac68a', '#b77dee', '#e59266', '#19c8b9',
    '#fc736d', '#6fba2c',
  ];

  // Each factory returns an SVG shape string with stroke = color
  const SHAPES = [
    c => `<polygon points="0,-7 5,4 -5,4"     fill="rgba(255,255,255,0.15)" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>`,
    c => `<rect x="-3" y="-6" width="6" height="12" rx="1" fill="rgba(255,255,255,0.15)" stroke="${c}" stroke-width="1.8"/>`,
    c => `<polygon points="0,-7 6,0 0,7 -6,0" fill="rgba(255,255,255,0.15)" stroke="${c}" stroke-width="1.8"/>`,
    c => `<polygon points="-1.5,-8 1.5,-8 2.5,6 -2.5,6" fill="rgba(255,255,255,0.15)" stroke="${c}" stroke-width="1.8"/>`,
    c => `<polygon points="0,-8 2,-2 8,-2 3,2 5,8 0,4 -5,8 -3,2 -8,-2 -2,-2" fill="rgba(255,255,255,0.15)" stroke="${c}" stroke-width="1.6"/>`,
  ];

  document.addEventListener('click', (e) => {
    const count = 8 + Math.floor(Math.random() * 4); // 8¡V11 shards

    for (let i = 0; i < count; i++) {
      const color   = COLORS[Math.floor(Math.random() * COLORS.length)];
      const shapeFn = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      const scale   = 0.7 + Math.random() * 0.8;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      Object.assign(svg.style, {
        position:      'fixed',
        left:          e.clientX + 'px',
        top:           e.clientY + 'px',
        width:         '24px',
        height:        '24px',
        overflow:      'visible',
        pointerEvents: 'none',
        zIndex:        '999999',
        willChange:    'transform, opacity',
      });
      svg.innerHTML = `<g transform="scale(${scale})">${shapeFn(color)}</g>`;
      document.body.appendChild(svg);

      // Physics: spread evenly around the click, with a slight upward bias
      const angle   = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
      const speed   = 60 + Math.random() * 100;
      const vx      = Math.cos(angle) * speed;
      const vy      = Math.sin(angle) * speed - 40;
      const gravity = 200;
      const spin    = (Math.random() - 0.5) * 600;
      const dur     = 500 + Math.random() * 300; // ms
      const t0      = performance.now();

      (function frame(now) {
        const elapsed  = (now - t0) / 1000;         // seconds
        const progress = (now - t0) / dur;           // 0 ¡÷ 1
        if (progress >= 1) { svg.remove(); return; }

        const px  = vx * elapsed;
        const py  = vy * elapsed + 0.5 * gravity * elapsed * elapsed;
        const rot = spin * elapsed;

        svg.style.transform = `translate(${px}px, ${py}px) rotate(${rot}deg)`;
        svg.style.opacity   = (1 - progress).toString();
        requestAnimationFrame(frame);
      })(t0);
    }
  });
})();


/* ----------------------------------------------------------------
   INITIALIZE
   ---------------------------------------------------------------- */
renderDashboard();
