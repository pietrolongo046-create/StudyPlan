import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function SettingsModal({ show, onClose }) {
  const [morningOn, setMorningOn] = useState(true);
  const [morningTime, setMorningTime] = useState('07:30');
  const [afternoonOn, setAfternoonOn] = useState(true);
  const [afternoonTime, setAfternoonTime] = useState('14:00');
  const [eveningOn, setEveningOn] = useState(true);
  const [eveningTime, setEveningTime] = useState('21:00');

  useEffect(() => {
    if (show) {
      (async () => {
        try {
          const s = await api.loadSettings();
          if (s) {
            setMorningOn(s.morningNotif ?? true);
            setMorningTime(s.morningTime ?? '07:30');
            setAfternoonOn(s.afternoonNotif ?? true);
            setAfternoonTime(s.afternoonTime ?? '14:00');
            setEveningOn(s.eveningNotif ?? true);
            setEveningTime(s.eveningTime ?? '21:00');
          }
        } catch {}
      })();
    }
  }, [show]);

  const handleSave = async () => {
    try {
      await api.saveSettings({
        morningNotif: morningOn,
        morningTime,
        afternoonNotif: afternoonOn,
        afternoonTime,
        eveningNotif: eveningOn,
        eveningTime,
      });
      onClose();
    } catch {}
  };

  if (!show) return null;

  return (
    <div className={`modal-overlay ${show ? 'show' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 440 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Impostazioni</h2>
          <button onClick={onClose} className="btn-icon">
            <X size={20} />
          </button>
        </div>

        {/* Settings */}
        <div className="space-y-4">
          {/* Morning */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div>
              <div className="text-sm font-medium text-white">Notifica mattutina</div>
              <div className="text-xs text-text-muted mt-0.5">Riepilogo impegni della giornata</div>
            </div>
            <div className="flex items-center gap-3">
              <input type="time" value={morningTime} onChange={e => setMorningTime(e.target.value)}
                className="form-input !w-24 !py-1.5 !px-2 text-xs" />
              <label className="cursor-pointer">
                <input type="checkbox" checked={morningOn} onChange={e => setMorningOn(e.target.checked)} className="hidden" />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          {/* Evening */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div>
              <div className="text-sm font-medium text-white">Notifica pomeridiana</div>
              <div className="text-xs text-text-muted mt-0.5">Promemoria impegni del pomeriggio</div>
            </div>
            <div className="flex items-center gap-3">
              <input type="time" value={afternoonTime} onChange={e => setAfternoonTime(e.target.value)}
                className="form-input !w-24 !py-1.5 !px-2 text-xs" />
              <label className="cursor-pointer">
                <input type="checkbox" checked={afternoonOn} onChange={e => setAfternoonOn(e.target.checked)} className="hidden" />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          {/* Evening */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div>
              <div className="text-sm font-medium text-white">Notifica serale</div>
              <div className="text-xs text-text-muted mt-0.5">Riepilogo completamento giornata</div>
            </div>
            <div className="flex items-center gap-3">
              <input type="time" value={eveningTime} onChange={e => setEveningTime(e.target.value)}
                className="form-input !w-24 !py-1.5 !px-2 text-xs" />
              <label className="cursor-pointer">
                <input type="checkbox" checked={eveningOn} onChange={e => setEveningOn(e.target.checked)} className="hidden" />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end mt-6">
          <button onClick={handleSave} className="btn-primary">Salva</button>
        </div>
      </div>
    </div>
  );
}
