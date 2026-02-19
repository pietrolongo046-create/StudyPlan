import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, GraduationCap, ChevronRight, Check } from 'lucide-react';
import api from '../api';
import { CAREER_TYPES, MONTHS_IT, generateId, calcAutoProgress } from '../lib/constants';
import CareerExamModal from '../components/CareerExamModal';

export default function CareerPage() {
  const [career, setCareer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [examModal, setExamModal] = useState({ show: false, exam: null });

  // Setup form
  const [uniName, setUniName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [careerType, setCareerType] = useState('triennale');

  const load = useCallback(async () => {
    try {
      const c = await api.loadCareer();
      setCareer(c && c.type ? c : null);
    } catch { setCareer(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('app-data-changed', load);
    return () => window.removeEventListener('app-data-changed', load);
  }, [load]);

  const handleSetup = async () => {
    const ct = CAREER_TYPES[careerType];
    const data = {
      university: uniName.trim(),
      course: courseName.trim(),
      type: careerType,
      totalCfu: ct.cfu,
      years: ct.years,
      exams: [],
    };
    await api.saveCareer(data);
    setCareer(data);
  };

  const handleReset = async () => {
    if (!confirm('Sei sicuro di voler eliminare il piano carriera? Tutti i dati saranno persi.')) return;
    // Delete all PDFs
    if (career?.exams) {
      for (const ex of career.exams) {
        if (ex.pdfs) {
          for (const pdf of ex.pdfs) {
            try { await api.deletePdf(pdf.fileName); } catch {}
          }
        }
      }
    }
    await api.saveCareer({});
    setCareer(null);
  };

  const handleSaveExam = async (exam) => {
    const updated = { ...career };
    const idx = updated.exams.findIndex(e => e.id === exam.id);
    if (idx >= 0) {
      updated.exams[idx] = exam;
    } else {
      updated.exams.push(exam);
    }
    await api.saveCareer(updated);
    setCareer(updated);
    setExamModal({ show: false, exam: null });
  };

  const handleDeleteExam = async (id) => {
    const updated = { ...career };
    const ex = updated.exams.find(e => e.id === id);
    if (ex?.pdfs) {
      for (const pdf of ex.pdfs) {
        try { await api.deletePdf(pdf.fileName); } catch {}
      }
    }
    updated.exams = updated.exams.filter(e => e.id !== id);
    await api.saveCareer(updated);
    setCareer(updated);
    setExamModal({ show: false, exam: null });
  };

  if (loading) return <div className="h-full flex items-center justify-center text-text-dim">Caricamento...</div>;

  // ─── SETUP SCREEN ───
  if (!career) {
    return (
      <div className="h-full flex items-center justify-center animate-fade-in">
        <div className="text-center max-w-md">
          <GraduationCap size={56} className="mx-auto mb-4 text-text-dim/50" />
          <h2 className="text-xl font-bold text-white mb-2">Configura il tuo Piano Carriera</h2>
          <p className="text-sm text-text-muted mb-6">Inserisci i dati del tuo percorso universitario — tutto resta salvato solo sul tuo computer</p>

          <div className="space-y-3 text-left">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Università</label>
              <input type="text" value={uniName} onChange={e => setUniName(e.target.value)}
                placeholder="Es: Politecnico di Torino" className="form-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Corso di Laurea</label>
              <input type="text" value={courseName} onChange={e => setCourseName(e.target.value)}
                placeholder="Es: Ingegneria Informatica" className="form-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Tipo di percorso</label>
              <select value={careerType} onChange={e => setCareerType(e.target.value)} className="form-select">
                {Object.entries(CAREER_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label} ({val.cfu} CFU)</option>
                ))}
              </select>
            </div>
          </div>

          <button onClick={handleSetup} className="btn-primary mt-6">
            <Check size={16} /> Crea Piano Carriera
          </button>
        </div>
      </div>
    );
  }

  // ─── CAREER DASHBOARD ───
  const passedExams = career.exams.filter(e => e.status === 'passed');
  const cfuDone = passedExams.reduce((s, e) => s + (e.cfu || 0), 0);
  const media = passedExams.length > 0
    ? (passedExams.reduce((s, e) => s + (e.grade || 0) * (e.cfu || 0), 0) / passedExams.reduce((s, e) => s + (e.cfu || 0), 0)).toFixed(1)
    : '—';
  const progressPct = career.totalCfu > 0 ? Math.round(cfuDone / career.totalCfu * 100) : 0;

  // Upcoming exams
  const nowStr = toDateStr(new Date());
  const upcoming = career.exams
    .filter(e => e.status !== 'passed' && e.examDate && e.examDate >= nowStr)
    .sort((a, b) => a.examDate.localeCompare(b.examDate))
    .slice(0, 5);

  // Filtered & sorted exams
  let filtered = career.exams;
  if (statusFilter === 'passed') filtered = filtered.filter(e => e.status === 'passed');
  else if (statusFilter === 'pending') filtered = filtered.filter(e => e.status !== 'passed');
  filtered = [...filtered].sort((a, b) => {
    if (a.status === 'passed' && b.status !== 'passed') return 1;
    if (a.status !== 'passed' && b.status === 'passed') return -1;
    if (a.year !== b.year) return (a.year || 1) - (b.year || 1);
    return (a.sem || 1) - (b.sem || 1);
  });

  return (
    <div className="h-full overflow-y-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Piano Carriera</h1>
          <p className="text-sm text-text-muted mt-1">{career.university} · {career.course}</p>
        </div>
        <div className="flex items-center gap-4">
          {[
            { label: 'CFU acquisiti', val: cfuDone },
            { label: 'CFU totali', val: career.totalCfu },
            { label: 'Esami superati', val: passedExams.length },
            { label: 'Media pond.', val: media },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-lg font-bold text-white">{s.val}</div>
              <div className="text-[10px] text-text-dim">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-xs font-bold text-text-muted">{progressPct}%</span>
      </div>

      {/* Upcoming exams strip */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Prossimi esami</div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {upcoming.map(ex => {
              const ed = new Date(ex.examDate + 'T00:00:00');
              const dd = Math.ceil((ed - new Date()) / 86400000);
              const ds = `${ed.getDate()} ${MONTHS_IT[ed.getMonth()].substring(0, 3)}`;
              const prog = ex.progress || 0;
              const pc = prog >= 80 ? '#34d399' : prog >= 50 ? '#fbbf24' : '#f87171';
              return (
                <div
                  key={ex.id}
                  onClick={() => setExamModal({ show: true, exam: ex })}
                  className="glass-card p-4 min-w-[160px] cursor-pointer hover:border-primary/30"
                >
                  <div className="text-sm font-semibold text-white truncate">{ex.name}</div>
                  <div className="text-xs text-text-dim mt-1">{ds}</div>
                  <div className={`text-xs font-bold mt-1 ${dd <= 7 ? 'text-danger' : 'text-text-muted'}`}>
                    {dd === 0 ? 'Oggi!' : `Tra ${dd}g`}
                  </div>
                  <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${prog}%`, background: pc }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setExamModal({ show: true, exam: null })} className="btn-primary">
          <Plus size={16} /> Aggiungi esame
        </button>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select !w-auto !py-2 text-xs">
          <option value="all">Tutti gli esami</option>
          <option value="pending">Da sostenere</option>
          <option value="passed">Superati</option>
        </select>
        <div className="flex-1" />
        <button onClick={handleReset} className="btn-danger text-xs !py-2">
          <Trash2 size={14} /> Reset
        </button>
      </div>

      {/* Exam list */}
      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <GraduationCap size={48} className="mx-auto mb-3 text-text-dim/30" />
          <div className="text-text-dim">Nessun esame</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(ex => {
            const isPassed = ex.status === 'passed';
            const gradeDisplay = isPassed && ex.grade ? (ex.grade === 31 ? '30L' : ex.grade) : '—';
            const prog = ex.progress || 0;
            const progColor = prog >= 80 ? '#34d399' : prog >= 50 ? '#fbbf24' : '#f87171';

            // Countdown
            let countdown = null;
            if (!isPassed && ex.examDate) {
              const ed = new Date(ex.examDate + 'T00:00:00');
              const dd = Math.ceil((ed - new Date()) / 86400000);
              const ds = `${ed.getDate()} ${MONTHS_IT[ed.getMonth()].substring(0, 3)}`;
              countdown = dd < 0 ? 'Passato' : dd === 0 ? 'Oggi!' : `${ds} (${dd}g)`;
            }

            // File badges
            const appunti = (ex.pdfs || []).filter(p => p.type === 'appunti').length;
            const esercizi = (ex.pdfs || []).filter(p => p.type === 'esercizi').length;

            return (
              <div
                key={ex.id}
                onClick={() => setExamModal({ show: true, exam: ex })}
                className={`flex items-center gap-4 p-4 rounded-xl border border-white/5 cursor-pointer transition-all hover:border-primary/20 hover:bg-white/[0.02] ${isPassed ? 'opacity-70' : ''}`}
              >
                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isPassed && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                    <span className="text-sm font-semibold text-white truncate">{ex.name}</span>
                    {appunti > 0 && <span className="text-[10px] bg-info/10 text-info px-1.5 py-0.5 rounded">📖 {appunti}</span>}
                    {esercizi > 0 && <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded">🏋️ {esercizi}</span>}
                  </div>
                  <div className="text-[11px] text-text-dim mt-0.5 flex items-center gap-2">
                    <span>{ex.year}° anno, {ex.sem}° sem</span>
                    {countdown && (
                      <>
                        <span>·</span>
                        <span className={countdown.includes('Oggi') || parseInt(countdown.match(/\d+/)?.[0]) <= 7 ? 'text-danger font-bold' : ''}>
                          {countdown}
                        </span>
                      </>
                    )}
                  </div>
                  {!isPassed && (
                    <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden max-w-[200px]">
                      <div className="h-full rounded-full" style={{ width: `${prog}%`, background: progColor }} />
                    </div>
                  )}
                </div>

                {/* CFU */}
                <div className="text-center w-12">
                  <div className="text-sm font-bold text-white">{ex.cfu}</div>
                  <div className="text-[9px] text-text-dim">CFU</div>
                </div>

                {/* Grade */}
                <div className={`text-center w-12 ${gradeDisplay === '—' ? 'opacity-30' : ''}`}>
                  <div className="text-sm font-bold text-white">{gradeDisplay}</div>
                </div>

                {/* Status */}
                <div className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                  isPassed ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                }`}>
                  {isPassed ? 'Superato' : 'Da sostenere'}
                </div>

                <ChevronRight size={16} className="text-text-dim" />
              </div>
            );
          })}
        </div>
      )}

      {/* Exam Modal */}
      <CareerExamModal
        show={examModal.show}
        exam={examModal.exam}
        career={career}
        onClose={() => setExamModal({ show: false, exam: null })}
        onSave={handleSaveExam}
        onDelete={handleDeleteExam}
      />
    </div>
  );
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
