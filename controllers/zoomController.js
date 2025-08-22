const axios = require('axios');
const Appointment = require('../models/appointmentModels');
const ZoomMeeting = require('../models/zoomMeetingModels');
const Notification = require('../models/notificationModels');
//  const {isValidStatusTransition, findBestAppointmentMatch } = require('../utils/appointmentHelpers')

  
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


 // FIXED: Enhanced sync function with proper appointment matching
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

//         const meetingDuration = meeting.duration || 60;
//         const meetingEndTime = new Date(meetingStartTime.getTime() + (meetingDuration * 60000));
//         const meetingEnded = meetingEndTime < new Date();

//         // ✅ FIX 1: Check if this meeting already exists in our database
//         let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
//         if (existingZoomMeeting) {
//           // ✅ FIX 2: Only update if the meeting time actually changed
//           const appointment = await Appointment.findById(existingZoomMeeting.appointment);
          
//           if (appointment) {
//             const currentSlotTime = new Date(appointment.assignedSlot).getTime();
//             const newSlotTime = meetingStartTime.getTime();
            
//             // Only update if time actually changed
//             if (currentSlotTime !== newSlotTime) {
//               console.log(`⏰ Meeting time changed for appointment ${appointment._id}`);
              
//               const updatedAppointment = await Appointment.findByIdAndUpdate(
//                 appointment._id,
//                 {
//                   assignedSlot: meetingStartTime,
//                   contactWindowStart: meetingStartTime,
//                   contactWindowEnd: meetingEndTime,
//                   lastUpdated: new Date()
//                 },
//                 { runValidators: true, new: true }
//               );
              
//               // ✅ EMIT WEBSOCKET UPDATE FOR TIME CHANGE ONLY
//               if (global.io && updatedAppointment) {
//                 const appointmentWithUser = await Appointment.findById(appointment._id)
//                   .populate('formId')
//                   .lean();
                
//                 // Add user info
//                 if (appointmentWithUser.formId || appointmentWithUser.formData) {
//                   const formInfo = appointmentWithUser.formId || appointmentWithUser.formData;
//                   appointmentWithUser.user = {
//                     firstName: formInfo.firstName || 'N/A',
//                     lastName: formInfo.lastName || 'N/A',
//                     email: formInfo.Email || formInfo.email || 'N/A',
//                     phoneNumber: formInfo.phoneNumber || 'N/A'
//                   };
//                 }
                
//                 // Make sure the new time is reflected
//                 appointmentWithUser.assignedSlot = meetingStartTime;
//                 appointmentWithUser.zoomMeeting = existingZoomMeeting;
                
//                 global.io.emit('updateAppointment', appointmentWithUser);
//                 console.log('✅ Sent time update for appointment:', appointmentWithUser._id);
//               }
//             }
            
//             // ✅ FIX 3: Only mark as completed if meeting actually ended
//             if (meetingEnded && appointment.status !== 'completed') {
//               await Appointment.findByIdAndUpdate(
//                 appointment._id,
//                 { status: 'completed' },
//                 { new: true }
//               );
              
//               console.log(`✅ Meeting completed for appointment ${appointment._id}`);
//             }
//           }
//           continue; // Skip further processing for existing meetings
//         }

//         // ✅ FIX 4: Enhanced matching logic for new meetings
//         console.log(`🔍 Processing new meeting: ${meeting.id} - ${meeting.topic}`);
        
//         // Get ONLY contacted appointments (ready to be booked)
//         const contactedAppointments = await Appointment.find({
//           status: 'contacted', // ✅ ONLY contacted appointments can be booked
//           zoomMeeting: { $exists: false }, // ✅ No existing zoom meeting
//           lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // ✅ Contacted within last 7 days
//         }).populate('formId');

//         console.log(`📋 Found ${contactedAppointments.length} contacted appointments available for booking`);

//         let matchedAppointment = null;

//         // ✅ FIX 5: Better matching logic
//         if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
//           const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim();
//           console.log(`🔍 Looking for customer: "${nameFromTopic}"`);
          
//           matchedAppointment = contactedAppointments.find(app => {
//             const userData = app.formId || app.formData || app.user;
//             if (!userData) return false;
            
//             const firstName = userData.firstName || '';
//             const lastName = userData.lastName || '';
//             const fullName = `${firstName} ${lastName}`.trim();
//             const email = userData.Email || userData.email || '';
            
//             console.log(`📝 Checking against: "${fullName}" (${email})`);
            
//             // Match by name or email
//             return (
//               nameFromTopic.toLowerCase().includes(fullName.toLowerCase()) ||
//               fullName.toLowerCase().includes(nameFromTopic.toLowerCase()) ||
//               (email && nameFromTopic.toLowerCase().includes(email.toLowerCase()))
//             );
//           });
//         }

//         // ✅ FIX 6: Fallback matching by time proximity (within 2 hours of original slot)
//         if (!matchedAppointment && contactedAppointments.length > 0) {
//           console.log('🕐 Attempting time-based matching...');
          
//           matchedAppointment = contactedAppointments.find(app => {
//             const timeDiff = Math.abs(new Date(app.assignedSlot).getTime() - meetingStartTime.getTime());
//             const twoHours = 2 * 60 * 60 * 1000;
//             return timeDiff <= twoHours;
//           });
//         }

//         // ✅ FIX 7: Only proceed if we found a valid match
//         if (matchedAppointment) {
//           console.log(`✅ Matched meeting ${meeting.id} with appointment ${matchedAppointment._id}`);
          
//           // ✅ Update matched appointment to booked status with new time
//           const updatedAppointment = await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             {
//               assignedSlot: meetingStartTime, // ✅ Use the ACTUAL meeting time
//               contactWindowStart: meetingStartTime,
//               contactWindowEnd: meetingEndTime,
//               status: meetingEnded ? 'completed' : 'booked', // ✅ Correct status based on meeting state
//               lastUpdated: new Date()
//             },
//             { runValidators: true, new: true }
//           );

//           // ✅ Create ZoomMeeting record
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
          
//           // ✅ Link the zoom meeting to appointment
//           await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             { zoomMeeting: newZoomMeeting._id },
//             { runValidators: true }
//           );

//           // ✅ EMIT WEBSOCKET UPDATE FOR NEW BOOKING
//           if (global.io && updatedAppointment) {
//             const appointmentWithUser = await Appointment.findById(matchedAppointment._id)
//               .populate('formId')
//               .lean();
              
//             // Add user info
//             if (appointmentWithUser.formId || appointmentWithUser.formData) {
//               const formInfo = appointmentWithUser.formId || appointmentWithUser.formData;
//               appointmentWithUser.user = {
//                 firstName: formInfo.firstName || 'N/A',
//                 lastName: formInfo.lastName || 'N/A',
//                 email: formInfo.Email || formInfo.email || 'N/A',
//                 phoneNumber: formInfo.phoneNumber || 'N/A'
//               };
//             }
            
//             appointmentWithUser.zoomMeeting = newZoomMeeting;
//             appointmentWithUser.assignedSlot = meetingStartTime; // ✅ Ensure correct time
            
//             global.io.emit('updateAppointment', appointmentWithUser);
//             console.log('✅ Zoom sync - New booking WebSocket update emitted for appointment:', matchedAppointment._id);
//           }

//           // ✅ Create notification
//           await Notification.create({
//             message: `Meeting ${meetingEnded ? 'completed' : 'scheduled'}: ${updatedAppointment.user?.firstName || 'Client'} ${updatedAppointment.user?.lastName || ''} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
//             formType: matchedAppointment.formType || 'meeting_scheduled',
//             read: false,
//             appointmentId: matchedAppointment._id
//           });
          
//           console.log(`✅ Successfully processed new booking for appointment: ${matchedAppointment._id}`);
//         } else {
//           console.log(`⚠️ No matching contacted appointment found for meeting: ${meeting.id} - ${meeting.topic}`);
//         }

//       } catch (meetingError) {
//         console.error(`❌ Error processing meeting ${meeting.id}:`, meetingError.message);
//       }
//     }

//     console.log('✅ Zoom sync completed successfully');
    
//   } catch (error) {
//     console.error('❌ Zoom sync error:', error.response?.data || error.message);
//     throw error;
//   }
// };

const syncZoomMeetings = async () => {
  try {
    console.log('🔄 Starting Zoom meeting sync...');
    const accessToken = await getZoomAccessToken();

    const response = await axios.get(
      'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=300',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const meetings = response.data.meetings || [];
    console.log(`📅 Found ${meetings.length} Zoom meetings`);

    for (const meeting of meetings) {
      try {
        const meetingStartTime = parseZoomDate(meeting.start_time);
        if (!meetingStartTime) continue;

        const meetingDuration = meeting.duration || 60;
        const meetingEndTime = new Date(meetingStartTime.getTime() + (meetingDuration * 60000));
        const meetingEnded = meetingEndTime < new Date();

        // 1️⃣ Check if this meeting already exists
        let zoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });

        if (!zoomMeeting) {

          if(!meeting.start_url){
            console.log(`Meeting ${meeting.id} has no startUrl, skipping..`);
            continue;
          }
            if(!meeting.appointmentId){
            console.log(`Meeting ${meeting.id} has no startUrl, skipping..`);
            continue;
          }

        
          zoomMeeting = new ZoomMeeting({
            meetingId: meeting.id,
            joinUrl: meeting.join_url,
            startUrl: meeting.start_url,
            hostEmail: meeting.host_email,
            createdAt: new Date(meeting.created_at)
          });
          await zoomMeeting.save();
          console.log(`➕ Saved Zoom meeting found: ${meeting.id}`);
        }

        // 2️⃣ Ensure the meeting has a linked appointment
        const appointmentId = zoomMeeting.appointment;
        if (!appointmentId) {
          console.log(`⚠️ Zoom meeting ${meeting.id} has no linked appointment, skipping...`);
          continue;
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
          console.log(`⚠️ Appointment ${appointmentId} not found for meeting ${meeting.id}`);
          continue;
        }

        // 3️⃣ Update appointment slot if changed
        const currentSlot = appointment.assignedSlot ? new Date(appointment.assignedSlot).getTime() : null;
        const newSlot = meetingStartTime.getTime();
        let updated = false;

        if (!currentSlot || currentSlot !== newSlot) {
          appointment.assignedSlot = meetingStartTime;
          appointment.contactWindowStart = meetingStartTime;
          appointment.contactWindowEnd = meetingEndTime;
          updated = true;
          console.log(`⏰ Updated slot for appointment ${appointment._id} to ${meetingStartTime}`);
        }

        // 4️⃣ Update status safely
        if (!meetingEnded) {
          if (appointment.status !== 'booked' && appointment.status !== 'completed' && appointment.status !== 'missed') {
            appointment.status = 'booked'; // ✅ booked only via Zoom
            updated = true;
            console.log(`✅ Appointment ${appointment._id} marked as booked`);
          }
        } else {
          if (appointment.status === 'booked') {
            appointment.status = 'missed';
            updated = true;
            console.log(`❌ Appointment ${appointment._id} marked as missed (meeting ended)`);
          }
        }

        if (updated) {
          appointment.lastUpdated = new Date();
          await appointment.save();

          // Emit WebSocket update
          if (global.io) {
            const appointmentWithUser = await Appointment.findById(appointment._id).populate('formId').lean();
            global.io.emit('updateAppointment', appointmentWithUser);
            global.io.to('admins').emit('updateAppointment', appointmentWithUser);
          }
        }
      } catch (err) {
        console.error(`❌ Error processing meeting ${meeting.id}:`, err.message);
      }
    }

    console.log('✅ Zoom meetings sync completed.');
  } catch (error) {
    console.error('❌ Zoom sync failed:', error.response?.data || error.message);
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

const deleteZoomMeeting = async (req, res) => {
  try { 
    const { appointmentId } = req.params;
    
    // Find the appointment with zoom meeting
    const appointment = await Appointment.findById(appointmentId).populate('zoomMeeting');
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    // Delete from Zoom if there's a meeting
    if (appointment.zoomMeeting && appointment.zoomMeeting.meetingId) {
      try {
        const accessToken = await getZoomAccessToken();
        
        await axios.delete(
          `https://api.zoom.us/v2/meetings/${appointment.zoomMeeting.meetingId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log(`✅ Deleted Zoom meeting: ${appointment.zoomMeeting.meetingId}`);
        
        // Delete ZoomMeeting record from database
        await ZoomMeeting.findByIdAndDelete(appointment.zoomMeeting._id);
        console.log(`✅ Deleted ZoomMeeting record: ${appointment.zoomMeeting._id}`);
        
      } catch (zoomError) {
        console.error('❌ Failed to delete Zoom meeting:', zoomError.response?.data || zoomError.message);
        // Continue with appointment deletion even if Zoom deletion fails
      }
    }
    
    // Delete the appointment
    await Appointment.findByIdAndDelete(appointmentId);
    console.log(`✅ Deleted appointment: ${appointmentId}`);
    
    res.status(200).json({
      success: true,
      message: 'Appointment and associated Zoom meeting deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ 
      error: 'Failed to delete appointment',
      details: error.message
    });
  }
};





module.exports = {
  createZoomMeeting,
  syncZoomMeetings,
  getAllZoomMeetings,
  manualSync,
  getZoomAccessToken,
  deleteZoomMeeting
};