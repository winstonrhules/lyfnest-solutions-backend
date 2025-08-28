
const express = require('express');
const router = express.Router();
const {
  getAllAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment,
  markAppointmentCompleted,
  handleZoomWebhook
} = require('../controllers/appointmentController');


router.get('/all-appointment', getAllAppointments);
router.put('/update-status/:id', updateAppointmentStatus);
router.put('/reschedule/:id', rescheduleAppointment);
router.put('/:id/complete', markAppointmentCompleted);
router.delete('/delete-appointment/:id', deleteAppointment);
router.post('/zoom-webhook', handleZoomWebhook);

module.exports = router;