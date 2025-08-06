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

// Enhanced sync function to capture user-scheduled meetings
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
        console.log(`Processing meeting ${meeting.id}: ${meeting.topic}`);
        console.log(`Meeting start_time: ${meeting.start_time}`);
        console.log(`Meeting duration: ${meeting.duration}`);

        // Parse the meeting start time safely
        const meetingStartTime = parseZoomDate(meeting.start_time);
        if (!meetingStartTime) {
          console.error(`Skipping meeting ${meeting.id} due to invalid start time: ${meeting.start_time}`);
          continue;
        }

        // Calculate end time based on duration (in minutes)
        const meetingDuration = meeting.duration || 60; // Default to 60 minutes
        const meetingEndTime = new Date(meetingStartTime.getTime() + (meetingDuration * 60000));

        // Check if we already have this meeting
        let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
        if (existingZoomMeeting) {
          // Update existing meeting if time changed
          const appointment = await Appointment.findById(existingZoomMeeting.appointment);
          
          if (appointment && appointment.assignedSlot.getTime() !== meetingStartTime.getTime()) {
            console.log(`Updating appointment ${appointment._id} with new time: ${meetingStartTime}`);
            
            // Update appointment time with proper validation
            const updateData = {
              assignedSlot: meetingStartTime,
              contactWindowStart: meetingStartTime,
              contactWindowEnd: meetingEndTime,
              status: 'booked',
              lastUpdated: new Date()
            };

            // Only add initialSlot if it doesn't exist
            if (!appointment.initialSlot) {
              updateData.initialSlot = meetingStartTime;
            }

            // Update using findByIdAndUpdate to ensure validation
            await Appointment.findByIdAndUpdate(
              appointment._id,
              updateData,
              { runValidators: true, new: true }
            );

            // Create notification for admin
            await Notification.create({
              message: `Meeting booked: ${matchedAppointment.user?.firstName || 'Client'} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
              formType: appointment.formType || 'meeting_update',
              read: false,
              appointmentId: appointment._id
            });

            console.log(`Updated appointment ${appointment._id} with new meeting time`);
          }
          continue;
        }

        // This is a new meeting - check if it matches our appointment pattern
        console.log('This is a new meeting, looking for matching appointment...');
        
        // Try to find existing appointment by looking for meetings created around the same time
        // or by parsing the meeting topic
        let matchedAppointment = null;
        
        // Method 1: Look for appointments that were contacted recently and don't have a zoom meeting
        const recentAppointments = await Appointment.find({
          status: 'contacted',
          zoomMeeting: { $exists: false },
          lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        }).populate('formId');

        console.log(`Found ${recentAppointments.length} recent appointments without zoom meetings`);

        // Method 2: Try to match by name in topic
        if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
          const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim();
          console.log(`Trying to match name from topic: "${nameFromTopic}"`);
          
          matchedAppointment = recentAppointments.find(app => {
            const fullName = `${app.user?.firstName || ''} ${app.user?.lastName || ''}`.trim();
            console.log(`Comparing with appointment name: "${fullName}"`);
            return nameFromTopic.includes(fullName) || fullName.includes(nameFromTopic);
          });
        }

        // Method 3: If no match found, create a new appointment entry
        if (!matchedAppointment && recentAppointments.length > 0) {
          // Take the most recent contacted appointment as a fallback
          matchedAppointment = recentAppointments[0];
          console.log(`Using most recent appointment as fallback: ${matchedAppointment._id}`);
        }

        if (matchedAppointment) {
          console.log(`Matched appointment ${matchedAppointment._id}, updating...`);
          
          // Prepare update data
          const updateData = {
            assignedSlot: meetingStartTime,
            contactWindowStart: meetingStartTime,
            contactWindowEnd: meetingEndTime,
            status: 'scheduled',
            lastUpdated: new Date()
          };

          // Only add initialSlot if it doesn't exist
          if (!matchedAppointment.initialSlot) {
            updateData.initialSlot = meetingStartTime;
          }

          // Update the matched appointment
          await Appointment.findByIdAndUpdate(
            matchedAppointment._id,
            updateData,
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

          // Create notification
          await Notification.create({
            message: `New meeting scheduled: ${matchedAppointment.user?.firstName || 'Client'} ${matchedAppointment.user?.lastName || ''} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
            formType: matchedAppointment.formType || 'meeting_scheduled',
            read: false,
            appointmentId: matchedAppointment._id
          });

          console.log(`Successfully synced new meeting for appointment ${matchedAppointment._id}`);
        } else {
          console.log(`No matching appointment found for meeting: ${meeting.topic}`);
        }

      } catch (meetingError) {
        console.error(`Error processing meeting ${meeting.id}:`, meetingError.message);
        console.error('Meeting error details:', meetingError);
      }
    }

    console.log('Zoom sync completed successfully');
    
  } catch (error) {
    console.error('Zoom sync error:', error.response?.data || error.message);
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
