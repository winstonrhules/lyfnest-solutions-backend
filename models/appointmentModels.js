const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
    required: true
  },
  formType:{
      type: String, 
      required: true,
      enum:['mainForm', 'termForm', 'wholeForm', 'indexedForm', 'finalForm']
    },
    formData:{
    type: mongoose.Schema.Types.Mixed, 
    required: true,
  },

  zoomMeeting: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'ZoomMeeting'
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
    enum: ['scheduled', 'completed', 'missed', 'contacted'],
    default: 'scheduled'
  },

  zoomMeetingId: {
    type: String,
    required: false,
    unique: true,
    default:null,
  },
  
  source: {
    type: String,
    enum: ['zoom', 'manual'],
    default: 'manual'
  },

lastContactDate: Date,
contactMethod: String,
contactedBy: String,
  
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
