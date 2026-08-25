const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  licenseKey: {
    type: String,
    default: null
  },
  licenseExpiry: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: false
  },
  instances: {
    type: Number,
    default: 10
  },
  software: {
    type: Boolean,
    default: false
  },
  mobile: {
    type: Boolean,
    default: false
  },
  allowBoth: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, 
{ timestamps: true }
);

// JWT Token
userSchema.methods.getJWTToken = function (){
    return jwt.sign({
        id: this._id,
        licenseExpiry: this.licenseExpiry
    }, process.env.JWT_SECRET, {
        expiresIn: '365d',
    });
}

const User = mongoose.model('User', userSchema);

module.exports = User;
