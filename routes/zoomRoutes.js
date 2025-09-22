const express = require('express');
const router = express.Router();
const { 
  createZoomMeeting, 
  getAllZoomMeetings, 
  manualSync,
  syncZoomMeetings,
  verifyAppointmentToken,
  deleteZoomMeeting 
} = require('../controllers/zoomController');

// Existing routes...
router.post('/create-meeting', createZoomMeeting);
router.get('/verify-token/:token', verifyAppointmentToken);

router.get('/sync', syncZoomMeetings);
router.get('/meetings', getAllZoomMeetings);
router.post('/manual-sync', manualSync);
router.delete('/delete-appointment/:appointmentId', deleteZoomMeeting);



module.exports = router;
