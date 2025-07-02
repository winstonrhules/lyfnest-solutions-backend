const express = require('express');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middlewares/authMiddleware');
const {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment
} = require('../controllers/appointmentController');

// router.route('/')
//   .get(isAdmin, getAppointments);

router.get('/all-appointment', authMiddleware, isAdmin, getAppointments)

router.put('/:id', authMiddleware, isAdmin,  updateAppointmentStatus);

router.put('/reschedule/:id', authMiddleware, isAdmin, rescheduleAppointment);

module.exports = router;

