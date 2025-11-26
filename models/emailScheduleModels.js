const mongoose = require('mongoose');

const emailScheduleSchema = new mongoose.Schema({
  // Unique identifier for this scheduled email job
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
    path: String
  }],
  
  // Scheduling information
  scheduledFor: {
    type: Date,
    required: true,
    index: true
  },
  
  // Status tracking - CRITICAL for preventing duplicates
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Lock mechanism
  lockedAt: {
    type: Date,
    index: true
  },
  
  lockedBy: {
    type: String  // Server/process identifier
  },
  
  // Execution tracking
  executedAt: Date,
  
  completedAt: Date,
  
  attempts: {
    type: Number,
    default: 0
  },
  
  maxAttempts: {
    type: Number,
    default: 3
  },
  
  // Error tracking
  lastError: String,
  
  errorHistory: [{
    error: String,
    timestamp: Date,
    attempt: Number
  }],
  
  // Results tracking
  results: [{
    recipientEmail: String,
    success: Boolean,
    sentAt: Date,
    error: String
  }]
  
}, {
  timestamps: true
});

// Compound indexes for efficient querying
emailScheduleSchema.index({ status: 1, scheduledFor: 1 });
emailScheduleSchema.index({ status: 1, lockedAt: 1 });
emailScheduleSchema.index({ jobId: 1, status: 1 });

// Method to acquire lock for processing
emailScheduleSchema.methods.acquireLock = async function(processId, lockDuration = 300000) {
  const now = new Date();
  const lockExpiry = new Date(now.getTime() - lockDuration);
  
  // Try to acquire lock atomically
  const result = await this.constructor.findOneAndUpdate(
    {
      _id: this._id,
      status: 'pending',
      $or: [
        { lockedAt: null },
        { lockedAt: { $lt: lockExpiry } }  // Lock expired
      ]
    },
    {
      $set: {
        status: 'processing',
        lockedAt: now,
        lockedBy: processId,
        executedAt: now
      },
      $inc: { attempts: 1 }
    },
    { new: true }
  );
  
  return result !== null;
};

// Method to mark as completed
emailScheduleSchema.methods.markCompleted = async function(results) {
  await this.constructor.findByIdAndUpdate(this._id, {
    $set: {
      status: 'completed',
      completedAt: new Date(),
      results: results,
      lockedAt: null,
      lockedBy: null
    }
  });
};

// Method to mark as failed
emailScheduleSchema.methods.markFailed = async function(error) {
  const shouldRetry = this.attempts < this.maxAttempts;
  
  await this.constructor.findByIdAndUpdate(this._id, {
    $set: {
      status: shouldRetry ? 'pending' : 'failed',
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
  });
};

// Static method to find jobs ready for processing
emailScheduleSchema.statics.findJobsToProcess = async function(limit = 5, processId) {
  const now = new Date();
  
  return await this.find({
    status: 'pending',
    scheduledFor: { $lte: now },
    attempts: { $lt: 3 },
    $or: [
      { lockedAt: null },
      { lockedAt: { $lt: new Date(now.getTime() - 300000) } }  // 5 min old locks
    ]
  })
  .sort({ scheduledFor: 1 })
  .limit(limit);
};

// Static method to cleanup old completed jobs
emailScheduleSchema.statics.cleanupOldJobs = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return await this.deleteMany({
    status: 'completed',
    completedAt: { $lt: cutoffDate }
  });
};

module.exports = mongoose.model('EmailSchedule', emailScheduleSchema);

