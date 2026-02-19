import { useState, useEffect, useRef } from 'react';
import { X, Plus, ExternalLink, Trash2 } from 'lucide-react';
import api from '../api';
import { generateId, calcAutoProgress } from '../lib/constants';

export default function CareerExamModal({ show, exam, career, onClose, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [cfu, setCfu] = useState(6);
  const [year, setYear] = useState(1);
  const [sem, setSem] = useState(1);
  const [status, setStatus] = useState('pending');
  const [grade, setGrade] = useState('');
  const [passDate, setPassDate] = useState('');
  const [examDate, setExamDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [pdfs, setPdfs] = useState([]);
  const [activeFileTab, setActiveFileTab] = useState(0);
  const nameRef = useRef(null);

  const isEdit = !!exam?.id;

  useEffect(() => {
    if (show) {
      if (exam) {
        setName(exam.name || '');
        setCfu(exam.cfu || 6);
        setYear(exam.year || 1);
        setSem(exam.sem || 1);
        setStatus(exam.status || 'pending');
        setGrade(exam.grade || '');
        setPassDate(exam.passDate || '');
        setExamDate(exam.examDate || '');
        setProgress(exam.progress || 0);
        setPdfs(JSON.parse(JSON.stringify(exam.pdfs || [])));
        setActiveFileTab(0);
      } else {
        setName('');
        setCfu(6);
        setYear(1);
        setSem(1);
        setStatus('pending');
        setGrade('');
        setPassDate('');
        setExamDate('');
        setProgress(0);
        setPdfs([]);
        setActiveFileTab(0);
      }
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [show, exam]);

  // Recalc progress when PDFs change
  useEffect(() => {
    const prog = calcAutoProgress({ pdfs });
    setProgress(prog);
  }, [pdfs]);

  const handleAddPdf = async () => {
    // File type dialog
    const type = await showFileTypeDialog();
    if (!type) return;

    try {
      const result = await api.pickPdf();
      if (result) {
        const newPdf = {
          fileName: result.fileName,
          originalName: result.originalName,
          type,
          pages: type === 'appunti' ? { total: result.pages || 0, read: 0, studied: 0, repeated: 0 } : undefined,
          exercises: type === 'esercizi' ? [] : undefined,
        };
        setPdfs(prev => [...prev, newPdf]);
      }
    } catch {}
  };

  const handleDeletePdf = async (idx) => {
    const removed = pdfs[idx];
    if (removed) {
      try { await api.deletePdf(removed.fileName); } catch {}
    }
    setPdfs(prev => prev.filter((_, i) => i !== idx));
    if (activeFileTab >= pdfs.length - 1) setActiveFileTab(Math.max(0, pdfs.length - 2));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data = {
      id: exam?.id || generateId(),
      name: name.trim(),
      cfu: parseInt(cfu) || 6,
      year: parseInt(year) || 1,
      sem: parseInt(sem) || 1,
      status,
      grade: status === 'passed' ? (parseInt(grade) || null) : null,
      passDate: status === 'passed' ? passDate : '',
      examDate: status !== 'passed' ? examDate : '',
      progress,
      pdfs,
    };
    onSave(data);
  };

  if (!show) return null;

  const activePdf = pdfs[activeFileTab];

  return (
    <div className={`modal-overlay ${show ? 'show' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 620, maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? 'Modifica esame' : 'Aggiungi esame'}
          </h2>
          <button onClick={onClose} className="btn-icon"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Nome esame</label>
            <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Es: Analisi Matematica I" className="form-input" required />
          </div>

          {/* CFU / Year / Sem */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">CFU</label>
              <input type="number" value={cfu} onChange={e => setCfu(e.target.value)} min="1" max="30" className="form-input" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Anno</label>
              <select value={year} onChange={e => setYear(e.target.value)} className="form-select">
                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}° Anno</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Semestre</label>
              <select value={sem} onChange={e => setSem(e.target.value)} className="form-select">
                <option value={1}>1° Semestre</option>
                <option value={2}>2° Semestre</option>
              </select>
            </div>
          </div>

          {/* Status / Grade / Date */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Stato</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="form-select">
                <option value="pending">Da sostenere</option>
                <option value="passed">Superato</option>
              </select>
            </div>
            {status === 'passed' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Voto</label>
                  <select value={grade} onChange={e => setGrade(e.target.value)} className="form-select">
                    <option value="">—</option>
                    {Array.from({ length: 13 }, (_, i) => 18 + i).map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                    <option value="31">30 e Lode</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Data superamento</label>
                  <input type="date" value={passDate} onChange={e => setPassDate(e.target.value)} className="form-input" />
                </div>
              </>
            )}
          </div>

          {/* Schedule (pending only) */}
          {status !== 'passed' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Data esame</label>
                <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Preparazione (auto)</label>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        background: progress >= 80 ? '#34d399' : progress >= 50 ? '#fbbf24' : '#f87171',
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-text-muted w-8">{progress}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-white/5" />

          {/* PDF Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">File allegati</h3>
              <button type="button" onClick={handleAddPdf} className="btn-secondary text-xs !py-1.5 !px-3">
                <Plus size={14} /> Aggiungi PDF
              </button>
            </div>

            {pdfs.length === 0 ? (
              <div className="text-center py-4 text-text-dim text-xs">Nessun file allegato</div>
            ) : (
              <div className="space-y-1.5">
                {pdfs.map((pdf, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03]">
                    <span className="text-lg">{pdf.type === 'esercizi' ? '🏋️' : '📖'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{pdf.originalName}</div>
                      <div className="text-[10px] text-text-dim">
                        {pdf.type === 'esercizi' ? 'Esercizi' : 'Appunti'}
                        {pdf.pages?.total > 0 ? ` · ${pdf.pages.total} pag.` : ''}
                      </div>
                    </div>
                    <button type="button" onClick={() => api.openPdf(pdf.fileName)} className="btn-icon !w-8 !h-8">
                      <ExternalLink size={14} />
                    </button>
                    <button type="button" onClick={() => handleDeletePdf(i)} className="btn-icon !w-8 !h-8 hover:!text-danger">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File Tracking */}
          {pdfs.length > 0 && (
            <>
              <div className="border-t border-white/5" />
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Tracciamento per file</h3>
                {/* Tabs */}
                <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                  {pdfs.map((pdf, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveFileTab(i)}
                      className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                        i === activeFileTab
                          ? 'bg-primary/20 text-primary font-semibold'
                          : 'bg-white/[0.03] text-text-dim hover:text-text-muted'
                      }`}
                    >
                      {pdf.type === 'esercizi' ? '🏋️' : '📖'}{' '}
                      {pdf.originalName.length > 18 ? pdf.originalName.substring(0, 16) + '…' : pdf.originalName}
                    </button>
                  ))}
                </div>

                {/* Tracking body */}
                {activePdf && (
                  activePdf.type === 'appunti'
                    ? <AppuntiTracking pdf={activePdf} onChange={() => setPdfs([...pdfs])} />
                    : <EserciziTracking pdf={activePdf} onChange={() => setPdfs([...pdfs])} />
                )}
              </div>

              {/* Global summary */}
              {pdfs.some(p => p.type === 'appunti' && p.pages?.total > 0) && (
                <>
                  <div className="border-t border-white/5" />
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Riepilogo complessivo</h3>
                    <GlobalSummaryChart pdfs={pdfs} />
                  </div>
                </>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/5">
            {isEdit && (
              <button type="button" onClick={() => onDelete(exam.id)} className="btn-danger">
                <Trash2 size={14} /> Elimina
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

// ─── File Type Dialog ───
function showFileTypeDialog() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.style.zIndex = '1100';
    overlay.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;max-width:340px;width:90%;">
        <h3 style="color:#fff;font-size:15px;font-weight:700;margin-bottom:16px;">Tipo di file</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button data-type="appunti" style="display:flex;align-items:center;gap:12px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:12px;cursor:pointer;text-align:left;color:#e2e4ef;">
            <span style="font-size:24px;">📖</span>
            <div><strong>Appunti / Studio</strong><div style="font-size:11px;color:#7c8099;margin-top:2px;">Traccia pagine lette, studiate e ripetute</div></div>
          </button>
          <button data-type="esercizi" style="display:flex;align-items:center;gap:12px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:12px;cursor:pointer;text-align:left;color:#e2e4ef;">
            <span style="font-size:24px;">🏋️</span>
            <div><strong>Esercizi</strong><div style="font-size:11px;color:#7c8099;margin-top:2px;">Traccia argomenti: fatti, da fare, in esecuzione</div></div>
          </button>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px;">
          <button data-type="cancel" style="padding:8px 16px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:8px;color:#e2e4ef;cursor:pointer;font-size:13px;">Annulla</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cleanup = () => document.body.removeChild(overlay);
    overlay.querySelectorAll('button[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        cleanup();
        resolve(type === 'cancel' ? null : type);
      });
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { cleanup(); resolve(null); }
    });
  });
}

// ─── Appunti Tracking Component ───
function AppuntiTracking({ pdf, onChange }) {
  const p = pdf.pages || { total: 0, read: 0, studied: 0, repeated: 0 };

  const updateField = (field, val) => {
    if (!pdf.pages) pdf.pages = { total: 0, read: 0, studied: 0, repeated: 0 };
    const v = Math.max(0, val);
    const total = field === 'total' ? v : (pdf.pages.total || 0);
    pdf.pages[field] = field === 'total' ? v : Math.min(v, total);
    onChange();
  };

  const fields = [
    { key: 'total', label: 'Pagine totali', color: null },
    { key: 'read', label: 'Lette', color: '#60a5fa' },
    { key: 'studied', label: 'Studiate', color: '#8070d0' },
    { key: 'repeated', label: 'Ripetute', color: '#34d399' },
  ];

  return (
    <div className="space-y-2">
      {fields.map(f => (
        <div key={f.key} className="flex items-center justify-between">
          <span className="text-xs text-text-muted flex items-center gap-2">
            {f.color && <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />}
            {f.label}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => updateField(f.key, (p[f.key] || 0) - 1)}
              className="w-6 h-6 rounded bg-white/5 text-text-dim text-xs flex items-center justify-center hover:bg-white/10">▼</button>
            <input
              type="number"
              value={p[f.key] || 0}
              onChange={e => updateField(f.key, parseInt(e.target.value) || 0)}
              className="form-input !w-16 !py-1 !px-2 text-xs text-center"
              min="0"
            />
            <button type="button" onClick={() => updateField(f.key, (p[f.key] || 0) + 1)}
              className="w-6 h-6 rounded bg-white/5 text-text-dim text-xs flex items-center justify-center hover:bg-white/10">▲</button>
          </div>
        </div>
      ))}
      {p.total > 0 && <PageChart pages={p} />}
    </div>
  );
}

// ─── Esercizi Tracking Component ───
function EserciziTracking({ pdf, onChange }) {
  const exercises = pdf.exercises || [];
  const statusLabels = { 'da-fare': 'Da fare', 'in-corso': 'In esecuzione', 'fatto': 'Fatto' };

  const updateExercise = (idx, field, val) => {
    pdf.exercises[idx][field] = val;
    onChange();
  };

  const addExercise = () => {
    if (!pdf.exercises) pdf.exercises = [];
    pdf.exercises.push({ name: `Argomento ${pdf.exercises.length + 1}`, status: 'da-fare' });
    onChange();
  };

  const deleteExercise = (idx) => {
    pdf.exercises.splice(idx, 1);
    onChange();
  };

  const counts = {
    fatto: exercises.filter(e => e.status === 'fatto').length,
    'in-corso': exercises.filter(e => e.status === 'in-corso').length,
    'da-fare': exercises.filter(e => e.status === 'da-fare').length,
  };

  return (
    <div className="space-y-2">
      {exercises.map((exc, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={exc.name || ''}
            onChange={e => updateExercise(i, 'name', e.target.value)}
            placeholder="Nome argomento"
            className="form-input !py-1.5 text-xs flex-1"
          />
          <select
            value={exc.status}
            onChange={e => updateExercise(i, 'status', e.target.value)}
            className="form-select !py-1.5 text-xs !w-auto"
          >
            <option value="da-fare">Da fare</option>
            <option value="in-corso">In esecuzione</option>
            <option value="fatto">Fatto</option>
          </select>
          <button type="button" onClick={() => deleteExercise(i)} className="btn-icon !w-7 !h-7 hover:!text-danger">
            <X size={12} />
          </button>
        </div>
      ))}

      <button type="button" onClick={addExercise} className="btn-secondary text-xs !py-1.5">
        <Plus size={12} /> Aggiungi argomento
      </button>

      <div className="text-xs text-text-dim flex gap-2">
        <span className="text-success">{counts.fatto} fatti</span> ·
        <span className="text-warning">{counts['in-corso']} in corso</span> ·
        <span className="text-danger">{counts['da-fare']} da fare</span>
      </div>
    </div>
  );
}

// ─── Page Chart ───
function PageChart({ pages }) {
  const total = pages.total || 0;
  if (total === 0) return null;

  const repeated = pages.repeated || 0;
  const studied = pages.studied || 0;
  const read = pages.read || 0;

  const rPct = (repeated / total * 100).toFixed(1);
  const sPct = (Math.max(studied - repeated, 0) / total * 100).toFixed(1);
  const lPct = (Math.max(read - studied, 0) / total * 100).toFixed(1);

  return (
    <div className="mt-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
        <div style={{ width: `${rPct}%`, background: '#34d399' }} />
        <div style={{ width: `${sPct}%`, background: '#8070d0' }} />
        <div style={{ width: `${lPct}%`, background: '#60a5fa' }} />
      </div>
      <div className="flex gap-4 mt-1.5 text-[10px] text-text-dim">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success" /> Ripetute {repeated}/{total}</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Studiate {studied}/{total}</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-info" /> Lette {read}/{total}</span>
      </div>
    </div>
  );
}

// ─── Global Summary Chart ───
function GlobalSummaryChart({ pdfs }) {
  const appuntiPdfs = pdfs.filter(p => p.type === 'appunti' && p.pages?.total > 0);
  if (!appuntiPdfs.length) return <div className="text-xs text-text-dim">Nessun file di appunti</div>;

  const agg = { total: 0, read: 0, studied: 0, repeated: 0 };
  appuntiPdfs.forEach(p => {
    agg.total += p.pages.total || 0;
    agg.read += p.pages.read || 0;
    agg.studied += p.pages.studied || 0;
    agg.repeated += p.pages.repeated || 0;
  });

  if (agg.total === 0) return <div className="text-xs text-text-dim">Nessuna pagina tracciata</div>;
  return <PageChart pages={agg} />;
}
