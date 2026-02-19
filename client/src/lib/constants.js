/* ═══════════════════════════════════════════════════════════
 *  StudyPlan — Constants
 * ═══════════════════════════════════════════════════════════ */

export const CAT_COLORS = {
  lezione:   '#60a5fa',
  studio:    '#8070d0',
  esame:     '#f87171',
  progetto:  '#34d399',
  personale: '#fbbf24',
  pausa:     '#2dd4bf',
};

export const CAT_LABELS = {
  lezione:   'Lezione',
  studio:    'Studio',
  esame:     'Esame',
  progetto:  'Progetto',
  personale: 'Personale',
  pausa:     'Pausa',
};

export const DAYS_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
export const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
export const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

export const CAREER_TYPES = {
  triennale:      { label: 'Triennale',            cfu: 180, years: 3 },
  magistrale:     { label: 'Magistrale',            cfu: 120, years: 2 },
  'ciclo-unico-5': { label: 'Ciclo Unico 5 anni',  cfu: 300, years: 5 },
  'ciclo-unico-6': { label: 'Ciclo Unico 6 anni',  cfu: 360, years: 6 },
};

export const HOUR_START = 7;
export const HOUR_END = 23;

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function formatDateIT(date) {
  return `${DAYS_IT[date.getDay()]} ${date.getDate()} ${MONTHS_IT[date.getMonth()]}`;
}

export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day === 0 ? 7 : day) - 1) + offset * 7);
  mon.setHours(0, 0, 0, 0);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Auto-calculate preparation % from page data and exercise data
 * Weights: read=20%, studied=30%, repeated=50% (for appunti)
 * For esercizi: fatto=100%, in-corso=50%, da-fare=0%
 */
export function calcAutoProgress(ex) {
  const pdfs = ex.pdfs || [];
  if (!pdfs.length) return 0;
  let totalWeight = 0, totalScore = 0;
  pdfs.forEach(pdf => {
    if (pdf.type === 'appunti' && pdf.pages && pdf.pages.total > 0) {
      const t = pdf.pages.total;
      const readPct = (pdf.pages.read || 0) / t;
      const studiedPct = (pdf.pages.studied || 0) / t;
      const repeatedPct = (pdf.pages.repeated || 0) / t;
      const fileProg = readPct * 0.2 + studiedPct * 0.3 + repeatedPct * 0.5;
      totalScore += fileProg * t;
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
