// const express = require('express');
// const router = express.Router();
// const { 
//   createZoomMeeting, 
//   getAllZoomMeetings, 
//   manualSync,
//   syncZoomMeetings,
//   verifyAppointmentToken,
//   deleteZoomMeeting 
// } = require('../controllers/zoomController');

// // Existing routes...
// router.post('/create-meeting', createZoomMeeting);
// router.get('/verify-token/:token', verifyAppointmentToken);

// router.get('/sync', syncZoomMeetings);
// router.get('/meetings', getAllZoomMeetings);
// router.post('/manual-sync', manualSync);
// router.delete('/delete-appointment/:appointmentId', deleteZoomMeeting);



// module.exports = router;


// ====== UPDATED ZOOM ROUTES - COMPLETE INTEGRATION ======

const express = require('express');
const router = express.Router();

// Import from zoomController (which re-exports functions from zoomService)
const { 
  createZoomMeeting, 
  getAllZoomMeetings, 
  manualSync,
  syncZoomMeetings,
  verifyAppointmentToken,
  deleteZoomMeeting,
  debugAppointments,
  getSyncStatus,
  testTokenSystem
} = require('../controllers/zoomController');


// ====== MAIN ROUTES ======

// Create Zoom meeting manually
router.post('/create-meeting', createZoomMeeting);

// Verify appointment token (for pre-filling scheduler forms)
router.get('/verify-token/:token', verifyAppointmentToken);

// Sync Zoom meetings (manual trigger)
router.post('/manual-sync', manualSync);
 router.get('/sync', syncZoomMeetings); // Alternative endpoint

// Get all Zoom meetings
router.get('/meetings', getAllZoomMeetings);

// Delete appointment and associated Zoom meeting
router.delete('/delete-appointment/:appointmentId', deleteZoomMeeting);

// ====== DEBUG AND MONITORING ROUTES ======

// Debug appointment matching data
router.get('/debug/appointments/:status?', debugAppointments);

// Get sync status and health check
router.get('/status', getSyncStatus);

// Test token generation and matching system
router.get('/test-tokens', testTokenSystem);

// Simple health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'zoom-integration',
    timestamp: new Date().toISOString(),
    version: '2.0-enhanced'
  });
});

module.exports = router;

