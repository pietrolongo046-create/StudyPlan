# Changelog — StudyPlan

Tutte le modifiche rilevanti a StudyPlan sono documentate in questo file.

## [1.6.8] — 2025-02-15

### Cambiato
- **Migrazione React** — Frontend riscritto da vanilla JS a React 18 + Vite + Tailwind CSS v4
- **Sidebar unificata** — Stessa sidebar premium di SubTracker/FinanceFlow/LexFlow (Glass + Neon Purple)
- **Struttura professionale** — Cartelle riorganizzate secondo BUILD_MASTER standard
- **Bundle ID** — Aggiornato a `com.technojaw.studyplan`
- **Script npm** — Standardizzati (dev, build, deploy:desktop, install, icons)
- **Autore** — TechnoJaw

### Rimosso
- `build-web.js` — Sostituito da Vite
- `build/` — Residuo Electron
- `dist/` — Vecchi DMG Electron (3GB)
- `services/` — Legacy Electron (biometrics.js, keychain.js con require('electron'))

## [1.6.7] — 2025-02-14

### Aggiunto
- Background mode (hide on close)
- Tray icon con menu

## [1.6.6] — 2025-02-13

### Aggiunto
- Notifiche native
- Widget desktop
- Privacy Shield

## [1.6.0] — 2025-02-10

### Cambiato
- Migrazione da Electron a Tauri v2
- Titlebar overlay macOS
- Dark theme unificato
