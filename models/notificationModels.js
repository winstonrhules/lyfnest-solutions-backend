const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, required: true },
  read: { type: Boolean, default: false },
  formType:{
    type: String, 
    required: true,
    enum:['mainForm', 'termForm', 'wholeForm', 'indexedForm', 'finalForm']
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
