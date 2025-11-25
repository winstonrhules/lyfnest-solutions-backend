// const mongoose = require('mongoose');

// const emailScheduleSchema = new mongoose.Schema({
//   // Unique identifier for this scheduled email job
//   jobId: {
//     type: String,
//     required: true,
//     unique: true,
//     index: true
//   },
  
//   // Email content
//   recipients: [{
//     email: { type: String, required: true },
//     contactData: {
//       firstName: String,
//       lastName: String,
//        email: String,    
//        phone: String,
//       policyType: String,
//       policyNumber: String,
//     renewalDate: String,
//     premiumAmount: String, 
//     Dob: Date,
//     appointmentDate: String,
//     appointmentTime: String,
//     reviewDueDate: String,
//     customFields: mongoose.Schema.Types.Mixed
//     }
//   }],
  
//   subject: {
//     type: String,
//     required: true
//   },
  
//   bodyTemplate: {
//     type: String,
//     required: true
//   },
  
//   design: {
//     type: String,
//     default: 'default'
//   },
  
//   sender: {
//     fromName: String,
//     fromEmail: String,
//     replyTo: String
//   },
  
//   attachments: [{
//     filename: String,
//     path: String
//   }],
  
//   // Scheduling information
//   scheduledFor: {
//     type: Date,
//     required: true,
//     index: true
//   },
  
//   // Status tracking - CRITICAL for preventing duplicates
//   status: {
//     type: String,
//     enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
//     default: 'pending',
//     index: true
//   },
  
//   // Lock mechanism
//   lockedAt: {
//     type: Date,
//     index: true
//   },
  
//   lockedBy: {
//     type: String  // Server/process identifier
//   },
  
//   // Execution tracking
//   executedAt: Date,
  
//   completedAt: Date,
  
//   attempts: {
//     type: Number,
//     default: 0
//   },
  
//   maxAttempts: {
//     type: Number,
//     default: 3
//   },
  
//   // Error tracking
//   lastError: String,
  
//   errorHistory: [{
//     error: String,
//     timestamp: Date,
//     attempt: Number
//   }],
  
//   // Results tracking
//   results: [{
//     recipientEmail: String,
//     success: Boolean,
//     sentAt: Date,
//     error: String
//   }]
  
// }, {
//   timestamps: true
// });

// // Compound indexes for efficient querying
// emailScheduleSchema.index({ status: 1, scheduledFor: 1 });
// emailScheduleSchema.index({ status: 1, lockedAt: 1 });
// emailScheduleSchema.index({ jobId: 1, status: 1 });

// // Method to acquire lock for processing
// emailScheduleSchema.methods.acquireLock = async function(processId, lockDuration = 300000) {
//   const now = new Date();
//   const lockExpiry = new Date(now.getTime() - lockDuration);
  
//   // Try to acquire lock atomically
//   const result = await this.constructor.findOneAndUpdate(
//     {
//       _id: this._id,
//       status: 'pending',
//       $or: [
//         { lockedAt: null },
//         { lockedAt: { $lt: lockExpiry } }  // Lock expired
//       ]
//     },
//     {
//       $set: {
//         status: 'processing',
//         lockedAt: now,
//         lockedBy: processId,
//         executedAt: now
//       },
//       $inc: { attempts: 1 }
//     },
//     { new: true }
//   );
  
//   return result !== null;
// };

// // Method to mark as completed
// emailScheduleSchema.methods.markCompleted = async function(results) {
//   await this.constructor.findByIdAndUpdate(this._id, {
//     $set: {
//       status: 'completed',
//       completedAt: new Date(),
//       results: results,
//       lockedAt: null,
//       lockedBy: null
//     }
//   });
// };

// // Method to mark as failed
// emailScheduleSchema.methods.markFailed = async function(error) {
//   const shouldRetry = this.attempts < this.maxAttempts;
  
//   await this.constructor.findByIdAndUpdate(this._id, {
//     $set: {
//       status: shouldRetry ? 'pending' : 'failed',
//       lastError: error,
//       lockedAt: null,
//       lockedBy: null
//     },
//     $push: {
//       errorHistory: {
//         error: error,
//         timestamp: new Date(),
//         attempt: this.attempts
//       }
//     }
//   });
// };

// // Static method to find jobs ready for processing
// emailScheduleSchema.statics.findJobsToProcess = async function(limit = 5, processId) {
//   const now = new Date();
  
//   return await this.find({
//     status: 'pending',
//     scheduledFor: { $lte: now },
//     attempts: { $lt: 3 },
//     $or: [
//       { lockedAt: null },
//       { lockedAt: { $lt: new Date(now.getTime() - 300000) } }  // 5 min old locks
//     ]
//   })
//   .sort({ scheduledFor: 1 })
//   .limit(limit);
// };

// // Static method to cleanup old completed jobs
// emailScheduleSchema.statics.cleanupOldJobs = async function(daysOld = 30) {
//   const cutoffDate = new Date();
//   cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
//   return await this.deleteMany({
//     status: 'completed',
//     completedAt: { $lt: cutoffDate }
//   });
// };

// module.exports = mongoose.model('EmailSchedule', emailScheduleSchema);


const mongoose = require('mongoose');

const emailScheduleSchema = new mongoose.Schema({
  // Unique job identifier
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Email recipients with their data
  recipients: [{
    email: { 
      type: String, 
      required: true 
    },
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
      reviewDueDate: String
    }
  }],
  
  // Email content
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
  
  // Sender information
  sender: {
    fromName: String,
    fromEmail: String,
    replyTo: String
  },
  
  // Attachments
  attachments: [{
    filename: String,
    path: String,
    contentType: String
  }],
  
  // Scheduling
  scheduledFor: {
    type: Date,
    required: true,
    index: true
  },
  
  // Status with proper indexing
  status: {
    type: String,
    enum: ['scheduled', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'scheduled',
    required: true,
    index: true
  },
  
  // Processing lock to prevent duplicate execution
  processingLock: {
    isLocked: {
      type: Boolean,
      default: false,
      index: true
    },
    lockedAt: Date,
    lockedBy: String,
    lockExpiry: Date
  },
  
  // Execution tracking
  executionAttempts: {
    type: Number,
    default: 0
  },
  
  maxExecutionAttempts: {
    type: Number,
    default: 3
  },
  
  lastExecutionAttempt: Date,
  
  // Completion tracking
  completedAt: Date,
  
  // Error tracking
  errors: [{
    message: String,
    timestamp: Date,
    attemptNumber: Number
  }],
  
  // Results for each recipient
  results: [{
    recipientEmail: String,
    status: {
      type: String,
      enum: ['sent', 'failed']
    },
    sentAt: Date,
    error: String
  }],
  
  // Metadata
  createdBy: String,
  updatedBy: String

}, {
  timestamps: true
});

// Compound indexes for efficient querying
emailScheduleSchema.index({ status: 1, scheduledFor: 1 });
emailScheduleSchema.index({ status: 1, 'processingLock.isLocked': 1 });
emailScheduleSchema.index({ createdAt: -1 });

// Method to acquire processing lock
emailScheduleSchema.methods.acquireProcessingLock = async function(processId) {
  const lockDuration = 5 * 60 * 1000; // 5 minutes
  const now = new Date();
  const lockExpiry = new Date(now.getTime() + lockDuration);
  
  const updated = await this.constructor.findOneAndUpdate(
    {
      _id: this._id,
      status: 'scheduled',
      $or: [
        { 'processingLock.isLocked': false },
        { 'processingLock.lockExpiry': { $lt: now } } // Expired lock
      ]
    },
    {
      $set: {
        status: 'processing',
        'processingLock.isLocked': true,
        'processingLock.lockedAt': now,
        'processingLock.lockedBy': processId,
        'processingLock.lockExpiry': lockExpiry,
        lastExecutionAttempt: now
      },
      $inc: { executionAttempts: 1 }
    },
    { new: true }
  );
  
  return updated !== null;
};

// Method to release lock
emailScheduleSchema.methods.releaseLock = async function() {
  await this.constructor.findByIdAndUpdate(this._id, {
    $set: {
      'processingLock.isLocked': false,
      'processingLock.lockedAt': null,
      'processingLock.lockedBy': null,
      'processingLock.lockExpiry': null
    }
  });
};

// Method to mark as completed
emailScheduleSchema.methods.markAsCompleted = async function(results) {
  await this.constructor.findByIdAndUpdate(this._id, {
    $set: {
      status: 'completed',
      completedAt: new Date(),
      results: results,
      'processingLock.isLocked': false
    }
  });
};

// Method to mark as failed
emailScheduleSchema.methods.markAsFailed = async function(errorMessage) {
  const shouldRetry = this.executionAttempts < this.maxExecutionAttempts;
  
  await this.constructor.findByIdAndUpdate(this._id, {
    $set: {
      status: shouldRetry ? 'scheduled' : 'failed',
      'processingLock.isLocked': false
    },
    $push: {
      errors: {
        message: errorMessage,
        timestamp: new Date(),
        attemptNumber: this.executionAttempts
      }
    }
  });
};

// Static method to find jobs ready for processing
emailScheduleSchema.statics.findReadyJobs = async function(limit = 10) {
  const now = new Date();
  
  return await this.find({
    status: 'scheduled',
    scheduledFor: { $lte: now },
    executionAttempts: { $lt: 3 },
    'processingLock.isLocked': false
  })
  .sort({ scheduledFor: 1 })
  .limit(limit);
};

// Static method to cleanup expired locks
emailScheduleSchema.statics.cleanupExpiredLocks = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      status: 'processing',
      'processingLock.lockExpiry': { $lt: now }
    },
    {
      $set: {
        status: 'scheduled',
        'processingLock.isLocked': false,
        'processingLock.lockedAt': null,
        'processingLock.lockedBy': null,
        'processingLock.lockExpiry': null
      }
    }
  );
  
  return result.modifiedCount;
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