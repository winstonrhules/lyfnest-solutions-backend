
 // Enhanced appointment controller with proper status transitions
const Appointment = require('../models/appointmentModels');
const Tform = require('../models/tformModels');
const asyncHandler = require('express-async-handler');
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// ✅ ENHANCED: Get all appointments with proper user population
const getAllAppointments = asyncHandler(async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('formId')
      .sort({ assignedSlot: 1 })
      .lean();

    // ✅ ENHANCED: Enrich appointments with user data from different sources
    const enrichedAppointments = appointments.map(appointment => {
      let userData = {
        firstName: 'Unknown',
        lastName: 'User',
        email: 'N/A',
        phoneNumber: 'N/A',
        Dob: null
      };

      // Try to get user data from formData first, then formId
      if (appointment.formData) {
        userData = {
          firstName: appointment.formData.firstName || userData.firstName,
          lastName: appointment.formData.lastName || userData.lastName,
          email: appointment.formData.Email || appointment.formData.email || userData.email,
          phoneNumber: appointment.formData.phoneNumber || userData.phoneNumber,
          Dob: appointment.formData.Dob || userData.Dob
        };
      } else if (appointment.formId) {
        userData = {
          firstName: appointment.formId.firstName || userData.firstName,
          lastName: appointment.formId.lastName || userData.lastName,
          email: appointment.formId.Email || appointment.formId.email || userData.email,
          phoneNumber: appointment.formId.phoneNumber || userData.phoneNumber,
          Dob: appointment.formId.Dob || userData.Dob
        };
      }

      return {
        ...appointment,
        user: userData
      };
    });

    res.status(200).json(enrichedAppointments);
  } catch (error) {
    console.error("Get All Appointments Error:", error);
    res.status(500).json({ error: 'Failed to retrieve appointments' });
  }
});

// ✅ ENHANCED: Update appointment status with proper validation
const updateAppointmentStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, zoomMeeting, assignedSlot, customerBookedAt } = req.body;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // ✅ VALIDATION: Valid status transitions
    const validTransitions = {
      'scheduled': ['contacted', 'booked', 'completed', 'missed'],
      'contacted': ['booked', 'completed', 'missed', 'scheduled'], // Allow reverting
      'booked': ['completed', 'missed'],
      'completed': [], // Terminal state
      'missed': ['scheduled', 'contacted', 'booked'] // Allow rescheduling
    };

    if (!validTransitions[appointment.status]?.includes(status) && appointment.status !== status) {
      return res.status(400).json({ 
        error: `Invalid status transition from ${appointment.status} to ${status}` 
      });
    }

    // ✅ ENHANCED: Update appointment with proper field mapping
    const updateData = {
      status,
      lastUpdated: new Date()
    };

    // Handle specific status updates
    switch (status) {
      case 'contacted':
        updateData.lastContactDate = updateData.lastContactDate || new Date();
        updateData.contactMethod = updateData.contactMethod || 'email';
        break;
        
      case 'booked':
        if (zoomMeeting) {
          updateData.zoomMeeting = zoomMeeting;
        }
        if (assignedSlot) {
          updateData.assignedSlot = new Date(assignedSlot);
        }
        if (customerBookedAt) {
          updateData.customerBookedAt = new Date(customerBookedAt);
        }
        break;
        
      case 'completed':
        updateData.completedAt = new Date();
        break;
        
      case 'missed':
        updateData.missedAt = new Date();
        break;
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('formId').lean();

    // ✅ ENHANCED: Enrich with user data for WebSocket
    let userData = {
      firstName: 'Unknown',
      lastName: 'User', 
      email: 'N/A',
      phoneNumber: 'N/A'
    };

    if (updatedAppointment.formData) {
      userData = {
        firstName: updatedAppointment.formData.firstName || userData.firstName,
        lastName: updatedAppointment.formData.lastName || userData.lastName,
        email: updatedAppointment.formData.Email || updatedAppointment.formData.email || userData.email,
        phoneNumber: updatedAppointment.formData.phoneNumber || userData.phoneNumber
      };
    } else if (updatedAppointment.formId) {
      userData = {
        firstName: updatedAppointment.formId.firstName || userData.firstName,
        lastName: updatedAppointment.formId.lastName || userData.lastName,
        email: updatedAppointment.formId.Email || updatedAppointment.formId.email || userData.email,
        phoneNumber: updatedAppointment.formId.phoneNumber || userData.phoneNumber
      };
    }

    const appointmentWithUser = {
      ...updatedAppointment,
      user: userData
    };

    // ✅ EMIT WEBSOCKET UPDATE
    if (req.io) {
      req.io.emit('updateAppointment', appointmentWithUser);
      req.io.to('admins').emit('updateAppointment', appointmentWithUser);
      console.log(`✅ WebSocket update emitted for appointment ${id}: ${appointment.status} → ${status}`);
    }

    res.status(200).json({
      success: true,
      message: `Appointment status updated to ${status}`,
      appointment: appointmentWithUser
    });

  } catch (error) {
    console.error("Update Appointment Status Error:", error);
    res.status(500).json({ error: 'Failed to update appointment status' });
  }
});

// ✅ ENHANCED: Mark appointment as completed
const markAppointmentCompleted = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({ error: 'Appointment already completed' });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      {
        status: 'completed',
        completedAt: new Date(),
        lastUpdated: new Date()
      },
      { new: true, runValidators: true }
    ).populate('formId').lean();

    // Enrich with user data
    let userData = {
      firstName: 'Unknown',
      lastName: 'User',
      email: 'N/A',
      phoneNumber: 'N/A'
    };

    if (updatedAppointment.formData) {
      userData = {
        firstName: updatedAppointment.formData.firstName || userData.firstName,
        lastName: updatedAppointment.formData.lastName || userData.lastName,
        email: updatedAppointment.formData.Email || updatedAppointment.formData.email || userData.email,
        phoneNumber: updatedAppointment.formData.phoneNumber || userData.phoneNumber
      };
    } else if (updatedAppointment.formId) {
      userData = {
        firstName: updatedAppointment.formId.firstName || userData.firstName,
        lastName: updatedAppointment.formId.lastName || userData.lastName,
        email: updatedAppointment.formId.Email || updatedAppointment.formId.email || userData.email,
        phoneNumber: updatedAppointment.formId.phoneNumber || userData.phoneNumber
      };
    }

    const appointmentWithUser = {
      ...updatedAppointment,
      user: userData
    };

    // Emit WebSocket update
    if (req.io) {
      req.io.emit('updateAppointment', appointmentWithUser);
      req.io.to('admins').emit('updateAppointment', appointmentWithUser);
      console.log(`✅ Appointment ${id} marked as completed via WebSocket`);
    }

    res.status(200).json({
      success: true,
      message: 'Appointment marked as completed',
      appointment: appointmentWithUser
    });

  } catch (error) {
    console.error("Mark Completed Error:", error);
    res.status(500).json({ error: 'Failed to mark appointment as completed' });
  }
});

// ✅ ENHANCED: Reschedule appointment
const rescheduleAppointment = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedSlot } = req.body;

    if (!assignedSlot) {
      return res.status(400).json({ error: 'New appointment time is required' });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      {
        assignedSlot: new Date(assignedSlot),
        status: appointment.status === 'missed' ? 'scheduled' : appointment.status,
        lastUpdated: new Date()
      },
      { new: true, runValidators: true }
    ).populate('formId').lean();

    // Enrich with user data
    let userData = {
      firstName: 'Unknown',
      lastName: 'User',
      email: 'N/A',
      phoneNumber: 'N/A'
    };

    if (updatedAppointment.formData) {
      userData = {
        firstName: updatedAppointment.formData.firstName || userData.firstName,
        lastName: updatedAppointment.formData.lastName || userData.lastName,
        email: updatedAppointment.formData.Email || updatedAppointment.formData.email || userData.email,
        phoneNumber: updatedAppointment.formData.phoneNumber || userData.phoneNumber
      };
    } else if (updatedAppointment.formId) {
      userData = {
        firstName: updatedAppointment.formId.firstName || userData.firstName,
        lastName: updatedAppointment.formId.lastName || userData.lastName,
        email: updatedAppointment.formId.Email || updatedAppointment.formId.email || userData.email,
        phoneNumber: updatedAppointment.formId.phoneNumber || userData.phoneNumber
      };
    }

    const appointmentWithUser = {
      ...updatedAppointment,
      user: userData
    };

    // Emit WebSocket update
    if (req.io) {
      req.io.emit('updateAppointment', appointmentWithUser);
      req.io.to('admins').emit('updateAppointment', appointmentWithUser);
      console.log(`✅ Appointment ${id} rescheduled via WebSocket`);
    }

    res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully',
      appointment: appointmentWithUser
    });

  } catch (error) {
    console.error("Reschedule Error:", error);
    res.status(500).json({ error: 'Failed to reschedule appointment' });
  }
});

// ✅ ENHANCED: Delete appointment
// Enhanced delete appointment function that also deletes Zoom meeting
const deleteAppointmentWithZoom = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the appointment with populated Zoom meeting data
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    console.log(`Deleting appointment ${id} and associated Zoom meeting`);

    // Delete Zoom meeting if it exists
    if (appointment.zoomMeeting && appointment.zoomMeeting.meetingId) {
      try {
        const accessToken = await getZoomAccessToken(); // Use your existing function
        
        // Delete from Zoom
        await axios.delete(
          `https://api.zoom.us/v2/meetings/${appointment.zoomMeeting.meetingId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log(`Zoom meeting ${appointment.zoomMeeting.meetingId} deleted successfully`);
        
        // Delete from ZoomMeeting model if you have the reference
        if (appointment.zoomMeeting.zoomMeetingRecordId) {
          await ZoomMeeting.findByIdAndDelete(appointment.zoomMeeting.zoomMeetingRecordId);
          console.log(`ZoomMeeting record ${appointment.zoomMeeting.zoomMeetingRecordId} deleted`);
        }
        
      } catch (zoomError) {
        console.error('Failed to delete Zoom meeting:', zoomError.response?.data || zoomError.message);
        // Continue with appointment deletion even if Zoom deletion fails
      }
    }

    // Delete the appointment
    await Appointment.findByIdAndDelete(id);
    console.log(`Appointment ${id} deleted successfully`);

    // Emit WebSocket update
    if (req.io) {
      req.io.emit('deleteAppointment', id);
      req.io.to('admins').emit('deleteAppointment', id);
      console.log(`WebSocket delete event emitted for appointment ${id}`);
    }

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



// ✅ NEW: Zoom webhook handler for booking status updates
const handleZoomWebhook = asyncHandler(async (req, res) => {
  try {
    const { event, payload } = req.body;

    console.log('Zoom webhook received:', { event, payload });

    // Handle different Zoom events
    switch (event) {
      case 'meeting.participant_joined':
        await handleParticipantJoined(payload, req);
        break;
        
      case 'meeting.ended':
        await handleMeetingEnded(payload, req);
        break;
        
      case 'meeting.registration_created':
        await handleMeetingRegistration(payload, req);
        break;
        
      default:
        console.log('Unhandled Zoom event:', event);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error("Zoom Webhook Error:", error);
    res.status(500).json({ error: 'Failed to process Zoom webhook' });
  }
});

// ✅ Helper function to handle participant joined
const handleParticipantJoined = async (payload, req) => {
  try {
    const meetingId = payload.object?.id;
    if (!meetingId) return;

    // Find appointment by Zoom meeting ID
    const appointment = await Appointment.findOne({
      'zoomMeeting.meetingId': meetingId
    }).populate('formId');

    if (appointment && appointment.status !== 'completed') {
      // Update status to indicate meeting started
      const updatedAppointment = await Appointment.findByIdAndUpdate(
        appointment._id,
        {
          status: 'booked', // Keep as booked when meeting starts
          meetingStarted: true,
          meetingStartTime: new Date(),
          lastUpdated: new Date()
        },
        { new: true }
      ).lean();

      // Emit WebSocket update
      if (req.io) {
        const appointmentWithUser = await enrichAppointmentWithUser(updatedAppointment);
        req.io.emit('updateAppointment', appointmentWithUser);
        req.io.to('admins').emit('updateAppointment', appointmentWithUser);
        console.log(`✅ Meeting started for appointment ${appointment._id}`);
      }
    }
  } catch (error) {
    console.error('Handle participant joined error:', error);
  }
};

// ✅ Helper function to handle meeting ended
const handleMeetingEnded = async (payload, req) => {
  try {
    const meetingId = payload.object?.id;
    const duration = payload.object?.duration; // Meeting duration in minutes
    
    if (!meetingId) return;

    // Find appointment by Zoom meeting ID
    const appointment = await Appointment.findOne({
      'zoomMeeting.meetingId': meetingId
    }).populate('formId');

    if (appointment) {
      // Determine if meeting was completed or missed based on duration
      const wasCompleted = duration && duration > 2; // Consider completed if longer than 2 minutes
      
      const updatedAppointment = await Appointment.findByIdAndUpdate(
        appointment._id,
        {
          status: wasCompleted ? 'completed' : 'missed',
          meetingEnded: true,
          meetingEndTime: new Date(),
          meetingDuration: duration,
          completedAt: wasCompleted ? new Date() : undefined,
          missedAt: !wasCompleted ? new Date() : undefined,
          lastUpdated: new Date()
        },
        { new: true }
      ).lean();

      // Emit WebSocket update
      if (req.io) {
        const appointmentWithUser = await enrichAppointmentWithUser(updatedAppointment);
        req.io.emit('updateAppointment', appointmentWithUser);
        req.io.to('admins').emit('updateAppointment', appointmentWithUser);
        console.log(`✅ Meeting ended for appointment ${appointment._id}, status: ${wasCompleted ? 'completed' : 'missed'}`);
      }
    }
  } catch (error) {
    console.error('Handle meeting ended error:', error);
  }
};

// ✅ Helper function to handle meeting registration (booking)
const handleMeetingRegistration = async (payload, req) => {
  try {
    const meetingId = payload.object?.id;
    const registrant = payload.object?.registrant;
    
    if (!meetingId || !registrant) return;

    // Find appointment by email and update with booking info
    const appointment = await Appointment.findOne({
      $or: [
        { 'formData.Email': registrant.email },
        { 'formData.email': registrant.email }
      ]
    }).populate('formId');

    if (appointment && appointment.status === 'contacted') {
      const updatedAppointment = await Appointment.findByIdAndUpdate(
        appointment._id,
        {
          status: 'booked',
          customerBookedAt: new Date(),
          zoomMeeting: {
            ...appointment.zoomMeeting,
            meetingId: meetingId,
            registrantId: registrant.id,
            registrationTime: new Date()
          },
          lastUpdated: new Date()
        },
        { new: true }
      ).lean();

      // Emit WebSocket update
      if (req.io) {
        const appointmentWithUser = await enrichAppointmentWithUser(updatedAppointment);
        req.io.emit('updateAppointment', appointmentWithUser);
        req.io.to('admins').emit('updateAppointment', appointmentWithUser);
        console.log(`✅ Customer booked appointment ${appointment._id} via Zoom`);
      }
    }
  } catch (error) {
    console.error('Handle meeting registration error:', error);
  }
};

// ✅ Helper function to enrich appointment with user data
const enrichAppointmentWithUser = async (appointment) => {
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
    // Populate formId if needed
    if (!appointment.formId.firstName) {
      appointment.formId = await Tform.findById(appointment.formId._id || appointment.formId);
    }
    
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
};

module.exports = {
  getAllAppointments,
  updateAppointmentStatus,
  markAppointmentCompleted,
  rescheduleAppointment,
  deleteAppointmentWithZoom,
  handleZoomWebhook,
};
