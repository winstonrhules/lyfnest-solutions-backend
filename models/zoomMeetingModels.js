const mongoose = require('mongoose');

const zoomMeetingSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },  

  topic:String,
  startTime:Date,

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
    required: true,
  },
  hostEmail: String,
  registrationUrl:String,
  password:String,
  syncedAt:Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('ZoomMeeting', zoomMeetingSchema);

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
//   hostEmail: {
//     type: String,
//     required: false
//   },
//   password: {
//     type: String,
//     required: false
//   },
//   // NEW FIELDS TO TRACK BOOKING VALIDATION
//   customerBooked: {
//     type: Boolean,
//     default: false // Flag to indicate if customer actually booked this
//   },
//   bookingSource: {
//     type: String,
//     enum: ['customer_scheduler', 'admin_created', 'auto_sync'],
//     default: 'auto_sync'
//   },
//   originalMeetingTime: {
//     type: Date,
//     required: false // Time when meeting was first detected
//   },
//   customerBookingTime: {
//     type: Date,
//     required: false // Time when customer actually booked
//   },
//   timeChangeDetected: {
//     type: Boolean,
//     default: false // Flag if meeting time was changed from original
//   },
//   validationScore: {
//     type: Number,
//     default: 0 // Score to indicate confidence this is a real customer booking
//   },
//   // END NEW FIELDS
//   schedulerUrl: {
//     type: String,
//     required: false
//   },
//   status: {
//     type: String,
//     enum: ['scheduled', 'started', 'ended', 'cancelled'],
//     default: 'scheduled'
//   },
//   participantCount: {
//     type: Number,
//     default: 0
//   },
//   duration: {
//     type: Number, // in minutes
//     default: 60
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   syncedAt: {
//     type: Date,
//     default: Date.now
//   },
//   lastSyncedAt: {
//     type: Date,
//     required: false
//   }
// }, {
//   timestamps: true
// });

// // Method to calculate validation score for booking legitimacy
// zoomMeetingSchema.methods.calculateValidationScore = function(appointment) {
//   let score = 0;
  
//   // Check if meeting time is different from appointment time
//   if (appointment && appointment.assignedSlot) {
//     const appointmentTime = new Date(appointment.assignedSlot).getTime();
//     const meetingTime = new Date(this.createdAt).getTime();
//     const timeDifference = Math.abs(meetingTime - appointmentTime);
    
//     // If customer chose a significantly different time, higher score
//     if (timeDifference > (30 * 60 * 1000)) { // 30+ minutes difference
//       score += 30;
//       this.timeChangeDetected = true;
//     }
//   }
  
//   // Check if appointment was recently contacted
//   if (appointment && appointment.lastContactDate) {
//     const contactTime = new Date(appointment.lastContactDate).getTime();
//     const bookingTime = new Date(this.createdAt).getTime();
//     const timeSinceContact = bookingTime - contactTime;
    
//     // If booked within reasonable time after contact, higher score
//     if (timeSinceContact > 0 && timeSinceContact < (48 * 60 * 60 * 1000)) { // Within 48 hours
//       score += 25;
//     }
//   }
  
//   // Check if meeting has customer-specific topic name
//   if (appointment && appointment.user) {
//     const expectedName = `${appointment.user.firstName} ${appointment.user.lastName}`;
//     // This would be set when meeting is created - add logic in sync function
//     score += 20; // Base score for having a proper topic
//   }
  
//   // Check if meeting is in the future (legitimate bookings are typically future)
//   const now = new Date();
//   const meetingStart = new Date(this.createdAt);
//   if (meetingStart > now) {
//     score += 15;
//   }
  
//   // Check booking source
//   if (this.bookingSource === 'customer_scheduler') {
//     score += 30; // Highest confidence
//   } else if (this.bookingSource === 'admin_created') {
//     score += 10; // Medium confidence
//   }
  
//   this.validationScore = score;
//   return score;
// };

// // Pre-save middleware to calculate validation score
// zoomMeetingSchema.pre('save', function(next) {
//   this.lastSyncedAt = new Date();
  
//   // Calculate validation score if appointment is available
//   if (this.appointment && this.isModified()) {
//     // This would require populating appointment - handle in application logic
//   }
  
//   next();
// });

// // Index for efficient querying
// // zoomMeetingSchema.index({ meetingId: 1 }, { unique: true });
// zoomMeetingSchema.index({ appointment: 1 });
// zoomMeetingSchema.index({ createdAt: -1 });
// zoomMeetingSchema.index({ customerBooked: 1 });
// zoomMeetingSchema.index({ validationScore: -1 });
// zoomMeetingSchema.index({ bookingSource: 1 });

// module.exports = mongoose.model('ZoomMeeting', zoomMeetingSchema);





