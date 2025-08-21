const express = require('express');
const router = express.Router();
const { 
  createZoomMeeting, 
  getAllZoomMeetings, 
  manualSync,
  syncZoomMeetings,
  deleteZoomMeeting 
} = require('../controllers/zoomController');

// Existing routes...
router.post('/create-meeting', createZoomMeeting);
router.get('/sync', syncZoomMeetings);
router.get('/meetings', getAllZoomMeetings);
router.post('/manual-sync', manualSync);
router.delete('/delete-appointment/:appointmentId', deleteZoomMeeting);



module.exports = router;
