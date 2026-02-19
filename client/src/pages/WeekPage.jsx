import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';
import { CAT_COLORS, DAYS_SHORT, MONTHS_IT, HOUR_START, HOUR_END, getWeekDates, toDateStr, generateId } from '../lib/constants';

const CELL_H = 60; // px per hour

export default function WeekPage({ onEditEvent }) {
  const [events, setEvents] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const scrollRef = useRef(null);
  const todayStr = toDateStr(new Date());
  const weekDates = getWeekDates(weekOffset);

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

  // Scroll to 8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - HOUR_START) * CELL_H;
    }
  }, []);

  const weekTitle = (() => {
    const first = weekDates[0];
    const last = weekDates[6];
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()} - ${last.getDate()} ${MONTHS_IT[first.getMonth()]}`;
    }
    return `${first.getDate()} ${MONTHS_IT[first.getMonth()].substring(0, 3)} - ${last.getDate()} ${MONTHS_IT[last.getMonth()].substring(0, 3)}`;
  })();

  // Click empty space to add event
  const handleColumnClick = async (e, dayIndex) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
    const totalMin = Math.round(y / CELL_H * 60);
    const hour = Math.floor(totalMin / 60) + HOUR_START;
    const min = Math.round((totalMin % 60) / 15) * 15;

    const dateStr = toDateStr(weekDates[dayIndex]);
    const timeStart = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const endH = hour + 1;
    const timeEnd = `${String(Math.min(endH, HOUR_END)).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

    const newEvent = {
      id: generateId(),
      title: 'Nuovo impegno',
      date: dateStr,
      timeStart,
      timeEnd,
      category: 'studio',
      notes: '',
      completed: false,
      reminders: { dayBefore: { enabled: false, time: '20:00' }, sameDay: { enabled: false, time: '07:00' } },
    };
    try {
      const all = await api.loadEvents();
      all.push(newEvent);
      await api.saveEvents(all);
      load();
      onEditEvent(newEvent);
    } catch {}
  };

  const hours = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button onClick={() => setWeekOffset(w => w - 1)} className="btn-icon">
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-lg font-bold text-white min-w-[200px] text-center">{weekTitle}</h2>
        <button onClick={() => setWeekOffset(w => w + 1)} className="btn-icon">
          <ChevronRight size={18} />
        </button>
        <button onClick={() => setWeekOffset(0)} className="btn-secondary text-xs !py-1.5 !px-3">Oggi</button>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 glass-card overflow-hidden flex flex-col min-h-0">
        {/* Day headers */}
        <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-white/5 flex-shrink-0">
          <div className="p-2" />
          {weekDates.map((d, i) => {
            const ds = toDateStr(d);
            const isToday = ds === todayStr;
            return (
              <div key={i} className={`p-2 text-center border-l border-white/5 ${isToday ? 'bg-primary/10' : ''}`}>
                <div className="text-[10px] text-text-dim uppercase">{DAYS_SHORT[(d.getDay() + 7) % 7]}</div>
                <div className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-white'}`}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="grid grid-cols-[50px_repeat(7,1fr)] relative" style={{ height: hours.length * CELL_H }}>
            {/* Hour gutter */}
            <div className="relative">
              {hours.map(h => (
                <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: (h - HOUR_START) * CELL_H }}>
                  <span className="text-[10px] text-text-dim w-full text-right pr-2 -translate-y-[5px]">
                    {String(h).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDates.map((d, dayIdx) => {
              const ds = toDateStr(d);
              const isToday = ds === todayStr;
              const dayEvents = events.filter(e => e.date === ds);

              return (
                <div
                  key={dayIdx}
                  className={`relative border-l border-white/5 cursor-pointer ${isToday ? 'bg-primary/[0.03]' : ''}`}
                  onClick={(e) => handleColumnClick(e, dayIdx)}
                >
                  {/* Hour lines */}
                  {hours.map(h => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-white/5"
                      style={{ top: (h - HOUR_START) * CELL_H }}
                    />
                  ))}

                  {/* Events */}
                  {dayEvents.map(ev => {
                    const [sh, sm] = (ev.timeStart || '09:00').split(':').map(Number);
                    const [eh, em] = (ev.timeEnd || '10:00').split(':').map(Number);
                    const top = (sh - HOUR_START) * CELL_H + (sm / 60) * CELL_H;
                    const height = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * CELL_H, 20);
                    const color = CAT_COLORS[ev.category] || '#8070d0';

                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); onEditEvent(ev); }}
                        className="absolute left-1 right-1 rounded-md px-1.5 py-0.5 cursor-pointer overflow-hidden transition-all hover:brightness-125 hover:z-10"
                        style={{
                          top,
                          height,
                          background: `${color}25`,
                          borderLeft: `3px solid ${color}`,
                        }}
                      >
                        <div className="text-[10px] font-semibold text-white truncate">{ev.title}</div>
                        {height > 30 && (
                          <div className="text-[9px] text-text-dim">{ev.timeStart}–{ev.timeEnd}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
