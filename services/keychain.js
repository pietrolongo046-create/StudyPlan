const keytar = require('keytar');
const crypto = require('crypto');
const os = require('os');

const SERVICE_NAME = 'StudyPlan_Secure';
const ACCOUNT_NAME = os.userInfo().username;

module.exports = {
  async getEncryptionKey() {
    try {
      let key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
      if (!key) {
        key = crypto.randomBytes(32).toString('hex');
        await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
      }
      return key;
    } catch (error) {
      console.error('Errore Keytar:', error);
      return 'FALLBACK_KEY_EMERGENCY_ONLY_CHANGE_ME';
    }
  }
};
