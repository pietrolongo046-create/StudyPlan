/* ═══════════════════════════════════════════════════════════
 *  StudyPlan — Tauri API Bridge
 *  Replaces Electron IPC with tauri invoke()
 * ═══════════════════════════════════════════════════════════ */

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

function safeInvoke(cmd, args = {}) {
  return invoke(cmd, args).catch(err => {
    console.error(`[StudyPlan] ${cmd} failed:`, err);
    throw typeof err === 'string' ? new Error(err) : err;
  });
}

// ─── Build window.api for all components ───
window.api = {
  // Security
  getSecureKey: () => safeInvoke('get_secure_key'),

  // Blur handling
  onBlur: (callback) => {
    listen('app-blur', (event) => callback(event.payload));
  },

  // Biometrics
  checkBio: () => safeInvoke('bio_check'),
  hasBioSaved: () => safeInvoke('bio_has_saved'),
  saveBio: (pwd) => safeInvoke('bio_save', { pwd }),
  loginBio: () => safeInvoke('bio_login'),
  clearBio: () => safeInvoke('bio_clear'),

  // Events
  loadEvents: () => safeInvoke('load_events'),
  saveEvents: (events) => safeInvoke('save_events', { events }),

  // Exams
  loadExams: () => safeInvoke('load_exams'),
  saveExams: (exams) => safeInvoke('save_exams', { exams }),

  // Settings
  loadSettings: () => safeInvoke('load_settings'),
  saveSettings: (settings) => safeInvoke('save_settings', { settings }),

  // Notifications
  showNotification: (data) => {
    if (window.__TAURI__?.notification) {
      return window.__TAURI__.notification.sendNotification({
        title: data.title,
        body: data.body,
      });
    }
    return safeInvoke('show_notification', { data });
  },

  // Platform
  getPlatform: () => safeInvoke('get_platform'),

  // Career
  loadCareer: () => safeInvoke('load_career'),
  saveCareer: (data) => safeInvoke('save_career', { data }),

  // PDF
  pickPdf: () => safeInvoke('pick_pdf'),
  openPdf: (fileName) => safeInvoke('open_pdf', { fileName }),
  deletePdf: (fileName) => safeInvoke('delete_pdf', { fileName }),
  getPdfPages: (fileName) => safeInvoke('get_pdf_pages', { fileName }),

  // Widgets
  getWidgetToday: () => safeInvoke('get_widget_today'),
  getWidgetExams: () => safeInvoke('get_widget_exams'),
  getWidgetWeek: () => safeInvoke('get_widget_week'),
  getWidgetCareer: () => safeInvoke('get_widget_career'),
  showMainWindow: (opts) => safeInvoke('show_main_window', { opts: opts || null }),

  // Event listeners from Rust
  onNavigate: (cb) => {
    listen('navigate', (event) => cb(event.payload));
  },
  onDataChanged: (cb) => {
    listen('data-changed', () => cb());
  },

  // Window controls
  windowMinimize: () => safeInvoke('window_minimize'),
  windowMaximize: () => safeInvoke('window_maximize'),
  windowClose: () => safeInvoke('window_close'),
  isMac: () => safeInvoke('get_is_mac'),
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
