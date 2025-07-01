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

router.get('/all-appointment', isAdmin, getAppointments)

router.put('/:id', isAdmin, updateAppointmentStatus);

router.put('/reschedule/:id', isAdmin, rescheduleAppointment);

module.exports = router;

