const express = require('express');
const router = express.Router();
const {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment
} = require('../controllers/appointmentController');



router.get('/all-appointment', getAppointments)

router.put('/:id',  updateAppointmentStatus);

router.put('/reschedule/:id', rescheduleAppointment);

router.delete('/delete-appointment/:id', deleteAppointment);

module.exports = router;

