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



// const mongoose = require('mongoose');

// const appointmentSchema = new mongoose.Schema({
//   formType: {
//     type: String,
//     required: true,
//     enum: ['mainForm', 'termForm', 'wholeForm', 'indexedForm', 'finalForm', 'zoomBooking', 'policy_review', 'contact_list']
//   },
//   formId: {
//     type: mongoose.Schema.Types.ObjectId,
//     refPath: 'formType'
//   },
//   formData: {
//     type: mongoose.Schema.Types.Mixed,
//     required: false
//   },
//   assignedSlot: {
//     type: Date,
//     required: true
//   },
//   initialSlot: {
//     type: Date, // Track the original assigned time
//     required: false
//   },
//   contactWindowStart: {
//     type: Date,
//     required: false
//   },
//   contactWindowEnd: {
//     type: Date,
//     required: false
//   },
//   status: {
//     type: String,
//     enum: ['scheduled', 'contacted', 'booked', 'completed', 'missed'],
//     default: 'scheduled'
//   },
//   lastContactDate: {
//     type: Date,
//     required: false
//   },
//   contactMethod: {
//     type: String,
//     enum: ['email', 'phone', 'text'],
//     required: false
//   },
//   contactedBy: {
//     type: String,
//     required: false
//   },
//   // NEW FIELDS TO TRACK CUSTOMER BOOKING ACTIVITY
//   customerBookedAt: {
//     type: Date,
//     required: false // When customer actually booked the meeting
//   },
//   originalTimeSlot: {
//     type: Date,
//     required: false // Original time before customer chose new time
//   },
//   customerChosenTime: {
//     type: Boolean,
//     default: false // Flag to indicate if customer chose a different time
//   },
//   bookingSource: {
//     type: String,
//     enum: ['zoom_scheduler', 'manual', 'auto_sync'],
//     required: false
//   },
//   // END NEW FIELDS
//   zoomMeeting: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'ZoomMeeting',
//     required: false
//   },
//   zoomMeetingId: {
//     type: String,
//     required: false
//   },
//   clientContactId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'ClientContact',
//     required: false
//   },
//   isContactList: {
//     type: Boolean,
//     default: false
//   },
//   // Policy-related fields (for contact list appointments)
//   policyType: String,
//   policyEffectiveDate: Date,
//   annualReviewDate: Date,
//   lastContactedAt: Date,
//   nextFollowUpAt: Date,
//   notes: String,
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   lastUpdated: {
//     type: Date,
//     default: Date.now
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Virtual for user information
// appointmentSchema.virtual('user').get(function() {
//   if (this.isContactList && this.clientContactId) {
//     return {
//       firstName: this.clientContactId.firstName || 'N/A',
//       lastName: this.clientContactId.lastName || 'N/A',
//       email: this.clientContactId.email || 'N/A',
//       phoneNumber: this.clientContactId.phoneNumber || 'N/A',
//       Dob: this.clientContactId.Dob || null
//     };
//   }
  
//   if (this.formData) {
//     return {
//       firstName: this.formData.firstName || 'N/A',
//       lastName: this.formData.lastName || 'N/A',
//       email: this.formData.Email || this.formData.email || 'N/A',
//       phoneNumber: this.formData.phoneNumber || 'N/A',
//       Dob: this.formData.Dob || null
//     };
//   }
  
//   return null;
// });

// // Pre-save middleware to track time changes
// appointmentSchema.pre('save', function(next) {
//   if (this.isModified('assignedSlot') && !this.isNew) {
//     // If assigned slot is being modified after creation, track it
//     if (!this.originalTimeSlot) {
//       this.originalTimeSlot = this.assignedSlot;
//     }
//   }
  
//   if (this.isModified('assignedSlot') || this.isModified('status')) {
//     this.lastUpdated = new Date();
//   }
  
//   next();
// });

// // Index for efficient querying
// appointmentSchema.index({ assignedSlot: 1 });
// appointmentSchema.index({ status: 1 });
// appointmentSchema.index({ formType: 1 });
// appointmentSchema.index({ createdAt: -1 });
// appointmentSchema.index({ lastContactDate: 1 });
// appointmentSchema.index({ customerBookedAt: 1 });

// module.exports = mongoose.model('Appointment', appointmentSchema);

