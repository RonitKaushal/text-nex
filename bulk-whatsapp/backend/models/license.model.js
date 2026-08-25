const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  duration: {
    type: Number,
    required: true,
    default: 30 // default 30 days
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  activatedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

const License = mongoose.model('License', licenseSchema);

module.exports = License;
