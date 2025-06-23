const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
    required: true
  },
  contactWindowStart: {
    type: Date,
    required: true
  },
  contactWindowEnd: {
    type: Date,
    required: true
  },
  assignedSlot: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'missed'],
    default: 'scheduled'
  }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
