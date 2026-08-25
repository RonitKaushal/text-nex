const mongoose = require('mongoose');
const { RECIPIENT_STATUS, MESSAGE_STATUS } = require('../utils/enums');

const Schema = mongoose.Schema;

const recipientSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  variables: { type: Map, of: String, default: {} },
  status: {
    type: String,
    enum: Object.values(RECIPIENT_STATUS),
    default: RECIPIENT_STATUS.PENDING
  }
});

const messageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  templateId: {
    type: Schema.Types.ObjectId,
    ref: 'whatsapp-template'
  },
  instanceIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instance'
  }],
  recipients: [recipientSchema],

  delayRange: {
    start: {
      type: Number,
      default: 3
    },
    end: {
      type: Number,
      default: 5
    }
  },

  status: {
    type: String,
    enum: Object.values(MESSAGE_STATUS),
    default: MESSAGE_STATUS.PROCESSING
  },
  statistics: {
    total: {
      type: Number,
      default: 0
    },
    sent: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    notExist: {
      type: Number,
      default: 0
    },
    instanceDisconnected: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

const Message = mongoose.model("message", messageSchema);
module.exports = Message;