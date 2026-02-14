// ===== StudyPlan App Logic =====
const CAT_COLORS = {
  lezione: '#5B8DEF', studio: '#8B7CF6', esame: '#EF6B6B',
  progetto: '#4ADE80', personale: '#FBBF24', pausa: '#2DD4BF'
};
const DAYS_IT = ['Domenica','Lunedi','Martedi','Mercoledi','Giovedi','Venerdi','Sabato'];
const DAYS_SHORT = ['DOM','LUN','MAR','MER','GIO','VEN','SAB'];
const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

const CAREER_TYPES = {
  'triennale': { label: 'Triennale', totalCfu: 180 },
  'magistrale': { label: 'Magistrale', totalCfu: 120 },
  'ciclo-unico-5': { label: 'Ciclo Unico 5 anni', totalCfu: 300 },
  'ciclo-unico-6': { label: 'Ciclo Unico 6 anni', totalCfu: 360 }
};

let events = [];
let settings = {};
let career = null;
let currentWeekOffset = 0;
let selectedDate = new Date();
let careerStatusFilter = 'all';

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  events = await window.api.loadEvents();
  settings = await window.api.loadSettings();
  career = await window.api.loadCareer();
  initNav();
  initEventModal();
  initSettings();
  initCareer();
  renderToday();
  renderWeek();
  renderStats();
  setTimeout(scrollTimelineToNow, 300);
  // Update timeline only when tab is visible AND document is focused (saves battery)
  setInterval(() => { if (document.hasFocus() && document.querySelector('#tab-today.active')) renderTimeline(); }, 60000);

  // Auto-refresh when data changes (e.g., from widget)
  if (window.api.onDataChanged) {
    window.api.onDataChanged(async () => {
      events = await window.api.loadEvents();
      career = await window.api.loadCareer();
      renderToday();
      renderWeek();
      renderStats();
      renderCareer();
    });
  }

  // Listen for navigation from widget
  if (window.api.onNavigate) {
    window.api.onNavigate((data) => {
      if (data.tab) {
        // Switch to the requested tab
        document.querySelectorAll('.nav-btn[data-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const btn = document.querySelector('.nav-btn[data-tab="' + data.tab + '"]');
        if (btn) btn.classList.add('active');
        document.getElementById('tab-' + data.tab).classList.add('active');
        if (data.tab === 'today') { renderToday(); setTimeout(scrollTimelineToNow, 100); }
        if (data.tab === 'week') renderWeek();
        if (data.tab === 'career') renderCareer();
        if (data.tab === 'stats') renderStats();
      }
      // Open specific event for editing
      if (data.eventId) {
        setTimeout(() => {
          const ev = events.find(x => x.id === data.eventId);
          if (ev) openEditEvent(ev);
        }, 200);
      }
      // Open specific exam for editing
      if (data.examName) {
        setTimeout(() => {
          if (career && career.exams) {
            const ex = career.exams.find(x => x.name === data.examName);
            if (ex) openCareerExamModal(ex);
          }
        }, 200);
      }
    });
  }
});

// ===== NAVIGATION =====
function initNav() {
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn[data-tab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'today') { renderToday(); setTimeout(scrollTimelineToNow, 100); }
      if (btn.dataset.tab === 'week') renderWeek();
      if (btn.dataset.tab === 'career') renderCareer();
      if (btn.dataset.tab === 'stats') renderStats();
    });
  });
}

// ===== TODAY TAB =====
function renderToday() {
  const now = new Date();
  document.getElementById('todayDate').textContent = DAYS_IT[now.getDay()] + ' ' + now.getDate() + ' ' + MONTHS_IT[now.getMonth()];
  const todayEvts = getTodayEvents();
  const completed = todayEvts.filter(e => e.completed).length;
  document.getElementById('todaySubtitle').textContent = todayEvts.length > 0
    ? todayEvts.length + ' impegn' + (todayEvts.length === 1 ? 'o' : 'i') + ' — ' + completed + ' completat' + (completed === 1 ? 'o' : 'i')
    : 'Nessun impegno per oggi';
  renderTimeline(); renderDonut(); renderTaskList();
}
function getTodayEvents() {
  const todayStr = new Date().toISOString().split('T')[0];
  return events.filter(e => e.date === todayStr).sort((a,b) => a.timeStart.localeCompare(b.timeStart));
}
function renderTimeline() {
  const container = document.getElementById('timeline');
  const todayEvts = getTodayEvents();
  const now = new Date();
  let html = '';
  for (let h = 7; h <= 23; h++) { html += '<div class="timeline-row" data-hour="' + h + '"><div class="timeline-hour">' + String(h).padStart(2,'0') + ':00</div><div class="timeline-slot" id="slot-' + h + '"></div></div>'; }
  container.innerHTML = html;
  todayEvts.forEach(ev => {
    const [sh,sm] = ev.timeStart.split(':').map(Number);
    const [eh,em] = ev.timeEnd.split(':').map(Number);
    const startMin = sh*60+sm, endMin = eh*60+em, durationMin = Math.max(endMin-startMin,15);
    const rowH = 56, startHour = Math.max(Math.floor(sh),7);
    const topOffset = (startMin-startHour*60)*(rowH/60), height = durationMin*(rowH/60);
    const slot = document.getElementById('slot-'+startHour);
    if (!slot) return;
    const el = document.createElement('div'); el.className = 'timeline-event';
    el.style.top = topOffset+'px'; el.style.height = Math.max(height,20)+'px';
    el.style.background = CAT_COLORS[ev.category]||'#5B8DEF';
    if (ev.completed) el.style.opacity = '0.5';
    el.innerHTML = '<div>'+ev.title+'</div><div class="ev-time">'+ev.timeStart+' - '+ev.timeEnd+'</div>';
    el.addEventListener('click', () => openEditEvent(ev)); slot.appendChild(el);
  });
  const ex = container.querySelector('.timeline-now'); if (ex) ex.remove();
  const nowMin = now.getHours()*60+now.getMinutes();
  if (nowMin >= 420 && nowMin <= 1380) {
    const topPx = (nowMin-420)*(56/60);
    const nl = document.createElement('div'); nl.className = 'timeline-now'; nl.style.top = topPx+'px'; container.appendChild(nl);
  }
}
function scrollTimelineToNow() { const c=document.getElementById('timeline'),nl=c.querySelector('.timeline-now'); if(nl){c.scrollTop=Math.max(parseInt(nl.style.top)-120,0);} }
function renderDonut() {
  const canvas=document.getElementById('donutChart'),ctx=canvas.getContext('2d'),dpr=window.devicePixelRatio||1;
  canvas.width=200*dpr;canvas.height=200*dpr;canvas.style.width='200px';canvas.style.height='200px';ctx.scale(dpr,dpr);
  const todayEvts=getTodayEvents(),total=todayEvts.length,completed=todayEvts.filter(e=>e.completed).length,pct=total>0?completed/total:0;
  const cx=100,cy=100,r=75,lw=14;ctx.clearRect(0,0,200,200);
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='#252a3a';ctx.lineWidth=lw;ctx.stroke();
  if(total>0){ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);ctx.strokeStyle=pct===1?'#4ADE80':'#5B8DEF';ctx.lineWidth=lw;ctx.lineCap='round';ctx.stroke();}
  ctx.fillStyle='#e8eaf0';ctx.font='700 32px Inter, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(Math.round(pct*100)+'%',cx,cy-8);
  ctx.fillStyle='#8b90a5';ctx.font='500 12px Inter, sans-serif';ctx.fillText(completed+'/'+total+' completati',cx,cy+16);
}
function renderTaskList() {
  const container=document.getElementById('todayTaskList'),todayEvts=getTodayEvents();
  if(!todayEvts.length){container.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px;">Nessun impegno per oggi</div>';return;}
  container.innerHTML=todayEvts.map(ev=>'<div class="task-item" data-id="'+ev.id+'"><div class="task-dot" style="background:'+CAT_COLORS[ev.category]+'"></div><div class="task-name '+(ev.completed?'done':'')+'">'+ev.timeStart+' '+ev.title+'</div><div class="task-check '+(ev.completed?'done':'')+'"></div></div>').join('');
  container.querySelectorAll('.task-item').forEach(item=>{
    item.querySelector('.task-check').addEventListener('click',async(e)=>{e.stopPropagation();const ev=events.find(x=>x.id===item.dataset.id);if(ev){ev.completed=!ev.completed;await window.api.saveEvents(events);renderToday();}});
    item.addEventListener('click',()=>{const ev=events.find(x=>x.id===item.dataset.id);if(ev)openEditEvent(ev);});
  });
}

// ===== WEEK TAB (Time-grid calendar) =====
const WEEK_HOUR_H = 60; // px per hour
const WEEK_START_HOUR = 7;
const WEEK_END_HOUR = 23;
const WEEK_SNAP_MIN = 15; // snap to 15-min increments

function renderWeek() {
  const now = new Date(), sow = new Date(now);
  sow.setDate(now.getDate() - ((now.getDay() + 6) % 7) + (currentWeekOffset * 7));
  const eow = new Date(sow); eow.setDate(sow.getDate() + 6);
  const sm = MONTHS_IT[sow.getMonth()], em = MONTHS_IT[eow.getMonth()];
  document.getElementById('weekTitle').textContent = sm === em
    ? sow.getDate() + ' - ' + eow.getDate() + ' ' + sm + ' ' + sow.getFullYear()
    : sow.getDate() + ' ' + sm + ' - ' + eow.getDate() + ' ' + em + ' ' + eow.getFullYear();

  const todayStr = now.toISOString().split('T')[0];
  const totalHours = WEEK_END_HOUR - WEEK_START_HOUR;

  // Gutter (hours)
  const gutter = document.getElementById('weekCalGutter');
  let gutterHtml = '<div style="height:49px"></div>'; // header spacer
  for (let h = WEEK_START_HOUR; h <= WEEK_END_HOUR; h++) {
    gutterHtml += '<div class="week-gutter-hour">' + String(h).padStart(2, '0') + ':00</div>';
  }
  gutter.innerHTML = gutterHtml;

  // Columns
  const columns = document.getElementById('weekCalColumns');
  let colHtml = '';
  for (let i = 0; i < 7; i++) {
    const day = new Date(sow); day.setDate(sow.getDate() + i);
    const ds = day.toISOString().split('T')[0];
    const isToday = ds === todayStr;
    const di = day.getDay();
    const dayEvts = events.filter(e => e.date === ds).sort((a, b) => a.timeStart.localeCompare(b.timeStart));

    colHtml += '<div class="week-cal-day' + (isToday ? ' today' : '') + '" data-date="' + ds + '">';
    colHtml += '<div class="week-cal-day-header" data-date="' + ds + '">';
    colHtml += '<div class="week-day-label">' + DAYS_SHORT[(di + 7) % 7] + '</div>';
    colHtml += '<div class="week-day-number">' + day.getDate() + '</div>';
    colHtml += '</div>';
    colHtml += '<div class="week-cal-day-body" data-date="' + ds + '">';

    // Hour lines
    for (let h = WEEK_START_HOUR; h < WEEK_END_HOUR; h++) {
      colHtml += '<div class="week-hour-line"><div class="week-hour-line-half"></div></div>';
    }

    // Events
    dayEvts.forEach(ev => {
      const [sh, smn] = ev.timeStart.split(':').map(Number);
      const [eh, emn] = ev.timeEnd.split(':').map(Number);
      const startMin = sh * 60 + smn;
      const endMin = eh * 60 + emn;
      const durMin = Math.max(endMin - startMin, 15);
      const topPx = (startMin - WEEK_START_HOUR * 60) * (WEEK_HOUR_H / 60);
      const heightPx = durMin * (WEEK_HOUR_H / 60);
      const color = CAT_COLORS[ev.category] || '#5B8DEF';

      colHtml += '<div class="week-event' + (ev.completed ? ' completed' : '') + '" data-id="' + ev.id + '" ' +
        'style="top:' + topPx + 'px;height:' + Math.max(heightPx, 15) + 'px;background:' + color + '">';
      colHtml += '<div class="week-event-resize-top"></div>';
      if (heightPx >= 30) {
        colHtml += '<div class="week-event-title">' + ev.title + '</div>';
        colHtml += '<div class="week-event-time">' + ev.timeStart + ' - ' + ev.timeEnd + '</div>';
      } else {
        colHtml += '<div class="week-event-title" style="font-size:10px">' + ev.timeStart + ' ' + ev.title + '</div>';
      }
      colHtml += '<div class="week-event-resize-bottom"></div>';
      colHtml += '</div>';
    });

    // Now line
    if (isToday) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= WEEK_START_HOUR * 60 && nowMin <= WEEK_END_HOUR * 60) {
        const nowPx = (nowMin - WEEK_START_HOUR * 60) * (WEEK_HOUR_H / 60);
        colHtml += '<div class="week-now-line" style="top:' + nowPx + 'px"></div>';
      }
    }

    colHtml += '</div></div>';
  }
  columns.innerHTML = colHtml;

  // Scroll to current time or 8am
  const scroll = document.getElementById('weekCalScroll');
  if (!scroll._scrolled) {
    const scrollToMin = (now.getHours() >= WEEK_START_HOUR && now.getHours() <= WEEK_END_HOUR)
      ? (now.getHours() - 1) * 60 : 8 * 60;
    scroll.scrollTop = (scrollToMin - WEEK_START_HOUR * 60) * (WEEK_HOUR_H / 60);
    scroll._scrolled = true;
  }

  // Bind interactions
  initWeekInteractions();

  document.getElementById('weekPrev').onclick = () => { currentWeekOffset--; scroll._scrolled = false; renderWeek(); };
  document.getElementById('weekNext').onclick = () => { currentWeekOffset++; scroll._scrolled = false; renderWeek(); };
  document.getElementById('weekToday').onclick = () => { currentWeekOffset = 0; scroll._scrolled = false; renderWeek(); };
}

function weekPxToMinutes(px) {
  return Math.round(px / (WEEK_HOUR_H / 60)) + WEEK_START_HOUR * 60;
}

function weekSnapMinutes(min) {
  return Math.round(min / WEEK_SNAP_MIN) * WEEK_SNAP_MIN;
}

function minutesToTime(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function initWeekInteractions() {
  const columns = document.getElementById('weekCalColumns');

  // Click on day header -> add event on that date
  columns.querySelectorAll('.week-cal-day-header').forEach(hdr => {
    hdr.addEventListener('click', () => openNewEventOnDate(hdr.dataset.date));
  });

  // Click on empty area -> add event at that time
  columns.querySelectorAll('.week-cal-day-body').forEach(body => {
    body.addEventListener('click', (e) => {
      if (e.target.closest('.week-event')) return;
      const rect = body.getBoundingClientRect();
      const y = e.clientY - rect.top + body.parentElement.parentElement.parentElement.scrollTop;
      // Account for the header height
      const headerH = body.parentElement.querySelector('.week-cal-day-header').offsetHeight;
      const localY = e.clientY - rect.top;
      const rawMin = weekPxToMinutes(localY);
      const snapped = weekSnapMinutes(rawMin);
      const startTime = minutesToTime(Math.max(snapped, WEEK_START_HOUR * 60));
      const endMin = Math.min(snapped + 60, WEEK_END_HOUR * 60);
      const endTime = minutesToTime(endMin);
      openNewEvent();
      document.getElementById('eventDate').value = body.dataset.date;
      document.getElementById('eventTimeStart').value = startTime;
      document.getElementById('eventTimeEnd').value = endTime;
    });
  });

  // Click on event -> edit
  columns.querySelectorAll('.week-event').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.week-event-resize-top') || e.target.closest('.week-event-resize-bottom')) return;
      if (el._justDragged) { el._justDragged = false; return; }
      const ev = events.find(x => x.id === el.dataset.id);
      if (ev) openEditEvent(ev);
    });
  });

  // Drag to move / long-press to duplicate
  columns.querySelectorAll('.week-event').forEach(el => {
    let holdTimer = null;
    let isDuplicate = false;
    let startX, startY, origTop, origDate, origEvt;
    let moved = false;

    const onPointerDown = (e) => {
      if (e.target.closest('.week-event-resize-top') || e.target.closest('.week-event-resize-bottom')) return;
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      origTop = parseFloat(el.style.top);
      origDate = el.closest('.week-cal-day').dataset.date;
      origEvt = events.find(x => x.id === el.dataset.id);
      moved = false;
      isDuplicate = false;

      // Long-press detection (500ms = duplicate mode)
      holdTimer = setTimeout(() => {
        isDuplicate = true;
        el.style.opacity = '0.5';
        // Create visual clone
        const ghost = el.cloneNode(true);
        ghost.classList.add('dragging');
        ghost.style.opacity = '0.85';
        ghost.id = 'week-drag-ghost';
        el.parentElement.appendChild(ghost);
      }, 500);

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
        clearTimeout(holdTimer);
        holdTimer = null;
      }

      const target = isDuplicate ? document.getElementById('week-drag-ghost') : el;
      if (!target) return;
      if (!isDuplicate) el.classList.add('dragging');

      // Move vertically
      const newTop = Math.max(0, origTop + dy);
      target.style.top = newTop + 'px';

      // Detect column change (horizontal drag)
      const allBodies = columns.querySelectorAll('.week-cal-day-body');
      let targetBody = null;
      allBodies.forEach(b => {
        const r = b.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right) targetBody = b;
      });

      if (targetBody && targetBody !== target.parentElement) {
        targetBody.appendChild(target);
      }
    };

    const onPointerUp = async (e) => {
      clearTimeout(holdTimer);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      el.classList.remove('dragging');
      el.style.opacity = '';

      const ghost = document.getElementById('week-drag-ghost');
      const target = isDuplicate ? ghost : el;

      if (!moved || !origEvt || !target) {
        if (ghost) ghost.remove();
        return;
      }

      el._justDragged = true;

      // Calculate new time and date
      const newDate = target.parentElement.dataset.date;
      const newTopPx = parseFloat(target.style.top);
      const rawStartMin = weekPxToMinutes(newTopPx);
      const snappedStart = weekSnapMinutes(rawStartMin);
      const [osh, osm] = origEvt.timeStart.split(':').map(Number);
      const [oeh, oem] = origEvt.timeEnd.split(':').map(Number);
      const origDurMin = (oeh * 60 + oem) - (osh * 60 + osm);
      const newStartMin = Math.max(WEEK_START_HOUR * 60, Math.min(snappedStart, WEEK_END_HOUR * 60 - origDurMin));
      const newEndMin = newStartMin + origDurMin;

      if (isDuplicate) {
        // Create a copy of the event on the new day/time
        const newEvt = {
          id: generateId(),
          title: origEvt.title,
          date: newDate,
          timeStart: minutesToTime(newStartMin),
          timeEnd: minutesToTime(newEndMin),
          category: origEvt.category,
          notes: origEvt.notes || '',
          completed: false,
          reminders: origEvt.reminders ? JSON.parse(JSON.stringify(origEvt.reminders)) : [],
          remindersSent: []
        };
        events.push(newEvt);
        ghost.remove();
        showToast('Impegno duplicato');
      } else {
        // Move existing event
        const dateChanged = origEvt.date !== newDate;
        origEvt.date = newDate;
        origEvt.timeStart = minutesToTime(newStartMin);
        origEvt.timeEnd = minutesToTime(newEndMin);
        if (dateChanged) origEvt.remindersSent = [];
        showToast('Impegno spostato');
      }

      await window.api.saveEvents(events);
      renderWeek();
      renderToday();
      renderStats();
    };

    el.addEventListener('pointerdown', onPointerDown);
  });

  // Resize from top/bottom edges
  columns.querySelectorAll('.week-event-resize-top, .week-event-resize-bottom').forEach(handle => {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isTop = handle.classList.contains('week-event-resize-top');
      const evEl = handle.closest('.week-event');
      const ev = events.find(x => x.id === evEl.dataset.id);
      if (!ev) return;

      const startY = e.clientY;
      const origTopPx = parseFloat(evEl.style.top);
      const origHeightPx = parseFloat(evEl.style.height);

      const onMove = (e2) => {
        const dy = e2.clientY - startY;
        if (isTop) {
          const newTop = Math.max(0, origTopPx + dy);
          const newHeight = Math.max(15, origHeightPx - dy);
          evEl.style.top = newTop + 'px';
          evEl.style.height = newHeight + 'px';
        } else {
          const newHeight = Math.max(15, origHeightPx + dy);
          evEl.style.height = newHeight + 'px';
        }
        // Update time label
        const curTop = parseFloat(evEl.style.top);
        const curH = parseFloat(evEl.style.height);
        const sMin = weekSnapMinutes(weekPxToMinutes(curTop));
        const eMin = weekSnapMinutes(weekPxToMinutes(curTop + curH));
        const timeEl = evEl.querySelector('.week-event-time');
        if (timeEl) timeEl.textContent = minutesToTime(sMin) + ' - ' + minutesToTime(eMin);
      };

      const onUp = async () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);

        const finalTop = parseFloat(evEl.style.top);
        const finalH = parseFloat(evEl.style.height);
        const newStartMin = weekSnapMinutes(weekPxToMinutes(finalTop));
        const newEndMin = weekSnapMinutes(weekPxToMinutes(finalTop + finalH));

        if (newEndMin > newStartMin) {
          ev.timeStart = minutesToTime(Math.max(newStartMin, WEEK_START_HOUR * 60));
          ev.timeEnd = minutesToTime(Math.min(newEndMin, WEEK_END_HOUR * 60));
          await window.api.saveEvents(events);
          showToast('Durata aggiornata');
        }
        renderWeek();
        renderToday();
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  });
}


// ===== STATS TAB =====
function renderStats() {
  const now=new Date(),todayStr=now.toISOString().split('T')[0];
  const wsStart=new Date(now);wsStart.setDate(now.getDate()-((now.getDay()+6)%7));const ws=wsStart.toISOString().split('T')[0];
  const te=events.filter(e=>e.date===todayStr),we=events.filter(e=>e.date>=ws&&e.date<=todayStr);
  const ct=te.filter(e=>e.completed).length,cw=we.filter(e=>e.completed).length;
  const careerExams = (career && career.exams) ? career.exams : [];
  const ue=careerExams.filter(e=>e.status!=='passed'&&e.examDate&&e.examDate>=todayStr).length;
  document.getElementById('statsGrid').innerHTML='<div class="stat-card"><div class="stat-value">'+te.length+'</div><div class="stat-label">Impegni oggi</div></div><div class="stat-card"><div class="stat-value" style="color:var(--success)">'+ct+'</div><div class="stat-label">Completati oggi</div></div><div class="stat-card"><div class="stat-value">'+cw+'/'+we.length+'</div><div class="stat-label">Settimana</div></div><div class="stat-card"><div class="stat-value" style="color:var(--cat-esame)">'+ue+'</div><div class="stat-label">Esami in arrivo</div></div>';
  const recent=[...events].filter(e=>e.completed).sort((a,b)=>b.date.localeCompare(a.date)||b.timeEnd.localeCompare(a.timeEnd)).slice(0,20);
  const history=document.getElementById('statsHistory');
  if(!recent.length){history.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:30px;font-size:13px;">Nessuna attivita completata</div>';return;}
  history.innerHTML=recent.map(ev=>{const d=new Date(ev.date+'T00:00:00');const dl=ev.date===todayStr?'Oggi':d.getDate()+' '+MONTHS_IT[d.getMonth()].substring(0,3);return '<div class="history-item"><div class="history-dot" style="background:'+CAT_COLORS[ev.category]+'"></div><div class="history-text">'+ev.title+'</div><div class="history-date">'+dl+'</div></div>';}).join('');
}

// ===== EVENT MODAL =====
function initEventModal() {
  const modal=document.getElementById('eventModal'),form=document.getElementById('eventForm');
  document.getElementById('btnAddEvent').addEventListener('click',()=>openNewEvent());
  document.getElementById('eventModalClose').addEventListener('click',()=>closeModal(modal));
  document.getElementById('eventCancel').addEventListener('click',()=>closeModal(modal));
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal(modal);});
  document.getElementById('categoryPicker').addEventListener('click',e=>{const btn=e.target.closest('.cat-btn');if(!btn)return;document.querySelectorAll('#categoryPicker .cat-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');});
  // Auto end-time: when start time changes, set end = start + 1 hour
  document.getElementById('eventTimeStart').addEventListener('change', () => {
    const start = document.getElementById('eventTimeStart').value;
    if (!start) return;
    const [h, m] = start.split(':').map(Number);
    const endH = Math.min(h + 1, 23);
    document.getElementById('eventTimeEnd').value = String(endH).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  });
  document.getElementById('eventDelete').addEventListener('click',async()=>{events=events.filter(e=>e.id!==document.getElementById('eventId').value);await window.api.saveEvents(events);closeModal(modal);refreshAll();showToast('Impegno eliminato');});
  form.addEventListener('submit',async(e)=>{e.preventDefault();const id=document.getElementById('eventId').value;const ac=document.querySelector('#categoryPicker .cat-btn.active');
    const reminders = [];
    if (document.getElementById('eventReminder1On').checked) reminders.push({ type: 'day-before', time: document.getElementById('eventReminder1Time').value });
    if (document.getElementById('eventReminder2On').checked) reminders.push({ type: 'same-day', time: document.getElementById('eventReminder2Time').value });
    const ed={id:id||generateId(),title:document.getElementById('eventTitle').value.trim(),date:document.getElementById('eventDate').value,timeStart:document.getElementById('eventTimeStart').value,timeEnd:document.getElementById('eventTimeEnd').value,category:ac?ac.dataset.cat:'lezione',notes:document.getElementById('eventNotes').value.trim(),completed:false,reminders:reminders};
    if(id){const ex=events.find(x=>x.id===id);if(ex){ed.completed=ex.completed;
      // Reset remindersSent if date or reminders changed
      const oldRemStr = JSON.stringify((ex.reminders||[]).map(r=>r.type+':'+r.time).sort());
      const newRemStr = JSON.stringify(reminders.map(r=>r.type+':'+r.time).sort());
      ed.remindersSent = (ex.date===ed.date && oldRemStr===newRemStr) ? (ex.remindersSent||[]) : [];
      Object.assign(ex,ed);}}else{ed.remindersSent=[];events.push(ed);}
    await window.api.saveEvents(events);closeModal(modal);refreshAll();showToast(id?'Impegno aggiornato':'Impegno creato');});
}
function openNewEvent(){document.getElementById('eventModalTitle').textContent='Nuovo impegno';document.getElementById('eventForm').reset();document.getElementById('eventId').value='';document.getElementById('eventDate').value=new Date().toISOString().split('T')[0];document.getElementById('eventTimeStart').value='09:00';document.getElementById('eventTimeEnd').value='10:00';document.querySelectorAll('#categoryPicker .cat-btn').forEach(b=>b.classList.remove('active'));document.querySelector('#categoryPicker .cat-btn[data-cat="lezione"]').classList.add('active');document.getElementById('eventReminder1On').checked=false;document.getElementById('eventReminder1Time').value='20:00';document.getElementById('eventReminder2On').checked=false;document.getElementById('eventReminder2Time').value='07:00';document.getElementById('eventDelete').style.display='none';openModal(document.getElementById('eventModal'));}
function openNewEventOnDate(ds){openNewEvent();document.getElementById('eventDate').value=ds;}
function openEditEvent(ev){document.getElementById('eventModalTitle').textContent='Modifica impegno';document.getElementById('eventId').value=ev.id;document.getElementById('eventTitle').value=ev.title;document.getElementById('eventDate').value=ev.date;document.getElementById('eventTimeStart').value=ev.timeStart;document.getElementById('eventTimeEnd').value=ev.timeEnd;document.getElementById('eventNotes').value=ev.notes||'';document.querySelectorAll('#categoryPicker .cat-btn').forEach(b=>b.classList.remove('active'));const cb=document.querySelector('#categoryPicker .cat-btn[data-cat="'+ev.category+'"]');if(cb)cb.classList.add('active');
  const r = ev.reminders || [];
  const r1 = r.find(x => x.type === 'day-before');
  const r2 = r.find(x => x.type === 'same-day');
  document.getElementById('eventReminder1On').checked = !!r1;
  document.getElementById('eventReminder1Time').value = r1 ? r1.time : '20:00';
  document.getElementById('eventReminder2On').checked = !!r2;
  document.getElementById('eventReminder2Time').value = r2 ? r2.time : '07:00';
  document.getElementById('eventDelete').style.display='inline-flex';openModal(document.getElementById('eventModal'));}

// ===== SETTINGS =====
function initSettings() {
  const modal=document.getElementById('settingsModal');
  document.getElementById('btnSettings').addEventListener('click',()=>{document.getElementById('settMorningOn').checked=settings.morningNotif;document.getElementById('settEveningOn').checked=settings.eveningNotif;document.getElementById('settMorningTime').value=settings.morningTime||'07:30';document.getElementById('settEveningTime').value=settings.eveningTime||'21:00';openModal(modal);});
  document.getElementById('settingsModalClose').addEventListener('click',()=>closeModal(modal));
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal(modal);});
  document.getElementById('settingsSave').addEventListener('click',async()=>{settings.morningNotif=document.getElementById('settMorningOn').checked;settings.eveningNotif=document.getElementById('settEveningOn').checked;settings.morningTime=document.getElementById('settMorningTime').value;settings.eveningTime=document.getElementById('settEveningTime').value;await window.api.saveSettings(settings);closeModal(modal);showToast('Impostazioni salvate');});
}

// ===== UTILITIES =====
function openModal(m){m.classList.add('show');}
function closeModal(m){m.classList.remove('show');}
function generateId(){return Date.now().toString(36)+Math.random().toString(36).substring(2,7);}
function refreshAll(){renderToday();renderWeek();renderStats();}
let toastTimeout;
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.remove('show'),2500);}

// ===================================================
// ===== CAREER / PIANO CARRIERA — 100% MANUALE =====
// ===================================================
// Nessun collegamento esterno, nessuna password, nessun DB.
// Tutto salvato SOLO in career.json sul computer dell'utente.

function initCareer() {
  const setupBtn = document.getElementById('careerSetupBtn');

  // Setup: crea piano carriera
  setupBtn.addEventListener('click', async () => {
    const uniName = document.getElementById('careerUniName').value.trim();
    const courseName = document.getElementById('careerCourseName').value.trim();
    const careerType = document.getElementById('careerType').value;
    if (!uniName || !courseName) { showToast('Inserisci universita e corso'); return; }
    const typeInfo = CAREER_TYPES[careerType];
    career = {
      universityName: uniName,
      courseName: courseName,
      type: careerType,
      typeLabel: typeInfo.label,
      totalCfu: typeInfo.totalCfu,
      exams: []
    };
    await window.api.saveCareer(career);
    renderCareer();
    showToast('Piano carriera creato');
  });

  // Reset
  document.getElementById('careerReset').addEventListener('click', async () => {
    if (!career) return;
    // Elimina anche i PDF associati
    for (const ex of (career.exams || [])) {
      for (const pdf of (ex.pdfs || [])) {
        try { await window.api.deletePdf(pdf.fileName); } catch(e) {}
      }
    }
    career = null;
    await window.api.saveCareer(null);
    renderCareer();
    showToast('Piano carriera eliminato');
  });

  // Filter
  document.getElementById('careerStatusFilter').addEventListener('change', () => {
    careerStatusFilter = document.getElementById('careerStatusFilter').value;
    renderCareer();
  });

  // Add exam
  document.getElementById('careerAddExam').addEventListener('click', () => openCareerExamModal());

  // Career exam modal
  const ceModal = document.getElementById('careerExamModal');
  const ceForm = document.getElementById('careerExamForm');
  document.getElementById('careerExamModalClose').addEventListener('click', () => closeModal(ceModal));
  document.getElementById('cedCancel').addEventListener('click', () => closeModal(ceModal));
  ceModal.addEventListener('click', e => { if (e.target === ceModal) closeModal(ceModal); });

  // Toggle grade/date/schedule/study-sections visibility based on status
  document.getElementById('cedStatus').addEventListener('change', () => {
    const isPassed = document.getElementById('cedStatus').value === 'passed';
    document.getElementById('cedGradeGroup').style.display = isPassed ? '' : 'none';
    document.getElementById('cedDateGroup').style.display = isPassed ? '' : 'none';
    document.getElementById('cedScheduleRow').style.display = isPassed ? 'none' : '';
    // Hide PDF and page tracking for passed exams
    document.querySelectorAll('.ced-study-section').forEach(el => el.style.display = isPassed ? 'none' : '');
  });

  // Add PDF — works for both new (unsaved) and existing exams
  document.getElementById('cedAddPdf').addEventListener('click', async () => {
    const result = await window.api.pickPdf();
    if (!result) return;
    // Get page count automatically
    const pageCount = await window.api.getPdfPages(result.fileName);
    // Ask user for file type
    const fileType = await showFileTypeDialog();
    if (!fileType) { await window.api.deletePdf(result.fileName); return; }
    const fileEntry = {
      ...result,
      type: fileType, // 'appunti' or 'esercizi'
      totalPages: pageCount,
      pages: { total: pageCount, read: 0, studied: 0, repeated: 0 },
      exercises: [] // for 'esercizi' type: [{name, status}]
    };
    if (fileType === 'esercizi') {
      fileEntry.exercises = [{ name: 'Argomento 1', status: 'da-fare' }];
    }
    const examId = document.getElementById('cedExamId').value;
    if (examId && career) {
      const ex = career.exams.find(e => e.id === examId);
      if (ex) {
        ex.pdfs.push(fileEntry);
        await window.api.saveCareer(career);
        renderPdfList(ex);
        renderFileTracking(ex);
        return;
      }
    }
    // New exam — use temp storage
    if (!window._tempPdfs) window._tempPdfs = [];
    window._tempPdfs.push(fileEntry);
    renderTempPdfList();
    renderFileTracking({ pdfs: window._tempPdfs, pages: { total: 0, read: 0, studied: 0, repeated: 0 } });
  });

  // Delete career exam
  document.getElementById('cedDelete').addEventListener('click', async () => {
    const examId = document.getElementById('cedExamId').value;
    if (!career || !examId) return;
    const ex = career.exams.find(e => e.id === examId);
    if (ex) {
      // Elimina PDF associati
      for (const pdf of (ex.pdfs || [])) {
        try { await window.api.deletePdf(pdf.fileName); } catch(e) {}
      }
      career.exams = career.exams.filter(e => e.id !== examId);
      await window.api.saveCareer(career);
    }
    closeModal(ceModal);
    renderCareer();
    showToast('Esame eliminato');
  });

  // Save career exam
  ceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!career) return;
    const id = document.getElementById('cedExamId').value;
    const name = document.getElementById('cedName').value.trim();
    const cfu = parseInt(document.getElementById('cedCfu').value) || 6;
    const year = parseInt(document.getElementById('cedYear').value) || 1;
    const sem = parseInt(document.getElementById('cedSemester').value) || 1;
    const status = document.getElementById('cedStatus').value;
    const grade = status === 'passed' ? parseInt(document.getElementById('cedGrade').value) || null : null;
    const dateStr = status === 'passed' ? document.getElementById('cedDate').value : '';
    const examDate = status !== 'passed' ? document.getElementById('cedExamDate').value : '';

    if (!name) { showToast('Inserisci il nome dell\'esame'); return; }

    // Compute aggregate pages from per-file data
    const computeAggregatePages = (pdfs) => {
      const agg = { total: 0, read: 0, studied: 0, repeated: 0 };
      (pdfs || []).forEach(p => {
        if (p.type === 'appunti' && p.pages) {
          agg.total += p.pages.total || 0;
          agg.read += p.pages.read || 0;
          agg.studied += p.pages.studied || 0;
          agg.repeated += p.pages.repeated || 0;
        }
      });
      return agg;
    };

    if (id) {
      const ex = career.exams.find(x => x.id === id);
      if (ex) {
        ex.name = name; ex.cfu = cfu; ex.year = year; ex.sem = sem;
        ex.status = status; ex.grade = grade; ex.dateStr = dateStr;
        ex.examDate = examDate;
        ex.pages = computeAggregatePages(ex.pdfs);
        ex.progress = status === 'passed' ? 100 : calcAutoProgress(ex);
      }
    } else {
      const pdfs = window._tempPdfs || [];
      const tempEx = { pdfs: pdfs };
      const newExam = {
        id: generateId(), name, cfu, year, sem, status, grade, dateStr,
        examDate,
        progress: status === 'passed' ? 100 : calcAutoProgress(tempEx),
        pdfs: pdfs,
        pages: computeAggregatePages(pdfs)
      };
      career.exams.push(newExam);
      window._tempPdfs = [];
    }
    await window.api.saveCareer(career);
    closeModal(ceModal);
    renderCareer();
    showToast(id ? 'Esame aggiornato' : 'Esame aggiunto');
  });
}

function openCareerExamModal(existingExam) {
  const modal = document.getElementById('careerExamModal');
  const form = document.getElementById('careerExamForm');
  window._tempPdfs = [];

  if (existingExam) {
    document.getElementById('careerExamModalTitle').textContent = 'Modifica esame';
    document.getElementById('cedExamId').value = existingExam.id;
    document.getElementById('cedName').value = existingExam.name;
    document.getElementById('cedCfu').value = existingExam.cfu;
    document.getElementById('cedYear').value = existingExam.year || 1;
    document.getElementById('cedSemester').value = existingExam.sem || 1;
    document.getElementById('cedStatus').value = existingExam.status || 'pending';
    const isPassed = existingExam.status === 'passed';
    document.getElementById('cedGradeGroup').style.display = isPassed ? '' : 'none';
    document.getElementById('cedDateGroup').style.display = isPassed ? '' : 'none';
    document.getElementById('cedGrade').value = existingExam.grade || '';
    document.getElementById('cedDate').value = existingExam.dateStr || '';
    document.getElementById('cedExamDate').value = existingExam.examDate || '';
    document.getElementById('cedProgress').value = existingExam.progress || 0;
    document.getElementById('cedProgressLabel').textContent = (existingExam.progress || 0) + '%';
    document.getElementById('cedScheduleRow').style.display = isPassed ? 'none' : '';
    document.querySelectorAll('.ced-study-section').forEach(el => el.style.display = isPassed ? 'none' : '');
    document.getElementById('cedDelete').style.display = 'inline-flex';
    // Migrate old pdfs to new format if needed
    migrateExamPdfs(existingExam);
    renderPdfList(existingExam);
    renderFileTracking(existingExam);
    // Update auto-progress when opening
    updateAutoProgress(existingExam);
  } else {
    document.getElementById('careerExamModalTitle').textContent = 'Aggiungi esame';
    form.reset();
    document.getElementById('cedExamId').value = '';
    document.getElementById('cedCfu').value = 6;
    document.getElementById('cedYear').value = 1;
    document.getElementById('cedSemester').value = 1;
    document.getElementById('cedStatus').value = 'pending';
    document.getElementById('cedGradeGroup').style.display = 'none';
    document.getElementById('cedDateGroup').style.display = 'none';
    document.getElementById('cedGrade').value = '';
    document.getElementById('cedDate').value = '';
    document.getElementById('cedExamDate').value = '';
    document.getElementById('cedProgress').value = 0;
    document.getElementById('cedProgressLabel').textContent = '0%';
    document.getElementById('cedScheduleRow').style.display = '';
    document.querySelectorAll('.ced-study-section').forEach(el => el.style.display = '');
    document.getElementById('cedDelete').style.display = 'none';
    document.getElementById('cedPdfList').innerHTML = '<div class="ced-empty">Nessun file allegato</div>';
    document.getElementById('cedFileTrackingSection').style.display = 'none';
    document.getElementById('cedGlobalSummarySection').style.display = 'none';
  }
  openModal(modal);
}

// Migrate old-format pdfs (just {fileName, originalName}) to new format with per-file tracking
function migrateExamPdfs(ex) {
  if (!ex.pdfs) ex.pdfs = [];
  ex.pdfs.forEach(pdf => {
    if (!pdf.type) pdf.type = 'appunti';
    if (!pdf.pages) pdf.pages = { total: pdf.totalPages || 0, read: 0, studied: 0, repeated: 0 };
    if (!pdf.exercises) pdf.exercises = [];
  });
}

function calcMediaPonderata() {
  if (!career || !career.exams) return null;
  const passed = career.exams.filter(e => e.status === 'passed' && e.grade && e.grade >= 18);
  if (!passed.length) return null;
  let sumVC = 0, sumC = 0;
  passed.forEach(e => {
    const voto = e.grade === 31 ? 30 : e.grade; // 30L = 30 per la media
    sumVC += voto * e.cfu;
    sumC += e.cfu;
  });
  return sumC > 0 ? (sumVC / sumC).toFixed(2) : null;
}

function renderCareer() {
  const setup = document.getElementById('careerSetup');
  const dashboard = document.getElementById('careerDashboard');
  if (!career || !career.exams) {
    setup.style.display = 'flex'; dashboard.style.display = 'none'; return;
  }
  setup.style.display = 'none'; dashboard.style.display = 'flex';

  document.getElementById('careerTitle').textContent = career.courseName;
  document.getElementById('careerSubtitle').textContent = career.universityName + ' — ' + career.typeLabel;

  const cfuDone = career.exams.filter(e => e.status === 'passed').reduce((s, e) => s + e.cfu, 0);
  const examsDone = career.exams.filter(e => e.status === 'passed').length;
  const media = calcMediaPonderata();

  document.getElementById('careerCfuDone').textContent = cfuDone;
  document.getElementById('careerCfuTotal').textContent = career.totalCfu;
  document.getElementById('careerExamsDone').textContent = examsDone;
  document.getElementById('careerMedia').textContent = media || '—';

  const pct = career.totalCfu > 0 ? Math.round((cfuDone / career.totalCfu) * 100) : 0;
  document.getElementById('careerProgressFill').style.width = pct + '%';
  document.getElementById('careerProgressPct').textContent = pct + '%';

  // Upcoming exams strip
  const nowStr = new Date().toISOString().split('T')[0];
  const upcoming = career.exams
    .filter(e => e.status !== 'passed' && e.examDate && e.examDate >= nowStr)
    .sort((a,b) => a.examDate.localeCompare(b.examDate))
    .slice(0, 5);
  const upContainer = document.getElementById('careerUpcoming');
  if (upcoming.length) {
    upContainer.innerHTML = '<div class="career-upcoming-title">Prossimi esami</div><div class="career-upcoming-cards">' +
      upcoming.map(ex => {
        const ed = new Date(ex.examDate + 'T00:00:00'), dd = Math.ceil((ed - new Date()) / 86400000);
        const ds = ed.getDate() + ' ' + MONTHS_IT[ed.getMonth()].substring(0,3);
        let cd = '', u = false;
        if (dd === 0) { cd = 'Oggi!'; u = true; }
        else if (dd <= 7) { cd = 'Tra ' + dd + 'g'; u = true; }
        else cd = 'Tra ' + dd + 'g';
        const pc = (ex.progress || 0) >= 80 ? '#4ADE80' : (ex.progress || 0) >= 50 ? '#FBBF24' : '#EF6B6B';
        return '<div class="upcoming-card" data-id="' + ex.id + '">' +
          '<div class="upcoming-name">' + ex.name + '</div>' +
          '<div class="upcoming-date">' + ds + '</div>' +
          '<div class="upcoming-countdown ' + (u ? 'urgent' : '') + '">' + cd + '</div>' +
          '<div class="upcoming-bar"><div class="upcoming-bar-fill" style="width:' + (ex.progress || 0) + '%;background:' + pc + '"></div></div>' +
          '</div>';
      }).join('') +
      '</div>';
    upContainer.querySelectorAll('.upcoming-card').forEach(card => {
      card.addEventListener('click', () => {
        const ex = career.exams.find(e => e.id === card.dataset.id);
        if (ex) openCareerExamModal(ex);
      });
    });
  } else {
    upContainer.innerHTML = '';
  }

  // Exam list
  let filtered = career.exams;
  if (careerStatusFilter === 'passed') filtered = filtered.filter(e => e.status === 'passed');
  else if (careerStatusFilter === 'pending') filtered = filtered.filter(e => e.status !== 'passed');

  // Sort: pending first, then by year/sem
  filtered = [...filtered].sort((a,b) => {
    if (a.status === 'passed' && b.status !== 'passed') return 1;
    if (a.status !== 'passed' && b.status === 'passed') return -1;
    if (a.year !== b.year) return a.year - b.year;
    return a.sem - b.sem;
  });

  const listContainer = document.getElementById('careerExamList');
  if (!filtered.length) {
    listContainer.innerHTML = '<div class="exams-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/></svg><div>Nessun esame</div></div>';
    return;
  }

  listContainer.innerHTML = filtered.map(ex => {
    const statusLabels = { pending: 'Da sostenere', passed: 'Superato' };
    const statusClass = ex.status || 'pending';
    const gradeDisplay = ex.status === 'passed' && ex.grade ? (ex.grade === 31 ? '30L' : ex.grade) : '';
    const passedIcon = ex.status === 'passed' ? '<svg class="cei-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> ' : '';
    
    // File info badges
    let filesHtml = '';
    if (ex.pdfs && ex.pdfs.length > 0) {
      const appunti = ex.pdfs.filter(p => p.type === 'appunti').length;
      const esercizi = ex.pdfs.filter(p => p.type === 'esercizi').length;
      const badges = [];
      if (appunti > 0) badges.push('<span class="cei-file-badge appunti">📖 ' + appunti + '</span>');
      if (esercizi > 0) badges.push('<span class="cei-file-badge esercizi">🏋️ ' + esercizi + '</span>');
      filesHtml = ' ' + badges.join(' ');
    }
    
    // Countdown & progress for pending exams
    let countdownHtml = '';
    if (ex.status !== 'passed' && ex.examDate) {
      const ed = new Date(ex.examDate + 'T00:00:00'), dd = Math.ceil((ed - new Date()) / 86400000);
      const ds = ed.getDate() + ' ' + MONTHS_IT[ed.getMonth()].substring(0,3);
      let cd = ''; const u = dd >= 0 && dd <= 7;
      if (dd < 0) cd = 'Passato';
      else if (dd === 0) cd = 'Oggi!';
      else cd = ds + ' (' + dd + 'g)';
      countdownHtml = '<span class="cei-countdown ' + (u ? 'urgent' : '') + '">' + cd + '</span>';
    }
    let progressHtml = '';
    if (ex.status !== 'passed') {
      const prog = ex.progress || 0;
      const pc = prog >= 80 ? '#4ADE80' : prog >= 50 ? '#FBBF24' : '#EF6B6B';
      progressHtml = '<div class="cei-progress-bar"><div class="cei-progress-fill" style="width:' + prog + '%;background:' + pc + '"></div></div>';
    }
    return '<div class="career-exam-item ' + (statusClass === 'passed' ? 'passed' : '') + '" data-id="' + ex.id + '">' +
      '<div class="cei-name">' + passedIcon + ex.name + filesHtml +
        '<div class="cei-meta">' + ex.year + '\u00B0 anno, ' + ex.sem + '\u00B0 sem' +
        (countdownHtml ? ' · ' + countdownHtml : '') + '</div>' +
        progressHtml +
      '</div>' +
      '<div class="cei-cfu">' + ex.cfu + '</div>' +
      '<div class="cei-grade ' + (gradeDisplay ? '' : 'no-grade') + '">' + (gradeDisplay || '—') + '</div>' +
      '<div class="cei-status ' + statusClass + '">' + statusLabels[statusClass] + '</div>' +
      '<div class="cei-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>' +
      '</div>';
  }).join('');

  listContainer.querySelectorAll('.career-exam-item').forEach(item => {
    item.addEventListener('click', () => {
      const ex = career.exams.find(e => e.id === item.dataset.id);
      if (ex) openCareerExamModal(ex);
    });
  });
}

function renderPdfList(ex) {
  const container = document.getElementById('cedPdfList');
  if (!ex.pdfs || !ex.pdfs.length) {
    container.innerHTML = '<div class="ced-empty">Nessun file allegato</div>'; return;
  }
  container.innerHTML = ex.pdfs.map((pdf, i) => {
    const typeIcon = pdf.type === 'esercizi' ? '🏋️' : '📖';
    const typeLabel = pdf.type === 'esercizi' ? 'Esercizi' : 'Appunti';
    const pagesInfo = pdf.pages && pdf.pages.total > 0 ? ' · ' + pdf.pages.total + ' pag.' : '';
    return '<div class="ced-pdf-item">' +
    '<span class="ced-pdf-type-icon">' + typeIcon + '</span>' +
    '<div class="ced-pdf-info"><span class="ced-pdf-name">' + pdf.originalName + '</span><span class="ced-pdf-meta">' + typeLabel + pagesInfo + '</span></div>' +
    '<button type="button" class="ced-pdf-open" data-fn="' + pdf.fileName + '" title="Apri"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>' +
    '<button type="button" class="ced-pdf-del" data-idx="' + i + '" title="Rimuovi"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
    '</div>';
  }).join('');

  container.querySelectorAll('.ced-pdf-open').forEach(btn => {
    btn.addEventListener('click', (ev) => { ev.preventDefault(); window.api.openPdf(btn.dataset.fn); });
  });
  container.querySelectorAll('.ced-pdf-del').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const idx = parseInt(btn.dataset.idx);
      const examId = document.getElementById('cedExamId').value;
      const cex = career.exams.find(e => e.id === examId);
      if (!cex) return;
      const removed = cex.pdfs.splice(idx, 1);
      if (removed[0]) await window.api.deletePdf(removed[0].fileName);
      await window.api.saveCareer(career);
      renderPdfList(cex);
      renderFileTracking(cex);
    });
  });
}

function renderTempPdfList() {
  const container = document.getElementById('cedPdfList');
  const pdfs = window._tempPdfs || [];
  if (!pdfs.length) { container.innerHTML = '<div class="ced-empty">Nessun file allegato</div>'; return; }
  container.innerHTML = pdfs.map((pdf, i) => {
    const typeIcon = pdf.type === 'esercizi' ? '🏋️' : '📖';
    const typeLabel = pdf.type === 'esercizi' ? 'Esercizi' : 'Appunti';
    const pagesInfo = pdf.pages && pdf.pages.total > 0 ? ' · ' + pdf.pages.total + ' pag.' : '';
    return '<div class="ced-pdf-item">' +
    '<span class="ced-pdf-type-icon">' + typeIcon + '</span>' +
    '<div class="ced-pdf-info"><span class="ced-pdf-name">' + pdf.originalName + '</span><span class="ced-pdf-meta">' + typeLabel + pagesInfo + '</span></div>' +
    '<button type="button" class="ced-pdf-del-temp" data-idx="' + i + '" title="Rimuovi"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
    '</div>';
  }).join('');
  container.querySelectorAll('.ced-pdf-del-temp').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const idx = parseInt(btn.dataset.idx);
      const removed = window._tempPdfs.splice(idx, 1);
      if (removed[0]) await window.api.deletePdf(removed[0].fileName);
      renderTempPdfList();
      renderFileTracking({ pdfs: window._tempPdfs, pages: { total: 0, read: 0, studied: 0, repeated: 0 } });
    });
  });
}

// ===== File Type Selection Dialog =====
function showFileTypeDialog() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.style.zIndex = '1100';
    overlay.innerHTML = '<div class="modal modal-xs" style="max-width:340px;">' +
      '<div class="modal-header"><h2>Tipo di file</h2></div>' +
      '<div style="padding:16px;display:flex;flex-direction:column;gap:10px;">' +
        '<button type="button" class="ced-filetype-btn" data-type="appunti">' +
          '<span style="font-size:24px;">📖</span>' +
          '<div><strong>Appunti / Studio</strong><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Traccia pagine lette, studiate e ripetute</div></div>' +
        '</button>' +
        '<button type="button" class="ced-filetype-btn" data-type="esercizi">' +
          '<span style="font-size:24px;">🏋️</span>' +
          '<div><strong>Esercizi</strong><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Traccia argomenti: fatti, da fare, in esecuzione</div></div>' +
        '</button>' +
      '</div>' +
      '<div class="modal-actions" style="padding:0 16px 16px;"><div class="spacer"></div><button type="button" class="btn-secondary ced-filetype-cancel">Annulla</button></div>' +
    '</div>';
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.ced-filetype-btn').forEach(btn => {
      btn.addEventListener('click', () => { document.body.removeChild(overlay); resolve(btn.dataset.type); });
    });
    overlay.querySelector('.ced-filetype-cancel').addEventListener('click', () => { document.body.removeChild(overlay); resolve(null); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); } });
  });
}

// ===== Per-File Tracking =====
let _activeFileTab = 0;

function renderFileTracking(ex) {
  const pdfs = ex.pdfs || [];
  const trackingSection = document.getElementById('cedFileTrackingSection');
  const summarySection = document.getElementById('cedGlobalSummarySection');
  
  if (!pdfs.length) {
    trackingSection.style.display = 'none';
    summarySection.style.display = 'none';
    return;
  }

  trackingSection.style.display = '';
  summarySection.style.display = '';
  if (_activeFileTab >= pdfs.length) _activeFileTab = 0;

  // Render tabs
  const tabsContainer = document.getElementById('cedFileTabs');
  tabsContainer.innerHTML = pdfs.map((pdf, i) => {
    const icon = pdf.type === 'esercizi' ? '🏋️' : '📖';
    const shortName = pdf.originalName.length > 20 ? pdf.originalName.substring(0, 18) + '…' : pdf.originalName;
    return '<button type="button" class="ced-file-tab ' + (i === _activeFileTab ? 'active' : '') + '" data-idx="' + i + '">' + icon + ' ' + shortName + '</button>';
  }).join('');

  tabsContainer.querySelectorAll('.ced-file-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeFileTab = parseInt(btn.dataset.idx);
      renderFileTracking(ex);
    });
  });

  // Render tracking body for active file
  const body = document.getElementById('cedFileTrackingBody');
  const pdf = pdfs[_activeFileTab];

  if (pdf.type === 'appunti') {
    renderAppuntiTracking(body, pdf, ex);
  } else {
    renderEserciziTracking(body, pdf, ex);
  }

  // Render global summary chart
  renderGlobalPagesChart(ex);
}

function renderAppuntiTracking(body, pdf, ex) {
  const p = pdf.pages || { total: 0, read: 0, studied: 0, repeated: 0 };
  const total = p.total || 0;

  body.innerHTML =
    '<div class="ced-pages-form">' +
      '<div class="ced-page-row">' +
        '<span class="ced-page-label">Pagine totali</span>' +
        '<div class="ced-page-stepper">' +
          '<button type="button" class="ced-step-btn ced-step-down" data-field="total">▼</button>' +
          '<input type="number" class="form-input-sm ced-page-input" data-field="total" min="0" value="' + total + '">' +
          '<button type="button" class="ced-step-btn ced-step-up" data-field="total">▲</button>' +
        '</div>' +
      '</div>' +
      '<div class="ced-page-row">' +
        '<span class="ced-page-label"><span class="ced-page-dot" style="background:#5B8DEF"></span>Lette</span>' +
        '<div class="ced-page-stepper">' +
          '<button type="button" class="ced-step-btn ced-step-down" data-field="read">▼</button>' +
          '<input type="number" class="form-input-sm ced-page-input" data-field="read" min="0" value="' + (p.read || 0) + '">' +
          '<button type="button" class="ced-step-btn ced-step-up" data-field="read">▲</button>' +
        '</div>' +
      '</div>' +
      '<div class="ced-page-row">' +
        '<span class="ced-page-label"><span class="ced-page-dot" style="background:#8B7CF6"></span>Studiate</span>' +
        '<div class="ced-page-stepper">' +
          '<button type="button" class="ced-step-btn ced-step-down" data-field="studied">▼</button>' +
          '<input type="number" class="form-input-sm ced-page-input" data-field="studied" min="0" value="' + (p.studied || 0) + '">' +
          '<button type="button" class="ced-step-btn ced-step-up" data-field="studied">▲</button>' +
        '</div>' +
      '</div>' +
      '<div class="ced-page-row">' +
        '<span class="ced-page-label"><span class="ced-page-dot" style="background:#4ADE80"></span>Ripetute</span>' +
        '<div class="ced-page-stepper">' +
          '<button type="button" class="ced-step-btn ced-step-down" data-field="repeated">▼</button>' +
          '<input type="number" class="form-input-sm ced-page-input" data-field="repeated" min="0" value="' + (p.repeated || 0) + '">' +
          '<button type="button" class="ced-step-btn ced-step-up" data-field="repeated">▲</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="ced-pages-chart" id="cedFileChart"></div>';

  // Render chart for this file
  renderSingleFileChart(document.getElementById('cedFileChart'), p);

  // Stepper buttons
  body.querySelectorAll('.ced-step-up, .ced-step-down').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      const input = body.querySelector('.ced-page-input[data-field="' + field + '"]');
      let val = parseInt(input.value) || 0;
      if (btn.classList.contains('ced-step-up')) val++;
      else val = Math.max(0, val - 1);
      // Clamp to total (except total itself)
      const t = parseInt(body.querySelector('.ced-page-input[data-field="total"]').value) || 0;
      if (field !== 'total' && val > t) val = t;
      input.value = val;
      updateFilePages(pdf, body, ex);
    });
  });

  // Direct input changes
  body.querySelectorAll('.ced-page-input').forEach(inp => {
    inp.addEventListener('input', () => updateFilePages(pdf, body, ex));
  });
}

function updateFilePages(pdf, body, ex) {
  const t = Math.max(0, parseInt(body.querySelector('.ced-page-input[data-field="total"]').value) || 0);
  const r = Math.min(parseInt(body.querySelector('.ced-page-input[data-field="read"]').value) || 0, t);
  const s = Math.min(parseInt(body.querySelector('.ced-page-input[data-field="studied"]').value) || 0, t);
  const rep = Math.min(parseInt(body.querySelector('.ced-page-input[data-field="repeated"]').value) || 0, t);
  pdf.pages = { total: t, read: r, studied: s, repeated: rep };
  // Update chart
  const chartEl = document.getElementById('cedFileChart');
  if (chartEl) renderSingleFileChart(chartEl, pdf.pages);
  renderGlobalPagesChart(ex);
  // Auto-calculate preparation %
  updateAutoProgress(ex);
  // Auto-save if existing exam
  const examId = document.getElementById('cedExamId').value;
  if (examId && career) {
    window.api.saveCareer(career);
  }
}

// Auto-calculate preparation % from page data and exercise data
// Weights: read=20%, studied=40%, repeated=40% (for appunti)
// For esercizi: fatto=100%, in-corso=50%, da-fare=0%
function calcAutoProgress(ex) {
  const pdfs = ex.pdfs || [];
  if (!pdfs.length) return 0;
  
  let totalWeight = 0, totalScore = 0;
  
  pdfs.forEach(pdf => {
    if (pdf.type === 'appunti' && pdf.pages && pdf.pages.total > 0) {
      const t = pdf.pages.total;
      const readPct = (pdf.pages.read || 0) / t;
      const studiedPct = (pdf.pages.studied || 0) / t;
      const repeatedPct = (pdf.pages.repeated || 0) / t;
      // Weighted: read 20%, studied 30%, repeated 50%
      const fileProg = readPct * 0.2 + studiedPct * 0.3 + repeatedPct * 0.5;
      totalScore += fileProg * t; // weight by page count
      totalWeight += t;
    }
    if (pdf.type === 'esercizi' && pdf.exercises && pdf.exercises.length > 0) {
      const exCount = pdf.exercises.length;
      let done = 0;
      pdf.exercises.forEach(e => {
        if (e.status === 'fatto') done += 1;
        else if (e.status === 'in-corso') done += 0.5;
      });
      const fileProg = done / exCount;
      totalScore += fileProg * exCount;
      totalWeight += exCount;
    }
  });
  
  if (totalWeight === 0) return 0;
  return Math.round((totalScore / totalWeight) * 100);
}

function updateAutoProgress(ex) {
  const prog = calcAutoProgress(ex);
  const slider = document.getElementById('cedProgress');
  const label = document.getElementById('cedProgressLabel');
  if (slider && label) {
    slider.value = prog;
    label.textContent = prog + '%';
  }
  // Also update the exam object if it exists
  const examId = document.getElementById('cedExamId').value;
  if (examId && career) {
    const examObj = career.exams.find(e => e.id === examId);
    if (examObj) examObj.progress = prog;
  }
}

function renderEserciziTracking(body, pdf, ex) {
  const exercises = pdf.exercises || [];
  const statusLabels = { 'da-fare': 'Da fare', 'in-corso': 'In esecuzione', 'fatto': 'Fatto' };
  const statusColors = { 'da-fare': '#EF6B6B', 'in-corso': '#FBBF24', 'fatto': '#4ADE80' };

  body.innerHTML =
    '<div class="ced-exercises-list">' +
      exercises.map((exc, i) =>
        '<div class="ced-exercise-row">' +
          '<input type="text" class="ced-exercise-name" data-idx="' + i + '" value="' + (exc.name || '') + '" placeholder="Nome argomento">' +
          '<select class="ced-exercise-status form-select form-select-xs" data-idx="' + i + '">' +
            '<option value="da-fare"' + (exc.status === 'da-fare' ? ' selected' : '') + '>Da fare</option>' +
            '<option value="in-corso"' + (exc.status === 'in-corso' ? ' selected' : '') + '>In esecuzione</option>' +
            '<option value="fatto"' + (exc.status === 'fatto' ? ' selected' : '') + '>Fatto</option>' +
          '</select>' +
          '<button type="button" class="ced-exercise-del btn-icon-sm" data-idx="' + i + '" title="Rimuovi"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>'
      ).join('') +
    '</div>' +
    '<button type="button" class="btn-secondary btn-sm ced-add-exercise" style="margin-top:8px;">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      ' Aggiungi argomento' +
    '</button>' +
    '<div class="ced-exercises-summary">' +
      '<span style="color:#4ADE80">' + exercises.filter(e => e.status === 'fatto').length + ' fatti</span> · ' +
      '<span style="color:#FBBF24">' + exercises.filter(e => e.status === 'in-corso').length + ' in corso</span> · ' +
      '<span style="color:#EF6B6B">' + exercises.filter(e => e.status === 'da-fare').length + ' da fare</span>' +
    '</div>';

  // Event handlers
  body.querySelectorAll('.ced-exercise-name').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = parseInt(inp.dataset.idx);
      pdf.exercises[idx].name = inp.value;
      autoSaveCareer();
    });
  });
  body.querySelectorAll('.ced-exercise-status').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = parseInt(sel.dataset.idx);
      pdf.exercises[idx].status = sel.value;
      autoSaveCareer();
      updateAutoProgress(ex);
      renderEserciziTracking(body, pdf, ex);
    });
  });
  body.querySelectorAll('.ced-exercise-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      pdf.exercises.splice(idx, 1);
      autoSaveCareer();
      renderEserciziTracking(body, pdf, ex);
    });
  });
  body.querySelector('.ced-add-exercise').addEventListener('click', () => {
    if (!pdf.exercises) pdf.exercises = [];
    pdf.exercises.push({ name: 'Argomento ' + (pdf.exercises.length + 1), status: 'da-fare' });
    autoSaveCareer();
    renderEserciziTracking(body, pdf, ex);
  });
}

function autoSaveCareer() {
  const examId = document.getElementById('cedExamId').value;
  if (examId && career) {
    window.api.saveCareer(career);
  }
}

function renderSingleFileChart(container, pages) {
  const total = pages.total || 0;
  if (total === 0) { container.innerHTML = '<div class="ced-empty">Inserisci il numero di pagine totali</div>'; return; }
  const read = pages.read || 0, studied = pages.studied || 0, repeated = pages.repeated || 0;
  const rPct = (repeated/total*100).toFixed(1), sPct = (Math.max(studied-repeated,0)/total*100).toFixed(1);
  const lPct = (Math.max(read-studied,0)/total*100).toFixed(1), restPct = (Math.max(total-read,0)/total*100).toFixed(1);
  container.innerHTML =
    '<div class="ced-chart-bar">' +
    '<div class="ced-chart-seg" style="width:'+rPct+'%;background:#4ADE80">'+(repeated>0?repeated:'')+'</div>' +
    '<div class="ced-chart-seg" style="width:'+sPct+'%;background:#8B7CF6">'+(studied-repeated>0?studied-repeated:'')+'</div>' +
    '<div class="ced-chart-seg" style="width:'+lPct+'%;background:#5B8DEF">'+(read-studied>0?read-studied:'')+'</div>' +
    '<div class="ced-chart-seg" style="width:'+restPct+'%;background:var(--bg-hover)"></div>' +
    '</div>' +
    '<div class="ced-chart-legend">' +
    '<div class="ced-chart-legend-item"><div class="ced-chart-legend-dot" style="background:#4ADE80"></div>Ripetute '+repeated+'/'+total+'</div>' +
    '<div class="ced-chart-legend-item"><div class="ced-chart-legend-dot" style="background:#8B7CF6"></div>Studiate '+studied+'/'+total+'</div>' +
    '<div class="ced-chart-legend-item"><div class="ced-chart-legend-dot" style="background:#5B8DEF"></div>Lette '+read+'/'+total+'</div>' +
    '</div>';
}

function renderGlobalPagesChart(ex) {
  const container = document.getElementById('cedPagesChart');
  const pdfs = (ex.pdfs || []).filter(p => p.type === 'appunti');
  if (!pdfs.length) { container.innerHTML = '<div class="ced-empty">Nessun file di appunti</div>'; return; }
  const agg = { total: 0, read: 0, studied: 0, repeated: 0 };
  pdfs.forEach(p => {
    if (p.pages) {
      agg.total += p.pages.total || 0;
      agg.read += p.pages.read || 0;
      agg.studied += p.pages.studied || 0;
      agg.repeated += p.pages.repeated || 0;
    }
  });
  if (agg.total === 0) { container.innerHTML = '<div class="ced-empty">Nessuna pagina tracciata</div>'; return; }
  renderSingleFileChart(container, agg);
}
