const cron = require('node-cron');
const { syncZoomMeetings } = require('../controllers/zoomController');

// Schedule the sync to run every 5 minutes
const syncJob = cron.schedule('*/5 * * * *', () => {
  console.log('Running scheduled Zoom meeting sync...');
  syncZoomMeetings();
});

module.exports = { syncJob };
