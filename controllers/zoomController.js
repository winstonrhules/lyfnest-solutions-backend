// const axios = require('axios');
// const Appointment = require('../models/appointmentModels');
// const ZoomMeeting = require('../models/zoomMeetingModels');
// const Notification = require('../models/notificationModels');

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

// // Enhanced sync function to capture user-scheduled meetings
// // const syncZoomMeetings = async () => {
// //   try {
// //     console.log('Starting Zoom meeting sync...');
// //     const accessToken = await getZoomAccessToken();
    
// //     const response = await axios.get(
// //       'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=300',
// //       { headers: { Authorization: `Bearer ${accessToken}` } }
// //     );

// //     const meetings = response.data.meetings || [];
// //     console.log(`Found ${meetings.length} Zoom meetings`);

// //     for (const meeting of meetings) {
// //       try {
// //         const meetingStartTime = parseZoomDate(meeting.start_time);
// //         if (!meetingStartTime) continue;

// //         const meetingDuration = meeting.duration || 60;
// //         const meetingEndTime = new Date(meetingStartTime.getTime() + (meetingDuration * 60000));
// //         const meetingEnded = meetingEndTime < new Date();

// //         let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
// //         if (existingZoomMeeting) {
// //           const appointment = await Appointment.findById(existingZoomMeeting.appointment);
          
// //           if (appointment && appointment.assignedSlot.getTime() !== meetingStartTime.getTime()) {
// //             // Update appointment with new time and status
// //             const updatedAppointment = await Appointment.findByIdAndUpdate(
// //               appointment._id,
// //               {
// //                 assignedSlot: meetingStartTime,
// //                 contactWindowStart: meetingStartTime,
// //                 contactWindowEnd: meetingEndTime,
// //                 lastUpdated: new Date()
// //               },
// //               { runValidators: true, new: true }
// //             );
            
// //             // MARK AS COMPLETED IF MEETING ENDED
// //             if (meetingEnded) {
// //               await Appointment.findByIdAndUpdate(
// //                 appointment._id,
// //                 { status: 'completed' },
// //                 { new: true }
// //               );
// //             }
    
// //             // ✅ EMIT WEBSOCKET UPDATE FOR STATUS CHANGE
// //             if (global.io && updatedAppointment) {
// //               const appointmentWithUser = await Appointment.findById(appointment._id).lean();
// //               if (appointmentWithUser.formData) {
// //                 appointmentWithUser.user = {
// //                   firstName: appointmentWithUser.formData.firstName || 'N/A',
// //                   lastName: appointmentWithUser.formData.lastName || 'N/A',
// //                   email: appointmentWithUser.formData.Email || appointmentWithUser.formData.email || 'N/A',
// //                   phoneNumber: appointmentWithUser.formData.phoneNumber || 'N/A'
// //                 };
// //               }
// //               // ✅ Make sure assignedSlot is the *new* meetingStartTime
// //                 appointmentWithUser.assignedSlot = meetingStartTime;

// //               global.io.emit('updateAppointment', appointmentWithUser);
// //               console.log('✅ Sent updated assignedSlot to frontend for appointment:', appointmentWithUser._id);
// //             }
            
// //             await Notification.create({
// //               message: `Meeting rescheduled and confirmed: ${appointment.user?.firstName || 'Client'} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
// //               formType: appointment.formType || 'meeting_update',
// //               read: false,
// //               appointmentId: appointment._id
// //             });
// //           }
// //           continue;
// //         }

// //         // Handle new meetings - match with existing appointments
// //         const recentAppointments = await Appointment.find({
// //           status: 'contacted',
// //           zoomMeeting: { $exists: false },
// //           lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
// //         }).populate('formId');

// //         let matchedAppointment = null;

// //         if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
// //           const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim();
          
// //           matchedAppointment = recentAppointments.find(app => {
// //             const fullName = `${app.user?.firstName || ''} ${app.user?.lastName || ''}`.trim();
// //             return nameFromTopic.includes(fullName) || fullName.includes(nameFromTopic);
// //           });
// //         }

// //         if (!matchedAppointment && recentAppointments.length > 0) {
// //           matchedAppointment = recentAppointments[0];
// //         }

// //         if (matchedAppointment) {
// //           // Update matched appointment to booked status
// //           const updatedAppointment = await Appointment.findByIdAndUpdate(
// //             matchedAppointment._id,
// //             {
// //               assignedSlot: meetingStartTime,
// //               contactWindowStart: meetingStartTime,
// //               contactWindowEnd: meetingEndTime,
// //               status: meetingEnded ? 'completed' : 'booked',
// //               lastUpdated: new Date()
// //             },
// //             { runValidators: true, new: true }
// //           );

// //           // Create ZoomMeeting record
// //           const newZoomMeeting = new ZoomMeeting({
// //             appointment: matchedAppointment._id,
// //             meetingId: meeting.id,
// //             joinUrl: meeting.join_url,
// //             startUrl: meeting.start_url,
// //             hostEmail: meeting.host_email,
// //             createdAt: parseZoomDate(meeting.created_at) || new Date(),
// //             syncedAt: new Date()
// //           });

// //           await newZoomMeeting.save();
          
// //           // Link the zoom meeting to appointment
// //           await Appointment.findByIdAndUpdate(
// //             matchedAppointment._id,
// //             { zoomMeeting: newZoomMeeting._id },
// //             { runValidators: true }
// //           );

// //           // ✅ EMIT WEBSOCKET UPDATE FOR NEW BOOKING
// //           if (global.io && updatedAppointment) {
// //             const appointmentWithUser = await Appointment.findById(matchedAppointment._id).lean();
// //             if (appointmentWithUser.formData) {
// //               appointmentWithUser.user = {
// //                 firstName: appointmentWithUser.formData.firstName || 'N/A',
// //                 lastName: appointmentWithUser.formData.lastName || 'N/A',
// //                 email: appointmentWithUser.formData.Email || appointmentWithUser.formData.email || 'N/A',
// //                 phoneNumber: appointmentWithUser.formData.phoneNumber || 'N/A'
// //               };
// //             }
// //             appointmentWithUser.zoomMeeting = newZoomMeeting;
            
// //             global.io.emit('updateAppointment', appointmentWithUser);
// //             console.log('✅ Zoom sync - New booking WebSocket update emitted');
// //           }

// //           await Notification.create({
// //             message: `New meeting scheduled: ${matchedAppointment.user?.firstName || 'Client'} ${matchedAppointment.user?.lastName || ''} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
// //             formType: matchedAppointment.formType || 'meeting_scheduled',
// //             read: false,
// //             appointmentId: matchedAppointment._id
// //           });
// //         }

// //       } catch (meetingError) {
// //         console.error(`Error processing meeting ${meeting.id}:`, meetingError.message);
// //       }
// //     }

// //     console.log('✅ Zoom sync completed successfully');
    
// //   } catch (error) {
// //     console.error('❌ Zoom sync error:', error.response?.data || error.message);
// //     throw error;
// //   }
// // };

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

//         // Check if this is a user-scheduled meeting (not admin-created)
//         const isUserScheduled = !meeting.created_at || 
//           (new Date() - new Date(meeting.created_at)) < 60000; // Created very recently
        
//         let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
//         if (existingZoomMeeting) {
//           // Update existing meeting with potential new time
//           const appointment = await Appointment.findById(existingZoomMeeting.appointment);
          
//           if (appointment) {
//             // Always update with the actual Zoom meeting time
//             const updateData = {
//               assignedSlot: meetingStartTime,
//               contactWindowStart: meetingStartTime,
//               contactWindowEnd: new Date(meetingStartTime.getTime() + (meeting.duration || 60) * 60000),
//               lastUpdated: new Date()
//             };
            
//             // If this is a user-scheduled meeting, update status to booked
//             if (isUserScheduled && appointment.status !== 'booked') {
//               updateData.status = 'booked';
//             }
            
//             const updatedAppointment = await Appointment.findByIdAndUpdate(
//               appointment._id,
//               updateData,
//               { runValidators: true, new: true }
//             );
            
//             // Emit WebSocket update
//             if (global.io && updatedAppointment) {
//               const appointmentWithUser = await populateAppointmentWithUser(updatedAppointment.toObject());
//               global.io.emit('updateAppointment', appointmentWithUser);
//             }
//           }
//           continue;
//         }

//         // Handle new meetings - improved matching logic
//         const recentAppointments = await Appointment.find({
//           status: 'contacted',
//           zoomMeeting: { $exists: false },
//           lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
//         }).populate('formId');

//         // Improved matching logic
//         let matchedAppointment = null;
        
//         // Try to match by topic first
//         if (meeting.topic) {
//           const nameFromTopic = meeting.topic.replace('Financial Consultation -', '').trim();
//           matchedAppointment = recentAppointments.find(app => {
//             const fullName = `${app.user?.firstName || ''} ${app.user?.lastName || ''}`.trim();
//             return meeting.topic.includes(fullName) || fullName.includes(nameFromTopic);
//           });
//         }
        
//         // If no match, try to find by email (if available in meeting info)
//         if (!matchedAppointment && meeting.settings && meeting.settings.registrants_email_notification) {
//           // Try to extract email from notification settings
//           // This is Zoom-dependent and might need adjustment
//         }

//         if (matchedAppointment) {
//           // Update appointment with actual Zoom time
//           const updatedAppointment = await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             {
//               assignedSlot: meetingStartTime,
//               contactWindowStart: meetingStartTime,
//               contactWindowEnd: new Date(meetingStartTime.getTime() + (meeting.duration || 60) * 60000),
//               status: 'booked', // Always set to booked when matched with Zoom meeting
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

//           // Emit WebSocket update
//           if (global.io && updatedAppointment) {
//             const appointmentWithUser = await populateAppointmentWithUser(updatedAppointment.toObject());
//             global.io.emit('updateAppointment', appointmentWithUser);
//           }
//         }
//       } catch (meetingError) {
//         console.error(`Error processing meeting ${meeting.id}:`, meetingError.message);
//       }
//     }
//   } catch (error) {
//     console.error('❌ Zoom sync error:', error.response?.data || error.message);
//     throw error;  
//   }
// };
 
 
// const getAllZoomMeetings = async (req, res) => {
//   try {
//     const zoomMeetings = await ZoomMeeting.find()
//       .populate({
//         path: 'appointment',
//         populate: {
//           path: 'formId'
//         }
//       })
//       .sort({ createdAt: -1 });

//     res.status(200).json(zoomMeetings);
//   } catch (error) {
//     console.error('Get zoom meetings error:', error);
//     res.status(500).json({ error: 'Failed to fetch zoom meetings' });
//   }
// };

// // Manual sync endpoint for testing
// const manualSync = async (req, res) => {
//   try {
//     await syncZoomMeetings();
//     res.status(200).json({ message: 'Manual sync completed' });
//   } catch (error) {
//     console.error('Manual sync error:', error);
//     res.status(500).json({ error: 'Manual sync failed', details: error.message });
//   }
// };

//  const deleteZoomMeeting = async (req, res) => {
//   try { 
//     const { appointmentId } = req.params;
    
//     // Find the appointment with zoom meeting
//     const appointment = await Appointment.findById(appointmentId).populate('zoomMeeting');
//     if (!appointment) {
//       return res.status(404).json({ error: 'Appointment not found' });
//     }
    
//     // Delete from Zoom if there's a meeting
//     if (appointment.zoomMeeting && appointment.zoomMeeting.meetingId) {
//       try {
//         const accessToken = await getZoomAccessToken();
        
//         await axios.delete(
//           `https://api.zoom.us/v2/meetings/${appointment.zoomMeeting.meetingId}`,
//           {
//             headers: {
//               'Authorization': `Bearer ${accessToken}`,
//               'Content-Type': 'application/json'
//             }
//           }
//         );
        
//         console.log(`✅ Deleted Zoom meeting: ${appointment.zoomMeeting.meetingId}`);
        
//         // Delete ZoomMeeting record from database
//         await ZoomMeeting.findByIdAndDelete(appointment.zoomMeeting._id);
//         console.log(`✅ Deleted ZoomMeeting record: ${appointment.zoomMeeting._id}`);
        
//       } catch (zoomError) {
//         console.error('❌ Failed to delete Zoom meeting:', zoomError.response?.data || zoomError.message);
//         // Continue with appointment deletion even if Zoom deletion fails
//       }
//     }
    
//     // Delete the appointment
//     await Appointment.findByIdAndDelete(appointmentId);
//     console.log(`✅ Deleted appointment: ${appointmentId}`);
    
//     res.status(200).json({
//       success: true,
//       message: 'Appointment and associated Zoom meeting deleted successfully'
//     });
    
//   } catch (error) {
//     console.error('Delete appointment error:', error);
//     res.status(500).json({ 
//       error: 'Failed to delete appointment',
//       details: error.message
//     });
//   }
// };

// module.exports = {
//   createZoomMeeting,
//   syncZoomMeetings,
//   getAllZoomMeetings,
//   manualSync,
//   getZoomAccessToken,
//   deleteZoomMeeting
// };


// const axios = require('axios');
// const Appointment = require('../models/appointmentModels');
// const ZoomMeeting = require('../models/zoomMeetingModels');
// const Notification = require('../models/notificationModels');

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

// // Helper function to safely parse dates
// const parseZoomDate = (dateString) => {
//   if (!dateString) return null;
  
//   try {
//     const date = new Date(dateString);
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

// // ✅ FIXED: More intelligent appointment matching to prevent cross-contamination
// const findMatchingAppointment = async (meeting, recentAppointments) => {
//   console.log(`🔍 Finding match for meeting: ${meeting.topic} at ${meeting.start_time}`);
  
//   // ✅ FIX 1: More precise matching criteria
//   if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
//     const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim();
//     console.log(`🏷️ Extracted name from topic: "${nameFromTopic}"`);
    
//     // Look for exact or partial name matches
//     const nameMatch = recentAppointments.find(app => {
//       const fullName = `${app.user?.firstName || ''} ${app.user?.lastName || ''}`.trim();
//       const isMatch = nameFromTopic.toLowerCase().includes(fullName.toLowerCase()) || 
//                      fullName.toLowerCase().includes(nameFromTopic.toLowerCase());
      
//       if (isMatch) {
//         console.log(`✅ Name match found: "${fullName}" matches "${nameFromTopic}"`);
//       }
//       return isMatch;
//     });
    
//     if (nameMatch) return nameMatch;
//   }

//   // ✅ FIX 2: Time-based matching as fallback - only if meeting time is reasonable
//   const meetingTime = parseZoomDate(meeting.start_time);
//   if (meetingTime) {
//     const timeMatch = recentAppointments.find(app => {
//       const appointmentTime = new Date(app.assignedSlot);
//       const timeDifference = Math.abs(meetingTime.getTime() - appointmentTime.getTime());
      
//       // ✅ Allow reasonable time difference (up to 2 hours)
//       const isTimeMatch = timeDifference <= (2 * 60 * 60 * 1000);
      
//       if (isTimeMatch) {
//         console.log(`⏰ Time match found: Meeting ${meetingTime.toISOString()} matches appointment ${appointmentTime.toISOString()}`);
//       }
      
//       return isTimeMatch;
//     });
    
//     if (timeMatch) return timeMatch;
//   }

//   // ✅ FIX 3: Only return oldest appointment if no better match found AND it's within reasonable time
//   if (recentAppointments.length > 0) {
//     const oldestAppointment = recentAppointments[0];
//     const appointmentAge = new Date() - new Date(oldestAppointment.lastContactDate);
    
//     // ✅ Only match if appointment was contacted within last 48 hours
//     if (appointmentAge <= (48 * 60 * 60 * 1000)) {
//       console.log(`🕐 Using oldest recent appointment as fallback: ${oldestAppointment._id}`);
//       return oldestAppointment;
//     }
//   }

//   console.log('❌ No suitable appointment match found');
//   return null;
// };

// // ✅ FIXED: Enhanced sync function with better matching and validation
// const syncZoomMeetings = async () => {
//   try {
//     console.log('🔄 Starting Zoom meeting sync...');
//     const accessToken = await getZoomAccessToken();
    
//     const response = await axios.get(
//       'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=300',
//       { headers: { Authorization: `Bearer ${accessToken}` } }
//     );

//     const meetings = response.data.meetings || [];
//     console.log(`📊 Found ${meetings.length} Zoom meetings`);

//     for (const meeting of meetings) {
//       try {
//         const meetingStartTime = parseZoomDate(meeting.start_time);
//         if (!meetingStartTime) {
//           console.log(`⚠️ Skipping meeting with invalid start time: ${meeting.start_time}`);
//           continue;
//         }

//         const meetingDuration = meeting.duration || 60;
//         const meetingEndTime = new Date(meetingStartTime.getTime() + (meetingDuration * 60000));
//         const meetingEnded = meetingEndTime < new Date();

//         // ✅ Check if this meeting already exists in our system
//         let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
//         if (existingZoomMeeting) {
//           console.log(`📋 Meeting ${meeting.id} already exists, checking for updates...`);
          
//           const appointment = await Appointment.findById(existingZoomMeeting.appointment);
          
//           if (appointment) {
//             const originalTime = new Date(appointment.assignedSlot).getTime();
//             const newTime = meetingStartTime.getTime();
            
//             // ✅ Only update if there's a meaningful time change
//             if (Math.abs(originalTime - newTime) > (5 * 60 * 1000)) { // 5-minute threshold
//               console.log(`⏰ Time change detected for existing appointment ${appointment._id}`);
              
//               const updatedAppointment = await Appointment.findByIdAndUpdate(
//                 appointment._id,
//                 {
//                   assignedSlot: meetingStartTime,
//                   contactWindowStart: meetingStartTime,
//                   contactWindowEnd: meetingEndTime,
//                   lastUpdated: new Date(),
//                   // ✅ CRITICAL: Only mark as completed if meeting has ended, otherwise keep current status
//                   ...(meetingEnded && appointment.status === 'booked' ? { status: 'completed' } : {})
//                 },
//                 { runValidators: true, new: true }
//               );
              
//               // ✅ Emit WebSocket update with preserved status
//               if (global.io && updatedAppointment) {
//                 const appointmentWithUser = await Appointment.findById(appointment._id).lean();
//                 if (appointmentWithUser.formData) {
//                   appointmentWithUser.user = {
//                     firstName: appointmentWithUser.formData.firstName || 'N/A',
//                     lastName: appointmentWithUser.formData.lastName || 'N/A',
//                     email: appointmentWithUser.formData.Email || appointmentWithUser.formData.email || 'N/A',
//                     phoneNumber: appointmentWithUser.formData.phoneNumber || 'N/A'
//                   };
//                 }
//                 appointmentWithUser.assignedSlot = meetingStartTime;

//                 global.io.emit('updateAppointment', appointmentWithUser);
//                 console.log(`✅ WebSocket update sent for rescheduled appointment: ${appointmentWithUser._id}`);
//               }
//             }
//           }
//           continue;
//         }

//         // ✅ FIXED: Handle new meetings with stricter validation
//         console.log(`🆕 Processing new meeting: ${meeting.id} - ${meeting.topic}`);
        
//         // ✅ Get contacted appointments that are eligible for booking
//         const recentAppointments = await Appointment.find({
//           status: 'contacted',
//           zoomMeeting: { $exists: false },
//           lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
//         }).populate('formId').sort({ lastContactDate: -1 }); // Most recently contacted first

//         console.log(`📋 Found ${recentAppointments.length} eligible appointments for matching`);

//         const matchedAppointment = await findMatchingAppointment(meeting, recentAppointments);

//         if (matchedAppointment) {
//           console.log(`✅ Matched meeting ${meeting.id} with appointment ${matchedAppointment._id}`);
          
//           // ✅ CRITICAL FIX: Validate that this is actually a customer booking
//           // Check if meeting time is different from original appointment time (indicates customer chose new time)
//           const originalTime = new Date(matchedAppointment.assignedSlot);
//           const customerChosenTime = meetingStartTime;
//           const timeDifference = Math.abs(customerChosenTime.getTime() - originalTime.getTime());
          
//           // ✅ If time difference is significant, customer likely chose a new time = legitimate booking
//           const isCustomerBooking = timeDifference > (30 * 60 * 1000); // 30-minute threshold
          
//           console.log(`⏰ Time analysis: Original: ${originalTime.toISOString()}, Meeting: ${customerChosenTime.toISOString()}, Difference: ${Math.round(timeDifference / (60 * 1000))} minutes`);
//           console.log(`🤖 Is customer booking: ${isCustomerBooking}`);

//           // ✅ Update appointment with customer's chosen time and mark as booked
//           const updatedAppointment = await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             {
//               assignedSlot: meetingStartTime,
//               contactWindowStart: meetingStartTime,
//               contactWindowEnd: meetingEndTime,
//               status: meetingEnded ? 'completed' : 'booked', // ✅ Only mark as booked if legitimate
//               lastUpdated: new Date(),
//               // ✅ Track when the customer actually booked
//               customerBookedAt: new Date()
//             },
//             { runValidators: true, new: true }
//           );

//           // ✅ Create ZoomMeeting record with proper linking
//           const newZoomMeeting = new ZoomMeeting({
//             appointment: matchedAppointment._id,
//             meetingId: meeting.id,
//             joinUrl: meeting.join_url,
//             startUrl: meeting.start_url,
//             hostEmail: meeting.host_email,
//             createdAt: parseZoomDate(meeting.created_at) || new Date(),
//             syncedAt: new Date(),
//             customerBooked: isCustomerBooking
//           });

//           await newZoomMeeting.save();
          
//           // ✅ Link the zoom meeting to appointment
//           await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             { zoomMeeting: newZoomMeeting._id },
//             { runValidators: true }
//           );

//           // ✅ Emit WebSocket update for legitimate bookings
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
//             console.log(`✅ WebSocket update emitted for new booking: ${matchedAppointment._id}`);
//           }

//           // ✅ Create appropriate notification
//           const notificationMessage = isCustomerBooking ? 
//             `🎉 Customer booked meeting: ${matchedAppointment.user?.firstName || 'Client'} ${matchedAppointment.user?.lastName || ''} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}` :
//             `📋 Meeting scheduled: ${matchedAppointment.user?.firstName || 'Client'} ${matchedAppointment.user?.lastName || ''} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`;

//           await Notification.create({
//             message: notificationMessage,
//             formType: matchedAppointment.formType || 'meeting_scheduled',
//             read: false,
//             appointmentId: matchedAppointment._id
//           });
          
//         } else {
//           console.log(`⚠️ No matching appointment found for meeting ${meeting.id}`);
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

// // ✅ FIXED: Create meeting function with proper validation
// const createZoomMeeting = async (req, res) => {
//   try {
//     const { appointmentId, startTime } = req.body;
    
//     const appointment = await Appointment.findById(appointmentId).populate('formId');
//     if (!appointment) {
//       return res.status(404).json({ error: 'Appointment not found' });
//     }

//     const accessToken = await getZoomAccessToken();
    
//     // ✅ Create meeting with proper settings
//     const meetingData = {
//       topic: `Financial Consultation - ${appointment.user?.firstName || 'Client'} ${appointment.user?.lastName || ''}`,
//       type: 2, // Scheduled meeting
//       start_time: new Date(startTime).toISOString(),
//       duration: 60,
//       timezone: 'America/New_York',
//       settings: {
//         host_video: true,
//         participant_video: true,
//         join_before_host: false,
//         mute_upon_entry: true,
//         waiting_room: true,
//         approval_type: 0,
//         registration_type: 1,
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

//     // ✅ Save meeting with proper flags
//     const zoomMeeting = new ZoomMeeting({
//       appointment: appointmentId,
//       meetingId: meeting.id,
//       joinUrl: meeting.join_url,
//       startUrl: meeting.start_url,
//       hostEmail: meeting.host_email,
//       createdAt: new Date(meeting.created_at),
//       customerBooked: true, // ✅ Mark as customer-booked if created via this endpoint
//       schedulerUrl: `https://scheduler.zoom.us/nattye-a/discovery-and-guidance-call?meeting_id=${meeting.id}`
//     });

//     await zoomMeeting.save();

//     // ✅ Update appointment properly
//     const updatedAppointment = await Appointment.findByIdAndUpdate(
//       appointmentId,
//       { 
//         zoomMeeting: zoomMeeting._id,
//         status: 'booked',
//         customerBookedAt: new Date()
//       },
//       { new: true }
//     );

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

// // ✅ Keep existing functions unchanged
// const getAllZoomMeetings = async (req, res) => {
//   try {
//     const zoomMeetings = await ZoomMeeting.find()
//       .populate({
//         path: 'appointment',
//         populate: {
//           path: 'formId'
//         }
//       })
//       .sort({ createdAt: -1 });

//     res.status(200).json(zoomMeetings);
//   } catch (error) {
//     console.error('Get zoom meetings error:', error);
//     res.status(500).json({ error: 'Failed to fetch zoom meetings' });
//   }
// };

// const manualSync = async (req, res) => {
//   try {
//     await syncZoomMeetings();
//     res.status(200).json({ message: 'Manual sync completed' });
//   } catch (error) {
//     console.error('Manual sync error:', error);
//     res.status(500).json({ error: 'Manual sync failed', details: error.message });
//   }
// };

// const deleteZoomMeeting = async (req, res) => {
//   try { 
//     const { appointmentId } = req.params;
    
//     const appointment = await Appointment.findById(appointmentId).populate('zoomMeeting');
//     if (!appointment) {
//       return res.status(404).json({ error: 'Appointment not found' });
//     }
    
//     if (appointment.zoomMeeting && appointment.zoomMeeting.meetingId) {
//       try {
//         const accessToken = await getZoomAccessToken();
        
//         await axios.delete(
//           `https://api.zoom.us/v2/meetings/${appointment.zoomMeeting.meetingId}`,
//           {
//             headers: {
//               'Authorization': `Bearer ${accessToken}`,
//               'Content-Type': 'application/json'
//             }
//           }
//         );
        
//         console.log(`✅ Deleted Zoom meeting: ${appointment.zoomMeeting.meetingId}`);
        
//         await ZoomMeeting.findByIdAndDelete(appointment.zoomMeeting._id);
//         console.log(`✅ Deleted ZoomMeeting record: ${appointment.zoomMeeting._id}`);
        
//       } catch (zoomError) {
//         console.error('❌ Failed to delete Zoom meeting:', zoomError.response?.data || zoomError.message);
//       }
//     }
    
//     await Appointment.findByIdAndDelete(appointmentId);
//     console.log(`✅ Deleted appointment: ${appointmentId}`);
    
//     res.status(200).json({
//       success: true,
//       message: 'Appointment and associated Zoom meeting deleted successfully'
//     });
    
//   } catch (error) {
//     console.error('Delete appointment error:', error);
//     res.status(500).json({ 
//       error: 'Failed to delete appointment',
//       details: error.message
//     });
//   }
// };

// module.exports = {
//   createZoomMeeting,
//   syncZoomMeetings,
//   getAllZoomMeetings,
//   manualSync,
//   getZoomAccessToken,
//   deleteZoomMeeting
// };


const axios = require('axios');
const ZoomMeeting = require('../models/zoomMeetingModels');

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
        const meetingEnded = meetingEndTime < new Date();

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
                lastUpdated: new Date()
              },
              { runValidators: true, new: true }
            );
            
            // MARK AS COMPLETED IF MEETING ENDED
            if (meetingEnded) {
              await Appointment.findByIdAndUpdate(
                appointment._id,
                { status: 'completed' },
                { new: true }
              );
            }
    
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
              status: meetingEnded ? 'completed' : 'booked',
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

const deleteZoomMeeting = async (req, res) => {
  try { 
    const { appointmentId } = req.params;
    
    const appointment = await Appointment.findById(appointmentId).populate('zoomMeeting');
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
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
        
        await ZoomMeeting.findByIdAndDelete(appointment.zoomMeeting._id);
        console.log(`✅ Deleted ZoomMeeting record: ${appointment.zoomMeeting._id}`);
        
      } catch (zoomError) {
        console.error('❌ Failed to delete Zoom meeting:', zoomError.response?.data || zoomError.message);
      }
    }
    
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






