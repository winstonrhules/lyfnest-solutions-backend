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

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  // ✅ EXISTING CORE FIELDS
  assignedSlot: {
    type: Date,
    required: true
  },
  formType: {
    type: String,
    required: true,
    enum: ['mainForm', 'termForm', 'wholeForm', 'indexedForm', 'finalForm', 'zoomBooking', 'policy_review', 'contact_list']
  },
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'formType', // Dynamic reference based on formType
    required: false
  },
  status: {
    type: String,
    enum: ['scheduled', 'contacted', 'booked', 'completed', 'missed', 'cancelled'],
    default: 'scheduled'
  },
  
  // ✅ EXISTING CONTACT FIELDS
  contactMethod: {
    type: String,
    enum: ['email', 'phone', 'sms'],
    default: 'email'
  },
  lastContactDate: {
    type: Date
  },
  contactedBy: {
    type: String,
    default: 'Admin'
  },
  
  // ✅ EXISTING TIME FIELDS
  contactWindowStart: {
    type: Date,
    required: true
  },
  contactWindowEnd: {
    type: Date,
    required: true
  },
  customerBookedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  missedAt: {
    type: Date
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },

  appointmentType: {
  type: String,
  enum: ['consultation', 'policy_review', 'follow_up'],
  default: 'consultation'
},
  
  // ✅ ENHANCED: Token-based matching fields (NEW)
  appointmentToken: {
    type: String,
    required: false,
    index: true, // Index for faster token lookups
    unique: true, // Ensure tokens are unique
    sparse: true // Allow null values while maintaining uniqueness for non-null values
  },
  originalEmail: {
    type: String,
    required: false,
    index: true // Index for faster email matching
  },
  originalName: {
    type: String,
    required: false
  },
  
  // ✅ EXISTING ZOOM INTEGRATION
  zoomMeeting: {
    id: String,
    meetingId: String,
    topic: String,
    startTime: Date,
    joinUrl: String,
    startUrl: String,
    password: String,
    schedulerUrl: String,
    zoomMeetingRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ZoomMeeting'
    },
    matchingStrategy: String,
    // ✅ NEW: Add token to zoom meeting object for consistency
    appointmentToken: String,
    originalEmail: String,
    originalName: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // ✅ EXISTING USER DATA (for appointments without formId)
  user: {
    firstName: String,
    lastName: String,
    email: String,
    phoneNumber: String,
    Dob: Date // Keep existing Dob field for birthday detection
  },
  
  // ✅ EXISTING FORM DATA (embedded form data as fallback)
  formData: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  
  // ✅ ENHANCED: Contact List specific fields
  isContactList: {
    type: Boolean,
    default: false
  },
  policyType: {
    type: String,
    required: false
  },
  policyEffectiveDate: {
    type: Date,
    required: false
  },
  annualReviewDate: {
    type: Date,
    required: false
  },
  lastContactedAt: {
    type: Date,
    required: false
  },
  nextFollowUpAt: {
    type: Date,
    required: false
  },
  
  // ✅ NEW: Enhanced tracking fields
  initialSlot: {
    type: Date,
    required: false // Store the original assigned slot before any changes
  },
  timeZone: {
    type: String,
    default: 'America/New_York'
  },
  source: {
    type: String,
    enum: ['website_form', 'manual_entry', 'contact_list', 'referral', 'zoom_direct'],
    default: 'website_form'
  },
  
  // ✅ NEW: Booking analytics
  schedulerLinkSentCount: {
    type: Number,
    default: 0
  },
  schedulerLinkLastSent: {
    type: Date
  },
  clientViewedScheduler: {
    type: Boolean,
    default: false
  },
  clientViewedSchedulerAt: {
    type: Date
  },
  
  // ✅ NEW: Meeting quality tracking
  meetingFeedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String,
    submittedAt: Date
  },
  
  // ✅ NEW: Error tracking and retry logic
  lastSyncError: {
    type: String,
    required: false
  },
  syncRetryCount: {
    type: Number,
    default: 0
  },
  
  // ✅ NEW: Priority and urgency
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  tags: [{
    type: String
  }],
  
  // ✅ NEW: Admin notes
  adminNotes: [{
    note: String,
    addedBy: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ✅ EXISTING TIMESTAMPS
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true, // Adds createdAt and updatedAt
  // ✅ ENHANCED: Add compound indexes for better query performance
  indexes: [
    { appointmentToken: 1 },
    { originalEmail: 1 },
    { status: 1, createdAt: -1 },
    { formType: 1, status: 1 },
    { assignedSlot: 1 },
    { lastContactDate: -1 },
    { 'zoomMeeting.meetingId': 1 },
    { isContactList: 1, annualReviewDate: 1 },
    { priority: 1, status: 1 }
  ]
});

// ✅ NEW: Add useful instance methods
appointmentSchema.methods.getClientFullName = function() {
  // Try multiple sources for client name
  if (this.originalName) return this.originalName;
  if (this.user && (this.user.firstName || this.user.lastName)) {
    return `${this.user.firstName || ''} ${this.user.lastName || ''}`.trim();
  }
  if (this.formData && (this.formData.firstName || this.formData.lastName)) {
    return `${this.formData.firstName || ''} ${this.formData.lastName || ''}`.trim();
  }
  if (this.formId && (this.formId.firstName || this.formId.lastName)) {
    return `${this.formId.firstName || ''} ${this.formId.lastName || ''}`.trim();
  }
  return 'Unknown Client';
};

appointmentSchema.methods.getClientEmail = function() {
  // Try multiple sources for client email
  if (this.originalEmail) return this.originalEmail;
  if (this.user && this.user.email) return this.user.email;
  if (this.formData && (this.formData.Email || this.formData.email)) {
    return this.formData.Email || this.formData.email;
  }
  if (this.formId && (this.formId.Email || this.formId.email)) {
    return this.formId.Email || this.formId.email;
  }
  return null;
};

appointmentSchema.methods.hasZoomMeeting = function() {
  return !!(this.zoomMeeting && this.zoomMeeting.meetingId);
};

appointmentSchema.methods.isOverdue = function() {
  const now = new Date();
  return this.status === 'scheduled' && this.assignedSlot < now;
};

appointmentSchema.methods.canBeCancelled = function() {
  return ['scheduled', 'contacted', 'booked'].includes(this.status);
};

appointmentSchema.methods.canBeRescheduled = function() {
  return ['scheduled', 'contacted', 'booked'].includes(this.status);
};

appointmentSchema.methods.getTimeSinceLastContact = function() {
  if (!this.lastContactDate) return null;
  const now = new Date();
  return now.getTime() - new Date(this.lastContactDate).getTime();
};

appointmentSchema.methods.needsFollowUp = function() {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const timeSinceContact = this.getTimeSinceLastContact();
  
  return this.status === 'contacted' && 
         timeSinceContact && 
         timeSinceContact > oneDayMs;
};

// ✅ NEW: Static methods for better querying
appointmentSchema.statics.findByToken = function(token) {
  return this.findOne({ appointmentToken: token });
};

appointmentSchema.statics.findContactedWithoutZoom = function() {
  return this.find({
    status: 'contacted',
    'zoomMeeting.meetingId': { $exists: false }
  });
};

appointmentSchema.statics.findOverdue = function() {
  const now = new Date();
  return this.find({
    status: { $in: ['scheduled', 'contacted'] },
    assignedSlot: { $lt: now }
  });
};

appointmentSchema.statics.findNeedingFollowUp = function() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.find({
    status: 'contacted',
    lastContactDate: { $lt: oneDayAgo }
  });
};

appointmentSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    assignedSlot: {
      $gte: startDate,
      $lte: endDate
    }
  });
};

appointmentSchema.statics.getStatusCounts = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// ✅ NEW: Pre-save middleware to maintain data consistency
appointmentSchema.pre('save', function(next) {
  // Ensure initialSlot is set when first creating appointment
  if (this.isNew && !this.initialSlot) {
    this.initialSlot = this.assignedSlot;
  }
  
  // Update lastUpdated on any change
  this.lastUpdated = new Date();
  
  // Validate token uniqueness if provided
  if (this.appointmentToken && this.isModified('appointmentToken')) {
    // The unique index will handle the validation, but we can add logging here
    console.log(`Setting appointment token: ${this.appointmentToken} for appointment: ${this._id}`);
  }
  
  next();
});

// ✅ NEW: Post-save middleware for logging important status changes
appointmentSchema.post('save', function(doc, next) {
  if (this.isModified('status')) {
    console.log(`Appointment ${doc._id} status changed to: ${doc.status}`);
  }
  
  if (this.isModified('appointmentToken')) {
    console.log(`Appointment ${doc._id} token updated: ${doc.appointmentToken}`);
  }
  
  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);
  

