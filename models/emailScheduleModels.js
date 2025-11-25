const mongoose = require('mongoose');

const emailScheduleSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Email content
  recipients: [{
    email: { type: String, required: true },
    contactData: {
      firstName: String,
      lastName: String,
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
    }
  }],
  
  subject: {
    type: String,
    required: true
  },
  
  bodyTemplate: {
    type: String,
    required: true
  },
  
  design: {
    type: String,
    default: 'default'
  },
  
  sender: {
    fromName: String,
    fromEmail: String,
    replyTo: String
  },
  
  attachments: [{
    filename: String,
    path: String,
    size: Number,
    mimetype: String
  }],
  
  // Scheduling
  scheduledFor: {
    type: Date,
    required: true,
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['scheduled', 'processing', 'sent', 'failed', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  
  // Lock mechanism for processing
  lockedAt: Date,
  lockedBy: String,
  
  // Execution tracking
  processedAt: Date,
  sentAt: Date,
  
  attempts: {
    type: Number,
    default: 0
  },
  
  maxAttempts: {
    type: Number,
    default: 3
  },
  
  // Results tracking
  results: [{
    recipientEmail: String,
    success: Boolean,
    sentAt: Date,
    messageId: String,
    error: String
  }],
  
  lastError: String,
  
  errorHistory: [{
    error: String,
    timestamp: Date,
    attempt: Number
  }]
  
}, {
  timestamps: true
});

// Indexes for efficient querying
emailScheduleSchema.index({ status: 1, scheduledFor: 1 });
emailScheduleSchema.index({ scheduledFor: 1 });
// emailScheduleSchema.index({ jobId: 1 });

// Method to acquire lock
emailScheduleSchema.methods.acquireLock = async function(processorId, lockTimeoutMs = 300000) {
  const lockExpiry = new Date(Date.now() - lockTimeoutMs);
  
  const result = await mongoose.model('EmailSchedule').findOneAndUpdate(
    {
      _id: this._id,
      status: 'scheduled',
      $or: [
        { lockedAt: { $exists: false } },
        { lockedAt: null },
        { lockedAt: { $lt: lockExpiry } }
      ]
    },
    {
      $set: {
        status: 'processing',
        lockedAt: new Date(),
        lockedBy: processorId
      },
      $inc: { attempts: 1 }
    }
  );
  
  return result !== null;
};

// Method to release lock and mark as sent
emailScheduleSchema.methods.markSent = async function(results) {
  await mongoose.model('EmailSchedule').findOneAndUpdate(
    { _id: this._id },
    {
      $set: {
        status: 'sent',
        sentAt: new Date(),
        results: results,
        lockedAt: null,
        lockedBy: null
      }
    }
  );
};

// Method to mark as failed
emailScheduleSchema.methods.markFailed = async function(error) {
  const shouldRetry = this.attempts < this.maxAttempts;
  
  await mongoose.model('EmailSchedule').findOneAndUpdate(
    { _id: this._id },
    {
      $set: {
        status: shouldRetry ? 'scheduled' : 'failed',
        lastError: error,
        lockedAt: null,
        lockedBy: null
      },
      $push: {
        errorHistory: {
          error: error,
          timestamp: new Date(),
          attempt: this.attempts
        }
      }
    }
  );
};

// Static method to find due emails
emailScheduleSchema.statics.findDueEmails = async function(limit = 10) {
  return await this.find({
    status: 'scheduled',
    scheduledFor: { $lte: new Date() },
    attempts: { $lt: 3 }
  })
  .sort({ scheduledFor: 1 })
  .limit(limit);
};

// Static method to cleanup old sent emails
emailScheduleSchema.statics.cleanupOldEmails = async function(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  return await this.deleteMany({
    status: 'sent',
    sentAt: { $lt: cutoff }
  });
};

module.exports = mongoose.model('EmailSchedule', emailScheduleSchema);



