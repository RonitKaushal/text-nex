const { asyncForEach } = require('../utils/common.util');
const { MESSAGE_COLUMNS } = require('../utils/enums');
const sessions = require("../utils/sessions");
const instanceRegistry = require("../utils/instanceRegistry");

const randomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => 
        characters.charAt(Math.floor(Math.random() * characters.length))
    ).join('');
};

exports.applyVariable = async (message, data, index = 0) => {
    let msg = message || '';
    const name = data.name || 'User';

    msg = MESSAGE_COLUMNS.reduce((currentMsg, column) => {
        const newValue = data[column];
        const pattern = new RegExp(`\\{\\{${column}\\}\\}`, 'g');
        
        if (newValue && newValue !== 'Enter Here' && newValue !== undefined) {
            return currentMsg.replace(pattern, newValue);
        } else if (column === 'name') {
            return currentMsg.replace(pattern, name);
        } else {
            return currentMsg.replace(pattern, '');
        }
    }, msg);

    // Replace special variables
    msg = msg.replace(/\{\{index\}\}/g, index.toString());
    msg = msg.replace(/\{\{randomText\}\}/g, randomString(5));

    return msg;
};

exports.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.getRandomDelay = (start, end) => {
    const min = start * 1000; 
    const max = end * 1000; 
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

exports.isInstanceAvailable = async (instanceId) => {
    try {
        const instance = sessions.get(instanceId.toString());
        if (!instance) return false;
        const instanceDoc = instanceRegistry.getInstance(instanceId);
        if (instanceDoc?.whatsapp?.status) {
            return instanceDoc.whatsapp.status === 'connected';
        }
        return !!instance.connected;
    } catch (error) {
        console.error(`Instance ${instanceId} unavailable:`, error.message);
        return false;
    }
};