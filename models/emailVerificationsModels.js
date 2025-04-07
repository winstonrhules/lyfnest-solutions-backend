// models/emailVerificationModel.js
const mongoose = require('mongoose');

const emailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'verified'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('EmailVerification', emailVerificationSchema);


