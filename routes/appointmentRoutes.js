// const express = require('express');
// const router = express.Router();
// const {
//   getAllAppointments,
//   updateAppointmentStatus,
//   rescheduleAppointment,
//   deleteAppointmentWithZoom,
//   markAppointmentCompleted,
//   handleZoomWebhook,
//   scheduleContactListZoomMeeting,
//   bookContactMeeting
// } = require('../controllers/appointmentController');

// // Existing routes
// router.get('/all-appointment', getAllAppointments);
// router.put('/update-status/:id', updateAppointmentStatus);
// router.put('/reschedule/:id', rescheduleAppointment);
// router.put('/:id/complete', markAppointmentCompleted);
// router.delete('/delete-appointment/:id', deleteAppointmentWithZoom);
// router.post('/zoom-webhook', handleZoomWebhook);

// // NEW ROUTES for contact list functionality
// router.post('/schedule-contact-zoom', scheduleContactListZoomMeeting);
// router.post('/book-contact-meeting/:appointmentId', bookContactMeeting);

// module.exports = router;


// const express = require('express');
// const router = express.Router();
// const {
//   getAllAppointments,
//   updateAppointmentStatus,
//   rescheduleAppointment,
//   deleteAppointmentWithZoom,
//   markAppointmentCompleted,
//   handleZoomWebhook,
//   scheduleContactListZoomMeeting,
//   bookContactMeeting
// } = require('../controllers/appointmentController');

// // Existing routes
// router.get('/all-appointment', getAllAppointments);
// router.put('/update-status/:id', updateAppointmentStatus);
// router.put('/reschedule/:id', rescheduleAppointment);
// router.put('/:id/complete', markAppointmentCompleted);
// router.delete('/delete-appointment/:id', deleteAppointmentWithZoom);
// router.post('/zoom-webhook', handleZoomWebhook);

// // NEW ROUTES for contact list functionality
// router.post('/schedule-contact-zoom', scheduleContactListZoomMeeting);
// router.post('/book-contact-meeting/:appointmentId', bookContactMeeting);

// module.exports = router;


const express = require('express');
const router = express.Router();
const {
  getAllAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointmentWithZoom,
  markAppointmentCompleted,
  handleZoomWebhook,
  scheduleContactListZoomMeeting,
  bookContactMeeting
} = require('../controllers/appointmentController');

// Existing routes
router.get('/all-appointment', getAllAppointments);
router.put('/update-status/:id', updateAppointmentStatus);
router.put('/reschedule/:id', rescheduleAppointment);
router.put('/:id/complete', markAppointmentCompleted);
router.delete('/delete-appointment/:id', deleteAppointmentWithZoom);
router.post('/zoom-webhook', handleZoomWebhook);

// NEW ROUTES for contact list functionality
router.post('/schedule-contact-zoom', scheduleContactListZoomMeeting);
router.post('/book-contact-meeting/:appointmentId', bookContactMeeting);

module.exports = router;
