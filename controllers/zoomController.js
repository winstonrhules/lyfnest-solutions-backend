//  const axios = require('axios');
// const ZoomMeeting = require('../models/zoomMeetingModels');
 
// // Get Zoom access token
// const getZoomAccessToken = async () => {
//   try {
//     const response = await axios.post('https://zoom.us/oauth/token', 
//       `grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
//       {
//         headers: {
//           'Authorization': `Basic ${Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
//           'Content-Type': 'application/x-www-form-urlencoded'
//         }
//       }
//     );
//     return response.data.access_token;
//   } catch (error) {
//     console.error('Zoom token error:', error.response?.data || error.message);
//     throw error;
//   }
// };

// const createZoomMeeting = async (req, res) => {
//   try {
//     const { appointmentId, startTime } = req.body;
    
//     const appointment = await Appointment.findById(appointmentId).populate('formId');
//     if (!appointment) {
//       return res.status(404).json({ error: 'Appointment not found' });
//     }

//     const accessToken = await getZoomAccessToken();
    
//     // Create meeting with scheduler settings
//     const meetingData = {
//       topic: `Financial Consultation - ${appointment.user?.firstName || 'Client'} ${appointment.user?.lastName || ''}`,
//       type: 2, // Scheduled meeting
//       start_time: new Date(startTime).toISOString(),
//       duration: 60, // 60 minutes
//       timezone: 'America/New_York',
//       settings: {
//         host_video: true,
//         participant_video: true,
//         join_before_host: false,
//         mute_upon_entry: true,
//         waiting_room: true,
//         approval_type: 0, // Automatically approve
//         registration_type: 1, // Attendees register once and can attend any occurrence
//         enforce_login: false
//       }
//     };

//     const response = await axios.post(
//       'https://api.zoom.us/v2/users/me/meetings',
//       meetingData,
//       {
//         headers: {
//           'Authorization': `Bearer ${accessToken}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     const meeting = response.data;

//     // Save meeting to database
//     const zoomMeeting = new ZoomMeeting({
//       appointment: appointmentId,
//       meetingId: meeting.id,
//       joinUrl: meeting.join_url,
//       startUrl: meeting.start_url,
//       hostEmail: meeting.host_email,
//       createdAt: new Date(meeting.created_at),
//       schedulerUrl: `https://scheduler.zoom.us/nattye-a/discovery-and-guidance-call?meeting_id=${meeting.id}` // Your scheduler link
//     });

//     await zoomMeeting.save();

//     // Update appointment
//     appointment.zoomMeeting = zoomMeeting._id;
//     await appointment.save();

//     res.status(201).json({
//       message: 'Zoom meeting created successfully',
//       meetingInfo: {
//         meetingId: meeting.id,
//         joinUrl: meeting.join_url,
//         startUrl: meeting.start_url,
//         password: meeting.password,
//         schedulerUrl: zoomMeeting.schedulerUrl
//       }
//     });

//   } catch (error) {
//     console.error('Create Zoom meeting error:', error.response?.data || error.message);
//     res.status(500).json({ 
//       error: 'Failed to create Zoom meeting',
//       details: error.response?.data || error.message
//     });
//   }
// };

// // Helper function to safely parse dates
// const parseZoomDate = (dateString) => {
//   if (!dateString) return null;
  
//   try {
//     const date = new Date(dateString);
//     // Check if date is valid
//     if (isNaN(date.getTime())) {
//       console.error(`Invalid date string: ${dateString}`);
//       return null;
//     }
//     return date;
//   } catch (error) {
//     console.error(`Error parsing date ${dateString}:`, error);
//     return null;
//   }
// };

// const verifyAppointmentToken = async (req, res) => {
//   try {
//     const { token } = req.params;
    
//     // Find appointment by token
//     const appointment = await Appointment.findOne({ appointmentToken: token })
//       .populate('formId');
    
//     if (!appointment) {
//       return res.status(404).json({ 
//         success: false, 
//         message: 'Invalid or expired token' 
//       });
//     }
    
//     // Return appointment details for pre-filling the form
//     res.status(200).json({
//       success: true,
//       appointment: {
//         _id: appointment._id,
//         user: {
//           firstName: appointment.user?.firstName || appointment.formData?.firstName || appointment.formId?.firstName,
//           lastName: appointment.user?.lastName || appointment.formData?.lastName || appointment.formId?.lastName,
//           email: appointment.user?.email || appointment.formData?.Email || appointment.formData?.email || appointment.formId?.Email || appointment.formId?.email
//         },
//         formType: appointment.formType,
//         assignedSlot: appointment.assignedSlot
//       }
//     });
//   } catch (error) {
//     console.error('Token verification error:', error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Server error during token verification'
//     });
//   }
// };

// ====== UPDATED ZOOM CONTROLLER - MATCHES ENHANCED SERVICE ======
const axios = require('axios');
const crypto = require('crypto');
const ZoomMeeting = require('../models/zoomMeetingModels');
const Appointment = require('../models/appointmentModels');
const Notification = require('../models/notificationModels');

// Import functions from zoomService to avoid duplication
const { 
  getZoomAccessToken, 
  syncZoomMeetings,
  enrichAppointmentWithUser,
  verifyAppointmentToken
} = require('../utils/zoomService');


// Create Zoom Meeting - Enhanced with token support
const createZoomMeeting = async (req, res) => {
  try {
    const { appointmentId, startTime } = req.body;
    
    const appointment = await Appointment.findById(appointmentId).populate('formId');
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Generate a unique token for this appointment
    const appointmentToken = crypto.createHash('sha256')
      .update(`${appointmentId}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`)
      .digest('hex').substring(0, 32);

    const accessToken = await getZoomAccessToken();
    
    // Get client name safely
    const getClientName = () => {
      if (appointment.originalName) return appointment.originalName;
      if (appointment.user && (appointment.user.firstName || appointment.user.lastName)) {
        return `${appointment.user.firstName || ''} ${appointment.user.lastName || ''}`.trim();
      }
      if (appointment.formData && (appointment.formData.firstName || appointment.formData.lastName)) {
        return `${appointment.formData.firstName || ''} ${appointment.formData.lastName || ''}`.trim();
      }
      if (appointment.formId && (appointment.formId.firstName || appointment.formId.lastName)) {
        return `${appointment.formId.firstName || ''} ${appointment.formId.lastName || ''}`.trim();
      }
      return 'Client';
    };

    const clientName = getClientName();
    
    // Create meeting with scheduler settings and embedded identifiers
    const meetingData = {
      topic: `Financial Consultation - ${clientName} [APPT:${appointmentId}][TOKEN:${appointmentToken}]`,
      type: 2, // Scheduled meeting
      start_time: new Date(startTime).toISOString(),
      duration: 60, // 60 minutes
      timezone: 'America/New_York',
      agenda: `Appointment ID: ${appointmentId} | Token: ${appointmentToken}`,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
        approval_type: 0, // Automatically approve
        registration_type: 1, // Attendees register once and can attend any occurrence
        enforce_login: false
      }
    };

    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      meetingData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const meeting = response.data;

    // Extract names for scheduler URL
    const firstName = clientName.split(' ')[0] || '';
    const lastName = clientName.split(' ').slice(1).join(' ') || '';
    const email = appointment.originalEmail || appointment.getClientEmail() || '';
    
    // Encode parameters
    const encodedFirstName = encodeURIComponent(firstName);
    const encodedLastName = encodeURIComponent(lastName);
    const encodedEmail = encodeURIComponent(email);
    const encodedToken = encodeURIComponent(appointmentToken);

    const schedulerUrl = `https://scheduler.zoom.us/nattye-a/discovery-and-guidance-call?meeting_id=${meeting.id}&first_name=${encodedFirstName}&last_name=${encodedLastName}&email=${encodedEmail}&token=${encodedToken}`;

    // Save meeting to database with enhanced data
    const zoomMeeting = new ZoomMeeting({
      appointment: appointmentId,
      meetingId: meeting.id,
      joinUrl: meeting.join_url,
      startUrl: meeting.start_url,
      hostEmail: meeting.host_email,
      createdAt: new Date(meeting.created_at),
      schedulerUrl: schedulerUrl,
      appointmentToken: appointmentToken,
      originalEmail: email,
      originalName: clientName,
      topic: meeting.topic,
      agenda: meeting.agenda,
      duration: meeting.duration,
      timezone: meeting.timezone
    });

    await zoomMeeting.save();

    // Update appointment with the token and zoom data
    await Appointment.findByIdAndUpdate(appointmentId, {
      appointmentToken: appointmentToken,
      originalEmail: email,
      originalName: clientName,
      zoomMeeting: {
        id: meeting.id,
        meetingId: meeting.id,
        topic: meeting.topic,
        joinUrl: meeting.join_url,
        startUrl: meeting.start_url,
        zoomMeetingRecordId: zoomMeeting._id,
        appointmentToken: appointmentToken,
        schedulerUrl: schedulerUrl,
        createdAt: new Date()
      }
    });

    res.status(201).json({
      success: true,
      message: 'Zoom meeting created successfully with token-based matching',
      meetingInfo: {
        meetingId: meeting.id,
        joinUrl: meeting.join_url,
        startUrl: meeting.start_url,
        password: meeting.password,
        schedulerUrl: schedulerUrl,
        appointmentToken: appointmentToken,
        topic: meeting.topic
      }
    });

  } catch (error) {
    console.error('Create Zoom meeting error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create Zoom meeting',
      details: error.response?.data || error.message
    });
  }
};

// Get all Zoom meetings with enhanced data
const getAllZoomMeetings = async (req, res) => {
  try {
    const zoomMeetings = await ZoomMeeting.find()
      .populate({
        path: 'appointment',
        populate: {
          path: 'formId'
        }
      })
      .sort({ createdAt: -1 });

    // Enrich with user data
    const enrichedMeetings = await Promise.all(
      zoomMeetings.map(async (meeting) => {
        if (meeting.appointment) {
          const appointmentWithUser = await enrichAppointmentWithUser(meeting.appointment.toObject());
          return {
            ...meeting.toObject(),
            appointment: appointmentWithUser
          };
        }
        return meeting.toObject();
      })
    );

    res.status(200).json({
      success: true,
      meetings: enrichedMeetings,
      count: enrichedMeetings.length
    });
  } catch (error) {
    console.error('Get zoom meetings error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch zoom meetings',
      details: error.message
    });
  }
};

// Manual sync endpoint
const manualSync = async (req, res) => {
  try {
    console.log('Starting manual Zoom sync...');
    await syncZoomMeetings();
    
    res.status(200).json({ 
      success: true,
      message: 'Manual Zoom sync completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Manual sync failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Delete appointment and associated Zoom meeting
const deleteZoomMeeting = async (req, res) => {
  try { 
    const { appointmentId } = req.params;
    
    console.log(`Attempting to delete appointment: ${appointmentId}`);
    
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ 
        success: false,
        error: 'Appointment not found' 
      });
    }
    
    // Find and delete associated ZoomMeeting
    const zoomMeeting = await ZoomMeeting.findOne({ appointment: appointmentId });
    
    if (zoomMeeting && zoomMeeting.meetingId) {
      try {
        const accessToken = await getZoomAccessToken();
        
        // Delete the Zoom meeting
        await axios.delete(
          `https://api.zoom.us/v2/meetings/${zoomMeeting.meetingId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log(`Deleted Zoom meeting: ${zoomMeeting.meetingId}`);
        
      } catch (zoomError) {
        console.error('Failed to delete Zoom meeting:', zoomError.response?.data || zoomError.message);
        // Continue with local deletion even if Zoom deletion fails
      }
      
      // Delete ZoomMeeting record
      await ZoomMeeting.findByIdAndDelete(zoomMeeting._id);
      console.log(`Deleted ZoomMeeting record: ${zoomMeeting._id}`);
    }
    
    // Delete the appointment
    await Appointment.findByIdAndDelete(appointmentId);
    console.log(`Deleted appointment: ${appointmentId}`);
    
    // Emit WebSocket update for deletion
    if (global.io) {
      global.io.emit('deleteAppointment', { appointmentId });
      console.log(`WebSocket delete event emitted for appointment: ${appointmentId}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'Appointment and associated Zoom meeting deleted successfully',
      deletedAppointmentId: appointmentId,
      deletedZoomMeeting: zoomMeeting ? zoomMeeting.meetingId : null
    });
    
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete appointment',
      details: error.message
    });
  }
};

// Debug endpoint to check appointment matching data
const debugAppointments = async (req, res) => {
  try {
    const { status = 'contacted' } = req.params;
    
    const appointments = await Appointment.find({ status })
      .select('_id appointmentToken originalEmail originalName status assignedSlot lastContactDate formType')
      .limit(20)
      .sort({ lastContactDate: -1 });
    
    const zoomMeetings = await ZoomMeeting.find()
      .select('meetingId appointmentToken originalEmail matchingReason topic agenda')
      .limit(20)
      .sort({ createdAt: -1 });
    
    const debugData = {
      appointments: appointments.map(apt => ({
        id: apt._id,
        token: apt.appointmentToken || 'NO_TOKEN',
        email: apt.originalEmail || 'NO_EMAIL',
        name: apt.originalName || 'NO_NAME',
        status: apt.status,
        formType: apt.formType,
        assignedSlot: apt.assignedSlot,
        lastContactDate: apt.lastContactDate,
        timeSinceContact: apt.lastContactDate ? 
          Math.round((new Date() - new Date(apt.lastContactDate)) / (1000 * 60 * 60)) + ' hours ago' : 
          'Never'
      })),
      zoomMeetings: zoomMeetings.map(zm => ({
        meetingId: zm.meetingId,
        token: zm.appointmentToken || 'NO_TOKEN', 
        email: zm.originalEmail || 'NO_EMAIL',
        matchingReason: zm.matchingReason || 'NO_REASON',
        topicHasToken: zm.topic && zm.topic.includes('[TOKEN:'),
        topicHasAppointmentId: zm.topic && zm.topic.includes('[APPT:'),
        agendaHasToken: zm.agenda && zm.agenda.includes('Token:'),
        agendaHasAppointmentId: zm.agenda && zm.agenda.includes('Appointment ID:')
      })),
      summary: {
        totalAppointments: appointments.length,
        appointmentsWithTokens: appointments.filter(a => a.appointmentToken).length,
        appointmentsWithEmails: appointments.filter(a => a.originalEmail).length,
        totalZoomMeetings: zoomMeetings.length,
        meetingsWithTokens: zoomMeetings.filter(z => z.appointmentToken).length,
        meetingsWithMatchingReasons: zoomMeetings.filter(z => z.matchingReason).length
      }
    };
    
    res.status(200).json({
      success: true,
      message: `Debug data for appointments with status: ${status}`,
      data: debugData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Debug appointments error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch debug data',
      details: error.message
    });
  }
};

// Check sync status and recent activity
const getSyncStatus = async (req, res) => {
  try {
    const recentAppointments = await Appointment.find({
      lastContactDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).select('status appointmentToken originalEmail lastContactDate').sort({ lastContactDate: -1 });

    const recentZoomMeetings = await ZoomMeeting.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).select('meetingId appointmentToken matchingReason createdAt').sort({ createdAt: -1 });

    const statusCounts = await Appointment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      syncStatus: {
        lastSyncTime: new Date().toISOString(),
        recentActivity: {
          appointmentsLast24h: recentAppointments.length,
          zoomMeetingsLast24h: recentZoomMeetings.length,
          contactedAppointments: recentAppointments.filter(a => a.status === 'contacted').length,
          bookedAppointments: recentAppointments.filter(a => a.status === 'booked').length
        },
        statusBreakdown: statusCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        tokenHealth: {
          appointmentsWithTokens: recentAppointments.filter(a => a.appointmentToken).length,
          meetingsWithTokens: recentZoomMeetings.filter(m => m.appointmentToken).length,
          meetingsWithMatchingReasons: recentZoomMeetings.filter(m => m.matchingReason).length
        }
      }
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get sync status',
      details: error.message
    });
  }
};

// Test token generation and validation
const testTokenSystem = async (req, res) => {
  try {
    const testAppointmentId = '507f1f77bcf86cd799439011'; // Sample ObjectId
    
    // Generate test token
    const testToken = crypto.createHash('sha256')
      .update(`${testAppointmentId}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`)
      .digest('hex').substring(0, 32);
    
    // Test topic generation
    const testTopic = `Test Consultation - John Doe [APPT:${testAppointmentId}][TOKEN:${testToken}]`;
    
    // Test regex matching
    const tokenMatch = testTopic.match(/\[TOKEN:([a-f\d]{32})\]/);
    const appointmentMatch = testTopic.match(/\[APPT:([a-f\d]{24})\]/);
    
    res.status(200).json({
      success: true,
      tokenTest: {
        generatedToken: testToken,
        tokenLength: testToken.length,
        testTopic: testTopic,
        regexResults: {
          tokenExtracted: tokenMatch ? tokenMatch[1] : null,
          appointmentIdExtracted: appointmentMatch ? appointmentMatch[1] : null,
          tokenMatches: tokenMatch && tokenMatch[1] === testToken,
          appointmentIdMatches: appointmentMatch && appointmentMatch[1] === testAppointmentId
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Token test failed',
      details: error.message
    });
  }
};

module.exports = {
  createZoomMeeting,
  verifyAppointmentToken, // Re-export from service
  syncZoomMeetings, // Re-export from service
  getAllZoomMeetings,
  manualSync,
  getZoomAccessToken, // Re-export from service
  deleteZoomMeeting,
  debugAppointments,
  getSyncStatus,
  testTokenSystem
};