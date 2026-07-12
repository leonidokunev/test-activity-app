/* ============================================================
   Goals — prototype logic (vanilla JS)
   ============================================================ */
'use strict';

const STORAGE_KEY = 'goals_proto_v1';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- status bars are intentionally hidden to maximize content space ---------- */

/* ---------- state ---------- */
function loadState(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
  catch { return null; }
}
function saveState(state){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
let state = loadState(); // {goals:[...]} or null

/* ---------- month helper ---------- */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function monthLabel(iso){
  if(!iso) return 'Mar 2026';
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/* ---------- mock goals (cards 2 & 3) ---------- */
function mockGoals(){
  return [
    { title:'Meditation', color:'var(--card-2)', hex:'#132848', target:16, completed:5,
      startDate:'2026-03-01', endDate:'2026-03-31', thisWeek:40, prevWeek:25 },
    { title:'Stretching', color:'var(--card-3)', hex:'#44515D', target:20, completed:13,
      startDate:'2026-03-01', endDate:'2026-03-31', thisWeek:60, prevWeek:45 },
  ];
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function show(id){
  $$('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if(el) el.classList.add('active');
  // reset scroll positions
  $$('.detail-body, .settings-body, .create-body').forEach(b => b.scrollTop = 0);
}

/* generic [data-nav] buttons */
$$('[data-nav]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const dest = btn.getAttribute('data-nav');
    if(dest === 'main') openMain();
    else if(dest === 'create') show('screen-create');
    else show('screen-' + dest);
  });
});

/* splash → Apple Health (tap anywhere) */
$('#screen-splash').addEventListener('click', openHealth);

/* main header buttons */
$('#btn-settings').addEventListener('click', ()=> show('screen-settings'));
$('#btn-add').addEventListener('click', ()=> show('screen-create'));

/* ============================================================
   MAIN SCREEN
   ============================================================ */
function openMain(){
  renderMain();
  show('screen-main');
}

function visibleGoals(){
  return (state && state.goals ? state.goals : []).filter(g => !g.archived);
}
function renderMain(){
  const has = visibleGoals().length > 0;
  $('#main-empty').hidden = has;
  $('#carousel-wrap').hidden = !has;
  if(has) buildCarousel(state.goals);
}

function ringSVG(pct){
  const total = 60, green = Math.round(pct/100*total);
  const cx = 140, cy = 140, rO = 122, rI = 104;
  let out = '';
  for(let i=0;i<total;i++){
    const a = (-90 + i*(360/total)) * Math.PI/180;
    const x1 = cx+Math.cos(a)*rO, y1 = cy+Math.sin(a)*rO;
    const x2 = cx+Math.cos(a)*rI, y2 = cy+Math.sin(a)*rI;
    const on = i < green;
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" `+
           `stroke="${on?'#49F036':'rgba(214,222,235,.45)'}" stroke-width="3" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 280 280">${out}</svg>`;
}

function buildCarousel(goals){
  const car = $('#carousel');
  const vis = goals.map((g,i)=>({g,i})).filter(o => !o.g.archived);
  car.innerHTML = vis.map(({g,i})=>{
    const pct = Math.round(g.completed/g.target*100);
    const remaining = Math.max(0, g.target - g.completed);
    return `
    <div class="goal-card" data-idx="${i}">
      <div class="goal-card-inner" style="background:${g.hex}">
        <div class="gc-top">
          <div>
            <div class="gc-title">${escapeHtml(g.title)}</div>
            <div class="gc-month">${monthLabel(g.startDate)}</div>
          </div>
          <div class="gc-arrow">
            <svg width="12" height="18" viewBox="0 0 12 18"><path d="M2 2l7 7-7 7" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>
        <div class="gc-ring">
          ${ringSVG(pct)}
          <div class="gc-ring-label"><span class="gc-ring-num">${pct}</span><span class="gc-ring-sym">%</span></div>
        </div>
        <div class="gc-remaining">${remaining}/${g.target} remaining</div>
      </div>
    </div>`;
  }).join('');

  // dots
  const dots = $('#dots');
  dots.innerHTML = vis.map((_,i)=>`<span class="dot${i===0?' active':''}"></span>`).join('');

  // card tap → detail
  $$('.goal-card', car).forEach(c=>{
    c.addEventListener('click', ()=> openDetail(+c.dataset.idx));
  });

  // scroll → sync dots
  let raf;
  car.addEventListener('scroll', ()=>{
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(()=>{
      const idx = Math.round(car.scrollLeft / car.clientWidth);
      $$('.dot', dots).forEach((d,i)=> d.classList.toggle('active', i===idx));
    });
  });

  enableDrag(car);
  car.scrollLeft = 0;
}

/* mouse drag-to-scroll for desktop */
function enableDrag(el){
  let down=false, startX=0, startScroll=0, moved=false;
  el.addEventListener('mousedown', e=>{ down=true; moved=false; startX=e.pageX; startScroll=el.scrollLeft; el.style.cursor='grabbing'; });
  window.addEventListener('mouseup', ()=>{ down=false; el.style.cursor=''; setTimeout(()=>moved=false,0); });
  window.addEventListener('mousemove', e=>{
    if(!down) return;
    const dx = e.pageX - startX;
    if(Math.abs(dx)>4) moved=true;
    el.scrollLeft = startScroll - dx;
  });
  // prevent click→detail when dragging
  el.addEventListener('click', e=>{ if(moved){ e.stopPropagation(); e.preventDefault(); } }, true);
}

/* ============================================================
   GOAL DETAIL
   ============================================================ */
let currentDetailIdx = null;

function openDetail(idx){
  const g = state.goals[idx];
  if(!g) return;
  currentDetailIdx = idx;
  const pct = Math.round(g.completed/g.target*100);

  $('#d-title').textContent   = g.title;
  $('#d-month').textContent   = monthLabel(g.startDate);
  $('#d-month2').textContent  = monthLabel(g.startDate);
  $('#d-pct').textContent     = pct;
  $('#d-thisweek').textContent= g.thisWeek;
  $('#d-prevweek').textContent= g.prevWeek;
  $('#d-ttpct').textContent   = pct;
  $('#d-sessions').textContent= `${g.completed} sessions`;

  // dotlines
  $$('.dotline').forEach(dl=>{
    dl.style.setProperty('--p', dl.dataset.pct + '%');
  });
  $$('.dotline')[0].style.setProperty('--p', g.thisWeek + '%');
  $$('.dotline')[1].style.setProperty('--p', g.prevWeek + '%');

  buildMiniBars(pct);
  buildBigChart(pct);

  $('#d-tooltip').classList.remove('hidden');
  $('#more-menu').classList.add('hidden');
  show('screen-detail');
}

/* uniform progress-bar: all bars same height, filled white + green marker + faint rest */
function buildMiniBars(pct){
  const n = 24;
  const active = Math.round(pct/100*n);
  let html='';
  for(let i=0;i<n;i++){
    let cls='';
    if(i < active) cls='';        // completed (white)
    else if(i === active) cls='g';// current marker (green)
    else cls='dim';               // remaining (faint)
    html += `<i class="${cls}"></i>`;
  }
  $('#d-minibars').innerHTML = html;
}

/* cumulative progress over time: x = time, y = sessions, monotonically increasing */
function buildBigChart(pct){
  const n = 40;
  const active = Math.max(1, Math.round(pct/100*n));
  let html='';
  for(let i=0;i<n;i++){
    let h, cls='';
    if(i < active){
      // ascending from ~20% up to ~90% across elapsed time
      h = 20 + (active > 1 ? (i/(active-1)) : 1) * 68;
      if(i === active-1) cls='g';   // latest session highlighted
    } else {
      h = 12; cls='dim';            // future days, flat & faint
    }
    html += `<i class="${cls}" style="height:${h.toFixed(1)}%"></i>`;
  }
  $('#d-barchart').innerHTML = html;
}

/* tooltip close */
$('.tt-close').addEventListener('click', ()=> $('#d-tooltip').classList.add('hidden'));

/* ⋮ dropdown: archive / delete */
const moreBtn = $('#btn-more');
const moreMenu = $('#more-menu');
moreBtn.addEventListener('click', e=>{
  e.stopPropagation();
  moreMenu.classList.toggle('hidden');
});
document.addEventListener('click', e=>{
  if(!moreMenu.classList.contains('hidden') &&
     !moreMenu.contains(e.target) && !moreBtn.contains(e.target)){
    moreMenu.classList.add('hidden');
  }
});
$$('.dd-item', moreMenu).forEach(item=>{
  item.addEventListener('click', ()=>{
    const act = item.dataset.action;
    if(currentDetailIdx != null && state && state.goals[currentDetailIdx]){
      if(act === 'delete') state.goals.splice(currentDetailIdx, 1);
      else if(act === 'archive') state.goals[currentDetailIdx].archived = true;
      saveState(state);
    }
    moreMenu.classList.add('hidden');
    openMain();
  });
});

/* ============================================================
   CREATE GOAL
   ============================================================ */
const RULER = {
  min:0, max:60, step:1, tickW:16, value:30,
  el:null, track:null, dragging:false, startX:0, startTx:0, tx:0
};

function buildRuler(){
  RULER.el = $('#ruler');
  RULER.track = $('#ruler-track');
  let ticks='';
  for(let v=RULER.min; v<=RULER.max; v++){
    const major = v % 5 === 0;
    ticks += `<span class="ruler-tick${major?' major':''}"><i></i></span>`;
  }
  RULER.track.innerHTML = ticks;
  positionRuler();
  attachRuler();
}
function centerX(){ return RULER.el.clientWidth / 2; }
function txForValue(v){ return centerX() - v*RULER.tickW - RULER.tickW/2; }
function valueForTx(tx){ return (centerX() - RULER.tickW/2 - tx) / RULER.tickW; }
function positionRuler(){
  RULER.tx = txForValue(RULER.value);
  RULER.track.style.transform = `translateY(-50%) translateX(${RULER.tx}px)`;
  $('#value-num').textContent = RULER.value;
}
function attachRuler(){
  const el = RULER.el;
  const start = x=>{ RULER.dragging=true; RULER.startX=x; RULER.startTx=RULER.tx; };
  const move = x=>{
    if(!RULER.dragging) return;
    let tx = RULER.startTx + (x - RULER.startX);
    let v = Math.round(valueForTx(tx));
    v = Math.max(RULER.min, Math.min(RULER.max, v));
    RULER.value = v;
    RULER.tx = tx;
    RULER.track.style.transform = `translateY(-50%) translateX(${tx}px)`;
    $('#value-num').textContent = v;
  };
  const end = ()=>{ if(!RULER.dragging) return; RULER.dragging=false; positionRuler(); };

  el.addEventListener('pointerdown', e=>{ el.setPointerCapture(e.pointerId); start(e.clientX); });
  el.addEventListener('pointermove', e=> move(e.clientX));
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/* target sessions dropdown */
const targetVal = $('#target-val');
const targetMenu = $('#target-menu');
targetMenu.innerHTML = Array.from({ length: 30 }, (_, i) => {
  const value = i + 1;
  return `<button class="target-option${value === 12 ? ' active' : ''}" type="button" role="option" data-target="${value}">${value}</button>`;
}).join('');
targetVal.addEventListener('click', e=>{
  e.stopPropagation();
  const isOpen = !targetMenu.classList.toggle('hidden');
  targetVal.setAttribute('aria-expanded', String(isOpen));
});
$$('.target-option', targetMenu).forEach(item=>{
  item.addEventListener('click', ()=>{
    $('#target-num').textContent = item.dataset.target;
    $$('.target-option', targetMenu).forEach(option => option.classList.toggle('active', option === item));
    targetMenu.classList.add('hidden');
    targetVal.setAttribute('aria-expanded', 'false');
  });
});
document.addEventListener('click', e=>{
  if(!targetMenu.classList.contains('hidden') &&
     !targetMenu.contains(e.target) && !targetVal.contains(e.target)){
    targetMenu.classList.add('hidden');
    targetVal.setAttribute('aria-expanded', 'false');
  }
});

/* dates: keep end >= start */
const startInput = $('#start-date');
const endInput   = $('#end-date');
function syncDates(){
  endInput.min = startInput.value;
  if(endInput.value < startInput.value) endInput.value = startInput.value;
}
startInput.addEventListener('change', syncDates);
syncDates();

/* activity picker */
const goalNameBtn = $('#goal-name-btn');
const activityMenu = $('#activity-menu');
goalNameBtn.addEventListener('click', e=>{
  e.stopPropagation();
  activityMenu.classList.toggle('hidden');
});
$$('.act-item', activityMenu).forEach(item=>{
  item.addEventListener('click', ()=>{
    $('#goal-name-text').textContent = item.dataset.act;
    activityMenu.classList.add('hidden');
  });
});
document.addEventListener('click', e=>{
  if(!activityMenu.classList.contains('hidden') &&
     !activityMenu.contains(e.target) && !goalNameBtn.contains(e.target)){
    activityMenu.classList.add('hidden');
  }
});

/* white calendar buttons open the native picker */
$$('.cal-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const input = document.getElementById(btn.dataset.for);
    if(input && typeof input.showPicker === 'function'){
      try { input.showPicker(); } catch { input.focus(); }
    } else if(input){ input.focus(); }
  });
});

/* create */
$('#btn-create').addEventListener('click', ()=>{
  const title = ($('#goal-name-text').textContent || 'Walking').trim() || 'Walking';
  const target = +$('#target-num').textContent;
  const completed = Math.max(1, Math.round(target * 0.5)); // demo: ~50%
  const userGoal = {
    title, color:'var(--card-1)', hex:'#547098',
    target, completed,
    startDate: startInput.value, endDate: endInput.value,
    thisWeek: 50, prevWeek: 30,
  };
  state = { goals: [ userGoal, ...mockGoals() ] };
  saveState(state);
  openMain();
});

/* ============================================================
   SETTINGS
   ============================================================ */
$('#toggle-push').addEventListener('click', function(){
  this.classList.toggle('on');
});

/* ============================================================
   APPLE HEALTH (debug screen)
   ============================================================ */
$('#btn-connect').addEventListener('click', function(){
  if(this.classList.contains('connected')){ openMain(); return; }
  this.classList.add('connected');
  this.textContent = 'Connected ✓';
  setTimeout(openCreate, 650);
});
$('#btn-skip').addEventListener('click', openCreate);
$('#health-close').addEventListener('click', openCreate);

/* open health via debug link/param */
function openHealth(){ show('screen-health'); }
function openCreate(){ show('screen-create'); }
window.openHealth = openHealth;

/* ============================================================
   RESET
   ============================================================ */
function resetPrototype(){
  localStorage.removeItem(STORAGE_KEY);
  state = null;
  // reset create-goal form
  RULER.value = 30; positionRuler();
  $('#goal-name-text').textContent = 'Walking';
  $('#activity-menu').classList.add('hidden');
  $('#target-num').textContent = '12';
  $$('.target-option', targetMenu).forEach(option => option.classList.toggle('active', option.dataset.target === '12'));
  targetMenu.classList.add('hidden');
  targetVal.setAttribute('aria-expanded', 'false');
  startInput.value = '2026-03-01';
  endInput.value = '2026-03-01';
  syncDates();
  $('#toggle-push').classList.add('on');
  // reset health connect button
  const cb = $('#btn-connect');
  cb.classList.remove('connected'); cb.textContent = 'Connect';
  show('screen-splash');
}
window.resetPrototype = resetPrototype;

/* ---------- util ---------- */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============================================================
   INIT
   ============================================================ */
function init(){
  buildRuler();
  window.addEventListener('resize', ()=>{ if(!RULER.dragging) positionRuler(); });

  const params = new URLSearchParams(location.search);
  const scr = params.get('screen');
  if(scr === 'health'){ openHealth(); return; }
  // always start at splash (splash opens first)
  show('screen-splash');
}
init();
