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
  matchScore: {
    type: Number,
    default: 0
  },
  matchReason: {
    type: String,
    default: 'unknown'
  },
  needsReview: {
    type: Boolean,
    default: false
  },
  hostEmail: String,
  scheduleUrl:String,
  password:String,
  syncedAt:Date,
  createdAt: { 
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('ZoomMeeting', zoomMeetingSchema);

