const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  timestamp: { type: Date, required: true, default:Date.now},
  read: { type: Boolean, default: false },
  formType:{
    type: String, 
    required: true,
    enum:['mainForm', 'termForm', 'wholeForm', 'indexedForm', 'finalForm']
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
