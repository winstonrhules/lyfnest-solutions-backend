// const mongoose = require('mongoose');

// const zoomMeetingSchema = new mongoose.Schema({
//   appointment: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Appointment',
//     required: true
//   },  

//   meetingId: {
//     type: String,
//     required: true,
//     unique: true
//   },
//   joinUrl: {
//     type: String,
//     required: true
//   },

//   startUrl: {
//     type: String,
//     required: false
//   },
//   hostEmail: String,
//   scheduleUrl:String,
//   password:String,
//   syncedAt:Date,
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// }, { timestamps: true });

// module.exports = mongoose.model('ZoomMeeting', zoomMeetingSchema);


const mongoose = require('mongoose');

const zoomMeetingSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },  
  meetingId: {
    type: String,
    required: true,
    unique: true
  },
  joinUrl: {
    type: String,
    required: true
  },
  startUrl: {
    type: String,
    required: false
  },
  hostEmail: {
    type: String,
    required: false
  },
  // ✅ ENHANCED: Add missing fields for better appointment matching
  schedulerUrl: {
    type: String,
    required: false
  },
  password: {
    type: String,
    required: false
  },
  syncedAt: {
    type: Date,
    required: false
  },
  // ✅ NEW: Token-based matching fields
  appointmentToken: {
    type: String,
    required: false,
    index: true // Index for faster lookups
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
  // ✅ NEW: Matching metadata for debugging
  matchingReason: {
    type: String,
    required: false,
    enum: [
      'token match',
      'embedded appointment ID',
      'agenda appointment ID', 
      'agenda token',
      'original email match',
      'form data email match',
      'unique appointment in 2-hour window',
      'most recent contacted appointment within 24 hours',
      'manual creation',
      'fallback match'
    ]
  },
  // ✅ NEW: Additional meeting metadata
  topic: {
    type: String,
    required: false
  },
  agenda: {
    type: String,
    required: false
  },
  duration: {
    type: Number,
    required: false,
    default: 60
  },
  timezone: {
    type: String,
    required: false,
    default: 'America/New_York'
  },
  meetingType: {
    type: Number,
    required: false,
    default: 2 // Scheduled meeting
  },
  // ✅ NEW: Meeting status tracking
  status: {
    type: String,
    required: false,
    enum: ['scheduled', 'started', 'ended', 'cancelled'],
    default: 'scheduled'
  },
  // ✅ NEW: Participant tracking
  participantsJoined: {
    type: Number,
    required: false,
    default: 0
  },
  lastParticipantCheck: {
    type: Date,
    required: false
  },
  // ✅ NEW: Meeting completion tracking
  actualStartTime: {
    type: Date,
    required: false
  },
  actualEndTime: {
    type: Date,
    required: false
  },
  actualDuration: {
    type: Number,
    required: false // in minutes
  },
  // ✅ NEW: Registration and booking info
  registrationRequired: {
    type: Boolean,
    default: true
  },
  registrationUrl: {
    type: String,
    required: false
  },
  // ✅ NEW: Error tracking
  lastSyncError: {
    type: String,
    required: false
  },
  syncRetryCount: {
    type: Number,
    default: 0
  },
  // ✅ EXISTING: Keep original timestamp fields
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true, // This adds createdAt and updatedAt automatically
  // ✅ NEW: Add indexes for better performance
  indexes: [
    { appointmentToken: 1 },
    { originalEmail: 1 },
    { meetingId: 1 },
    { appointment: 1 },
    { status: 1 },
    { createdAt: -1 }
  ]
});

// ✅ NEW: Add useful instance methods
zoomMeetingSchema.methods.isExpired = function() {
  const now = new Date();
  const meetingEndTime = new Date(this.createdAt);
  meetingEndTime.setMinutes(meetingEndTime.getMinutes() + (this.duration || 60));
  return now > meetingEndTime;
};

zoomMeetingSchema.methods.getTimeUntilMeeting = function() {
  const now = new Date();
  const meetingTime = new Date(this.createdAt);
  return meetingTime.getTime() - now.getTime(); // Returns milliseconds until meeting
};

zoomMeetingSchema.methods.canBeMatched = function() {
  // A meeting can be matched if it has a token or appointment ID
  return !!(this.appointmentToken || this.matchingReason);
};

// ✅ NEW: Add static methods for better querying
zoomMeetingSchema.statics.findByToken = function(token) {
  return this.findOne({ appointmentToken: token });
};

zoomMeetingSchema.statics.findByAppointmentId = function(appointmentId) {
  return this.findOne({ appointment: appointmentId });
};

zoomMeetingSchema.statics.findUnmatched = function() {
  return this.find({ 
    appointment: { $exists: false },
    appointmentToken: { $exists: true }
  });
};

module.exports = mongoose.model('ZoomMeeting', zoomMeetingSchema);