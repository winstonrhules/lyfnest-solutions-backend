// const mongoose = require('mongoose');

// const appointmentSchema = new mongoose.Schema({
//  user: {
//   firstName: String,
//   lastName: String,
//   email: String,
//   phoneNumber: String
// },
//   formId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Form',
//     required: true
//   },
//   formType:{
//       type: String, 
//       required: true,
//       enum:['mainForm', 'termForm', 'wholeForm', 'indexedForm', 'finalForm', 'zoomBooking']
//     },
//     formData:{
//     type: mongoose.Schema.Types.Mixed, 
//     required: true,
//   },

//   zoomMeeting: {
//   type: mongoose.Schema.Types.ObjectId,
//   ref: 'ZoomMeeting'
// },

  
//   contactWindowStart: {
//     type: Date,
//     required: true
//   },
  
//   contactWindowEnd: {
//     type: Date,
//     required: true
//   },
  
//   initialSlot: {
//     type: Date,
//     required: true
//   },
//   assignedSlot: {
//     type: Date,
//     required: true
//   },
//   status: {
//     type: String,
//     enum: ['scheduled', 'completed', 'booked', 'missed', 'contacted'],
//     default: 'scheduled'
//   },

//   zoomMeetingId: {
//     type: String,
//     required: false,
//   },
    
//   source: {
//     type: String,
//     enum: ['zoom', 'manual'],
//     default: 'manual'
//   },

// lastContactDate: Date,
// contactMethod: String,
// contactedBy: String,
  
// }, { timestamps: true });

// module.exports = mongoose.model('Appointment', appointmentSchema);


const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  user: {
    firstName: String,
    lastName: String,
    email: String,
    phoneNumber: String
  },
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
    required: true
  },
  formType: {
    type: String, 
    required: true,
    enum: ['mainForm', 'termForm', 'wholeForm', 'indexedForm', 'finalForm', 'zoomBooking']
  },
  formData: {
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
  // Add the missing initialSlot field
  initialSlot: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'booked', 'missed', 'contacted'],
    default: 'scheduled'
  },
  zoomMeetingId: {
    type: String,
    required: false,
  },
  source: {
    type: String,
    enum: ['zoom', 'manual'],
    default: 'manual'
  },
  lastContactDate: Date,
  contactMethod: String,
  contactedBy: String,
  lastUpdated: {
    type: Date,
    default: Date.now
  },

  policyType: {
  type: String,
  enum: ['IUL', 'WL', 'Term', 'Final Expense'],
  required: true
},

appointmentType: {
  type: String,
  enum: ['consultation', 'policy_review', 'follow_up'],
  default: 'consultation'
}

}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
