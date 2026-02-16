// const mongoose = require('mongoose');

// const appointmentSchema = new mongoose.Schema({
//   user: {
//     firstName: String,
//     lastName: String,
//     email: String,
//     phoneNumber: String,
//     Dob:Date
//   },
//   formId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Form',
//     required: function() {
//       return !this.isContactList;
//     }
//   },
//   formType: {
//     type: String, 
//     required: true,
//     enum: ['mainForm', 'termForm', 'wholeForm', 'indexedForm', 'finalForm', 'zoomBooking', 'policy_review', 'contact_list']
//   },
//   formData: {
//     type: mongoose.Schema.Types.Mixed, 
//     required: function() {
//       return !this.isContactList;
//     }
//   },
//   zoomMeeting: {
//     id: String,
//     meetingId:String,
//     topic:String,
//     startTime:Date,
//     joinUrl:String,
//     startUrl:String,
//     registrationUrl:String,
//     password:String,
//     createdAt:Date
//   },
  
//   contactWindowStart: {
//     type: Date,
//     required: true
//   },
//   contactWindowEnd: {
//     type: Date,
//     required: true
//   },
//   assignedSlot: {
//     type: Date,
//     required: true
//   },
//   // Add the missing initialSlot field
//   initialSlot: {
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
//   lastContactDate: Date,
//   contactMethod: String,
//   contactedBy: String,
//   lastUpdated: {
//     type: Date,
//     default: Date.now
//   },

//   policyType: {
//   type: String,
//   enum: ['IUL', 'WL', 'Term', 'Final Expense', 'Other'],
//   required: true
// },

//   policyEffectiveDate: Date,
//   annualReviewDate: Date,
//   lastContactedAt: Date,
//   nextFollowUpAt: Date,
//   isContactList: { type: Boolean, default: false }, // To distinguish contact list entries
//   clientContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientContact' },// Reference to contact


// appointmentType: {
//   type: String,
//   enum: ['consultation', 'policy_review', 'follow_up'],
//   default: 'consultation'
// }

// }, { timestamps: true });

// module.exports = mongoose.model('Appointment', appointmentSchema);


// 
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  user: {
    firstName: String,
    lastName: String,
    email: String,
    phoneNumber: String,
    Dob:Date
  },
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
    required: function() {
      return !this.isContactList;
    }
  },
  formType: {
    type: String, 
    required: true,
    enum: ['mainForm', 'termForm', 'wholeForm', 'indexedForm', 'finalForm', 'zoomBooking', 'policy_review', 'contact_list']
  },
  formData: {
    type: mongoose.Schema.Types.Mixed, 
    required: function() {
      return !this.isContactList;
    }
  },
  zoomMeeting: {
    id: String,
    meetingId:String,
    topic:String,
    startTime:Date,
    joinUrl:String,
    startUrl:String,
    registrationUrl:String,
    password:String,
    createdAt:Date
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
  enum: ['IUL', 'WL', 'Term', 'Final Expense', 'Other'],
  required: true
},

  policyEffectiveDate: Date,
  annualReviewDate: Date,
  lastContactedAt: Date,
  nextFollowUpAt: Date,
  isContactList: { type: Boolean, default: false }, // To distinguish contact list entries
  clientContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientContact' },// Reference to contact


appointmentType: {
  type: String,
  enum: ['consultation', 'policy_review', 'follow_up'],
  default: 'consultation'
}

}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
