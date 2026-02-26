import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { CAT_COLORS, CAT_LABELS, generateId } from '../lib/constants';

const CATEGORIES = Object.keys(CAT_COLORS);

export default function EventModal({ show, event, defaultDate, onClose, onSave, onDelete }) {
  // Dynamic default: next half-hour from now
  const getNextHalfHour = () => {
    const n = new Date();
    let m = n.getMinutes();
    let h = n.getHours();
    m = m < 30 ? 30 : 0;
    if (m === 0) h = (h + 1) % 24;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };
  const getEndFromStart = (start) => {
    const [h, m] = start.split(':').map(Number);
    const eh = (h + 1) % 24;
    return `${String(eh).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('10:00');
  const [category, setCategory] = useState('lezione');
  const [notes, setNotes] = useState('');
  const [reminder1On, setReminder1On] = useState(false);
  const [reminder1Time, setReminder1Time] = useState('20:00');
  const [reminder2On, setReminder2On] = useState(false);
  const [reminder2Time, setReminder2Time] = useState('07:00');
  const titleRef = useRef(null);

  const isEdit = !!event?.id;

  useEffect(() => {
    if (show) {
      if (event) {
        setTitle(event.title || '');
        setDate(event.date || '');
        setTimeStart(event.timeStart || '09:00');
        setTimeEnd(event.timeEnd || '10:00');
        setCategory(event.category || 'lezione');
        setNotes(event.notes || '');
        setReminder1On(event.reminders?.dayBefore?.enabled || false);
        setReminder1Time(event.reminders?.dayBefore?.time || '20:00');
        setReminder2On(event.reminders?.sameDay?.enabled || false);
        setReminder2Time(event.reminders?.sameDay?.time || '07:00');
      } else {
        const nextTime = getNextHalfHour();
        setTitle('');
        setDate(defaultDate || new Date().toISOString().split('T')[0]);
        setTimeStart(nextTime);
        setTimeEnd(getEndFromStart(nextTime));
        setCategory('lezione');
        setNotes('');
        setReminder1On(false);
        setReminder1Time('20:00');
        setReminder2On(false);
        setReminder2Time('07:00');
      }
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [show, event, defaultDate]);

  // Auto end time
  useEffect(() => {
    if (timeStart && !isEdit) {
      const [h, m] = timeStart.split(':').map(Number);
      const endH = h + 1;
      if (endH <= 23) {
        setTimeEnd(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
  }, [timeStart, isEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const data = {
      id: event?.id || generateId(),
      title: title.trim(),
      date,
      timeStart,
      timeEnd,
      category,
      notes: notes.trim(),
      completed: event?.completed || false,
      reminders: {
        dayBefore: { enabled: reminder1On, time: reminder1Time },
        sameDay: { enabled: reminder2On, time: reminder2Time },
      },
    };
    onSave(data);
  };

  if (!show) return null;

  return (
    <div className={`modal-overlay ${show ? 'show' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? 'Modifica impegno' : 'Nuovo impegno'}
          </h2>
          <button onClick={onClose} className="btn-icon">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Titolo</label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Es: Lezione di Analisi"
              className="form-input"
              required
            />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Ora inizio</label>
              <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} className="form-input" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Ora fine</label>
              <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} className="form-input" required />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Categoria</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    category === cat
                      ? 'text-white shadow-lg scale-105'
                      : 'text-text-muted hover:text-white opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    background: category === cat ? CAT_COLORS[cat] : 'rgba(255,255,255,0.06)',
                    boxShadow: category === cat ? `0 4px 15px ${CAT_COLORS[cat]}40` : 'none',
                  }}
                >
                  {CAT_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Note (opzionale)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Appunti, aula, link..."
              className="form-input"
            />
          </div>

          {/* Reminders */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-2">Promemoria</label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <input type="checkbox" checked={reminder1On} onChange={e => setReminder1On(e.target.checked)} className="hidden" />
                  <span className="toggle-slider" />
                </label>
                <span className="text-sm text-text-muted">Giorno prima alle</span>
                <input type="time" value={reminder1Time} onChange={e => setReminder1Time(e.target.value)}
                  className="form-input !w-24 !py-1.5 !px-2 text-xs" />
              </div>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <input type="checkbox" checked={reminder2On} onChange={e => setReminder2On(e.target.checked)} className="hidden" />
                  <span className="toggle-slider" />
                </label>
                <span className="text-sm text-text-muted">Stesso giorno alle</span>
                <input type="time" value={reminder2Time} onChange={e => setReminder2Time(e.target.value)}
                  className="form-input !w-24 !py-1.5 !px-2 text-xs" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {isEdit && (
              <button type="button" onClick={() => onDelete(event.id)} className="btn-danger">
                Elimina
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="btn-secondary">Annulla</button>
            <button type="submit" className="btn-primary">Salva</button>
          </div>
        </form>
      </div>
    </div>
  );
}
