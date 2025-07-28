// const axios = require('axios');
// const Appointment = require('../models/appointmentModels');
// const Form = require('../models/formModels');
// const Wform = require('../models/wformModels')
// const Tform = require('../models/tformModels'); 
// const Iform = require('../models/iformModel');
// const Fform = require('../models/fformModels');
// const { getZoomAccessToken } = require('../middlewares/zoomAuth');

// const syncZoomMeetings = async () => {
//   try {
//     const accessToken = await getZoomAccessToken();
//     const userId = 'me';

//     const res = await axios.get(`https://api.zoom.us/v2/users/${userId}/meetings?type=upcoming&page_size=30`, {
//       headers: { Authorization: `Bearer ${accessToken}` },
//     });

//     const meetings = res.data.meetings;

//     for (const meeting of meetings) {
//       const { id, topic, start_time } = meeting;
//       const exists = await Appointment.findOne({ zoomMeetingId: id });
//       if (exists) continue;

//       const matchedForm = await Form.findOne().sort({ createdAt: -1 });

//       const start = new Date(start_time);
//       const end = new Date(start.getTime() + 30 * 60000);

//       const newAppointment = new Appointment({
//         formId: matchedForm?._id,
//         formType: matchedForm?.formType || 'mainForm' || 'termForm' || 'wholeForm' || 'indexedForm' || 'finalForm',
//         formData: matchedForm || {},
//         assignedSlot: start,
//         contactWindowStart: start,
//         contactWindowEnd: end,
//         zoomMeetingId: id,
//         status: 'scheduled',
//         source: 'zoom',
//       });

//       await newAppointment.save();
//       console.log(`Saved appointment for: ${topic}`);
//     }

//     console.log('Zoom sync completed.');
//   } catch (err) {
//     console.error('Zoom sync error:', err.message);
//   }
// };

// module.exports = { syncZoomMeetings };

const { ZoomMeeting } = require('../models/zoomMeetingModels');
const asyncHandler = require('express-async-handler');
const Appointment = require('../models/appointmentModels');
const { getZoomAccessToken } = require('../middlewares/zoomAuth');
const axios = require('axios');

// Create Zoom meeting for an appointment
const createZoomMeeting = asyncHandler(async (req, res) => {
  try {
    const { appointmentId, startTime, duration = 30 } = req.body;
    const appointment = await Appointment.findById(appointmentId).populate('formId');
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const accessToken = await getZoomAccessToken();
    const startTimeISO = new Date(startTime).toISOString();
    
    const meetingPayload = {
      topic: `Financial Consultation - ${appointment.formId.firstName} ${appointment.formId.lastName}`,
      type: 2, // Scheduled meeting
      start_time: startTimeISO,
      duration,
      timezone: 'UTC',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        waiting_room: true
      }
    };

    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      meetingPayload,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const zoomMeeting = new ZoomMeeting({
      appointment: appointmentId,
      meetingId: response.data.id,
      joinUrl: response.data.join_url,
      startUrl: response.data.start_url,
      hostEmail: response.data.host_email,
      createdAt: new Date()
    });

    await zoomMeeting.save();

    // Update appointment with Zoom info
    appointment.zoomMeeting = zoomMeeting._id;
    await appointment.save();

    res.status(201).json({
      message: 'Zoom meeting created',
      joinUrl: response.data.join_url,
      meetingInfo: response.data
    });

  } catch (error) {
    console.error('Zoom Meeting Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create Zoom meeting' });
  }
});


const syncZoomMeetings = async () => {
  try {
    const accessToken = await getZoomAccessToken();
    const response = await axios.get(
      'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=30',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    for (const meeting of response.data.meetings) {
      const exists = await ZoomMeeting.findOne({ meetingId: meeting.id });
      if (exists) continue;

      // Find appointment by participant email
      const appointment = await Appointment.findOne({
        'user.email': meeting.participants?.find(p => p.email)?.email
      }).sort({ createdAt: -1 });

      const newZoomMeeting = new ZoomMeeting({
        meetingId: meeting.id,
        joinUrl: meeting.join_url,
        startUrl: meeting.start_url,
        hostEmail: meeting.host_email,
        appointment: appointment?._id,
        createdAt: new Date(meeting.created_at)
      });

      await newZoomMeeting.save();

      // Update appointment if found
      if (appointment) {
        appointment.zoomMeeting = newZoomMeeting._id;
        await appointment.save();
      }
    }
  } catch (error) {
    console.error('Zoom Sync Error:', error.response?.data || error.message);
  }
}


module.exports = {
  createZoomMeeting,
  syncZoomMeetings
}
