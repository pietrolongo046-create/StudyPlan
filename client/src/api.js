/* ═══════════════════════════════════════════════════════════
 *  StudyPlan — API Wrapper
 *  Clean interface for all Tauri commands
 * ═══════════════════════════════════════════════════════════ */

const api = {
  // Events (calendar)
  loadEvents: () => window.api.loadEvents(),
  saveEvents: (events) => window.api.saveEvents(events),

  // Settings
  loadSettings: () => window.api.loadSettings(),
  saveSettings: (settings) => window.api.saveSettings(settings),

  // Career
  loadCareer: () => window.api.loadCareer(),
  saveCareer: (data) => window.api.saveCareer(data),

  // PDF
  pickPdf: () => window.api.pickPdf(),
  openPdf: (fileName) => window.api.openPdf(fileName),
  deletePdf: (fileName) => window.api.deletePdf(fileName),
  getPdfPages: (fileName) => window.api.getPdfPages(fileName),

  // Notifications
  showNotification: (data) => window.api.showNotification(data),

  // Platform
  isMac: () => window.api.isMac(),

  // Event listeners
  onNavigate: (cb) => window.api.onNavigate(cb),
  onDataChanged: (cb) => window.api.onDataChanged(cb),
  onBlur: (cb) => window.api.onBlur(cb),
};

export default api;
