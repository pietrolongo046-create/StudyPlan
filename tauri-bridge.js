/**
 * StudyPlan — Tauri v2 Bridge
 * Replaces Electron's preload.js — exposes window.api with identical interface.
 * The frontend code (app.js) doesn't need ANY changes.
 */
(function () {
  // Check if running in Tauri
  if (!window.__TAURI__) return;

  const { invoke } = window.__TAURI__.core;
  const { listen, emit } = window.__TAURI__.event;

  // Build window.api — identical to Electron preload
  window.api = {
    // Security
    getSecureKey: () => invoke('get_secure_key'),

    // Blur handling — Tauri emits from Rust
    onBlur: (callback) => {
      listen('app-blur', (event) => callback(event.payload));
    },

    // Biometrics
    checkBio: () => invoke('bio_check'),
    hasBioSaved: () => invoke('bio_has_saved'),
    saveBio: (pwd) => invoke('bio_save', { pwd }),
    loginBio: () => invoke('bio_login'),
    clearBio: () => invoke('bio_clear'),

    // Events
    loadEvents: () => invoke('load_events'),
    saveEvents: (events) => invoke('save_events', { events }),

    // Exams
    loadExams: () => invoke('load_exams'),
    saveExams: (exams) => invoke('save_exams', { exams }),

    // Settings
    loadSettings: () => invoke('load_settings'),
    saveSettings: (settings) => invoke('save_settings', { settings }),

    // Notifications
    showNotification: (data) => {
      // Use Tauri notification plugin
      if (window.__TAURI__.notification) {
        return window.__TAURI__.notification.sendNotification({
          title: data.title,
          body: data.body,
        });
      }
      return invoke('show_notification', { data });
    },

    // Platform
    getPlatform: () => invoke('get_platform'),

    // Career
    loadCareer: () => invoke('load_career'),
    saveCareer: (data) => invoke('save_career', { data }),

    // PDF
    pickPdf: () => invoke('pick_pdf'),
    openPdf: (fileName) => invoke('open_pdf', { fileName }),
    deletePdf: (fileName) => invoke('delete_pdf', { fileName }),
    getPdfPages: (fileName) => invoke('get_pdf_pages', { fileName }),

    // Widgets
    getWidgetToday: () => invoke('get_widget_today'),
    getWidgetExams: () => invoke('get_widget_exams'),
    getWidgetWeek: () => invoke('get_widget_week'),
    getWidgetCareer: () => invoke('get_widget_career'),
    showMainWindow: () => invoke('show_main_window'),

    // Event listeners from Rust
    onNavigate: (cb) => {
      listen('navigate', (event) => cb(event.payload));
    },
    onDataChanged: (cb) => {
      listen('data-changed', () => cb());
    },

    // Window controls (frameless Windows/Linux)
    windowMinimize: () => invoke('window_minimize'),
    windowMaximize: () => invoke('window_maximize'),
    windowClose: () => invoke('window_close'),
    isMac: () => invoke('get_is_mac'),
  };

  // Listen for notification events from Rust scheduler
  listen('show-notification', async (event) => {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } = window.__TAURI__.notification;
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === 'granted';
      }
      if (granted) {
        sendNotification({
          title: event.payload.title,
          body: event.payload.body,
        });
      }
    } catch (e) {
      console.warn('Notification error:', e);
    }
  });

  // Window controls: show on Windows/Linux, hide on macOS
  (async () => {
    try {
      const isMac = await invoke('get_is_mac');
      const wc = document.getElementById('windowControls');
      if (wc) {
        wc.style.display = isMac ? 'none' : 'flex';
      }
      if (!isMac) {
        document.getElementById('btnWcMin')?.addEventListener('click', () => invoke('window_minimize'));
        document.getElementById('btnWcMax')?.addEventListener('click', () => invoke('window_maximize'));
        document.getElementById('btnWcClose')?.addEventListener('click', () => invoke('window_close'));
      }
    } catch (e) {
      // If get_is_mac fails, keep controls hidden
    }
  })();
})();
