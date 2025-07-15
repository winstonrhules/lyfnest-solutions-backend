const express = require('express');
const router = express.Router();
// const { authMiddleware, isAdmin } = require('../middlewares/authMiddleware');
const {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment
} = require('../controllers/appointmentController');

// router.route('/')
//   .get(isAdmin, getAppointments);

router.get('/all-appointment', getAppointments)

router.put('/:id',  updateAppointmentStatus);

router.put('/reschedule/:id', rescheduleAppointment);

router.delete('/delete-appointment/:id', deleteAppointment);

module.exports = router;

