const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  // Security
  getSecureKey: () => ipcRenderer.invoke('get-secure-key'),
  onBlur: (callback) => ipcRenderer.on('app-blur', (_, val) => callback(val)),

  // Biometrics
  checkBio: () => ipcRenderer.invoke('bio-check'),
  hasBioSaved: () => ipcRenderer.invoke('bio-has-saved'),
  saveBio: (pwd) => ipcRenderer.invoke('bio-save', pwd),
  loginBio: () => ipcRenderer.invoke('bio-login'),
  clearBio: () => ipcRenderer.invoke('bio-clear'),

  loadEvents: () => ipcRenderer.invoke('load-events'),
  saveEvents: (events) => ipcRenderer.invoke('save-events', events),
  loadExams: () => ipcRenderer.invoke('load-exams'),
  saveExams: (exams) => ipcRenderer.invoke('save-exams', exams),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  showNotification: (data) => ipcRenderer.invoke('show-notification', data),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  // Career
  loadCareer: () => ipcRenderer.invoke('load-career'),
  saveCareer: (data) => ipcRenderer.invoke('save-career', data),
  // PDF
  pickPdf: () => ipcRenderer.invoke('pick-pdf'),
  openPdf: (fileName) => ipcRenderer.invoke('open-pdf', fileName),
  deletePdf: (fileName) => ipcRenderer.invoke('delete-pdf', fileName),
  getPdfPages: (fileName) => ipcRenderer.invoke('get-pdf-pages', fileName),
  // Widgets
  getWidgetToday: () => ipcRenderer.invoke('get-widget-today'),
  getWidgetExams: () => ipcRenderer.invoke('get-widget-exams'),
  getWidgetWeek: () => ipcRenderer.invoke('get-widget-week'),
  getWidgetCareer: () => ipcRenderer.invoke('get-widget-career'),
  showMainWindow: (opts) => ipcRenderer.invoke('show-main-window', opts),
  onNavigate: (cb) => ipcRenderer.on('navigate', (_, data) => cb(data)),
  onDataChanged: (cb) => ipcRenderer.on('data-changed', () => cb()),
  // Window controls (frameless)
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  isMac: () => ipcRenderer.invoke('get-is-mac'),
});
