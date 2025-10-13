const mongoose = require('mongoose');

const scheduledEmailSchema = new mongoose.Schema({
  recipients: [{
    type: String,
    required: true
  }],
  recipientContacts: [{
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    policyType: String,
    policyNumber: String,
    renewalDate: String,
    premiumAmount: String,
    Dob: Date,
    appointmentDate: String,
    appointmentTime: String,
    reviewDueDate: String,
    customFields: mongoose.Schema.Types.Mixed
  }],
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  design: {
    type: String,
    default: 'default'
  },
  scheduleDateTime: {
    type: Date,
    required: true
  },
  sent: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date
  },
  sender: {
    fromName: String,
    fromEmail: String,
    replyTo: String
  },
  attachments: [{
    filename: String,
    path: String,
    size: Number
  }],
  error: {
    type: String
  },
  retryCount: {
    type: Number,
    default: 0
  },
  // ISSUE 1 FIX: Add processed flag to prevent duplicates
  processed: {
    type: Boolean,
    default: false
  },
   processing: {
    type: Boolean,
    default: false
  },
  lastProcessingAttempt: {
    type: Date
  },
  lastError: {
    type: String
  }
  
}, {
  timestamps: true
});

// ISSUE 1 FIX: Better indexing for scheduled email processing
scheduledEmailSchema.index({ scheduleDateTime: 1, sent: 1, processed: 1 });
scheduledEmailSchema.index({ userId: 1, sent: 1 });
scheduledEmailSchema.index({ _id: 1, scheduleDateTime: 1 }); 
// Compound index for uniqueness
scheduledEmailSchema.index({ scheduleDateTime: 1, sent: 1, processing: 1 });
scheduledEmailSchema.index({ processing: 1, lastProcessingAttempt: 1 });

module.exports = mongoose.model('ScheduledEmail', scheduledEmailSchema);


