import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus } from 'lucide-react';
import api from '../api';
import { CAT_COLORS, DAYS_IT, MONTHS_IT, HOUR_START, HOUR_END, toDateStr } from '../lib/constants';

export default function TodayPage({ onAddEvent, onEditEvent }) {
  const [events, setEvents] = useState([]);
  const todayStr = toDateStr(new Date());
  const canvasRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const all = await api.loadEvents();
      setEvents((all || []).filter(e => e.date === todayStr));
    } catch {}
  }, [todayStr]);

  useEffect(() => {
    load();
    window.addEventListener('app-data-changed', load);
    return () => window.removeEventListener('app-data-changed', load);
  }, [load]);

  // Draw donut chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 200 * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);

    const total = events.length;
    const done = events.filter(e => e.completed).length;
    const pct = total > 0 ? done / total : 0;

    const cx = 100, cy = 100, r = 70, w = 14;
    ctx.clearRect(0, 0, 200, 200);

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = w;
    ctx.stroke();

    // Progress ring
    if (total > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.strokeStyle = '#8070d0';
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Center text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(pct * 100) + '%', cx, cy - 6);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#7c8099';
    ctx.fillText(`${done}/${total} completati`, cx, cy + 18);
  }, [events]);

  const now = new Date();
  const dateLabel = `${DAYS_IT[now.getDay()]} ${now.getDate()} ${MONTHS_IT[now.getMonth()]}`;
  const subtitle = `${events.length} impegn${events.length === 1 ? 'o' : 'i'} oggi`;

  const toggleComplete = async (id) => {
    try {
      const all = await api.loadEvents();
      const ev = all.find(e => e.id === id);
      if (ev) {
        ev.completed = !ev.completed;
        await api.saveEvents(all);
        load();
      }
    } catch {}
  };

  // Timeline hours
  const hours = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">{dateLabel}</h1>
          <p className="text-sm text-text-muted mt-1">{subtitle}</p>
        </div>
        <button onClick={() => onAddEvent(todayStr)} className="btn-primary">
          <Plus size={16} /> Nuovo impegno
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-[1fr_280px] gap-5 min-h-0">
        {/* Timeline */}
        <div className="glass-card p-4 overflow-y-auto">
          <div className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">Timeline</div>
          <div className="relative" style={{ height: (HOUR_END - HOUR_START + 1) * 60 }}>
            {hours.map(h => (
              <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: (h - HOUR_START) * 60 }}>
                <span className="text-[10px] text-text-dim w-10 flex-shrink-0 text-right pr-2 -translate-y-[5px]">
                  {String(h).padStart(2, '0')}:00
                </span>
                <div className="flex-1 border-t border-white/5 h-[60px]" />
              </div>
            ))}
            {/* Events on timeline */}
            {events.map(ev => {
              const [sh, sm] = (ev.timeStart || '09:00').split(':').map(Number);
              const [eh, em] = (ev.timeEnd || '10:00').split(':').map(Number);
              const top = (sh - HOUR_START) * 60 + sm;
              const height = Math.max((eh * 60 + em) - (sh * 60 + sm), 20);
              return (
                <div
                  key={ev.id}
                  onClick={() => onEditEvent(ev)}
                  className="absolute left-12 right-2 rounded-lg px-3 py-1.5 cursor-pointer transition-all hover:brightness-110 hover:scale-[1.01]"
                  style={{
                    top,
                    height,
                    background: `${CAT_COLORS[ev.category] || '#8070d0'}20`,
                    borderLeft: `3px solid ${CAT_COLORS[ev.category] || '#8070d0'}`,
                  }}
                >
                  <div className="text-xs font-semibold text-white truncate">{ev.title}</div>
                  <div className="text-[10px] text-text-muted">
                    {ev.timeStart} – {ev.timeEnd}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Donut + Task list */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Donut */}
          <div className="glass-card p-4 flex flex-col items-center">
            <div className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Progresso</div>
            <canvas ref={canvasRef} style={{ width: 200, height: 200 }} />
          </div>

          {/* Task list */}
          <div className="glass-card p-4 flex-1 overflow-y-auto">
            <div className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">Attività</div>
            {events.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-text-dim text-sm">Nessun impegno oggi</div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {events.sort((a, b) => (a.timeStart || '').localeCompare(b.timeStart || '')).map(ev => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    onClick={() => onEditEvent(ev)}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleComplete(ev.id); }}
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        ev.completed
                          ? 'bg-primary border-primary'
                          : 'border-white/20 hover:border-primary/50'
                      }`}
                    >
                      {ev.completed && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${ev.completed ? 'text-text-dim line-through' : 'text-white'}`}>
                        {ev.title}
                      </div>
                      <div className="text-[10px] text-text-dim">{ev.timeStart} – {ev.timeEnd}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[ev.category] || '#8070d0' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
