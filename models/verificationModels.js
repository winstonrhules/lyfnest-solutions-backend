// models/Verification.js
const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Valid E.164 phone number required'] // E.164 format
  },

  // code: {
  //   type: String,
  //   required: true,
  //   match: [/^\d{6}$/, 'Verification code must be a 6-digit number'] // 6-digit code
  // },

  status: {
    type: String,
    enum: ['pending', 'verified', 'expired'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true
  },
  twilioSid: { // Store Twilio verification SID
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Index for faster querying
verificationSchema.index({ phoneNumber: 1, status: 1 });
verificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Verification', verificationSchema);
