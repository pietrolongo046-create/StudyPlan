import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import api from '../api';
import { CAT_COLORS, DAYS_SHORT, MONTHS_IT, toDateStr, generateId } from '../lib/constants';

export default function MonthPage({ onAddEvent, onEditEvent }) {
  const [events, setEvents] = useState([]);
  const [monthOffset, setMonthOffset] = useState(0);

  const load = useCallback(async () => {
    try {
      const all = await api.loadEvents();
      setEvents(all || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('app-data-changed', load);
    return () => window.removeEventListener('app-data-changed', load);
  }, [load]);

  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayStr = toDateStr(new Date());

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Monday=0 start
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0

  const cells = [];
  // Previous month padding
  const prevMonthLast = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLast - i);
    cells.push({ date: d, inMonth: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  // Next month padding to fill 6 rows
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ date: new Date(year, month + 1, d), inMonth: false });
  }

  // Group events by date string
  const eventsByDate = {};
  events.forEach(ev => {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  });

  // Sort events within each day by time
  Object.values(eventsByDate).forEach(arr => {
    arr.sort((a, b) => (a.timeStart || '').localeCompare(b.timeStart || ''));
  });

  const handleDayClick = (dateStr) => {
    onAddEvent(dateStr);
  };

  const handleEventClick = (e, ev) => {
    e.stopPropagation();
    onEditEvent(ev);
  };

  const weekHeaders = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button onClick={() => setMonthOffset(m => m - 1)} className="btn-icon">
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-lg font-bold text-white min-w-[200px] text-center">
          {MONTHS_IT[month]} {year}
        </h2>
        <button onClick={() => setMonthOffset(m => m + 1)} className="btn-icon">
          <ChevronRight size={18} />
        </button>
        <button onClick={() => setMonthOffset(0)} className="btn-secondary text-xs !py-1.5 !px-3">
          Oggi
        </button>
      </div>

      {/* Calendar */}
      <div className="flex-1 glass-card overflow-hidden flex flex-col min-h-0">
        {/* Day of week headers */}
        <div className="grid grid-cols-7 border-b border-white/5 flex-shrink-0">
          {weekHeaders.map(d => (
            <div key={d} className="p-2 text-center">
              <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">{d}</span>
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
          {cells.map((cell, idx) => {
            const ds = toDateStr(cell.date);
            const isToday = ds === todayStr;
            const dayEvents = eventsByDate[ds] || [];
            const maxShow = 3;
            const extraCount = dayEvents.length - maxShow;

            return (
              <div
                key={idx}
                onClick={() => cell.inMonth && handleDayClick(ds)}
                className={`
                  relative border-r border-b border-white/5 p-1.5 cursor-pointer
                  transition-colors duration-150 overflow-hidden
                  ${cell.inMonth ? 'hover:bg-white/[0.03]' : 'opacity-30'}
                  ${isToday ? 'bg-primary/[0.06]' : ''}
                `}
              >
                {/* Day number */}
                <div className={`
                  text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${isToday ? 'bg-primary text-white' : cell.inMonth ? 'text-text-dim' : 'text-text-dim/40'}
                `}>
                  {cell.date.getDate()}
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {dayEvents.slice(0, maxShow).map(ev => {
                    const color = CAT_COLORS[ev.category] || '#8070d0';
                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => handleEventClick(e, ev)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] truncate transition-all hover:brightness-125"
                        style={{
                          background: `${color}20`,
                          borderLeft: `2px solid ${color}`,
                        }}
                      >
                        {ev.timeStart && (
                          <span className="text-text-dim font-mono flex-shrink-0">{ev.timeStart}</span>
                        )}
                        <span className="text-white truncate font-medium">{ev.title}</span>
                      </div>
                    );
                  })}
                  {extraCount > 0 && (
                    <div className="text-[9px] text-primary font-semibold px-1.5">
                      +{extraCount} altri
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
