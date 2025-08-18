
const asyncHandler = require('express-async-handler');
const Appointment = require('../models/appointmentModels');
const Form = require('../models/formModels');
const Fform = require('../models/fformModels');
const Iform = require('../models/iformModel');
const Tform = require('../models/tformModels');
const Wform = require('../models/wformModels');
const Notification = require('../models/notificationModels');

// ✅ HELPER FUNCTION TO ADD USER INFO TO APPOINTMENT
const populateAppointmentWithUser = async (appointment) => {
  if (appointment.isContactList && appointment.formData) return appointment;
  
  if(appointment.formData){
  return {
    ...appointment,
    user: {
      firstName: appointment.formData.firstName || 'N/A',
      lastName: appointment.formData.lastName || 'N/A',
      email: appointment.formData.Email || appointment.formData.email || 'N/A',
      phoneNumber: appointment.formData.phoneNumber || 'N/A',
      Dob:appointment.formData.Dob|| null
    }
  };
}
return appointment;
};

// ✅ GET ALL APPOINTMENTS
const getAppointments = asyncHandler(async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('clientContactId', 'policyType policyEffectiveDate annualReviewDate')
      .sort({ assignedSlot: 1 })
      .lean();

    const formattedAppointments = await Promise.all(
      appointments.map(async (app) => {
        return await populateAppointmentWithUser(app);
      })
    );

    res.status(200).json(formattedAppointments);
  } catch (error) {
    console.error('❌ Get appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// ✅ UPDATE APPOINTMENT STATUS
const updateAppointmentStatus = asyncHandler(async (req, res) => {
  try {
    const { status, zoomMeetingId } = req.body;
    const appointmentId = req.params.id;

    console.log(`🔄 Updating appointment ${appointmentId} status to: ${status}`);

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Update fields based on status
    const updateData = { lastUpdated: new Date() };

    if (status === 'contacted') {
      updateData.status = 'contacted';
      updateData.lastContactDate = new Date();
    } else if (status === 'booked') {
      updateData.status = 'booked';
      if (zoomMeetingId) {
        updateData.zoomMeetingId = zoomMeetingId;
      }
    } else if (status === 'completed') {
      updateData.status = 'completed';
    } else if (status === 'missed') {
      updateData.status = 'missed';
    } else if (status) {
      updateData.status = status;
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!updatedAppointment) {
      return res.status(404).json({ error: 'Failed to update appointment' });
    }

    // Add user info for frontend
    const appointmentWithUser = await populateAppointmentWithUser(updatedAppointment);

    // ✅ EMIT WEBSOCKET UPDATE
    if (req.io) {
      req.io.emit('updateAppointment', appointmentWithUser);
      console.log(`✅ WebSocket update emitted for appointment ${appointmentId}`);
    }

    // Create notification
    await Notification.create({
      message: `Appointment status updated to ${status} for ${appointmentWithUser.user?.firstName} ${appointmentWithUser.user?.lastName}`,
      formType: updatedAppointment.formType || 'appointment',
      read: false,
      appointmentId: appointmentId
    });

    res.status(200).json({
      success: true,
      appointment: appointmentWithUser,
      message: `Appointment status updated to ${status}`
    });

  } catch (error) {
    console.error('❌ Update appointment status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update appointment status',
      details: error.message 
    });
  }
});

// ✅ RESCHEDULE APPOINTMENT
const rescheduleAppointment = asyncHandler(async (req, res) => {
  try {
    const { assignedSlot } = req.body; // Changed from newSlot to match frontend
    const appointmentId = req.params.id;

    console.log(`🔄 Rescheduling appointment ${appointmentId} to: ${assignedSlot}`);

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const newSlotDate = new Date(assignedSlot);
    const now = new Date();

    if (newSlotDate < now) {
      return res.status(400).json({ error: 'Cannot schedule in the past' });
    }

    // Update appointment with new time
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        assignedSlot: newSlotDate,
        lastUpdated: new Date()
      },
      { new: true, runValidators: true }
    ).lean();

    // Add user info
    const appointmentWithUser = await populateAppointmentWithUser(updatedAppointment);

    // ✅ EMIT WEBSOCKET UPDATE
    if (req.io) {
      req.io.emit('updateAppointment', appointmentWithUser);
      console.log(`✅ WebSocket reschedule update emitted for appointment ${appointmentId}`);
    }

    // Create notification
    await Notification.create({
      message: `Appointment rescheduled for ${appointmentWithUser.user?.firstName} ${appointmentWithUser.user?.lastName} to ${newSlotDate.toLocaleString()}`,
      formType: updatedAppointment.formType || 'appointment',
      read: false,
      appointmentId: appointmentId
    });

    res.status(200).json({
      success: true,
      appointment: appointmentWithUser,
      message: 'Appointment rescheduled successfully'
    });

  } catch (error) {
    console.error('❌ Reschedule appointment error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reschedule appointment',
      details: error.message 
    });
  }
});

// ✅ DELETE APPOINTMENT
const deleteAppointment = asyncHandler(async (req, res) => {
  try {
    const appointmentId = req.params.id;

    console.log(`🗑️ Deleting appointment ${appointmentId}`);

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Get user info before deletion
    const appointmentWithUser = await populateAppointmentWithUser(appointment.toObject());

    // Delete the appointment
    await Appointment.findByIdAndDelete(appointmentId);

    // ✅ EMIT WEBSOCKET DELETE EVENT
    if (req.io) {
      req.io.emit('deleteAppointment', appointmentId);
      console.log(`✅ WebSocket delete event emitted for appointment ${appointmentId}`);
    }

    // Create notification
    await Notification.create({
      message: `Appointment deleted for ${appointmentWithUser.user?.firstName} ${appointmentWithUser.user?.lastName}`,
      formType: appointment.formType || 'appointment',
      read: false
    });

    res.status(200).json({ 
      success: true, 
      message: 'Appointment deleted successfully',
      deletedId: appointmentId
    });

  } catch (error) {
    console.error('❌ Delete appointment error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete appointment',
      details: error.message 
    });
  }
});

// ✅ CREATE APPOINTMENT
const createAppointment = asyncHandler(async (req, res) => {
  try {
    console.log('📝 Creating new appointment:', req.body);

    const appointmentData = {
      ...req.body,
      status: req.body.status || 'scheduled', // Default to scheduled
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    const appointment = await Appointment.create(appointmentData);
    const appointmentWithUser = await populateAppointmentWithUser(appointment.toObject());

    // ✅ EMIT WEBSOCKET NEW APPOINTMENT EVENT
    if (req.io) {
      req.io.emit('newAppointment', appointmentWithUser);
      console.log(`✅ WebSocket new appointment event emitted for ${appointment._id}`);
    }

    // Create notification
    await Notification.create({
      message: `New appointment created for ${appointmentWithUser.user?.firstName} ${appointmentWithUser.user?.lastName}`,
      formType: appointment.formType || 'appointment',
      read: false,
      appointmentId: appointment._id
    });

    res.status(201).json({
      success: true,
      appointment: appointmentWithUser,
      message: 'Appointment created successfully'
    });

  } catch (error) {
    console.error('❌ Create appointment error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create appointment',
      details: error.message 
    });
  }
});

module.exports = {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment,
  createAppointment
};

