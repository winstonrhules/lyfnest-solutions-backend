// const mongoose = require('mongoose');

// const scheduledEmailSchema = new mongoose.Schema({
//   recipients: [{
//     type: String,
//     required: true
//   }],
//   recipientContacts: [{
//     firstName: String,
//     lastName: String,
//     email: String,    
//     phone: String,
//     policyType: String,
//     policyNumber: String,
//     renewalDate: String,
//     premiumAmount: String, 
//     Dob: Date,
//     appointmentDate: String,
//     appointmentTime: String,
//     reviewDueDate: String,
//     customFields: mongoose.Schema.Types.Mixed
//   }],
//   subject: {
//     type: String,
//     required: true
//   },
//   body: {
//     type: String,
//     required: true
//   },
//   design: {
//     type: String,
//     default: 'default'
//   },
//   scheduleDateTime: {
//     type: Date,
//     required: true
//   },
//   sent: {
//     type: Boolean,
//     default: false
//   },
//   sentAt: {
//     type: Date
//   },
//   sender: {
//     fromName: String,
//     fromEmail: String,
//     replyTo: String
//   },
//   attachments: [{
//     filename: String,
//     path: String,
//     size: Number
//   }],
//   error: {
//     type: String
//   },
//   retryCount: {
//     type: Number,
//     default: 0
//   },
//   // ISSUE 1 FIX: Add processed flag to prevent duplicates
//   processed: {
//     type: Boolean,
//     default: false
//   },
//    processing: {
//     type: Boolean,
//     default: false
//   },
//   lastProcessingAttempt: {
//     type: Date
//   },
//   lastError: {
//     type: String
//   }
  
// }, {
//   timestamps: true
// });

// // ISSUE 1 FIX: Better indexing for scheduled email processing
// scheduledEmailSchema.index({ scheduleDateTime: 1, sent: 1, processed: 1 });
// scheduledEmailSchema.index({ userId: 1, sent: 1 });
// scheduledEmailSchema.index({ _id: 1, scheduleDateTime: 1 }); 
// // Compound index for uniqueness
// scheduledEmailSchema.index({ scheduleDateTime: 1, sent: 1, processing: 1 });
// scheduledEmailSchema.index({ processing: 1, lastProcessingAttempt: 1 });

// module.exports = mongoose.model('ScheduledEmail', scheduledEmailSchema);


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
  maxRetries: {
    type: Number,
    default: 3
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'],
    default: 'pending'
  },
  processingLock: {
    type: String,
    default: null
  },
  processingLockExpires: {
    type: Date
  },
  lastProcessingAttempt: {
    type: Date
  }
}, {
  timestamps: true
});

// Optimized indexes for email processing
scheduledEmailSchema.index({ 
  scheduleDateTime: 1, 
  status: 1,
  sent: 1 
});

scheduledEmailSchema.index({ 
  processingLock: 1,
  processingLockExpires: 1 
});

scheduledEmailSchema.index({ 
  status: 1,
  scheduleDateTime: 1 
});

// Instance method to acquire processing lock
scheduledEmailSchema.methods.acquireLock = async function(lockId, lockDurationMs = 300000) { // 5 minutes
  const now = new Date();
  const lockExpires = new Date(now.getTime() + lockDurationMs);
  
  const result = await mongoose.model('ScheduledEmail').updateOne(
    {
      _id: this._id,
      $or: [
        { processingLock: null },
        { processingLockExpires: { $lt: now } }
      ]
    },
    {
      $set: {
        processingLock: lockId,
        processingLockExpires: lockExpires,
        status: 'processing',
        lastProcessingAttempt: now
      }
    }
  );
  
  return result.modifiedCount > 0;
};

// Instance method to release processing lock
scheduledEmailSchema.methods.releaseLock = async function(lockId) {
  const result = await mongoose.model('ScheduledEmail').updateOne(
    {
      _id: this._id,
      processingLock: lockId
    },
    {
      $set: {
        processingLock: null,
        processingLockExpires: null
      }
    }
  );
  
  return result.modifiedCount > 0;
};

// Static method to find processable emails
scheduledEmailSchema.statics.findProcessableEmails = function(limit = 10) {
  const now = new Date();
  
  return this.find({
    scheduleDateTime: { $lte: now },
    status: 'pending',
    sent: false,
    $or: [
      { processingLock: null },
      { processingLockExpires: { $lt: now } }
    ]
  })
  .sort({ scheduleDateTime: 1 })
  .limit(limit);
};

module.exports = mongoose.model('ScheduledEmail', scheduledEmailSchema);