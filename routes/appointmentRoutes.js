// const express = require('express');
// const router = express.Router();
// const {
//   getAllAppointments,
//   updateAppointmentStatus,
//   rescheduleAppointment,
//   deleteAppointmentWithZoom,
//   markAppointmentCompleted,
//   handleZoomWebhook
// } = require('../controllers/appointmentController');


// router.get('/all-appointment', getAllAppointments);
// router.put('/update-status/:id', updateAppointmentStatus);
// router.put('/reschedule/:id', rescheduleAppointment);
// router.put('/:id/complete', markAppointmentCompleted);
// router.delete('/delete-appointment/:id', deleteAppointmentWithZoom);
// router.post('/zoom-webhook', handleZoomWebhook);


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
//   sendContactListSchedulerLink,
//   handleContactListBooking
// } = require('../controllers/appointmentController');

// // Middleware (adjust path as needed)
// // const { protect } = require('../middleware/authMiddleware');

// // ===== EXISTING ROUTES =====
// router.get('/all-appointment', getAllAppointments);
// router.put('/update-status/:id', updateAppointmentStatus);
// router.put('/reschedule/:id', rescheduleAppointment);
// router.put('/:id/complete', markAppointmentCompleted);
// router.delete('/delete-appointment/:id', deleteAppointmentWithZoom);

// // Zoom webhook (no authentication needed - it's a webhook from Zoom)
// router.post('/zoom-webhook', handleZoomWebhook);

// // ===== NEW CONTACT LIST ROUTES =====
// // Send scheduler link to contact list person
// // Add protect middleware if you have authentication: protect, sendContactListSchedulerLink
// router.post('/contact-list/send-scheduler-link', sendContactListSchedulerLink);

// // Handle booking callback (webhook from Calendly/Zoom - no auth needed)
// router.post('/contact-list/booking-callback', handleContactListBooking);

// module.exports = router;

// appointmentRoutes.js - Updated routes with contact list endpoints
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