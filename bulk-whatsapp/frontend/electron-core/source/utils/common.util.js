const mime = require("mime-types");
const googleLibPhone = require('google-libphonenumber');
const phoneUtil = googleLibPhone.PhoneNumberUtil.getInstance()
const mongoose = require('mongoose');
const { MESSAGE_COLUMNS } = require("./enums");

exports.asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};

exports.textToNumber = (text) => {
  return text.toString().replace(/\D/g, '')
}

exports.isValidNumber = (number) => {
  try {
    return phoneUtil.isValidNumber(number)
  }
  catch {
    return false
  }
};

exports.isPhoneNumber = (phone) => {
  try {
    const number = phoneUtil.parse(phone)
    return isValidNumber(number)
  }
  catch {
    return false
  }
};

exports.asyncForEachWithBreak = async (array, callback) => {
  let shouldBreak = false;
  for (let index = 0; index < array.length; index++) {
    if (shouldBreak) break;
    await callback(array[index], index, array, () => (shouldBreak = true));
  }
};

exports.getMimeType = (fileName) => {
  return mime.lookup(fileName);
};

exports.sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

exports.validateVariables = (variables, recipientIndex) => {
  if (!variables || typeof variables !== 'object') return;
  const invalidKeys = Object.keys(variables).filter(key => !MESSAGE_COLUMNS.includes(key));
  if (invalidKeys.length > 0) {
    throw new Error(`Recipient at index ${recipientIndex} has invalid variable keys: ${invalidKeys.join(', ')}. Only var1 to var30 are allowed.`);
  }
};

exports.validateRequestBody = ({ instanceIds, templateId, name, recipients, delayRange }) => {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) {
    throw new Error('Instance IDs must be a non-empty array');
  }
  if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
    throw new Error('Valid Template ID is required');
  }
  if (instanceIds.some(id => !mongoose.Types.ObjectId.isValid(id))) {
    throw new Error('All Instance IDs must be valid');
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('Recipients must be a non-empty array');
  }
  if (recipients.some(rec => !rec.phone || typeof rec.phone !== 'string' || rec.phone.trim() === '')) {
    throw new Error('Each recipient must have a valid phone number');
  }
  if (recipients.some(rec => rec.variables !== undefined && typeof rec.variables !== 'object')) {
    throw new Error('Variables for each recipient must be an object if provided');
  }
  if (!delayRange || typeof delayRange !== 'object' ||
      !Number.isFinite(delayRange.start) || !Number.isFinite(delayRange.end) ||
      delayRange.start < 0 || delayRange.end < delayRange.start) {
    throw new Error('Invalid delay range. Must provide start and end in seconds, with start >= 0 and end >= start');
  }
  recipients.forEach((rec, index) => exports.validateVariables(rec.variables, index));
};