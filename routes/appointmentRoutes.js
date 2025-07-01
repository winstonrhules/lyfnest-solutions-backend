const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middlewares/authMiddleware');
const {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment
} = require('../controllers/appointmentController');

// router.route('/')
//   .get(isAdmin, getAppointments);

router.get('/all-appointment', getAppointments)

router.put('/:id',  updateAppointmentStatus);

router.put('/reschedule/:id',  rescheduleAppointment);

module.exports = router;

