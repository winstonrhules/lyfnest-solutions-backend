// // models/EmailTemplate.js (MongoDB/Mongoose)
// const mongoose = require('mongoose');

// const emailTemplateSchema = new mongoose.Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   name: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   subject: {
//     type: String,
//     required: true
//   },
//   body: {
//     type: String,
//     required: true
//   },
//   templateType: {
//     type: String,
//     default: 'default'
//   },
//   design: {
//     type: String,
//     default: 'default'
//   },
//   tags: [{
//     type: String
//   }],
//   isPublic: {
//     type: Boolean,
//     default: false
//   }
// }, {
//   timestamps: true
// });

// // Index for better performance
// emailTemplateSchema.index({ userId: 1, name: 1 });

// module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);

const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  templateType: {
    type: String,
    default: 'default'
  },
  design: {
    type: String,
    default: 'default'
  },
  tags: [{
    type: String
  }],
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);

