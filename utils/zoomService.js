// zoomService.js - Zoom Integration Service
const axios = require('axios');
const jwt = require('jsonwebtoken');
const Appointment = require('../models/appointmentModels');

class ZoomService {
  constructor() {
    this.baseURL = 'https://api.zoom.us/v2';
    this.apiKey = process.env.ZOOM_API_KEY;
    this.apiSecret = process.env.ZOOM_API_SECRET;
    this.accountId = process.env.ZOOM_ACCOUNT_ID;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // ✅ Generate JWT token for Zoom API authentication
  generateJWT() {
    const payload = {
      iss: this.apiKey,
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiry
    };
    
    return jwt.sign(payload, this.apiSecret);
  }

  // ✅ Get OAuth access token (recommended approach)
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post('https://zoom.us/oauth/token', null, {
        params: {
          grant_type: 'account_credentials',
          account_id: this.accountId
        },
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 minute buffer
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Zoom access token:', error.response?.data || error.message);
      // Fallback to JWT if OAuth fails
      return this.generateJWT();
    }
  }

  // ✅ Make authenticated API request to Zoom
  async makeZoomRequest(endpoint, method = 'GET', data = null) {
    try {
      const token = await this.getAccessToken();
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Zoom API request failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // ✅ Create a Zoom meeting for appointment
  async createMeeting(appointmentData) {
    try {
      const { user, assignedSlot, formType } = appointmentData;
      
      const meetingData = {
        topic: `${formType.replace(/([A-Z])/g, ' $1').trim()} Consultation with ${user.firstName} ${user.lastName}`,
        type: 2, // Scheduled meeting
        start_time: new Date(assignedSlot).toISOString(),
        duration: 60, // 60 minutes
        timezone: 'America/New_York', // Adjust as needed
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
          meeting_authentication: false,
          auto_recording: 'none',
          approval_type: 2, // Manual approval
          registration_type: 1, // Attendees register once and can attend any occurrence
          enforce_login: false
        },
        registrants_email_notification: true
      };

      const meeting = await this.makeZoomRequest('/users/me/meetings', 'POST', meetingData);
      
      console.log('Zoom meeting created:', meeting.id);
      return meeting;
    } catch (error) {
      console.error('Failed to create Zoom meeting:', error);
      throw error;
    }
  }

  // ✅ Get meeting details
  async getMeeting(meetingId) {
    try {
      return await this.makeZoomRequest(`/meetings/${meetingId}`);
    } catch (error) {
      console.error('Failed to get meeting details:', error);
      throw error;
    }
  }

  // ✅ Get meeting registrants to detect bookings
  async getMeetingRegistrants(meetingId) {
    try {
      return await this.makeZoomRequest(`/meetings/${meetingId}/registrants`);
    } catch (error) {
      console.error('Failed to get meeting registrants:', error);
      throw error;
    }
  }

  // ✅ Check for new bookings by polling registrants
  async checkForNewBookings() {
    try {
      // Find appointments that have been contacted but not yet booked
      const contactedAppointments = await Appointment.find({
        status: 'contacted',
        zoomMeeting: { $exists: true, $ne: null }
      });

      for (const appointment of contactedAppointments) {
        if (appointment.zoomMeeting && appointment.zoomMeeting.id) {
          try {
            const registrants = await this.getMeetingRegistrants(appointment.zoomMeeting.id);
            
            // Check if customer has registered
            const customerRegistered = registrants.registrants?.some(registrant => 
              registrant.email.toLowerCase() === appointment.user?.email?.toLowerCase()
            );

            if (customerRegistered) {
              // Update appointment status to booked
              const updatedAppointment = await Appointment.findByIdAndUpdate(
                appointment._id,
                {
                  status: 'booked',
                  customerBookedAt: new Date(),
                  lastUpdated: new Date()
                },
                { new: true }
              ).populate('formId').lean();

              // Emit WebSocket update
              if (global.io) {
                const appointmentWithUser = await this.enrichAppointmentWithUser(updatedAppointment);
                global.io.emit('updateAppointment', appointmentWithUser);
                global.io.to('admins').emit('updateAppointment', appointmentWithUser);
                console.log(`✅ Customer booked appointment ${appointment._id} via Zoom`);
              }
            }
          } catch (error) {
            console.error(`Error checking registrants for meeting ${appointment.zoomMeeting.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error checking for new bookings:', error);
    }
  }

  // ✅ Get past meetings to check completion status
  async getPastMeetings(from, to) {
    try {
      const params = new URLSearchParams({
        type: 'past',
        page_size: 300,
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0]
      });

      return await this.makeZoomRequest(`/users/me/meetings?${params}`);
    } catch (error) {
      console.error('Failed to get past meetings:', error);
      throw error;
    }
  }

  // ✅ Get meeting participants to determine completion
  async getMeetingParticipants(meetingId) {
    try {
      return await this.makeZoomRequest(`/past_meetings/${meetingId}/participants`);
    } catch (error) {
      console.error('Failed to get meeting participants:', error);
      throw error;
    }
  }

  // ✅ Check meeting completion status
  async checkMeetingCompletion() {
    try {
      // Get booked appointments from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const bookedAppointments = await Appointment.find({
        status: 'booked',
        assignedSlot: { $gte: sevenDaysAgo },
        zoomMeeting: { $exists: true, $ne: null }
      });

      for (const appointment of bookedAppointments) {
        if (appointment.zoomMeeting && appointment.zoomMeeting.id) {
          try {
            // Check if meeting time has passed
            const meetingTime = new Date(appointment.assignedSlot);
            const now = new Date();
            
            if (now > meetingTime) {
              // Meeting time has passed, check if it was completed
              const participants = await this.getMeetingParticipants(appointment.zoomMeeting.id);
              
              // Consider completed if meeting had participants and lasted more than 2 minutes
              const wasCompleted = participants.participants && 
                                 participants.participants.length > 1 && 
                                 participants.participants.some(p => p.duration > 2);

              const newStatus = wasCompleted ? 'completed' : 'missed';
              
              if (appointment.status !== newStatus) {
                const updatedAppointment = await Appointment.findByIdAndUpdate(
                  appointment._id,
                  {
                    status: newStatus,
                    completedAt: wasCompleted ? new Date() : undefined,
                    missedAt: !wasCompleted ? new Date() : undefined,
                    lastUpdated: new Date()
                  },
                  { new: true }
                ).populate('formId').lean();

                // Emit WebSocket update
                if (global.io) {
                  const appointmentWithUser = await this.enrichAppointmentWithUser(updatedAppointment);
                  global.io.emit('updateAppointment', appointmentWithUser);
                  global.io.to('admins').emit('updateAppointment', appointmentWithUser);
                  console.log(`✅ Meeting ${newStatus} for appointment ${appointment._id}`);
                }
              }
            }
          } catch (error) {
            console.error(`Error checking completion for meeting ${appointment.zoomMeeting.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error checking meeting completion:', error);
    }
  }

  // ✅ Helper to enrich appointment with user data
  async enrichAppointmentWithUser(appointment) {
    let userData = {
      firstName: 'Unknown',
      lastName: 'User',
      email: 'N/A',
      phoneNumber: 'N/A'
    };

    if (appointment.formData) {
      userData = {
        firstName: appointment.formData.firstName || userData.firstName,
        lastName: appointment.formData.lastName || userData.lastName,
        email: appointment.formData.Email || appointment.formData.email || userData.email,
        phoneNumber: appointment.formData.phoneNumber || userData.phoneNumber
      };
    } else if (appointment.formId) {
      userData = {
        firstName: appointment.formId.firstName || userData.firstName,
        lastName: appointment.formId.lastName || userData.lastName,
        email: appointment.formId.Email || appointment.formId.email || userData.email,
        phoneNumber: appointment.formId.phoneNumber || userData.phoneNumber
      };
    }

    return {
      ...appointment,
      user: userData
    };
  }

  // ✅ Start polling for booking and completion updates
  startPolling() {
    // Check for new bookings every 2 minutes
    setInterval(() => {
      this.checkForNewBookings();
    }, 2 * 60 * 1000);

    // Check for meeting completion every 5 minutes
    setInterval(() => {
      this.checkMeetingCompletion();
    }, 5 * 60 * 1000);

    console.log('✅ Zoom polling service started');
  }
}

// ✅ Enhanced contact user function with Zoom meeting creation

module.exports = {
  ZoomService
};