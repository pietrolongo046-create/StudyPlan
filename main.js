const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, dialog, shell, clipboard, session } = require('electron');
const path = require('path');
const fs = require('fs');
const keychainService = require('./services/keychain');
const biometrics = require('./services/biometrics');

const IS_MAC = process.platform === 'darwin';

// ===== Traduzioni menu automatiche =====
const menuTranslations = {
  it: { about: 'Informazioni su StudyPlan', hide: 'Nascondi StudyPlan', hideOthers: 'Nascondi altri', showAll: 'Mostra tutti', quit: 'Esci da StudyPlan', edit: 'Modifica', undo: 'Annulla', redo: 'Ripeti', cut: 'Taglia', copy: 'Copia', paste: 'Incolla', selectAll: 'Seleziona tutto', view: 'Vista', reload: 'Ricarica', forceReload: 'Ricarica forzata', zoomIn: 'Zoom avanti', zoomOut: 'Zoom indietro', resetZoom: 'Zoom predefinito', fullscreen: 'Schermo intero', window: 'Finestra', minimize: 'Riduci', close: 'Chiudi' },
  en: { about: 'About StudyPlan', hide: 'Hide StudyPlan', hideOthers: 'Hide Others', showAll: 'Show All', quit: 'Quit StudyPlan', edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All', view: 'View', reload: 'Reload', forceReload: 'Force Reload', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', resetZoom: 'Actual Size', fullscreen: 'Toggle Full Screen', window: 'Window', minimize: 'Minimize', close: 'Close' },
  de: { about: 'Über StudyPlan', hide: 'StudyPlan ausblenden', hideOthers: 'Andere ausblenden', showAll: 'Alle einblenden', quit: 'StudyPlan beenden', edit: 'Bearbeiten', undo: 'Widerrufen', redo: 'Wiederholen', cut: 'Ausschneiden', copy: 'Kopieren', paste: 'Einsetzen', selectAll: 'Alles auswählen', view: 'Darstellung', reload: 'Neu laden', forceReload: 'Neu laden erzwingen', zoomIn: 'Vergrößern', zoomOut: 'Verkleinern', resetZoom: 'Originalgröße', fullscreen: 'Vollbild', window: 'Fenster', minimize: 'Minimieren', close: 'Schließen' },
  fr: { about: 'À propos de StudyPlan', hide: 'Masquer StudyPlan', hideOthers: 'Masquer les autres', showAll: 'Tout afficher', quit: 'Quitter StudyPlan', edit: 'Édition', undo: 'Annuler', redo: 'Rétablir', cut: 'Couper', copy: 'Copier', paste: 'Coller', selectAll: 'Tout sélectionner', view: 'Présentation', reload: 'Recharger', forceReload: 'Forcer le rechargement', zoomIn: 'Zoom avant', zoomOut: 'Zoom arrière', resetZoom: 'Taille réelle', fullscreen: 'Plein écran', window: 'Fenêtre', minimize: 'Réduire', close: 'Fermer' },
  es: { about: 'Acerca de StudyPlan', hide: 'Ocultar StudyPlan', hideOthers: 'Ocultar otros', showAll: 'Mostrar todo', quit: 'Salir de StudyPlan', edit: 'Edición', undo: 'Deshacer', redo: 'Rehacer', cut: 'Cortar', copy: 'Copiar', paste: 'Pegar', selectAll: 'Seleccionar todo', view: 'Visualización', reload: 'Recargar', forceReload: 'Forzar recarga', zoomIn: 'Ampliar', zoomOut: 'Reducir', resetZoom: 'Tamaño real', fullscreen: 'Pantalla completa', window: 'Ventana', minimize: 'Minimizar', close: 'Cerrar' },
};
function getMenuT() { const l = (app.getLocale() || 'en').substring(0, 2); return menuTranslations[l] || menuTranslations.en; }

// Forza il bundle ID per le notifiche macOS
app.setAppUserModelId('com.studyplan.app');

const DATA_DIR = path.join(app.getPath('userData'), 'studyplan-data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const EXAMS_FILE = path.join(DATA_DIR, 'exams.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const CAREER_FILE = path.join(DATA_DIR, 'career.json');
const PDF_DIR = path.join(DATA_DIR, 'pdf-notes');
const WIDGET_STATE_FILE = path.join(DATA_DIR, 'widget-state.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
}
function loadJSON(fp, fb) { try { if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8')); } catch (e) {} return fb; }
function saveJSON(fp, d) { ensureDataDir(); fs.writeFileSync(fp, JSON.stringify(d, null, 2), 'utf-8'); }

// ===== IPC: Data =====
ipcMain.handle('load-events', () => loadJSON(EVENTS_FILE, []));
ipcMain.handle('save-events', (_, ev) => { saveJSON(EVENTS_FILE, ev); notifyWidgetsDataChanged(); return true; });
ipcMain.handle('load-exams', () => loadJSON(EXAMS_FILE, []));
ipcMain.handle('save-exams', (_, ex) => { saveJSON(EXAMS_FILE, ex); notifyWidgetsDataChanged(); return true; });
ipcMain.handle('load-settings', () => loadJSON(SETTINGS_FILE, { morningNotif: true, eveningNotif: true, morningTime: '07:30', eveningTime: '21:00' }));
ipcMain.handle('save-settings', (_, s) => { saveJSON(SETTINGS_FILE, s); return true; });
ipcMain.handle('show-notification', (_, { title, body }) => { showRobustNotification(title, body); return true; });
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-secure-key', async () => {
  return await keychainService.getEncryptionKey();
});

// Biometrics
ipcMain.handle('bio-check', () => biometrics.isAvailable());
ipcMain.handle('bio-has-saved', () => biometrics.hasSaved());
ipcMain.handle('bio-save', (_, pwd) => biometrics.savePassword(pwd));
ipcMain.handle('bio-login', () => biometrics.retrievePassword());
ipcMain.handle('bio-clear', () => biometrics.clear());

// ===== IPC: Show main window (called from widgets) =====
ipcMain.handle('show-main-window', (_, opts) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    if (opts && opts.navigate) {
      mainWindow.webContents.send('navigate', opts.navigate);
    }
  } else {
    createWindow();
    if (opts && opts.navigate) {
      mainWindow.once('ready-to-show', () => {
        mainWindow.webContents.send('navigate', opts.navigate);
      });
    }
  }
  return true;
});

// ===== IPC: Career =====
ipcMain.handle('load-career', () => loadJSON(CAREER_FILE, null));
ipcMain.handle('save-career', (_, d) => { saveJSON(CAREER_FILE, d); notifyWidgetsDataChanged(); return true; });

// ===== IPC: PDF =====
ipcMain.handle('pick-pdf', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title: 'Seleziona PDF appunti', filters: [{ name: 'PDF', extensions: ['pdf'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths.length) return null;
  const src = r.filePaths[0];
  const fname = Date.now() + '_' + path.basename(src);
  const dest = path.join(PDF_DIR, fname);
  ensureDataDir();
  fs.copyFileSync(src, dest);
  return { fileName: fname, originalName: path.basename(src) };
});
function safePdfPath(fn) {
  const fp = path.join(PDF_DIR, path.basename(fn));
  if (!fp.startsWith(PDF_DIR)) return null;
  return fp;
}
ipcMain.handle('open-pdf', (_, fn) => { const fp = safePdfPath(fn); if (fp && fs.existsSync(fp)) { shell.openPath(fp); return true; } return false; });
ipcMain.handle('delete-pdf', (_, fn) => { try { const fp = safePdfPath(fn); if (fp && fs.existsSync(fp)) fs.unlinkSync(fp); return true; } catch (e) { return false; } });
ipcMain.handle('get-pdf-pages', async (_, fn) => {
  try {
    const fp = safePdfPath(fn);
    if (!fp || !fs.existsSync(fp)) return 0;
    const { PDFDocument } = require('pdf-lib');
    const data = fs.readFileSync(fp);
    const doc = await PDFDocument.load(data, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch (e) { return 0; }
});

// ===== IPC: Widget Data =====
ipcMain.handle('get-widget-today', () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const allEvents = loadJSON(EVENTS_FILE, []);
  return allEvents.filter(e => e.date === todayStr).sort((a,b) => a.timeStart.localeCompare(b.timeStart));
});
ipcMain.handle('get-widget-exams', () => {
  const c = loadJSON(CAREER_FILE, null);
  if (!c || !c.exams) return [];
  return c.exams
    .filter(e => e.status !== 'passed')
    .sort((a,b) => {
      if (a.examDate && b.examDate) return a.examDate.localeCompare(b.examDate);
      if (a.examDate) return -1;
      if (b.examDate) return 1;
      return 0;
    });
});
ipcMain.handle('get-widget-week', () => {
  const now = new Date();
  const sow = new Date(now);
  sow.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const eow = new Date(sow);
  eow.setDate(sow.getDate() + 6);
  const sowStr = sow.toISOString().split('T')[0];
  const eowStr = eow.toISOString().split('T')[0];
  const allEvents = loadJSON(EVENTS_FILE, []);
  return allEvents.filter(e => e.date >= sowStr && e.date <= eowStr)
    .sort((a,b) => a.date.localeCompare(b.date) || a.timeStart.localeCompare(b.timeStart));
});
ipcMain.handle('get-widget-career', () => {
  return loadJSON(CAREER_FILE, null);
});

// ===== Window Controls (frameless) =====
ipcMain.on('window-minimize', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close(); });
ipcMain.handle('get-is-mac', () => IS_MAC);

// ===== Window =====
let mainWindow, tray;
let widgets = []; // Array of widget windows (supports multiple instances)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 820, minWidth: 1000, minHeight: 650,
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'hidden',
    ...(IS_MAC ? { trafficLightPosition: { x: 16, y: 18 } } : {}),
    frame: IS_MAC, // macOS: frame con semafori nativi | Win/Linux: frameless
    backgroundColor: '#0c0d14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
      spellcheck: false
    },
    icon: path.join(__dirname, 'assets', 'studyplan-icon.png'),
    show: false
  });
  mainWindow.loadFile('index.html');
  mainWindow.webContents.on('will-navigate', (event) => { event.preventDefault(); });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // PRODUCTION HARDENING — DevTools blocked
  if (app.isPackaged) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  // BLOCK drag & drop of external files
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      document.addEventListener('dragover', e => e.preventDefault());
      document.addEventListener('drop', e => e.preventDefault());
    `);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Handle pending navigation from notification click (e.g., app was closed)
    if (pendingNavigation) {
      const nav = pendingNavigation;
      pendingNavigation = null;
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('navigate', nav);
        }
      }, 500);
    }
  });

  // PRIVACY BLUR — oscura quando l'app perde il focus
  mainWindow.on('blur', () => {
    mainWindow.webContents.send('app-blur', true);
  });
  mainWindow.on('focus', () => {
    // NON rimuovere lo shield al focus — resta visibile fino al click dell'utente
  });

  // CLIPBOARD CLEAR + macOS hide on close
  mainWindow.on('close', (e) => {
    clipboard.clear();
    if (IS_MAC && !isQuitting) {
      e.preventDefault();
      if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
        }, 700);
      } else {
        mainWindow.hide();
      }
    }
  });
}

function createTray() {
  let ti;
  try {
    const tray2x = path.join(__dirname, 'assets', 'studyplan-tray@2x.png');
    const tray1x = path.join(__dirname, 'assets', 'studyplan-tray.png');
    if (IS_MAC) {
      // Build nativeImage with proper 1x + 2x representations for crisp Retina rendering
      ti = nativeImage.createEmpty();
      if (fs.existsSync(tray2x)) {
        const img2x = nativeImage.createFromPath(tray2x);
        ti.addRepresentation({ scaleFactor: 2.0, width: 18, height: 18, buffer: img2x.toPNG() });
      }
      if (fs.existsSync(tray1x)) {
        const img1x = nativeImage.createFromPath(tray1x);
        ti.addRepresentation({ scaleFactor: 1.0, width: 18, height: 18, buffer: img1x.toPNG() });
      }
      if (ti.isEmpty()) {
        ti = nativeImage.createFromPath(path.join(__dirname, 'assets', 'studyplan-icon.png')).resize({ width: 18, height: 18 });
      }
    } else {
      ti = nativeImage.createFromPath(path.join(__dirname, 'assets', 'studyplan-icon.png')).resize({ width: 32, height: 32 });
    }
  } catch (e) { return; }
  tray = new Tray(ti);
  tray.setToolTip('StudyPlan');
  
  // Context menu per il tray (multilingua)
  const trayT = {
    it: { openWidget: 'Apri Widget', closeWidget: 'Chiudi Widget', quit: 'Esci da StudyPlan' },
    en: { openWidget: 'Open Widget', closeWidget: 'Close Widget', quit: 'Quit StudyPlan' },
    de: { openWidget: 'Widget öffnen', closeWidget: 'Widget schließen', quit: 'StudyPlan beenden' },
    fr: { openWidget: 'Ouvrir le Widget', closeWidget: 'Fermer le Widget', quit: 'Quitter StudyPlan' },
    es: { openWidget: 'Abrir Widget', closeWidget: 'Cerrar Widget', quit: 'Salir de StudyPlan' },
  };
  const tl = (app.getLocale() || 'en').substring(0, 2);
  const tt = trayT[tl] || trayT.en;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: tt.openWidget,
      click: () => {
        if (widgets.length === 0) {
          addWidget();
        }
      }
    },
    {
      label: tt.closeWidget,
      click: () => {
        widgets.forEach(w => { if (w.win && !w.win.isDestroyed()) w.win.close(); });
        widgets = [];
        saveWidgetState();
      }
    },
    { type: 'separator' },
    {
      label: tt.quit,
      click: () => { app.quit(); }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  // Click sinistro mostra il menu (come click destro)
  tray.on('click', () => { tray.popUpContextMenu(contextMenu); });
}

// ===== Widgets (persistent across quit, duplicable, responsive) =====
function loadWidgetState() {
  return loadJSON(WIDGET_STATE_FILE, []);
}
function saveWidgetState() {
  const state = widgets.filter(w => w.win && !w.win.isDestroyed()).map(w => {
    const [x, y] = w.win.getPosition();
    const [width, height] = w.win.getSize();
    return { x, y, w: width, h: height };
  });
  saveJSON(WIDGET_STATE_FILE, state);
}

function toggleWidget() {
  if (widgets.length > 0) {
    // Close all widgets
    widgets.forEach(w => { if (w.win && !w.win.isDestroyed()) w.win.close(); });
    widgets = [];
    saveWidgetState();
  } else {
    addWidget();
  }
}

// Notify all widgets AND main window when data changes
function notifyWidgetsDataChanged() {
  widgets.forEach(w => {
    if (w.win && !w.win.isDestroyed()) {
      w.win.webContents.send('data-changed');
    }
  });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('data-changed');
  }
}

function addWidget(saved) {
  const defW = 480, defH = 300;
  const w = (saved && saved.w) ? saved.w : defW;
  const h = (saved && saved.h) ? saved.h : defH;

  const win = new BrowserWindow({
    width: w, height: h,
    minWidth: 280, minHeight: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: true,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    }
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  if (IS_MAC) {
    win.setAlwaysOnTop(false);
    win.setWindowButtonVisibility(false);
  }
  win.loadFile('widget-studyplan.html');

  if (saved && saved.x !== undefined) {
    win.setPosition(saved.x, saved.y);
  } else {
    const { screen } = require('electron');
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    const offset = widgets.length * 30;
    win.setPosition(sw - w - 20 - offset, sh - h - 20 - offset);
  }

  const entry = { win };
  widgets.push(entry);

  win.on('moved', () => saveWidgetState());
  win.on('resized', () => saveWidgetState());
  win.on('closed', () => {
    widgets = widgets.filter(e => e.win !== win);
    saveWidgetState();
  });
  saveWidgetState();
  return win;
}

function restoreWidgets() {
  const state = loadWidgetState();
  if (Array.isArray(state) && state.length > 0) {
    state.forEach(s => addWidget(s));
  }
}

// ===== Notifications =====
const { execFile } = require('child_process');

function showRobustNotification(title, body, navigateData) {
  // Primary: Electron Notification (works without code signing)
  if (Notification.isSupported()) {
    try {
      const n = new Notification({ title, body, silent: false, timeoutType: 'never' });
      if (navigateData) {
        n.on('click', () => {
          handleNotificationClick(navigateData);
        });
      }
      n.show();
      return;
    } catch (e) {
      console.log('Electron Notification failed:', e.message);
    }
  }

  // Fallback: terminal-notifier on macOS
  if (IS_MAC) {
    const tn = '/opt/homebrew/bin/terminal-notifier';
    const args = [
      '-title', title,
      '-message', body,
      '-sound', 'default',
      '-appIcon', path.join(__dirname, 'assets', 'studyplan-icon.png'),
    ];
    if (navigateData) {
      pendingNavigation = navigateData;
      args.push('-actions', 'Mostra');
      const appPath = app.getPath('exe').replace(/\/Contents\/MacOS\/.*$/, '');
      args.push('-execute', `open "${appPath}"`);
    }
    execFile(tn, args, (err) => {
      if (err) console.log('terminal-notifier fallback failed:', err.message);
    });
  }
}

// Pending navigation data from notification click
let pendingNavigation = null;

function handleNotificationClick(navigateData) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('navigate', navigateData);
  } else {
    pendingNavigation = navigateData;
    createWindow();
  }
}

let notifInterval;
let lastNotifMinute = '';
function startNotifScheduler() {
  notifInterval = setInterval(() => {
    const now = new Date();
    const t = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    // Skip if we already checked this minute
    if (t === lastNotifMinute) return;
    lastNotifMinute = t;

    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // --- Per-event reminders ---
    const allEvents = loadJSON(EVENTS_FILE, []);
    let dirty = false;
    allEvents.forEach(ev => {
      if (!ev.reminders || ev.reminders.length === 0) return;
      if (!ev.remindersSent) ev.remindersSent = [];

      ev.reminders.forEach(rem => {
        const remKey = rem.type + ':' + rem.time;
        if (ev.remindersSent.includes(remKey)) return;

        let shouldFire = false;
        if (rem.type === 'day-before' && ev.date === tomorrowStr && t === rem.time) {
          shouldFire = true;
        } else if (rem.type === 'same-day' && ev.date === todayStr && t === rem.time) {
          shouldFire = true;
        }

        if (shouldFire) {
          const isDB = rem.type === 'day-before';
          const ntitle = 'StudyPlan — ' + (isDB ? 'Domani' : 'Oggi');
          const nbody = (isDB ? '📅 Domani: ' : '🔔 Oggi: ') + ev.title + ' alle ' + ev.timeStart;
          showRobustNotification(ntitle, nbody, { tab: 'today', eventId: ev.id });
          ev.remindersSent.push(remKey);
          dirty = true;
        }
      });
    });
    if (dirty) saveJSON(EVENTS_FILE, allEvents);

    // --- Global morning/evening summary (existing feature) ---
    const s = loadJSON(SETTINGS_FILE, { morningNotif: true, eveningNotif: true, morningTime: '07:30', eveningTime: '21:00' });
    const isMorning = s.morningNotif && t === s.morningTime;
    const isEvening = s.eveningNotif && t === s.eveningTime;
    if (!isMorning && !isEvening) return;
    const todayEvts = allEvents.filter(e => e.date === todayStr);
    if (todayEvts.length === 0) return;
    if (isMorning) {
      showRobustNotification('StudyPlan — Buongiorno!', 'Hai ' + todayEvts.filter(e => !e.completed).length + ' impegni per oggi.');
    }
    if (isEvening) {
      showRobustNotification('StudyPlan — Riepilogo', 'Completati ' + todayEvts.filter(e => e.completed).length + '/' + todayEvts.length + ' impegni.');
    }
  }, 30000); // Check every 30s to not miss the minute, but with dedup
}

function createMenu() {
  if (process.platform !== 'darwin') return;
  const t = getMenuT();
  const template = [
    {
      label: 'StudyPlan',
      submenu: [
        { role: 'about', label: t.about },
        { type: 'separator' },
        { role: 'hide', label: t.hide },
        { role: 'hideOthers', label: t.hideOthers },
        { role: 'unhide', label: t.showAll },
        { type: 'separator' },
        { role: 'quit', label: t.quit },
      ],
    },
    {
      label: t.edit,
      submenu: [
        { role: 'undo', label: t.undo },
        { role: 'redo', label: t.redo },
        { type: 'separator' },
        { role: 'cut', label: t.cut },
        { role: 'copy', label: t.copy },
        { role: 'paste', label: t.paste },
        { role: 'selectAll', label: t.selectAll },
      ],
    },
    {
      label: t.view,
      submenu: [
        { role: 'reload', label: t.reload },
        { role: 'forceReload', label: t.forceReload },
        { type: 'separator' },
        { role: 'zoomIn', label: t.zoomIn },
        { role: 'zoomOut', label: t.zoomOut },
        { role: 'resetZoom', label: t.resetZoom },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t.fullscreen },
      ],
    },
    {
      label: t.window,
      submenu: [
        { role: 'minimize', label: t.minimize },
        { role: 'close', label: t.close },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let isQuitting = false;

// Auto-start at login so widgets reappear after reboot
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: true,
  args: ['--hidden'],
});

const launchedHidden = process.argv.includes('--hidden');

app.whenReady().then(() => {
  // PERMISSION LOCKDOWN — deny all hardware/sensor requests
  session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));

  createMenu();
  createTray();
  startNotifScheduler();

  // Invia una notifica silenziosa al primo avvio per registrare l'app nel centro notifiche macOS
  if (IS_MAC) {
    const firstRunFile = path.join(DATA_DIR, '.notif-registered');
    if (!fs.existsSync(firstRunFile)) {
      ensureDataDir();
      showRobustNotification('StudyPlan', 'Notifiche attivate! Riceverai i promemoria dei tuoi impegni.');
      fs.writeFileSync(firstRunFile, new Date().toISOString(), 'utf-8');
    }
  }

  if (launchedHidden) {
    // Avvio al login: apri SOLO il widget (se era aperto), NON la finestra principale
    restoreWidgets();
  } else {
    // Avvio manuale (doppio click): apri SOLO la finestra principale, NON il widget
    createWindow();
  }

  app.on('activate', () => {
    // Click sull'icona del dock (or notification click via open -a): mostra la finestra principale
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      // Handle pending navigation from notification
      if (pendingNavigation) {
        const nav = pendingNavigation;
        pendingNavigation = null;
        mainWindow.webContents.send('navigate', nav);
      }
    } else {
      createWindow();
    }
  });
});
app.on('window-all-closed', () => {
  // On macOS keep alive for tray + widgets even if main window closed
  if (!IS_MAC) app.quit();
});
app.on('before-quit', () => {
  // "Esci" from menu or Cmd+Q: quit everything (app + widgets)
  isQuitting = true;
  saveWidgetState();
  if (notifInterval) clearInterval(notifInterval);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
  widgets.forEach(w => { if (w.win && !w.win.isDestroyed()) { w.win.removeAllListeners('closed'); w.win.close(); } });
});
