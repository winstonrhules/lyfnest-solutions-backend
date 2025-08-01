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

// const { ZoomMeeting } = require('../models/zoomMeetingModels');
// const asyncHandler = require('express-async-handler');
// const Appointment = require('../models/appointmentModels');
// const { getZoomAccessToken } = require('../middlewares/zoomAuth');
// const Notification = require('../models/notificationModels');
// const axios = require('axios');

// Create Zoom meeting for an appointment
// const createZoomMeeting = asyncHandler(async (req, res) => {
//   try {
//     const { appointmentId, startTime, duration = 30 } = req.body;
//     const appointment = await Appointment.findById(appointmentId).populate('formId');
    
//     if (!appointment) {
//       return res.status(404).json({ error: 'Appointment not found' });
//     }

//     const accessToken = await getZoomAccessToken();
//     const startTimeISO = new Date(startTime).toISOString();
    
//     const meetingPayload = {
//       topic: `Financial Consultation - ${appointment.formId.firstName} ${appointment.formId.lastName}`,
//       type: 2, // Scheduled meeting
//       start_time: startTimeISO,
//       duration,
//       timezone: 'UTC',
//       settings: {
//         host_video: true,
//         participant_video: true,
//         join_before_host: false,
//         waiting_room: true
//       }
//     };

//     const response = await axios.post(
//       'https://api.zoom.us/v2/users/me/meetings',
//       meetingPayload,
//       { headers: { Authorization: `Bearer ${accessToken}` } }
//     );

//     const zoomMeeting = new ZoomMeeting({
//       appointment: appointmentId,
//       meetingId: response.data.id,
//       joinUrl: response.data.join_url,
//       startUrl: response.data.start_url,
//       hostEmail: response.data.host_email,
//       createdAt: new Date()
//     });

//     await zoomMeeting.save();

//     // Update appointment with Zoom info
//     appointment.zoomMeeting = zoomMeeting._id;
//     await appointment.save();

//     res.status(201).json({
//       message: 'Zoom meeting created',
//       joinUrl: response.data.join_url,
//       meetingInfo: response.data
//     });

//   } catch (error) {
//     console.error('Zoom Meeting Error:', error.response?.data || error.message);
//     res.status(500).json({ error: 'Failed to create Zoom meeting' });
//   }
// });


// const syncZoomMeetings = async () => {
//   try {
//     const accessToken = await getZoomAccessToken();
//     const response = await axios.get(
//       'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=100',
//       { headers: { Authorization: `Bearer ${accessToken}` } }
//     );

//     for (const meeting of response.data.meetings) {
//       // Check if we have already synced this meeting
//       const existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
//       if (existingZoomMeeting) {
//         continue; // Skip if already exists
//       }

//       // 1. Create a new Appointment in your database from the Zoom data
//       const newAppointment = new Appointment({
//         formId: null, // This is null because the form was not submitted through your system
//         formType: 'finalForm', // Or a default/generic type
//         formData: { // Populate with data from Zoom
//           firstName: 'Zoom User',
//           lastName: meeting.topic.replace('Financial Consultation - ', ''), // Attempt to get name from topic
//           Email: 'N/A', // Email is not easily available from the meeting list
//           phoneNumber: 'N/A',
//         },
//         contactWindowStart: new Date(meeting.start_time),
//         contactWindowEnd: new Date(new Date(meeting.start_time).getTime() + meeting.duration * 60000),
//         assignedSlot: new Date(meeting.start_time),
//         status: 'scheduled',
//         source: 'zoom', // Mark this appointment as sourced from Zoom
//       });
//       await newAppointment.save();

//       // 2. Create the ZoomMeeting document and link it to the new appointment
//       const newZoomMeeting = new ZoomMeeting({
//         appointment: newAppointment._id, // Link to the appointment created above
//         meetingId: meeting.id,
//         joinUrl: meeting.join_url,
//         startUrl: meeting.start_url,
//         hostEmail: meeting.host_email,
//         createdAt: new Date(meeting.created_at)
//       });
//       await newZoomMeeting.save();

//       // 3. Update the appointment with the zoomMeeting ID
//       newAppointment.zoomMeeting = newZoomMeeting._id;
//       await newAppointment.save();
//     }
//   } catch (error) {
//     console.error('Zoom Sync Error:', error.response?.data || error.message);
//   }
// }


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

// // Enhanced sync function to capture user-scheduled meetings
// const syncZoomMeetings = async () => {
//   try {
//     console.log('Starting Zoom meeting sync...');
//     const accessToken = await getZoomAccessToken();
    
//     // Get all upcoming meetings
//     const response = await axios.get(
//       'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=300',
//       { headers: { Authorization: `Bearer ${accessToken}` } }
//     );

//     const meetings = response.data.meetings || [];
//     console.log(`Found ${meetings.length} Zoom meetings`);

//     for (const meeting of meetings) {
//       try {
//         // Check if we already have this meeting
//         let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
//         if (existingZoomMeeting) {
//           // Update existing meeting if time changed
//           const meetingStartTime = new Date(meeting.start_time);
//           const appointment = await Appointment.findById(existingZoomMeeting.appointment);
          
//           if (appointment && appointment.assignedSlot.getTime() !== meetingStartTime.getTime()) {
//             console.log(`Updating appointment ${appointment._id} with new time: ${meetingStartTime}`);
            
//             // Update appointment time
//             appointment.assignedSlot = meetingStartTime;
//             appointment.contactWindowStart = meetingStartTime;
//             appointment.contactWindowEnd = new Date(meetingStartTime.getTime() + (meeting.duration * 60000));
//             appointment.status = 'scheduled';
//             appointment.lastUpdated = new Date();
//             await appointment.save();

//             // Create notification for admin
//             await Notification.create({
//               message: `Meeting rescheduled: ${appointment.user?.firstName || 'Client'} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
//               formType: appointment.formType || 'meeting_update',
//               read: false,
//               appointmentId: appointment._id
//             });

//             console.log(`Updated appointment ${appointment._id} with new meeting time`);
//           }
//           continue;
//         }

//         // This is a new meeting - check if it matches our appointment pattern
//         const meetingStartTime = new Date(meeting.start_time);
        
//         // Try to find existing appointment by looking for meetings created around the same time
//         // or by parsing the meeting topic
//         let matchedAppointment = null;
        
//         // Method 1: Look for appointments that were contacted recently and don't have a zoom meeting
//         const recentAppointments = await Appointment.find({
//           status: 'contacted',
//           zoomMeeting: { $exists: false },
//           lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
//         }).populate('formId');

//         // Method 2: Try to match by name in topic
//         if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
//           const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim();
//           matchedAppointment = recentAppointments.find(app => {
//             const fullName = `${app.user?.firstName || ''} ${app.user?.lastName || ''}`.trim();
//             return nameFromTopic.includes(fullName) || fullName.includes(nameFromTopic);
//           });
//         }

//         // Method 3: If no match found, create a new appointment entry
//         if (!matchedAppointment && recentAppointments.length > 0) {
//           // Take the most recent contacted appointment as a fallback
//           matchedAppointment = recentAppointments[0];
//         }

//         if (matchedAppointment) {
//           // Update the matched appointment
//           matchedAppointment.assignedSlot = meetingStartTime;
//           matchedAppointment.contactWindowStart = meetingStartTime;
//           matchedAppointment.contactWindowEnd = new Date(meetingStartTime.getTime() + (meeting.duration * 60000));
//           matchedAppointment.status = 'scheduled';
//           matchedAppointment.lastUpdated = new Date();

//           // Create ZoomMeeting record
//           const newZoomMeeting = new ZoomMeeting({
//             appointment: matchedAppointment._id,
//             meetingId: meeting.id,
//             joinUrl: meeting.join_url,
//             startUrl: meeting.start_url,
//             hostEmail: meeting.host_email,
//             createdAt: new Date(meeting.created_at),
//             syncedAt: new Date()
//           });

//           await newZoomMeeting.save();
          
//           // Link the zoom meeting to appointment
//           matchedAppointment.zoomMeeting = newZoomMeeting._id;
//           await matchedAppointment.save();

//           // Create notification
//           await Notification.create({
//             message: `New meeting scheduled: ${matchedAppointment.user?.firstName || 'Client'} ${matchedAppointment.user?.lastName || ''} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
//             formType: matchedAppointment.formType || 'meeting_scheduled',
//             read: false,
//             appointmentId: matchedAppointment._id
//           });

//           console.log(`Synced new meeting for appointment ${matchedAppointment._id}`);
//         } else {
//           console.log(`No matching appointment found for meeting: ${meeting.topic}`);
//         }

//       } catch (meetingError) {
//         console.error(`Error processing meeting ${meeting.id}:`, meetingError);
//       }
//     }

//     console.log('Zoom sync completed successfully');
    
//   } catch (error) {
//     console.error('Zoom sync error:', error.response?.data || error.message);
//   }
// };

const syncZoomMeetings = async () => {
  try {
    console.log('Starting Zoom meeting sync...');
    const accessToken = await getZoomAccessToken();
    
    // Get all upcoming meetings
    const response = await axios.get(
      'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=300',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const meetings = response.data.meetings || [];
    console.log(`Found ${meetings.length} Zoom meetings`);

    for (const meeting of meetings) {
      try {
        // Check if we already have this meeting
        let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
        if (existingZoomMeeting) {
          // Update existing meeting if time changed
          const meetingStartTime = new Date(meeting.start_time);
          const appointment = await Appointment.findById(existingZoomMeeting.appointment);
          
          if (appointment && appointment.assignedSlot.getTime() !== meetingStartTime.getTime()) {
            console.log(`Updating appointment ${appointment._id} with new time: ${meetingStartTime}`);
            
            // Update appointment time
            appointment.assignedSlot = meetingStartTime;
            appointment.contactWindowStart = meetingStartTime;
            appointment.contactWindowEnd = new Date(meetingStartTime.getTime() + (meeting.duration * 60000));
            appointment.status = 'scheduled';
            appointment.lastUpdated = new Date();
            await appointment.save();

            // Create notification for admin
            await Notification.create({
              message: `Meeting rescheduled: ${appointment.user?.firstName || 'Client'} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
              formType: appointment.formType || 'meeting_update',
              read: false,
              appointmentId: appointment._id
            });

            console.log(`Updated appointment ${appointment._id} with new meeting time`);
          }
          continue;
        }

        // This is a new meeting - let's create a proper appointment for it
        const meetingStartTime = new Date(meeting.start_time);
        const meetingEndTime = new Date(meetingStartTime.getTime() + (meeting.duration * 60000));
        
        console.log(`Processing new meeting: ${meeting.topic} at ${meetingStartTime}`);
        
        // Try to extract user information from meeting topic or registrants
        let userInfo = {
          firstName: 'Unknown',
          lastName: 'Client',
          email: meeting.host_email // fallback
        };

        // Method 1: Parse meeting topic for user name
        if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
          const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim();
          const nameParts = nameFromTopic.split(' ');
          if (nameParts.length >= 2) {
            userInfo.firstName = nameParts[0];
            userInfo.lastName = nameParts.slice(1).join(' ');
          } else if (nameParts.length === 1) {
            userInfo.firstName = nameParts[0];
          }
        }

        // Method 2: Check for meeting registrants/participants
        try {
          const registrantsResponse = await axios.get(
            `https://api.zoom.us/v2/meetings/${meeting.id}/registrants`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          
          if (registrantsResponse.data.registrants && registrantsResponse.data.registrants.length > 0) {
            const registrant = registrantsResponse.data.registrants[0];
            userInfo.firstName = registrant.first_name || userInfo.firstName;
            userInfo.lastName = registrant.last_name || userInfo.lastName;
            userInfo.email = registrant.email || userInfo.email;
          }
        } catch (registrantError) {
          console.log('No registrants found or error fetching registrants:', registrantError.message);
        }

        // Try to find existing appointment by email or name
        let matchedAppointment = null;
        
        // First, try to find by email
        if (userInfo.email && userInfo.email !== meeting.host_email) {
          matchedAppointment = await Appointment.findOne({
            'user.email': userInfo.email,
            zoomMeeting: { $exists: false },
            status: { $in: ['contacted', 'pending', 'confirmed'] }
          }).populate('formId');
        }

        // If no match by email, try by name
        if (!matchedAppointment && userInfo.firstName && userInfo.lastName) {
          matchedAppointment = await Appointment.findOne({
            'user.firstName': new RegExp(userInfo.firstName, 'i'),
            'user.lastName': new RegExp(userInfo.lastName, 'i'),
            zoomMeeting: { $exists: false },
            status: { $in: ['contacted', 'pending', 'confirmed'] }
          }).populate('formId');
        }

        // If still no match, look for recent appointments without zoom meetings
        if (!matchedAppointment) {
          const recentAppointments = await Appointment.find({
            status: { $in: ['contacted', 'pending'] },
            zoomMeeting: { $exists: false },
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
          }).populate('formId').sort({ createdAt: -1 }).limit(5);

          if (recentAppointments.length > 0) {
            // Use the most recent one as fallback
            matchedAppointment = recentAppointments[0];
            console.log(`Using fallback appointment: ${matchedAppointment._id}`);
          }
        }

        if (matchedAppointment) {
          // Update the matched appointment
          matchedAppointment.assignedSlot = meetingStartTime;
          matchedAppointment.contactWindowStart = meetingStartTime;
          matchedAppointment.contactWindowEnd = meetingEndTime;
          matchedAppointment.status = 'scheduled';
          matchedAppointment.lastUpdated = new Date();

          // Update user info if we extracted better info from Zoom
          if (userInfo.firstName !== 'Unknown' && userInfo.email !== meeting.host_email) {
            matchedAppointment.user.firstName = userInfo.firstName;
            matchedAppointment.user.lastName = userInfo.lastName;
            matchedAppointment.user.email = userInfo.email;
          }

          // Create ZoomMeeting record
          const newZoomMeeting = new ZoomMeeting({
            appointment: matchedAppointment._id,
            meetingId: meeting.id,
            joinUrl: meeting.join_url,
            startUrl: meeting.start_url,
            hostEmail: meeting.host_email,
            createdAt: new Date(meeting.created_at),
            syncedAt: new Date()
          });

          await newZoomMeeting.save();
          
          // Link the zoom meeting to appointment
          matchedAppointment.zoomMeeting = newZoomMeeting._id;
          await matchedAppointment.save();

          // Create notification
          await Notification.create({
            message: `New Zoom meeting scheduled: ${matchedAppointment.user?.firstName || 'Client'} ${matchedAppointment.user?.lastName || ''} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
            formType: 'zoomBooking',
            read: false,
            appointmentId: matchedAppointment._id
          });

          console.log(`Successfully synced meeting for appointment ${matchedAppointment._id}`);
        } else {
          // No existing appointment found - create a new one
          console.log(`Creating new appointment for Zoom meeting: ${meeting.topic}`);
          
          // Create a new appointment
          const newAppointment = new Appointment({
            user: {
              firstName: userInfo.firstName,
              lastName: userInfo.lastName,
              email: userInfo.email,
              phoneNumber: '' 
            },
              //   user: {
              // firstName: 'Zoom',
              // lastName: nameFromTopic || 'User',
              // email: 'N/A',
              // phoneNumber: 'N/A'
              // },
            assignedSlot: meetingStartTime,
            contactWindowStart: meetingStartTime,
            contactWindowEnd: meetingEndTime,
            status: 'scheduled',
            formType: 'zoomBooking',
            createdAt: new Date(),
            lastUpdated: new Date(),
            emailSent: true, // Assume if they booked via Zoom, they got confirmation
            lastContactDate: new Date()
          });

          await newAppointment.save();

          // Create ZoomMeeting record
          const newZoomMeeting = new ZoomMeeting({
            appointment: newAppointment._id,
            meetingId: meeting.id,
            joinUrl: meeting.join_url,
            startUrl: meeting.start_url,
            hostEmail: meeting.host_email,
            createdAt: new Date(meeting.created_at),
            syncedAt: new Date()
          });

          await newZoomMeeting.save();

          // Link the zoom meeting to appointment
          newAppointment.zoomMeeting = newZoomMeeting._id;
          await newAppointment.save();

          // Create notification
          await Notification.create({
            message: `New Zoom booking created: ${userInfo.firstName} ${userInfo.lastName} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
            formType: 'zoomBooking',
            read: false,
            appointmentId: newAppointment._id
          });

          console.log(`Created new appointment ${newAppointment._id} for Zoom meeting ${meeting.id}`);
        }

      } catch (meetingError) {
        console.error(`Error processing meeting ${meeting.id}:`, meetingError);
      }
    }

    console.log('Zoom sync completed successfully');
    
  } catch (error) {
    console.error('Zoom sync error:', error.response?.data || error.message);
    throw error; // Re-throw to handle in calling function
  }
};

// Enhanced function to get meeting details including registrants
const getZoomMeetingDetails = async (meetingId, accessToken) => {
  try {
    const [meetingResponse, registrantsResponse] = await Promise.allSettled([
      axios.get(`https://api.zoom.us/v2/meetings/${meetingId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      }),
      axios.get(`https://api.zoom.us/v2/meetings/${meetingId}/registrants`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    ]);

    const meeting = meetingResponse.status === 'fulfilled' ? meetingResponse.value.data : null;
    const registrants = registrantsResponse.status === 'fulfilled' ? registrantsResponse.value.data.registrants : [];

    return { meeting, registrants };
  } catch (error) {
    console.error('Error getting meeting details:', error);
    return { meeting: null, registrants: [] };
  }
};


// Get all zoom meetings for debugging
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
    res.status(500).json({ error: 'Manual sync failed' });
  }
};


// const debugZoomSync = async (req, res) => {
//   try {
//     const accessToken = await getZoomAccessToken();
    
//     // Get meetings from Zoom
//     const zoomResponse = await axios.get(
//       'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=50',
//       { headers: { Authorization: `Bearer ${accessToken}` } }
//     );

//     // Get our stored zoom meetings
//     const storedMeetings = await ZoomMeeting.find().populate('appointment');
    
//     // Get all appointments
//     const appointments = await Appointment.find().populate('zoomMeeting');

//     res.status(200).json({
//       zoomMeetings: zoomResponse.data.meetings || [],
//       storedMeetings: storedMeetings,
//       appointments: appointments,
//       stats: {
//         zoomMeetingsCount: zoomResponse.data.meetings?.length || 0,
//         storedMeetingsCount: storedMeetings.length,
//         appointmentsCount: appointments.length,
//         appointmentsWithZoom: appointments.filter(app => app.zoomMeeting).length
//       }
//     });
//   } catch (error) {
//     console.error('Debug sync error:', error);
//     res.status(500).json({ error: 'Debug sync failed', details: error.message });
//   }
// };

module.exports = {
  createZoomMeeting,
  syncZoomMeetings,
  getAllZoomMeetings,
  manualSync,
  getZoomAccessToken,// Add this new function
};



// module.exports = {
//   createZoomMeeting,
//   syncZoomMeetings,
//   getAllZoomMeetings,
//   manualSync,
//   getZoomAccessToken
// };



