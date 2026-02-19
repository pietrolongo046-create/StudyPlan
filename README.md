# StudyPlan

**Calendario e pianificatore esami per studenti universitari**

StudyPlan è un'applicazione desktop che aiuta gli studenti a organizzare lo studio, gestire il calendario settimanale, tracciare la preparazione degli esami e monitorare il proprio piano carriera universitario.

## Funzionalità

### 📅 Calendario e Pianificazione
- **Vista Oggi** — Timeline giornaliera con donut chart di progresso
- **Vista Settimana** — Calendario 7 giorni con eventi posizionabili
- **Categorie** — Lezione, Studio, Esame, Progetto, Personale, Pausa
- **Promemoria** — Notifiche giorno prima e stesso giorno

### 📊 Riepilogo
- Statistiche giornaliere e settimanali
- Esami in arrivo con countdown
- Attività recente completata

### 🎓 Piano Carriera
- Setup percorso universitario (Triennale, Magistrale, Ciclo Unico)
- Gestione esami con CFU, anno, semestre, voto
- Media ponderata automatica
- Allegati PDF con tracciamento pagine (lette, studiate, ripetute)
- Tracciamento esercizi (da fare, in corso, fatto)
- Calcolo automatico preparazione %

### 🔒 Privacy
- Privacy Shield — blur automatico quando la finestra perde il focus
- Widget desktop con vista rapida
- Dati salvati solo localmente

## Stack Tecnico

| Layer | Tecnologia |
|-------|-----------|
| Framework | Tauri v2 |
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Backend | Rust |
| UI | Glass + Neon Purple Design System |
| Icons | lucide-react |

## Struttura

```
StudyPlan/
├── assets/           # icon-master.png (1024x1024)
├── client/           # Frontend React
│   ├── src/
│   │   ├── components/   # Sidebar, EventModal, CareerExamModal...
│   │   ├── pages/        # TodayPage, WeekPage, StatsPage, CareerPage
│   │   ├── lib/          # Constants, utilities
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── fonts/
│   └── widget-studyplan.html
├── scripts/          # generate-icons.py
├── releases/         # DMG output
└── src-tauri/        # Backend Rust
```

## Sviluppo

```bash
npm run dev          # Avvia dev server
npm run build        # Build .app
npm run install      # Build + deploy su Desktop
npm run icons        # Rigenera icone
```

## Autore

**TechnoJaw** — [technojaw.com](https://technojaw.com)

## Licenza

Proprietario © 2025 TechnoJaw. Tutti i diritti riservati.
