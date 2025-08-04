// const express = require('express');
// const router = express.Router();
// const {
//   getAppointments,
//   updateAppointmentStatus,
//   rescheduleAppointment,
//   deleteAppointment
// } = require('../controllers/appointmentController');



// router.get('/all-appointment', getAppointments)

// router.put('/:id',  updateAppointmentStatus);

// router.put('/reschedule/:id', rescheduleAppointment);

// router.delete('/delete-appointment/:id', deleteAppointment);

// module.exports = router;


const express = require('express');
const router = express.Router();

const {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment,
  createAppointment
} = require('../controllers/appointmentController');

// GET all appointments
router.get('/all-appointment', getAppointments);

// CREATE new appointment (with WebSocket emit)
router.post('/create-appointment', createAppointment);

// UPDATE status or Zoom info
router.put('/:id', updateAppointmentStatus);

// RESCHEDULE appointment
router.put('/reschedule/:id', rescheduleAppointment);

// DELETE appointment
router.delete('/delete-appointment/:id', deleteAppointment);

module.exports = router;
