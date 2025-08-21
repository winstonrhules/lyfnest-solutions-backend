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

const syncZoomMeetings = async () => {
  try {
    console.log('🔄 Starting Zoom meeting sync...');
    const accessToken = await getZoomAccessToken();
    
    const response = await axios.get(
      'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=300',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const meetings = response.data.meetings || [];
    console.log(`📋 Found ${meetings.length} Zoom meetings`);

    for (const meeting of meetings) {
      try {
        const meetingStartTime = parseZoomDate(meeting.start_time);
        if (!meetingStartTime) continue;

        const meetingDuration = meeting.duration || 60;
        const meetingEndTime = new Date(meetingStartTime.getTime() + (meetingDuration * 60000));
        const meetingEnded = meetingEndTime < new Date();

        // ✅ FIX 1: Check if this meeting already exists in our database
        let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
        if (existingZoomMeeting) {
          const appointment = await Appointment.findById(existingZoomMeeting.appointment);
          
          if (appointment) {
            const currentSlotTime = new Date(appointment.assignedSlot).getTime();
            const newSlotTime = meetingStartTime.getTime();
            
            // ✅ Only update if time actually changed (allow 1-minute tolerance)
            const timeDifference = Math.abs(currentSlotTime - newSlotTime);
            const oneMinute = 60 * 1000;
            
            if (timeDifference > oneMinute) {
              console.log(`⏰ Meeting time changed for appointment ${appointment._id}`);
              
              await Appointment.findByIdAndUpdate(
                appointment._id,
                {
                  assignedSlot: meetingStartTime,
                  contactWindowStart: meetingStartTime,
                  contactWindowEnd: meetingEndTime,
                  lastUpdated: new Date()
                },
                { runValidators: true, new: true }
              );
            }
            
            // ✅ Only mark as completed if meeting actually ended and not already completed
            if (meetingEnded && appointment.status !== 'completed') {
              await Appointment.findByIdAndUpdate(
                appointment._id,
                { 
                  status: 'completed',
                  lastUpdated: new Date()
                },
                { new: true }
              );
              console.log(`✅ Meeting completed for appointment ${appointment._id}`);
            }
          }
          continue; // Skip further processing for existing meetings
        }

        // ✅ FIX 2: STRICT matching logic for new meetings - only match CONTACTED appointments
        console.log(`🔍 Processing new meeting: ${meeting.id} - ${meeting.topic}`);
        
        // ✅ CRITICAL: Only get appointments that are CONTACTED and ready to be booked
        const contactedAppointments = await Appointment.find({
          status: 'contacted', // ✅ MUST be contacted status
          zoomMeeting: { $exists: false }, // ✅ No existing zoom meeting
          $or: [
            { lastContactDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Last 24 hours
            { lastContactDate: { $exists: false } } // Fallback for legacy data
          ]
        }).populate('formId').sort({ lastContactDate: -1 }); // Most recently contacted first

        console.log(`📋 Found ${contactedAppointments.length} CONTACTED appointments available for booking`);

        if (contactedAppointments.length === 0) {
          console.log(`⚠️ No contacted appointments available for meeting: ${meeting.id}`);
          continue;
        }

        let matchedAppointment = null;

        // ✅ FIX 3: Enhanced matching by name in meeting topic
        if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
          const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim();
          console.log(`🔍 Looking for customer: "${nameFromTopic}"`);
          
          // Try exact name match first
          matchedAppointment = contactedAppointments.find(app => {
            const userData = app.formId || app.formData || app.user;
            if (!userData) return false;
            
            const firstName = (userData.firstName || '').toLowerCase().trim();
            const lastName = (userData.lastName || '').toLowerCase().trim();
            const fullName = `${firstName} ${lastName}`.trim();
            const topicName = nameFromTopic.toLowerCase().trim();
            
            console.log(`📝 Checking: "${fullName}" vs "${topicName}"`);
            
            // Exact match
            return fullName === topicName || 
                   topicName.includes(fullName) || 
                   fullName.includes(topicName);
          });
        }

        // ✅ FIX 4: Fallback to email matching if available
        if (!matchedAppointment && meeting.topic) {
          const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
          const emailFromTopic = meeting.topic.match(emailRegex)?.[1];
          
          if (emailFromTopic) {
            console.log(`📧 Trying email match: ${emailFromTopic}`);
            
            matchedAppointment = contactedAppointments.find(app => {
              const userData = app.formId || app.formData || app.user;
              const userEmail = (userData.Email || userData.email || '').toLowerCase();
              return userEmail === emailFromTopic.toLowerCase();
            });
          }
        }

        // ✅ FIX 5: Time-based matching as last resort (within 2 hours of CONTACTED appointment)
        if (!matchedAppointment) {
          console.log('🕐 Attempting time-based matching...');
          
          matchedAppointment = contactedAppointments.find(app => {
            const timeDiff = Math.abs(new Date(app.assignedSlot).getTime() - meetingStartTime.getTime());
            const twoHours = 2 * 60 * 60 * 1000;
            const isTimeMatch = timeDiff <= twoHours;
            
            if (isTimeMatch) {
              console.log(`⏰ Time match found: ${timeDiff / 60000} minutes difference`);
            }
            
            return isTimeMatch;
          });
        }

        // ✅ FIX 6: Only proceed if we have a valid match
        if (!matchedAppointment) {
          console.log(`❌ No matching CONTACTED appointment found for meeting: ${meeting.id} - ${meeting.topic}`);
          continue;
        }

        // ✅ FIX 7: Double-check the appointment is still in contacted status (prevent race conditions)
        const freshAppointment = await Appointment.findById(matchedAppointment._id);
        if (!freshAppointment || freshAppointment.status !== 'contacted') {
          console.log(`⚠️ Appointment ${matchedAppointment._id} is no longer in contacted status (${freshAppointment?.status})`);
          continue;
        }

        console.log(`✅ CONFIRMED MATCH: Meeting ${meeting.id} → Appointment ${matchedAppointment._id}`);

        // ✅ FIX 8: Create ZoomMeeting record first
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
        console.log(`✅ ZoomMeeting record created: ${newZoomMeeting._id}`);

        // ✅ FIX 9: Update appointment with precise data
        const updatedAppointment = await Appointment.findByIdAndUpdate(
          matchedAppointment._id,
          {
            assignedSlot: meetingStartTime, // ✅ Use ACTUAL meeting time
            contactWindowStart: meetingStartTime,
            contactWindowEnd: meetingEndTime,
            status: meetingEnded ? 'completed' : 'booked', // ✅ Correct status
            zoomMeeting: newZoomMeeting._id, // ✅ Link zoom meeting
            lastUpdated: new Date()
          },
          { runValidators: true, new: true }
        );

        if (!updatedAppointment) {
          console.error(`❌ Failed to update appointment ${matchedAppointment._id}`);
          continue;
        }

        // ✅ FIX 10: Emit WebSocket update with complete data
        if (global.io) {
          const appointmentWithUser = await Appointment.findById(matchedAppointment._id)
            .populate('formId')
            .lean();
            
          // Ensure user info is available
          if (appointmentWithUser.formId || appointmentWithUser.formData) {
            const formInfo = appointmentWithUser.formId || appointmentWithUser.formData;
            appointmentWithUser.user = {
              firstName: formInfo.firstName || 'N/A',
              lastName: formInfo.lastName || 'N/A', 
              email: formInfo.Email || formInfo.email || 'N/A',
              phoneNumber: formInfo.phoneNumber || 'N/A'
            };
          }
          
          appointmentWithUser.zoomMeeting = newZoomMeeting;
          appointmentWithUser.assignedSlot = meetingStartTime;
          appointmentWithUser.status = meetingEnded ? 'completed' : 'booked';
          
          global.io.emit('updateAppointment', appointmentWithUser);
          console.log(`📡 WebSocket update emitted for appointment: ${matchedAppointment._id} (${appointmentWithUser.status})`);
        }

        // ✅ FIX 11: Create notification
        await Notification.create({
          message: `Meeting ${meetingEnded ? 'completed' : 'booked'}: ${updatedAppointment.user?.firstName} ${updatedAppointment.user?.lastName} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
          formType: matchedAppointment.formType || 'meeting_scheduled',
          read: false,
          appointmentId: matchedAppointment._id
        });
        
        console.log(`✅ Successfully processed new booking for appointment: ${matchedAppointment._id} (Status: ${updatedAppointment.status})`);

      } catch (meetingError) {
        console.error(`❌ Error processing meeting ${meeting.id}:`, meetingError.message);
      }
    }

    console.log('✅ Zoom sync completed successfully');
    
  } catch (error) {
    console.error('❌ Zoom sync error:', error.response?.data || error.message);
    throw error;
  }
};

// ✅ NEW: Delete Zoom meeting when appointment is deleted
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


// Enhanced sync function to capture user-scheduled meetings
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

//         let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
//         if (existingZoomMeeting) {
//           const appointment = await Appointment.findById(existingZoomMeeting.appointment);
          
//           if (appointment && appointment.assignedSlot.getTime() !== meetingStartTime.getTime()) {
//             // Update appointment with new time and status
//             const updatedAppointment = await Appointment.findByIdAndUpdate(
//               appointment._id,
//               {
//                 assignedSlot: meetingStartTime,
//                 contactWindowStart: meetingStartTime,
//                 contactWindowEnd: meetingEndTime,
//                 lastUpdated: new Date()
//               },
//               { runValidators: true, new: true }
//             );
            
//             // MARK AS COMPLETED IF MEETING ENDED
//             if (meetingEnded) {
//               await Appointment.findByIdAndUpdate(
//                 appointment._id,
//                 { status: 'completed' },
//                 { new: true }
//               );
//             }
    
//             // ✅ EMIT WEBSOCKET UPDATE FOR STATUS CHANGE
//             if (global.io && updatedAppointment) {
//               const appointmentWithUser = await Appointment.findById(appointment._id).lean();
//               if (appointmentWithUser.formData) {
//                 appointmentWithUser.user = {
//                   firstName: appointmentWithUser.formData.firstName || 'N/A',
//                   lastName: appointmentWithUser.formData.lastName || 'N/A',
//                   email: appointmentWithUser.formData.Email || appointmentWithUser.formData.email || 'N/A',
//                   phoneNumber: appointmentWithUser.formData.phoneNumber || 'N/A'
//                 };
//               }
//               // ✅ Make sure assignedSlot is the *new* meetingStartTime
//                 appointmentWithUser.assignedSlot = meetingStartTime;

//               global.io.emit('updateAppointment', appointmentWithUser);
//               console.log('✅ Sent updated assignedSlot to frontend for appointment:', appointmentWithUser._id);
//             }
            
//             await Notification.create({
//               message: `Meeting rescheduled and confirmed: ${appointment.user?.firstName || 'Client'} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
//               formType: appointment.formType || 'meeting_update',
//               read: false,
//               appointmentId: appointment._id
//             });
//           }
//           continue;
//         }

//         // Handle new meetings - match with existing appointments
//         const recentAppointments = await Appointment.find({
//           status: 'contacted',
//           zoomMeeting: { $exists: false },
//           lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
//         }).populate('formId');

//         let matchedAppointment = null;

//         if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
//           const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim();
          
//           matchedAppointment = recentAppointments.find(app => {
//             const fullName = `${app.user?.firstName || ''} ${app.user?.lastName || ''}`.trim();
//             return nameFromTopic.includes(fullName) || fullName.includes(nameFromTopic);
//           });
//         }

//         if (!matchedAppointment && recentAppointments.length > 0) {
//           matchedAppointment = recentAppointments[0];
//         }

//         if (matchedAppointment) {
//           // Update matched appointment to booked status
//           const updatedAppointment = await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             {
//               assignedSlot: meetingStartTime,
//               contactWindowStart: meetingStartTime,
//               contactWindowEnd: meetingEndTime,
//               status: meetingEnded ? 'completed' : 'booked',
//               lastUpdated: new Date()
//             },
//             { runValidators: true, new: true }
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
          
//           // Link the zoom meeting to appointment
//           await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             { zoomMeeting: newZoomMeeting._id },
//             { runValidators: true }
//           );

//           // ✅ EMIT WEBSOCKET UPDATE FOR NEW BOOKING
//           if (global.io && updatedAppointment) {
//             const appointmentWithUser = await Appointment.findById(matchedAppointment._id).lean();
//             if (appointmentWithUser.formData) {
//               appointmentWithUser.user = {
//                 firstName: appointmentWithUser.formData.firstName || 'N/A',
//                 lastName: appointmentWithUser.formData.lastName || 'N/A',
//                 email: appointmentWithUser.formData.Email || appointmentWithUser.formData.email || 'N/A',
//                 phoneNumber: appointmentWithUser.formData.phoneNumber || 'N/A'
//               };
//             }
//             appointmentWithUser.zoomMeeting = newZoomMeeting;
            
//             global.io.emit('updateAppointment', appointmentWithUser);
//             console.log('✅ Zoom sync - New booking WebSocket update emitted');
//           }

//           await Notification.create({
//             message: `New meeting scheduled: ${matchedAppointment.user?.firstName || 'Client'} ${matchedAppointment.user?.lastName || ''} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
//             formType: matchedAppointment.formType || 'meeting_scheduled',
//             read: false,
//             appointmentId: matchedAppointment._id
//           });
//         }

//       } catch (meetingError) {
//         console.error(`Error processing meeting ${meeting.id}:`, meetingError.message);
//       }
//     }

//     console.log('✅ Zoom sync completed successfully');
    
//   } catch (error) {
//     console.error('❌ Zoom sync error:', error.response?.data || error.message);
//     throw error;
//   }
// };


// const syncZoomMeetings = async () => {
//   try {
//     console.log('Starting Zoom meeting sync...');
//     const accessToken = await getZoomAccessToken();
    
//     // Use the correct API endpoint with /v2/
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

//         // Check if this meeting already exists in our database
//         let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
//         if (existingZoomMeeting) {
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
              
//               // EMIT WEBSOCKET UPDATE FOR TIME CHANGE ONLY
//               if (global.io && updatedAppointment) {
//                 const appointmentWithUser = await Appointment.findById(appointment._id)
//                   .populate('formId')
//                   .lean();
                
//                 // Simplified user info extraction - adjust based on your data structure
//                 if (appointmentWithUser.formId) {
//                   appointmentWithUser.user = {
//                     firstName: appointmentWithUser.formId.firstName || 'N/A',
//                     lastName: appointmentWithUser.formId.lastName || 'N/A',
//                     email: appointmentWithUser.formId.email || 'N/A',
//                     phoneNumber: appointmentWithUser.formId.phoneNumber || 'N/A'
//                   };
//                 }
                
//                 // Make sure the new time is reflected
//                 appointmentWithUser.assignedSlot = meetingStartTime;
//                 appointmentWithUser.zoomMeeting = existingZoomMeeting;
                
//                 global.io.emit('updateAppointment', appointmentWithUser);
//                 console.log('✅ Sent time update for appointment:', appointmentWithUser._id);
//               }
//             }
            
//             // Only mark as completed if meeting actually ended
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

//         // Enhanced matching logic for new meetings
//         console.log(`🔍 Processing new meeting: ${meeting.id} - ${meeting.topic}`);
        
//         // Get ONLY contacted appointments (ready to be booked)
//         const contactedAppointments = await Appointment.find({
//           status: 'contacted',
//           zoomMeeting: { $exists: false },
//           lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
//         }).populate('formId');

//         console.log(`📋 Found ${contactedAppointments.length} contacted appointments available for booking`);

//         let matchedAppointment = null;

//         // Better matching logic
//         if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
//           const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim();
//           console.log(`🔍 Looking for customer: "${nameFromTopic}"`);
          
//           matchedAppointment = contactedAppointments.find(app => {
//             const userData = app.formId;
//             if (!userData) return false;
            
//             const firstName = userData.firstName || '';
//             const lastName = userData.lastName || '';
//             const fullName = `${firstName} ${lastName}`.trim();
//             const email = userData.email || '';
            
//             console.log(`📝 Checking against: "${fullName}" (${email})`);
            
//             // Match by name or email
//             return (
//               nameFromTopic.toLowerCase().includes(fullName.toLowerCase()) ||
//               fullName.toLowerCase().includes(nameFromTopic.toLowerCase()) ||
//               (email && nameFromTopic.toLowerCase().includes(email.toLowerCase()))
//             );
//           });
//         }

//         // Fallback matching by time proximity (within 2 hours of original slot)
//         if (!matchedAppointment && contactedAppointments.length > 0) {
//           console.log('🕐 Attempting time-based matching...');
          
//           matchedAppointment = contactedAppointments.find(app => {
//             const timeDiff = Math.abs(new Date(app.assignedSlot).getTime() - meetingStartTime.getTime());
//             const twoHours = 2 * 60 * 60 * 1000;
//             return timeDiff <= twoHours;
//           });
//         }

//         // Only proceed if we found a valid match
//         if (matchedAppointment) {
//           console.log(`✅ Matched meeting ${meeting.id} with appointment ${matchedAppointment._id}`);
          
//           // Update matched appointment to booked status with new time
//           const updatedAppointment = await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             {
//               assignedSlot: meetingStartTime,
//               contactWindowStart: meetingStartTime,
//               contactWindowEnd: meetingEndTime,
//               status: meetingEnded ? 'completed' : 'booked',
//               lastUpdated: new Date()
//             },
//             { runValidators: true, new: true }
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
          
//           // Link the zoom meeting to appointment
//           await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             { zoomMeeting: newZoomMeeting._id },
//             { runValidators: true }
//           );

//           // EMIT WEBSOCKET UPDATE FOR NEW BOOKING
//           if (global.io && updatedAppointment) {
//             const appointmentWithUser = await Appointment.findById(matchedAppointment._id)
//               .populate('formId')
//               .lean();
              
//             // Add user info
//             if (appointmentWithUser.formId) {
//               appointmentWithUser.user = {
//                 firstName: appointmentWithUser.formId.firstName || 'N/A',
//                 lastName: appointmentWithUser.formId.lastName || 'N/A',
//                 email: appointmentWithUser.formId.email || 'N/A',
//                 phoneNumber: appointmentWithUser.formId.phoneNumber || 'N/A'
//               };
//             }
            
//             appointmentWithUser.zoomMeeting = newZoomMeeting;
//             appointmentWithUser.assignedSlot = meetingStartTime;
            
//             global.io.emit('updateAppointment', appointmentWithUser);
//             console.log('✅ Zoom sync - New booking WebSocket update emitted for appointment:', matchedAppointment._id);
//           }

//           // Create notification
//           await Notification.create({
//             message: `Meeting ${meetingEnded ? 'completed' : 'scheduled'}: ${matchedAppointment.formId?.firstName || 'Client'} ${matchedAppointment.formId?.lastName || ''} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
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
  deleteZoomMeeting // ✅ Add this new function
};


// module.exports = {
//   createZoomMeeting,
//   syncZoomMeetings,
//   getAllZoomMeetings,
//   manualSync,
//   getZoomAccessToken,
// };