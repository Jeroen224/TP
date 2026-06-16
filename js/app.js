/* ============ CONSTANTS ============ */
const STORAGE_KEY = 'daems_tp_v1';

const TYPE_OPTS = ['Practice', 'Qualifying', 'Heat', 'Superheat', 'Final'];
const COND_OPTS = ['Dry', 'Wet'];
const CAT_OPTS = ['Mini', 'Junior', 'Senior', 'DD2', 'Other'];
const GEAR_OPTS = ['11', '12', '13', 'Other'];
const RIDE_OPTS = ['Low', 'Middle', 'High'];
const RING_OPTS = ['1', '2', '3', '4', '5', '6'];
const CASTER_OPTS = ['Standard', 'Half', 'Full', 'Special'];
const BAR_OPTS = ['Standard', 'Chrome', 'Brown', 'Other'];

const CORNER_META = [
  { value: 'FL', label: 'FL', pos: 'Front L' },
  { value: 'FR', label: 'FR', pos: 'Front R' },
  { value: 'RL', label: 'RL', pos: 'Rear L' },
  { value: 'RR', label: 'RR', pos: 'Rear R' },
];

const KART_SVG = '<svg width="44" height="92" viewBox="0 0 44 92" fill="none"><rect x="17" y="18" width="10" height="56" rx="5" fill="var(--blue,#1453C9)" opacity=".55"/><path d="M22 7 L28 19 L16 19 Z" fill="var(--accent,#FFD400)" opacity=".85"/><rect x="14" y="40" width="16" height="20" rx="6" fill="var(--blue,#1453C9)" opacity=".7"/><rect x="1" y="16" width="9" height="19" rx="4" fill="var(--text,#fff)" opacity=".7"/><rect x="34" y="16" width="9" height="19" rx="4" fill="var(--text,#fff)" opacity=".7"/><rect x="0" y="58" width="11" height="23" rx="4" fill="var(--text,#fff)" opacity=".8"/><rect x="33" y="58" width="11" height="23" rx="4" fill="var(--text,#fff)" opacity=".8"/></svg>';

/* ============ STORAGE ============ */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { events: d.events || [], activeId: d.activeId || null, theme: d.theme || 'circuit' };
    }
  } catch (e) {}
  return { events: [], activeId: null, theme: 'circuit' };
}
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }

/* ============ BLANK DRAFTS ============ */
function blankMaster() { return { mechanic: '', driver: '', date: new Date().toISOString().slice(0, 10), circuit: '' }; }
function blankTire(prev) {
  return {
    type: prev ? prev.type : 'Practice',
    condition: prev ? prev.condition : 'Dry',
    cold: { FL: '', FR: '', RL: '', RR: '' },
    hot: { FL: '', FR: '', RL: '', RR: '' },
    rimTemp: '',
  };
}
function blankSetup() {
  return {
    category: '', categoryOther: '', engine: '', gearing: '', gearingOther: '',
    sprocket: '', carb: '', exhaust: '', rideRear: '', rearWidth: '', axle: '',
    axleLength: '', rideFront: '', frontRings: '', caster: '', casterOther: '', frontBar: '', frontBarOther: '',
  };
}

/* ============ APP STATE ============ */
const data = loadData();
const state = {
  screen: data.activeId ? 'tires' : (data.events.length ? 'events' : 'master'),
  masterDraft: blankMaster(),
  tireDraft: blankTire(null),
  setupDraft: blankSetup(),
  reviewTab: 'tires',
  editingSessionId: null,
  editingSetupId: null,
  err: {},
};

/* ============ HELPERS ============ */
function activeEvent() { return data.events.find(e => e.id === data.activeId) || null; }
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(ts) { if (!ts || ts < 1e9) return ''; return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function setupShort(st) {
  if (!st) return '';
  const cat = st.category === 'Other' ? (st.categoryOther || 'Other') : st.category;
  const gear = st.gearing === 'Other' ? (st.gearingOther || '') : st.gearing;
  return [cat, gear ? gear + 'T' : '', st.frontRings ? ('R' + st.frontRings) : ''].filter(Boolean).join(' · ');
}
function dispOther(v, other) { return v === 'Other' ? (other || 'Other') : v; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function inEventScreen() {
  const ev = activeEvent();
  return !!ev && (state.screen === 'tires' || state.screen === 'setup' || state.screen === 'review');
}

/* ============ TOAST ============ */
let toastTimer = null;
function flashToast(msg, icon, type) {
  clearTimeout(toastTimer);
  const root = document.getElementById('dtl-toast');
  root.innerHTML = '<div class="dtl-toast' + (type === 'err' ? ' dtl-toast--err' : '') + '"><span class="dtl-toast-icon">' + (icon || '✓') + '</span><span>' + esc(msg) + '</span></div>';
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, 2400);
}

/* ============ CHIP RENDERING ============ */
function chipBtn(draft, field, value, label, extraClass) {
  const active = state[draft][field] === value;
  let cls = 'dtl-chip' + (extraClass ? ' ' + extraClass : '');
  if (active) cls += ' dtl-chip--active';
  return '<button type="button" class="' + cls + '" data-action="choice" data-draft="' + draft + '" data-field="' + field + '" data-value="' + esc(value) + '">' + esc(label) + '</button>';
}
function chipRow(draft, field, values, extraClass, rowClass) {
  return '<div class="' + (rowClass || 'dtl-chip-row') + '">' + values.map(v => chipBtn(draft, field, v, v, extraClass)).join('') + '</div>';
}
function fieldClass(key) { return 'dtl-field' + (state.err[key] ? ' dtl-field--err' : ''); }

/* ============ HEADER / NAV ============ */
function renderHeader() {
  const ev = activeEvent();
  const inEvent = inEventScreen();
  return '' +
    '<header class="dtl-header">' +
      '<div class="dtl-header-left">' +
        '<button type="button" class="dtl-logo-btn" data-action="logo-home" aria-label="Home menu"><img src="assets/img/daems-logo.png" alt="Daems Racing"></button>' +
        (inEvent ? '<span class="dtl-divider"></span><span class="dtl-ctx-driver">' + esc(ev.driver) + '</span>' : '') +
      '</div>' +
      '<div class="dtl-header-right">' +
        (inEvent ? '<span class="dtl-ctx-circuit">' + esc(ev.circuit) + '</span>' : '') +
      '</div>' +
    '</header>';
}

function renderNav() {
  if (!inEventScreen()) return '';
  const items = [
    { key: 'tires', label: 'Pressures', d: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 5.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8z' },
    { key: 'setup', label: 'Setup', d: 'M4 6h16M4 12h16M4 18h16' },
    { key: 'review', label: 'Review', d: 'M3 4h18v16H3zM3 9h18M9 9v11' },
    { key: 'events', label: 'Events', d: 'M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8' },
  ];
  return '<nav class="dtl-nav">' + items.map(n => {
    const active = state.screen === n.key;
    return '<button type="button" class="dtl-nav-btn' + (active ? ' dtl-nav-btn--active' : '') + '" data-action="nav" data-key="' + n.key + '">' +
      '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="' + n.d + '"></path></svg>' +
      '<span>' + n.label + '</span>' +
    '</button>';
  }).join('') + '</nav>';
}

/* ============ SCREEN: EVENTS ============ */
function renderEvents() {
  const hasEvents = data.events.length > 0;
  return '' +
    '<div>' +
      '<div class="dtl-eyebrow-row"><span class="dtl-eyebrow-dash"></span><span class="dtl-eyebrow">Session log</span></div>' +
      '<h1 class="dtl-h1">Events</h1>' +
      '<p class="dtl-sub">Pick an event to keep logging, or start a new one.</p>' +
      '<button type="button" class="dtl-btn-primary dtl-btn-primary--lg" data-action="new-event">+ New event</button>' +
      (hasEvents ? '' +
        '<div class="dtl-events-label">Saved events</div>' +
        '<div class="dtl-events-list">' +
          data.events.map(ev => '' +
            '<div class="dtl-event-card">' +
              '<div class="dtl-event-row">' +
                '<button type="button" class="dtl-event-open" data-action="open-event" data-id="' + ev.id + '">' +
                  '<div class="dtl-event-name">' + esc(ev.driver) + '</div>' +
                  '<div class="dtl-event-meta">' + esc(ev.circuit) + ' · ' + fmtDate(ev.date) + '</div>' +
                  '<div class="dtl-event-tags">' +
                    '<span class="dtl-tag">' + ev.sessions.length + ' sessions</span>' +
                    '<span class="dtl-tag dtl-tag--muted">' + ev.setups.length + ' setups</span>' +
                  '</div>' +
                '</button>' +
                '<div class="dtl-event-actions">' +
                  '<button type="button" class="dtl-event-go" data-action="open-event" data-id="' + ev.id + '">→</button>' +
                  '<button type="button" class="dtl-event-delete" data-action="delete-event" data-id="' + ev.id + '">Delete</button>' +
                '</div>' +
              '</div>' +
            '</div>'
          ).join('') +
        '</div>'
      : '') +
    '</div>';
}

/* ============ SCREEN: MASTER ============ */
function renderMaster() {
  const hasEvents = data.events.length > 0;
  const m = state.masterDraft;
  return '' +
    '<div>' +
      (hasEvents ? '<button type="button" class="dtl-back-link" data-action="back-to-events">← Events</button>' : '') +
      '<div class="dtl-eyebrow-row"><span class="dtl-eyebrow-dash"></span><span class="dtl-eyebrow">Step 1 · Master data</span></div>' +
      '<h1 class="dtl-h1 dtl-h1--md">New event</h1>' +
      '<p class="dtl-sub">Saved once and attached to every session and setup you log.</p>' +
      '<div class="dtl-form">' +
        '<div>' +
          '<label class="dtl-label">Mechanic</label>' +
          '<input type="text" class="' + fieldClass('mechanic') + '" data-draft="masterDraft" name="mechanic" value="' + esc(m.mechanic) + '" placeholder="Your name">' +
        '</div>' +
        '<div>' +
          '<label class="dtl-label">Driver</label>' +
          '<input type="text" class="' + fieldClass('driver') + '" data-draft="masterDraft" name="driver" value="' + esc(m.driver) + '" placeholder="Driver name">' +
        '</div>' +
        '<div class="dtl-grid-2">' +
          '<div>' +
            '<label class="dtl-label">Date</label>' +
            '<input type="date" class="' + fieldClass('date') + '" data-draft="masterDraft" name="date" value="' + esc(m.date) + '">' +
          '</div>' +
          '<div>' +
            '<label class="dtl-label">Circuit</label>' +
            '<input type="text" class="' + fieldClass('circuit') + '" data-draft="masterDraft" name="circuit" value="' + esc(m.circuit) + '" placeholder="e.g. Genk">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="dtl-btn-primary" style="margin-top:26px;" data-action="save-master">Save &amp; continue →</button>' +
    '</div>';
}

/* ============ SCREEN: TIRE PRESSURES ============ */
function renderTires(ev) {
  const t = state.tireDraft;
  const editing = !!state.editingSessionId;
  const editSess = editing ? ev.sessions.find(s => s.id === state.editingSessionId) : null;
  const sessionNumber = editSess ? editSess.number : ev.nextSession;
  const curSetup = ev.setups[0] || null;

  const cornerGrid = (grid) => CORNER_META.map(c => {
    const val = t[grid][c.value];
    const errKey = grid + '_' + c.value;
    const errCls = state.err[errKey] ? ' dtl-corner-input--err' : '';
    return '' +
      '<div class="dtl-corner">' +
        '<div class="dtl-corner-head"><span class="dtl-corner-label">' + c.label + '</span><span class="dtl-corner-pos">' + c.pos + '</span></div>' +
        '<input type="number" inputmode="decimal" step="0.01" min="0" class="dtl-corner-input' + errCls + '" data-draft="tireDraft" data-grid="' + grid + '" data-corner="' + c.value + '" value="' + esc(val) + '" placeholder="0.00">' +
      '</div>';
  }).join('');

  const recentSessions = ev.sessions.slice().reverse();

  return '' +
    '<div>' +
      (editing ? '' +
        '<div class="dtl-edit-banner">' +
          '<span class="dtl-edit-label">✎ Correcting session ' + sessionNumber + '</span>' +
          '<button type="button" class="dtl-edit-cancel" data-action="cancel-edit">Cancel</button>' +
        '</div>'
      : '') +
      '<div class="dtl-session-head">' +
        '<h1 class="dtl-h1 dtl-h1--sm" style="margin-bottom:0;">Pressures</h1>' +
        '<div class="dtl-session-badge">' +
          '<span class="dtl-session-badge-label">Session</span>' +
          '<span class="dtl-session-badge-num">' + sessionNumber + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="dtl-sub--tight">' + esc(ev.driver) + ' · ' + esc(ev.circuit) + ' · ' + fmtDate(ev.date) + '</p>' +

      (curSetup ? '' +
        '<button type="button" class="dtl-setup-strip" data-action="nav" data-key="setup">' +
          '<span class="dtl-setup-strip-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 6h16M4 12h16M4 18h16"/></svg></span>' +
          '<span class="dtl-setup-strip-body">' +
            '<span class="dtl-setup-strip-meta">Running setup · ' + (fmtTime(curSetup.savedAt) ? 'Updated ' + fmtTime(curSetup.savedAt) : 'Current setup') + '</span>' +
            '<span class="dtl-setup-strip-label">' + esc(setupShort(curSetup)) + '</span>' +
          '</span>' +
          '<span class="dtl-setup-strip-change">Change ›</span>' +
        '</button>'
      : '' +
        '<button type="button" class="dtl-no-setup" data-action="new-setup">' +
          '<span class="dtl-no-setup-icon">🔧</span>' +
          '<span class="dtl-no-setup-text">No kart setup logged yet — <span>add today\'s setup</span></span>' +
          '<span class="dtl-no-setup-plus">＋</span>' +
        '</button>'
      ) +

      '<div class="dtl-section-label">Session type</div>' +
      chipRow('tireDraft', 'type', TYPE_OPTS, null, 'dtl-chip-row dtl-chip-row--tight') +

      '<div class="dtl-section-label">Track condition</div>' +
      chipRow('tireDraft', 'condition', COND_OPTS, 'dtl-chip--flex', 'dtl-chip-row--cond') +

      '<div class="dtl-rim-card">' +
        '<div>' +
          '<div class="dtl-rim-title">Rim temperature</div>' +
          '<div class="dtl-rim-sub">One reading per session</div>' +
        '</div>' +
        '<div class="dtl-rim-input-wrap">' +
          '<input type="number" inputmode="decimal" step="0.1" class="dtl-rim-input' + (state.err.rimTemp ? ' dtl-rim-input--err' : '') + '" data-draft="tireDraft" name="rimTemp" value="' + esc(t.rimTemp) + '" placeholder="0">' +
          '<span class="dtl-rim-unit">°C</span>' +
        '</div>' +
      '</div>' +

      '<div class="dtl-card">' +
        '<div class="dtl-card-head">' +
          '<span class="dtl-dot dtl-dot--cold"></span>' +
          '<span class="dtl-card-title">Cold pressures</span>' +
          '<span class="dtl-unit">bar</span>' +
        '</div>' +
        '<div class="dtl-corner-grid">' +
          cornerGrid('cold') +
          '<div class="dtl-kart-icon">' + KART_SVG + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="dtl-card">' +
        '<div class="dtl-card-head">' +
          '<span class="dtl-dot dtl-dot--hot"></span>' +
          '<span class="dtl-card-title">Hot pressures</span>' +
          '<span class="dtl-unit">bar</span>' +
        '</div>' +
        '<div class="dtl-corner-grid">' +
          cornerGrid('hot') +
          '<div class="dtl-kart-icon">' + KART_SVG + '</div>' +
        '</div>' +
      '</div>' +

      '<button type="button" class="dtl-btn-primary" data-action="save-tire">' + (editSess ? 'Update session ' + editSess.number : 'Save session ' + ev.nextSession) + ' →</button>' +

      (ev.sessions.length ? '' +
        '<div class="dtl-recent-head">' +
          '<span class="dtl-recent-label">This event</span>' +
          '<button type="button" class="dtl-compare-link" data-action="nav" data-key="review">Compare all →</button>' +
        '</div>' +
        '<div class="dtl-recent-scroll dtl-scroll">' +
          recentSessions.map(s => '' +
            '<div class="dtl-recent-card">' +
              '<div class="dtl-recent-card-top"><span class="dtl-recent-num">S' + s.number + '</span><span class="dtl-recent-cond">' + esc(s.condition) + '</span></div>' +
              '<div class="dtl-recent-type">' + esc(s.type) + '</div>' +
              '<div class="dtl-recent-values"><b class="c">C</b> ' + ['FL', 'FR', 'RL', 'RR'].map(k => esc(s.cold[k])).join(' / ') + '<br><b class="h">H</b> ' + ['FL', 'FR', 'RL', 'RR'].map(k => esc(s.hot[k])).join(' / ') + '</div>' +
            '</div>'
          ).join('') +
        '</div>'
      : '') +
    '</div>';
}

/* ============ SCREEN: KART SETUP ============ */
function renderSetup(ev) {
  const sd = state.setupDraft;
  const editing = !!state.editingSetupId;

  return '' +
    '<div>' +
      (editing ? '' +
        '<div class="dtl-edit-banner">' +
          '<span class="dtl-edit-label">✎ Correcting saved setup</span>' +
          '<button type="button" class="dtl-edit-cancel" data-action="cancel-edit">Cancel</button>' +
        '</div>'
      : '') +
      '<h1 class="dtl-h1 dtl-h1--sm">Kart setup</h1>' +
      '<p class="dtl-sub--tighter">' + esc(ev.driver) + ' · ' + esc(ev.circuit) + '</p>' +

      '<div class="dtl-section-label">Category</div>' +
      chipRow('setupDraft', 'category', CAT_OPTS, null, 'dtl-chip-row dtl-chip-row--tight') +
      (sd.category === 'Other' ? '<input type="text" class="' + fieldClass('categoryOther') + ' dtl-field--mb" data-draft="setupDraft" name="categoryOther" value="' + esc(sd.categoryOther) + '" placeholder="Specify category">' : '') +
      '<div class="dtl-spacer"></div>' +

      '<div class="dtl-setup-card">' +
        '<div class="dtl-setup-card-title">Engine</div>' +
        '<div class="dtl-setup-card-body">' +
          '<div>' +
            '<label class="dtl-label dtl-label--tight">Engine (name / number)</label>' +
            '<input type="text" class="' + fieldClass('engine') + '" data-draft="setupDraft" name="engine" value="' + esc(sd.engine) + '" placeholder="e.g. Rotax #284">' +
          '</div>' +
          '<div>' +
            '<label class="dtl-label dtl-label--tight">Gearing</label>' +
            chipRow('setupDraft', 'gearing', GEAR_OPTS, null, 'dtl-chip-row--flex') +
            (sd.gearing === 'Other' ? '<input type="text" class="' + fieldClass('gearingOther') + ' dtl-field--mt" data-draft="setupDraft" name="gearingOther" value="' + esc(sd.gearingOther) + '" placeholder="Specify gearing">' : '') +
          '</div>' +
          '<div class="dtl-grid-2">' +
            '<div>' +
              '<label class="dtl-label dtl-label--tight">Sprocket teeth</label>' +
              '<input type="number" inputmode="numeric" class="' + fieldClass('sprocket') + '" data-draft="setupDraft" name="sprocket" value="' + esc(sd.sprocket) + '" placeholder="e.g. 78">' +
            '</div>' +
            '<div>' +
              '<label class="dtl-label dtl-label--tight">Carburator</label>' +
              '<input type="text" class="' + fieldClass('carb') + '" data-draft="setupDraft" name="carb" value="' + esc(sd.carb) + '" placeholder="e.g. Dell\'Orto">' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="dtl-label dtl-label--tight">Exhaust</label>' +
            '<input type="text" class="' + fieldClass('exhaust') + '" data-draft="setupDraft" name="exhaust" value="' + esc(sd.exhaust) + '" placeholder="Exhaust spec">' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="dtl-setup-card">' +
        '<div class="dtl-setup-card-title">Back End</div>' +
        '<div class="dtl-setup-card-body">' +
          '<div>' +
            '<label class="dtl-label dtl-label--tight">Ride height rear</label>' +
            chipRow('setupDraft', 'rideRear', RIDE_OPTS, 'dtl-chip--flex', 'dtl-chip-row--flex') +
          '</div>' +
          '<div class="dtl-grid-2">' +
            '<div>' +
              '<label class="dtl-label dtl-label--tight">Rear width (mm)</label>' +
              '<input type="number" inputmode="decimal" step="0.1" class="' + fieldClass('rearWidth') + '" data-draft="setupDraft" name="rearWidth" value="' + esc(sd.rearWidth) + '" placeholder="e.g. 1390">' +
            '</div>' +
            '<div>' +
              '<label class="dtl-label dtl-label--tight">Axle</label>' +
              '<input type="text" class="' + fieldClass('axle') + '" data-draft="setupDraft" name="axle" value="' + esc(sd.axle) + '" placeholder="e.g. Type N">' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="dtl-label dtl-label--tight">Axle length</label>' +
            '<input type="text" class="' + fieldClass('axleLength') + '" data-draft="setupDraft" name="axleLength" value="' + esc(sd.axleLength) + '" placeholder="e.g. 1040 mm">' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="dtl-setup-card dtl-setup-card--last">' +
        '<div class="dtl-setup-card-title">Front end</div>' +
        '<div class="dtl-setup-card-body">' +
          '<div>' +
            '<label class="dtl-label dtl-label--tight">Ride height front</label>' +
            chipRow('setupDraft', 'rideFront', RIDE_OPTS, 'dtl-chip--flex', 'dtl-chip-row--flex') +
          '</div>' +
          '<div>' +
            '<label class="dtl-label dtl-label--tight">Front width — rings</label>' +
            chipRow('setupDraft', 'frontRings', RING_OPTS, 'dtl-chip--ring', 'dtl-ring-row') +
          '</div>' +
          '<div>' +
            '<label class="dtl-label dtl-label--tight">Caster</label>' +
            chipRow('setupDraft', 'caster', CASTER_OPTS, null, 'dtl-chip-row dtl-chip-row--tight') +
            (sd.caster === 'Special' ? '<input type="text" class="' + fieldClass('casterOther') + ' dtl-field--mt" data-draft="setupDraft" name="casterOther" value="' + esc(sd.casterOther) + '" placeholder="Specify caster">' : '') +
          '</div>' +
          '<div>' +
            '<label class="dtl-label dtl-label--tight">Front bar</label>' +
            chipRow('setupDraft', 'frontBar', BAR_OPTS, null, 'dtl-chip-row dtl-chip-row--tight') +
            (sd.frontBar === 'Other' ? '<input type="text" class="' + fieldClass('frontBarOther') + ' dtl-field--mt" data-draft="setupDraft" name="frontBarOther" value="' + esc(sd.frontBarOther) + '" placeholder="Specify front bar">' : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      '<button type="button" class="dtl-btn-primary" data-action="save-setup">Save kart setup →</button>' +
    '</div>';
}

/* ============ SCREEN: REVIEW ============ */
const REVIEW_ROW_DEFS = [
  { label: 'Type', get: x => x.type, color: 'var(--muted)' },
  { label: 'Track', get: x => x.condition, color: 'var(--muted)' },
  { label: 'Setup', get: x => x.setupLabel || '—', color: 'var(--blue)' },
  { label: 'Cold FL', get: x => x.cold.FL, color: '#5BC0FF' },
  { label: 'Cold FR', get: x => x.cold.FR, color: '#5BC0FF' },
  { label: 'Cold RL', get: x => x.cold.RL, color: '#5BC0FF' },
  { label: 'Cold RR', get: x => x.cold.RR, color: '#5BC0FF' },
  { label: 'Hot FL', get: x => x.hot.FL, color: '#FF7A4D' },
  { label: 'Hot FR', get: x => x.hot.FR, color: '#FF7A4D' },
  { label: 'Hot RL', get: x => x.hot.RL, color: '#FF7A4D' },
  { label: 'Hot RR', get: x => x.hot.RR, color: '#FF7A4D' },
  { label: 'Rim °C', get: x => x.rimTemp, color: 'var(--accent)' },
];

function renderTyreTable(ev) {
  const sessions = ev.sessions;
  return '' +
    '<div class="dtl-table-wrap dtl-scroll">' +
      '<table class="dtl-table">' +
        '<thead><tr>' +
          '<th>Session</th>' +
          sessions.map(se => '' +
            '<th>' +
              '<div class="dtl-col-num">S' + se.number + '</div>' +
              '<div class="dtl-col-short">' + esc(se.type) + ' · ' + esc(se.condition) + '</div>' +
              '<button type="button" class="dtl-col-edit" data-action="edit-session" data-id="' + se.id + '">Edit</button>' +
            '</th>'
          ).join('') +
        '</tr></thead>' +
        '<tbody>' +
          REVIEW_ROW_DEFS.map(r => '' +
            '<tr>' +
              '<th style="color:' + r.color + ';">' + r.label + '</th>' +
              sessions.map(se => '<td>' + esc(r.get(se)) + '</td>').join('') +
            '</tr>'
          ).join('') +
        '</tbody>' +
      '</table>' +
    '</div>' +
    '<p class="dtl-table-note">Swipe the table sideways to compare every session · <span class="c">cold</span> / <span class="h">hot</span> in bar.</p>';
}

const SETUP_ROW_DEFS = [
  { label: 'Category', get: st => dispOther(st.category, st.categoryOther) },
  { label: 'Engine', get: st => st.engine },
  { label: 'Gearing', get: st => dispOther(st.gearing, st.gearingOther) },
  { label: 'Sprocket', get: st => st.sprocket },
  { label: 'Carb', get: st => st.carb },
  { label: 'Exhaust', get: st => st.exhaust },
  { label: 'Ride rear', get: st => st.rideRear },
  { label: 'Rear width', get: st => st.rearWidth },
  { label: 'Axle', get: st => st.axle },
  { label: 'Axle length', get: st => st.axleLength },
  { label: 'Ride front', get: st => st.rideFront },
  { label: 'Front rings', get: st => st.frontRings },
  { label: 'Caster', get: st => (st.caster === 'Special' ? (st.casterOther || 'Special') : st.caster) },
  { label: 'Front bar', get: st => dispOther(st.frontBar, st.frontBarOther) },
];

function renderSetupCards(ev) {
  return '<div class="dtl-review-setups">' + ev.setups.map((st, i) => {
    const rows = SETUP_ROW_DEFS.map(r => ({ label: r.label, value: r.get(st) })).filter(r => String(r.value).trim() !== '');
    const title = dispOther(st.category, st.categoryOther) || 'Setup';
    return '' +
      '<div class="dtl-review-setup-card">' +
        '<div class="dtl-review-setup-head">' +
          '<span class="dtl-review-setup-title-group">' +
            '<span class="dtl-review-setup-title">' + esc(title) + '</span>' +
            (i === 0 ? '<span class="dtl-current-badge">Current</span>' : '') +
            '<span class="dtl-review-setup-time">' + fmtTime(st.savedAt) + '</span>' +
          '</span>' +
          '<span class="dtl-review-setup-actions">' +
            '<button type="button" class="dtl-edit-btn" data-action="edit-setup" data-id="' + st.id + '">Edit</button>' +
            '<button type="button" class="dtl-delete-btn" data-action="delete-setup" data-id="' + st.id + '">Delete</button>' +
          '</span>' +
        '</div>' +
        '<div class="dtl-review-setup-grid">' +
          rows.map(r => '<div class="dtl-review-setup-cell"><div class="dtl-review-setup-cell-label">' + esc(r.label) + '</div><div class="dtl-review-setup-cell-value">' + esc(r.value) + '</div></div>').join('') +
        '</div>' +
      '</div>';
  }).join('') + '</div>';
}

function renderReview(ev) {
  const sessions = ev.sessions;
  const setups = ev.setups;
  const tab = state.reviewTab;

  return '' +
    '<div>' +
      '<h1 class="dtl-h1 dtl-h1--sm" style="margin-bottom:14px;">Review</h1>' +
      '<div class="dtl-tabs">' +
        '<button type="button" class="dtl-tab' + (tab === 'tires' ? ' dtl-tab--active' : '') + '" data-action="review-tab" data-tab="tires">Pressures · ' + sessions.length + '</button>' +
        '<button type="button" class="dtl-tab' + (tab === 'setups' ? ' dtl-tab--active' : '') + '" data-action="review-tab" data-tab="setups">Setups · ' + setups.length + '</button>' +
      '</div>' +

      (tab === 'tires' ? (
        sessions.length ? '' +
          '<div class="dtl-export-row"><button type="button" class="dtl-export-btn" data-action="export-tyres"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"></path></svg>Export to Excel</button></div>' +
          renderTyreTable(ev)
        : '' +
          '<div class="dtl-empty">' +
            '<div class="dtl-empty-title">No sessions yet</div>' +
            '<button type="button" class="dtl-empty-btn" data-action="nav" data-key="tires">Log pressures →</button>' +
          '</div>'
      ) : (
        setups.length ? '' +
          '<div class="dtl-export-row"><button type="button" class="dtl-export-btn" data-action="export-setups"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"></path></svg>Export to Excel</button></div>' +
          renderSetupCards(ev)
        : '' +
          '<div class="dtl-empty">' +
            '<div class="dtl-empty-title">No setups yet</div>' +
            '<button type="button" class="dtl-empty-btn" data-action="nav" data-key="setup">Add setup →</button>' +
          '</div>'
      )) +
    '</div>';
}

/* ============ MAIN RENDER ============ */
function renderScreen() {
  const ev = activeEvent();
  if (state.screen === 'master') return renderMaster();
  if (state.screen === 'tires' && ev) return renderTires(ev);
  if (state.screen === 'setup' && ev) return renderSetup(ev);
  if (state.screen === 'review' && ev) return renderReview(ev);
  return renderEvents();
}

function render() {
  const root = document.getElementById('dtl-app');
  root.innerHTML = '' +
    '<div class="dtl-root" data-theme="' + data.theme + '">' +
      '<div class="dtl-texture"></div>' +
      '<div class="dtl-frame">' +
        renderHeader() +
        '<main class="dtl-main">' + renderScreen() + '</main>' +
        renderNav() +
      '</div>' +
    '</div>';
}

/* ============ HANDLERS: NAVIGATION ============ */
function onLogoHome() { state.screen = 'events'; render(); }
function onNewEvent() { state.screen = 'master'; state.masterDraft = blankMaster(); state.err = {}; render(); }
function onBackToEvents() { state.screen = 'events'; render(); }
function onOpenEvent(id) { data.activeId = id; persist(); state.screen = 'tires'; render(); }
function onDeleteEvent(id) {
  data.events = data.events.filter(e => e.id !== id);
  if (data.activeId === id) data.activeId = null;
  persist(); render();
}
function onNewSetup() { state.screen = 'setup'; state.setupDraft = blankSetup(); state.err = {}; render(); }
function onNav(key) {
  if (key === 'events') { state.screen = 'events'; render(); return; }
  if (key === 'setup') {
    const ev = activeEvent();
    const draft = state.setupDraft;
    const empty = !draft.category && !draft.engine && !draft.gearing && !draft.frontRings;
    if (empty && ev && ev.setups.length) {
      const l = ev.setups[0];
      state.setupDraft = {
        category: l.category, categoryOther: l.categoryOther, engine: l.engine, gearing: l.gearing,
        gearingOther: l.gearingOther, sprocket: l.sprocket, carb: l.carb, exhaust: l.exhaust,
        rideRear: l.rideRear, rearWidth: l.rearWidth, axle: l.axle, axleLength: l.axleLength,
        rideFront: l.rideFront, frontRings: l.frontRings, caster: l.caster, casterOther: l.casterOther, frontBar: l.frontBar, frontBarOther: l.frontBarOther,
      };
    }
    state.screen = 'setup'; state.err = {}; render();
    return;
  }
  state.screen = key; render();
}

/* ============ HANDLERS: EDIT / CANCEL ============ */
function onEditSession(id) {
  const ev = activeEvent(); if (!ev) return;
  const se = ev.sessions.find(x => x.id === id); if (!se) return;
  state.screen = 'tires'; state.editingSessionId = id; state.err = {};
  state.tireDraft = { type: se.type, condition: se.condition, cold: { ...se.cold }, hot: { ...se.hot }, rimTemp: se.rimTemp };
  render();
}
function onEditSetup(id) {
  const ev = activeEvent(); if (!ev) return;
  const st = ev.setups.find(x => x.id === id); if (!st) return;
  const { id: _i, savedAt: _s, ...fields } = st;
  state.screen = 'setup'; state.editingSetupId = id; state.err = {};
  state.setupDraft = { ...blankSetup(), ...fields };
  render();
}
function onCancelEdit() {
  const wasSetup = !!state.editingSetupId;
  state.screen = 'review'; state.editingSessionId = null; state.editingSetupId = null; state.err = {};
  state.reviewTab = wasSetup ? 'setups' : 'tires';
  state.tireDraft = blankTire(null); state.setupDraft = blankSetup();
  render();
}

/* ============ HANDLERS: INPUT ============ */
function onDraftInput(el) {
  const draft = el.dataset.draft;
  const name = el.name;
  state[draft][name] = el.value;
  if (state.err[name]) {
    delete state.err[name];
    el.classList.remove('dtl-field--err', 'dtl-rim-input--err');
  }
}
function onTireCorner(el) {
  const grid = el.dataset.grid;
  const corner = el.dataset.corner;
  state.tireDraft[grid][corner] = el.value;
  const key = grid + '_' + corner;
  if (state.err[key]) {
    delete state.err[key];
    el.classList.remove('dtl-corner-input--err');
  }
}
function onChoice(draft, field, value) {
  state[draft][field] = value;
  delete state.err[field];
  render();
}

/* ============ HANDLERS: SAVES ============ */
function onSaveMaster() {
  const m = state.masterDraft;
  const err = {};
  ['mechanic', 'driver', 'date', 'circuit'].forEach(k => { if (!String(m[k]).trim()) err[k] = true; });
  if (Object.keys(err).length) { state.err = err; render(); flashToast('Fill in all master fields', '⚠', 'err'); return; }
  const id = 'ev' + Date.now();
  const ev = { id, ...m, sessions: [], setups: [], nextSession: 1 };
  data.events = [ev, ...data.events];
  data.activeId = id;
  persist();
  state.screen = 'tires'; state.err = {};
  render();
  flashToast('Event saved', '🏁');
}

function onSaveTire() {
  const ev = activeEvent(); if (!ev) return;
  const t = state.tireDraft;
  const err = {};
  ['FL', 'FR', 'RL', 'RR'].forEach(c => {
    if (!String(t.cold[c]).trim()) err['cold_' + c] = true;
    if (!String(t.hot[c]).trim()) err['hot_' + c] = true;
  });
  if (!String(t.rimTemp).trim()) err.rimTemp = true;
  if (Object.keys(err).length) { state.err = err; render(); flashToast('Complete all 8 corners + rim temp', '⚠', 'err'); return; }

  if (state.editingSessionId) {
    const eid = state.editingSessionId;
    const se = ev.sessions.find(x => x.id === eid);
    let num = '';
    if (se) {
      se.type = t.type; se.condition = t.condition; se.cold = { ...t.cold }; se.hot = { ...t.hot }; se.rimTemp = t.rimTemp;
      num = se.number;
    }
    persist();
    state.editingSessionId = null; state.err = {}; state.screen = 'review'; state.reviewTab = 'tires'; state.tireDraft = blankTire(null);
    render();
    flashToast('Session ' + num + ' updated', '✓');
    return;
  }

  const num = ev.nextSession;
  const curSetup = ev.setups[0] || null;
  const session = {
    id: 's' + Date.now(), number: num, type: t.type, condition: t.condition,
    cold: { ...t.cold }, hot: { ...t.hot }, rimTemp: t.rimTemp, savedAt: Date.now(),
    setupId: curSetup ? curSetup.id : null, setupLabel: curSetup ? setupShort(curSetup) : '',
  };
  ev.sessions.push(session);
  ev.nextSession += 1;
  persist();
  state.tireDraft = blankTire(state.tireDraft); state.err = {};
  render();
  flashToast('Session ' + num + ' saved', '✓');
}

function onSaveSetup() {
  const ev = activeEvent(); if (!ev) return;
  const st = state.setupDraft;
  const req = ['category', 'engine', 'gearing', 'sprocket', 'carb', 'exhaust', 'rideRear', 'rearWidth', 'axle', 'axleLength', 'rideFront', 'frontRings', 'caster', 'frontBar'];
  const err = {};
  req.forEach(k => { if (!String(st[k]).trim()) err[k] = true; });
  if (st.category === 'Other' && !String(st.categoryOther).trim()) err.categoryOther = true;
  if (st.gearing === 'Other' && !String(st.gearingOther).trim()) err.gearingOther = true;
  if (st.caster === 'Special' && !String(st.casterOther).trim()) err.casterOther = true;
  if (st.frontBar === 'Other' && !String(st.frontBarOther).trim()) err.frontBarOther = true;
  if (Object.keys(err).length) { state.err = err; render(); flashToast('Fill in all setup fields', '⚠', 'err'); return; }

  if (state.editingSetupId) {
    const eid = state.editingSetupId;
    const existing = ev.setups.find(x => x.id === eid);
    if (existing) Object.assign(existing, st);
    persist();
    state.editingSetupId = null; state.setupDraft = blankSetup(); state.err = {}; state.screen = 'review'; state.reviewTab = 'setups';
    render();
    flashToast('Setup corrected', '✓');
    return;
  }

  const isFirst = ev.setups.length === 0;
  const setup = { id: 'st' + Date.now(), ...st, savedAt: Date.now() };
  ev.setups = [setup, ...ev.setups];
  persist();
  state.setupDraft = blankSetup(); state.err = {}; state.screen = 'tires';
  render();
  flashToast(isFirst ? 'Setup saved — now logging pressures' : 'Setup updated', '🔧');
}

function onDeleteSetup(id) {
  const ev = activeEvent(); if (!ev) return;
  ev.setups = ev.setups.filter(s => s.id !== id);
  persist(); render();
}

/* ============ EXCEL EXPORT ============ */
function numVal(v) { const n = parseFloat(v); return (v !== '' && v != null && !isNaN(n)) ? n : (v || ''); }
function safeName(s) { return String(s || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''); }
function exportName(ev, kind) { return 'DRT_' + safeName(ev.driver) + '_' + safeName(ev.circuit) + '_' + kind; }
function exportRows(rows, sheetName, filename) {
  if (window.XLSX) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename + '.xlsx');
  } else {
    const csv = rows.map(r => r.map(c => {
      const v = c == null ? '' : String(c);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
}
function onExportTyres() {
  const ev = activeEvent();
  if (!ev || !ev.sessions.length) { flashToast('No sessions to export', '⚠', 'err'); return; }
  const rows = [['Date', 'Circuit', 'Driver', 'Mechanic', 'Session', 'Type', 'Track', 'Setup', 'Cold FL', 'Cold FR', 'Cold RL', 'Cold RR', 'Hot FL', 'Hot FR', 'Hot RL', 'Hot RR', 'Rim °C', 'Logged']];
  ev.sessions.forEach(se => rows.push([
    fmtDate(ev.date), ev.circuit, ev.driver, ev.mechanic, se.number, se.type, se.condition, se.setupLabel || '',
    numVal(se.cold.FL), numVal(se.cold.FR), numVal(se.cold.RL), numVal(se.cold.RR),
    numVal(se.hot.FL), numVal(se.hot.FR), numVal(se.hot.RL), numVal(se.hot.RR),
    numVal(se.rimTemp), fmtTime(se.savedAt),
  ]));
  exportRows(rows, 'Tire pressures', exportName(ev, 'pressures'));
  flashToast('Exported ' + ev.sessions.length + ' session' + (ev.sessions.length > 1 ? 's' : ''), '📄');
}
function onExportSetups() {
  const ev = activeEvent();
  if (!ev || !ev.setups.length) { flashToast('No setups to export', '⚠', 'err'); return; }
  const rows = [['Date', 'Circuit', 'Driver', 'Mechanic', 'Logged', 'Category', 'Engine', 'Gearing', 'Sprocket teeth', 'Carburator', 'Exhaust', 'Ride height rear', 'Rear width', 'Axle', 'Axle length', 'Ride height front', 'Front rings', 'Caster', 'Front bar']];
  ev.setups.slice().reverse().forEach(st => rows.push([
    fmtDate(ev.date), ev.circuit, ev.driver, ev.mechanic, fmtTime(st.savedAt),
    dispOther(st.category, st.categoryOther), st.engine, dispOther(st.gearing, st.gearingOther), numVal(st.sprocket),
    st.carb, st.exhaust, st.rideRear, numVal(st.rearWidth), st.axle, st.axleLength, st.rideFront,
    numVal(st.frontRings), (st.caster === 'Special' ? (st.casterOther || 'Special') : st.caster), dispOther(st.frontBar, st.frontBarOther),
  ]));
  exportRows(rows, 'Kart setups', exportName(ev, 'setup'));
  flashToast('Exported ' + ev.setups.length + ' setup' + (ev.setups.length > 1 ? 's' : ''), '📄');
}

/* ============ EVENT DELEGATION ============ */
const appRoot = document.getElementById('dtl-app');

appRoot.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  switch (action) {
    case 'logo-home': onLogoHome(); break;
    case 'new-event': onNewEvent(); break;
    case 'open-event': onOpenEvent(btn.dataset.id); break;
    case 'delete-event': onDeleteEvent(btn.dataset.id); break;
    case 'back-to-events': onBackToEvents(); break;
    case 'save-master': onSaveMaster(); break;
    case 'nav': onNav(btn.dataset.key); break;
    case 'choice': onChoice(btn.dataset.draft, btn.dataset.field, btn.dataset.value); break;
    case 'save-tire': onSaveTire(); break;
    case 'cancel-edit': onCancelEdit(); break;
    case 'new-setup': onNewSetup(); break;
    case 'save-setup': onSaveSetup(); break;
    case 'edit-session': onEditSession(btn.dataset.id); break;
    case 'edit-setup': onEditSetup(btn.dataset.id); break;
    case 'delete-setup': onDeleteSetup(btn.dataset.id); break;
    case 'review-tab': state.reviewTab = btn.dataset.tab; render(); break;
    case 'export-tyres': onExportTyres(); break;
    case 'export-setups': onExportSetups(); break;
  }
});

appRoot.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.grid) { onTireCorner(el); return; }
  if (el.dataset.draft) { onDraftInput(el); return; }
});

/* ============ INIT ============ */
render();
