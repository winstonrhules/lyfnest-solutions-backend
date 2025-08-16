const axios = require('axios');
const Appointment = require('../models/appointmentModels');
const ZoomMeeting = require('../models/zoomMeetingModels');
const Notification = require('../models/notificationModels');




// Get Zoom access token
const getZoomAccessToken = async () => {
  try {
    const response = await axios.post('https://zoom.us/oauth/token', 
      `grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Zoom token error:', error.response?.data || error.message);
    throw error;
  }
};

const createZoomMeeting = async (req, res) => {
  try {
    const { appointmentId, startTime } = req.body;
    
    const appointment = await Appointment.findById(appointmentId).populate('formId');
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const accessToken = await getZoomAccessToken();
    
    // Create meeting with scheduler settings
    const meetingData = {
      topic: `Financial Consultation - ${appointment.user?.firstName || 'Client'} ${appointment.user?.lastName || ''}`,
      type: 2, // Scheduled meeting
      start_time: new Date(startTime).toISOString(),
      duration: 60, // 60 minutes
      timezone: 'America/New_York',
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

    // Save meeting to database
    const zoomMeeting = new ZoomMeeting({
      appointment: appointmentId,
      meetingId: meeting.id,
      joinUrl: meeting.join_url,
      startUrl: meeting.start_url,
      hostEmail: meeting.host_email,
      createdAt: new Date(meeting.created_at),
      schedulerUrl: `https://scheduler.zoom.us/nattye-a/discovery-and-guidance-call?meeting_id=${meeting.id}` // Your scheduler link
    });

    await zoomMeeting.save();

    // Update appointment
    appointment.zoomMeeting = zoomMeeting._id;
    await appointment.save();

    res.status(201).json({
      message: 'Zoom meeting created successfully',
      meetingInfo: {
        meetingId: meeting.id,
        joinUrl: meeting.join_url,
        startUrl: meeting.start_url,
        password: meeting.password,
        schedulerUrl: zoomMeeting.schedulerUrl
      }
    });

  } catch (error) {
    console.error('Create Zoom meeting error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to create Zoom meeting',
      details: error.response?.data || error.message
    });
  }
};

// Helper function to safely parse dates
const parseZoomDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error(`Invalid date string: ${dateString}`);
      return null;
    }
    return date;
  } catch (error) {
    console.error(`Error parsing date ${dateString}:`, error);
    return null;
  }
};

// const getUrlParam = (url, param) => {
//   try {
//     const urlObj = new URL(url);
//     return urlObj.searchParams.get(param);
//   } catch {
//     return null;
//   }
// };

// const syncZoomMeetings = async () => {
//   try {
//     console.log('Starting Zoom meeting sync...');
//     const accessToken = await getZoomAccessToken();
    
//     const response = await axios.get(
//       'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=300',
//       { headers: { Authorization: `Bearer ${accessToken}` } }
//     );

//     const meetings = response.data.meetings || [];
//     console.log(`Found ${meetings.length} Zoom meetings`);

//     for (const meeting of meetings) {
//       try {
//         const meetingStartTime = parseZoomDate(meeting.start_time);
//         if (!meetingStartTime) continue;

//         // ✅ NEW: Try to get appointmentId from URL parameters
//         const appointmentId = getUrlParam(meeting.join_url, 'appointmentId');
//         let matchedAppointment = null;

//         if (appointmentId) {
//           // Find appointment by ID
//           matchedAppointment = await Appointment.findById(appointmentId);
//         }

//         // If not found by ID, try name matching
//         if (!matchedAppointment && meeting.topic) {
//           const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim();
          
//           const recentAppointments = await Appointment.find({
//             status: 'contacted',
//             zoomMeeting: { $exists: false },
//             lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
//           }).populate('formId');

//           matchedAppointment = recentAppointments.find(app => {
//             const fullName = `${app.user?.firstName || ''} ${app.user?.lastName || ''}`.trim();
//             return nameFromTopic.includes(fullName) || fullName.includes(nameFromTopic);
//           });
//         }

//         if (matchedAppointment) {
//           // ✅ Update appointment with new time
//           const updatedAppointment = await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             {
//               assignedSlot: meetingStartTime,
//               contactWindowStart: meetingStartTime,
//               contactWindowEnd: new Date(meetingStartTime.getTime() + (meeting.duration || 60) * 60000),
//               status: 'booked',
//               lastUpdated: new Date()
//             },
//             { new: true, runValidators: true }
//           );

//           // Create ZoomMeeting record
//           const newZoomMeeting = new ZoomMeeting({
//             appointment: matchedAppointment._id,
//             meetingId: meeting.id,
//             joinUrl: meeting.join_url,
//             startUrl: meeting.start_url,
//             hostEmail: meeting.host_email,
//             createdAt: parseZoomDate(meeting.created_at) || new Date(),
//             syncedAt: new Date()
//           });

//           await newZoomMeeting.save();
          
//           // Link to appointment
//           await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             { zoomMeeting: newZoomMeeting._id },
//             { runValidators: true }
//           );

//           console.log(`✅ Zoom meeting ${meeting.id} linked to appointment ${matchedAppointment._id}`);
//         }
//       } catch (meetingError) {
//         console.error(`Error processing meeting ${meeting.id}:`, meetingError);
//       }
//     }
//   } catch (error) {
//     console.error('❌ Zoom sync error:', error);
//   }
// };


// Enhanced sync function to capture user-scheduled meetings
const syncZoomMeetings = async () => {
  try {
    console.log('Starting Zoom meeting sync...');
    const accessToken = await getZoomAccessToken();       
    
    const response = await axios.get(
      'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=300',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const meetings = response.data.meetings || [];
    console.log(`Found ${meetings.length} Zoom meetings`);

    for (const meeting of meetings) {
      try {
        const meetingStartTime = parseZoomDate(meeting.start_time);
        if (!meetingStartTime) continue;

        const meetingDuration = meeting.duration || 60;
        const meetingEndTime = new Date(meetingStartTime.getTime() + (meetingDuration * 60000));

        let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
        if (existingZoomMeeting) {
          const appointment = await Appointment.findById(existingZoomMeeting.appointment);
          
          if (appointment && appointment.assignedSlot.getTime() !== meetingStartTime.getTime()) {
            // Update appointment with new time and status
            const updatedAppointment = await Appointment.findByIdAndUpdate(
              appointment._id,
              {
                assignedSlot: meetingStartTime,
                contactWindowStart: meetingStartTime,
                contactWindowEnd: meetingEndTime,
                status: 'booked', // ✅ SET STATUS TO BOOKED WHEN ZOOM MEETING IS CONFIRMED
                lastUpdated: new Date()
              },
              { runValidators: true, new: true }
            );
            
    
            // ✅ EMIT WEBSOCKET UPDATE FOR STATUS CHANGE
            if (global.io && updatedAppointment) {
              const appointmentWithUser = await Appointment.findById(appointment._id).lean();
              if (appointmentWithUser.formData) {
                appointmentWithUser.user = {
                  firstName: appointmentWithUser.formData.firstName || 'N/A',
                  lastName: appointmentWithUser.formData.lastName || 'N/A',
                  email: appointmentWithUser.formData.Email || appointmentWithUser.formData.email || 'N/A',
                  phoneNumber: appointmentWithUser.formData.phoneNumber || 'N/A'
                };
              }
               // ✅ Make sure assignedSlot is the *new* meetingStartTime
                appointmentWithUser.assignedSlot = meetingStartTime;

              global.io.emit('updateAppointment', appointmentWithUser);
              console.log('✅ Sent updated assignedSlot to frontend for appointment:', appointmentWithUser._id);
            }
            //   global.io.emit('updateAppointment', appointmentWithUser);
            //   console.log('✅ Zoom sync - WebSocket update emitted for appointment:', appointment._id);
            // }

            await Notification.create({
              message: `Meeting rescheduled and confirmed: ${appointment.user?.firstName || 'Client'} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
              formType: appointment.formType || 'meeting_update',
              read: false,
              appointmentId: appointment._id
            });
          }
          continue;
        }

        // Handle new meetings - match with existing appointments
        const recentAppointments = await Appointment.find({
          status: 'contacted',
          zoomMeeting: { $exists: false },
          lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }).populate('formId');

        let matchedAppointment = null;

        if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
          const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim();
          
          matchedAppointment = recentAppointments.find(app => {
            const fullName = `${app.user?.firstName || ''} ${app.user?.lastName || ''}`.trim();
            return nameFromTopic.includes(fullName) || fullName.includes(nameFromTopic);
          });  
        }

        if (!matchedAppointment && recentAppointments.length > 0) {
          matchedAppointment = recentAppointments[0];
        }

        if (matchedAppointment) {
          // Update matched appointment to booked status
          const updatedAppointment = await Appointment.findByIdAndUpdate(
            matchedAppointment._id,
            {
              assignedSlot: meetingStartTime,
              contactWindowStart: meetingStartTime,
              contactWindowEnd: meetingEndTime,
              status: 'booked', // ✅ SET STATUS TO BOOKED
              lastUpdated: new Date()
            },
            { runValidators: true, new: true }
          );

          // Create ZoomMeeting record
          const newZoomMeeting = new ZoomMeeting({
            appointment: matchedAppointment._id,
            meetingId: meeting.id,
            joinUrl: meeting.join_url,
            startUrl: meeting.start_url,
            hostEmail: meeting.host_email,
            createdAt: parseZoomDate(meeting.created_at) || new Date(),
            syncedAt: new Date()
          });

          await newZoomMeeting.save();
          
          // Link the zoom meeting to appointment
          await Appointment.findByIdAndUpdate(
            matchedAppointment._id,
            { zoomMeeting: newZoomMeeting._id },
            { runValidators: true }
          );

          // ✅ EMIT WEBSOCKET UPDATE FOR NEW BOOKING
          if (global.io && updatedAppointment) {
            const appointmentWithUser = await Appointment.findById(matchedAppointment._id).lean();
            if (appointmentWithUser.formData) {
              appointmentWithUser.user = {
                firstName: appointmentWithUser.formData.firstName || 'N/A',
                lastName: appointmentWithUser.formData.lastName || 'N/A',
                email: appointmentWithUser.formData.Email || appointmentWithUser.formData.email || 'N/A',
                phoneNumber: appointmentWithUser.formData.phoneNumber || 'N/A'
              };
            }
            appointmentWithUser.zoomMeeting = newZoomMeeting;
            
            global.io.emit('updateAppointment', appointmentWithUser);
            console.log('✅ Zoom sync - New booking WebSocket update emitted');
          }

          await Notification.create({
            message: `New meeting scheduled: ${matchedAppointment.user?.firstName || 'Client'} ${matchedAppointment.user?.lastName || ''} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
            formType: matchedAppointment.formType || 'meeting_scheduled',
            read: false,
            appointmentId: matchedAppointment._id
          });
        }

      } catch (meetingError) {
        console.error(`Error processing meeting ${meeting.id}:`, meetingError.message);
      }
    }

    console.log('✅ Zoom sync completed successfully');
    
  } catch (error) {
    console.error('❌ Zoom sync error:', error.response?.data || error.message);
    throw error;
  }
};

     
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

    res.status(200).json(zoomMeetings);
  } catch (error) {
    console.error('Get zoom meetings error:', error);
    res.status(500).json({ error: 'Failed to fetch zoom meetings' });
  }
};

// Manual sync endpoint for testing
const manualSync = async (req, res) => {
  try {
    await syncZoomMeetings();
    res.status(200).json({ message: 'Manual sync completed' });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ error: 'Manual sync failed', details: error.message });
  }
};

module.exports = {
  createZoomMeeting,
  syncZoomMeetings,
  getAllZoomMeetings,
  manualSync,
  getZoomAccessToken,
};
