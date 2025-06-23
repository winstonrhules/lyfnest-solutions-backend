const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middlewares/authMiddleware');
const {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment
} = require('../controllers/appointmentController');

router.route('/')
  .get(isAdmin, getAppointments);

router.route('/:id')
  .put(isAdmin, updateAppointmentStatus);

router.route('/reschedule/:id')
  .put(isAdmin, rescheduleAppointment);

module.exports = router;

