const asyncHandler = require('express-async-handler');
const Appointment = require('../models/appointmentModels');
const Form = require('../models/formModels');

// Get all appointments
const getAppointments = asyncHandler(async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('formId', 'firstName lastName phoneNumber Email')
      .sort({ assignedSlot: 1 });
      
    res.status(200).json(appointments);
  } catch (error) {
    console.error("Get Appointments Error:", error);
    res.status(500).json({ error: 'Failed to retrieve appointments' });
  }
});

// Update appointment status
const updateAppointmentStatus = asyncHandler(async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    appointment.status = status;
    await appointment.save();
    
    res.status(200).json({
      _id: appointment._id,
      status: appointment.status,
      formId: appointment.formId
    });
  } catch (error) {
    console.error("Update Appointment Error:", error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Reschedule appointment
const rescheduleAppointment = asyncHandler(async (req, res) => {
  try {
    const { newSlot } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    // Validate new slot is within original window
    if (
      new Date(newSlot) < appointment.contactWindowStart ||
      new Date(newSlot) > appointment.contactWindowEnd
    ) {
      return res.status(400).json({ error: 'New slot outside contact window' });
    }
    
    appointment.assignedSlot = newSlot;
    await appointment.save();
    
    // Send notification to admin
    const form = await Form.findById(appointment.formId);
    await Notification.create({
      message: `Appointment rescheduled for ${form.firstName} ${form.lastName} to ${newSlot.toLocaleString()}`,
      formType: 'appointment',
      read: false
    });
    
    res.status(200).json(appointment);
  } catch (error) {
    console.error("Reschedule Error:", error);
    res.status(500).json({ error: 'Failed to reschedule appointment' });
  }
});

module.exports = {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment
};
