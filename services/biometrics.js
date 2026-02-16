// StudyPlan — Biometric Authentication (TouchID / FaceID / Windows Hello)
const { systemPreferences, app } = require('electron');
const keytar = require('keytar');
const os = require('os');

const SERVICE_NAME = `TechnoJaw_StudyPlan_Bio`;
const ACCOUNT_NAME = os.userInfo().username;

module.exports = {
  async isAvailable() {
    if (process.platform === 'darwin') {
      try {
        return systemPreferences.canPromptTouchID ? systemPreferences.canPromptTouchID() : false;
      } catch { return false; }
    }
    if (process.platform === 'win32') return true;
    return false;
  },

  async prompt() {
    if (process.platform === 'darwin') {
      try {
        await systemPreferences.promptTouchID('Sblocca StudyPlan');
        return true;
      } catch { return false; }
    }
    return true;
  },

  async savePassword(password) {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, password);
  },

  async retrievePassword() {
    const authorized = await this.prompt();
    if (!authorized) throw new Error('Biometria non autorizzata');
    return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  },

  async hasSaved() {
    const pwd = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    return !!pwd;
  },

  async clear() {
    await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  }
};
