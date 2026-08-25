const { WhatsAppInstance } = require('./whatsapp.instance');
/**
 * @type {Map<string, WhatsAppInstance>}
 */
const sessions = new Map();

module.exports = sessions;