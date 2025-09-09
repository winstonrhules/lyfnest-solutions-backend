// const mongoose = require('mongoose');
// const scheduledEmailSchema = new mongoose.Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   recipients: [{
//     type: String,
//     required: true
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
//   }
// }, {
//   timestamps: true
// });

// // Index for scheduled processing
// scheduledEmailSchema.index({ scheduleDateTime: 1, sent: 1 });
// scheduledEmailSchema.index({ userId: 1, sent: 1 });

// module.exports = mongoose.model('ScheduledEmail', scheduledEmailSchema);


const mongoose = require('mongoose');

const scheduledEmailSchema = new mongoose.Schema({
  recipients: [{
    type: String,
    required: true
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
  }
}, {
  timestamps: true
});

// Index for scheduled processing
scheduledEmailSchema.index({ scheduleDateTime: 1, sent: 1 });

module.exports = mongoose.model('ScheduledEmail', scheduledEmailSchema);