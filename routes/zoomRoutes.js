// const express = require('express');
// const router = express.Router();
// const { syncZoomMeetings } = require('../controllers/zoomController');


// router.post('/create-meeting', async (req, res) => {
//   try {
//     await syncZoomMeetings();
//     res.send('Zoom meetings created.');
//   } catch (e) {
//     res.status(500).send('Zoom meeting creation failed');
//   }
// })

// router.get('/sync', async (req, res) => {
//   try {
//     await syncZoomMeetings();
//     res.send('Zoom meetings synced.');
//   } catch (e) {
//     res.status(500).send('Zoom sync failed');
//   }
// });


// module.exports = router;

const express = require('express');
const router = express.Router();
const { 
  createZoomMeeting, 
  getAllZoomMeetings, 
  manualSync,
  syncZoomMeetings 
} = require('../controllers/zoomController');

router.post('/create-meeting', createZoomMeeting);
router.get('/meetings', getAllZoomMeetings);
router.post('/manual-sync', manualSync);
router.get('/sync', syncZoomMeetings);

module.exports = router;
