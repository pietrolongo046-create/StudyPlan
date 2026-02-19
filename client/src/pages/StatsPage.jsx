import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle, Calendar, GraduationCap } from 'lucide-react';
import api from '../api';
import { CAT_COLORS, CAT_LABELS, MONTHS_IT, toDateStr, getWeekDates } from '../lib/constants';

export default function StatsPage() {
  const [events, setEvents] = useState([]);
  const todayStr = toDateStr(new Date());

  const load = useCallback(async () => {
    try {
      setEvents(await api.loadEvents() || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('app-data-changed', load);
    return () => window.removeEventListener('app-data-changed', load);
  }, [load]);

  const todayEvents = events.filter(e => e.date === todayStr);
  const todayDone = todayEvents.filter(e => e.completed).length;

  // Week stats
  const weekDates = getWeekDates(0);
  const weekStrs = weekDates.map(d => toDateStr(d));
  const weekEvents = events.filter(e => weekStrs.includes(e.date));
  const weekDone = weekEvents.filter(e => e.completed).length;

  // Upcoming exams (events with category 'esame' in the future)
  const upcoming = events
    .filter(e => e.category === 'esame' && e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Recent completed
  const recentDone = events
    .filter(e => e.completed)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.timeEnd || '').localeCompare(a.timeEnd || ''))
    .slice(0, 10);

  const stats = [
    { icon: Clock, label: 'Impegni oggi', value: todayEvents.length, color: 'var(--info)' },
    { icon: CheckCircle, label: 'Completati oggi', value: todayDone, color: 'var(--success)' },
    { icon: Calendar, label: 'Questa settimana', value: `${weekDone}/${weekEvents.length}`, color: 'var(--primary)' },
    { icon: GraduationCap, label: 'Esami in arrivo', value: upcoming.length, color: 'var(--danger)' },
  ];

  return (
    <div className="h-full overflow-y-auto animate-fade-in">
      <h1 className="text-2xl font-bold text-white mb-6">Riepilogo</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="glass-card p-5 text-center">
            <s.icon size={24} className="mx-auto mb-2" style={{ color: s.color }} />
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-text-muted mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Upcoming exams */}
      {upcoming.length > 0 && (
        <div className="glass-card p-5 mb-6">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Prossimi esami</h3>
          <div className="space-y-2">
            {upcoming.slice(0, 5).map(ev => {
              const d = new Date(ev.date + 'T00:00:00');
              const dd = Math.ceil((d - new Date()) / 86400000);
              return (
                <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03]">
                  <div className="w-2 h-2 rounded-full bg-danger" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{ev.title}</div>
                    <div className="text-[10px] text-text-dim">
                      {d.getDate()} {MONTHS_IT[d.getMonth()].substring(0, 3)} · {ev.timeStart}
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${dd <= 7 ? 'text-danger' : 'text-text-muted'}`}>
                    {dd === 0 ? 'Oggi!' : `Tra ${dd}g`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent history */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Attività recente</h3>
        {recentDone.length === 0 ? (
          <div className="text-center py-6 text-text-dim text-sm">Nessuna attività completata</div>
        ) : (
          <div className="space-y-1.5">
            {recentDone.map(ev => {
              const d = new Date(ev.date + 'T00:00:00');
              return (
                <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[ev.category] || '#8070d0' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{ev.title}</div>
                    <div className="text-[10px] text-text-dim">
                      {d.getDate()} {MONTHS_IT[d.getMonth()].substring(0, 3)} · {CAT_LABELS[ev.category] || ev.category}
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
