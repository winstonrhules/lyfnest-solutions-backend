// const express = require('express');
// const router = express.Router();
// const emailScheduler = require('../services/emailSchedulerService');

// /**
//  * GET /scheduled-emails - Get all scheduled emails with filtering
//  */
// router.get('/', async (req, res) => {
//   try {
//     const { status, page, limit } = req.query;
    
//     const result = await emailScheduler.getScheduledEmails({
//       status: status || 'all',
//       page: parseInt(page) || 1,
//       limit: parseInt(limit) || 50
//     });

//     res.json({
//       success: true,
//       data: result.emails,
//       pagination: result.pagination
//     });

//   } catch (error) {
//     console.error('Error fetching scheduled emails:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch scheduled emails',
//       message: error.message
//     });
//   }
// });

// /**
//  * GET /scheduled-emails/:jobId - Get specific scheduled email
//  */
// router.get('/:jobId', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const email = await emailScheduler.getScheduledEmail(jobId);

//     res.json({
//       success: true,
//       data: email
//     });

//   } catch (error) {
//     console.error('Error fetching scheduled email:', error);
    
//     if (error.message.includes('not found')) {
//       return res.status(404).json({
//         success: false,
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch scheduled email',
//       message: error.message
//     });
//   }
// });

// /**
//  * POST /scheduled-emails - Schedule new email
//  */
// router.post('/', async (req, res) => {
//   try {
//     const emailData = req.body;
//     const schedule = await emailScheduler.scheduleEmail(emailData);

//     res.status(201).json({
//       success: true,
//       message: 'Email scheduled successfully',
//       data: {
//         jobId: schedule.jobId,
//         scheduledFor: schedule.scheduledFor,
//         recipientCount: schedule.recipients.length,
//         status: schedule.status
//       }
//     });

//   } catch (error) {
//     console.error('Error scheduling email:', error);
    
//     if (error.message.includes('required') || error.message.includes('must be')) {
//       return res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: 'Failed to schedule email',
//       message: error.message
//     });
//   }
// });

// /**
//  * PUT /scheduled-emails/:jobId - Update scheduled email
//  */
// router.put('/:jobId', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const updates = req.body;
    
//     const updated = await emailScheduler.updateScheduledEmail(jobId, updates);

//     res.json({
//       success: true,
//       message: 'Scheduled email updated successfully',
//       data: updated
//     });

//   } catch (error) {
//     console.error('Error updating scheduled email:', error);
    
//     if (error.message.includes('not found')) {
//       return res.status(404).json({
//         success: false,
//         error: error.message
//       });
//     }
    
//     if (error.message.includes('Cannot update') || error.message.includes('must be')) {
//       return res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: 'Failed to update scheduled email',
//       message: error.message
//     });
//   }
// });

// /**
//  * DELETE /scheduled-emails/:jobId - Cancel scheduled email
//  */
// router.delete('/:jobId', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const cancelled = await emailScheduler.cancelScheduledEmail(jobId);

//     res.json({
//       success: true,
//       message: 'Email cancelled successfully',
//       data: {
//         jobId: cancelled.jobId,
//         status: cancelled.status
//       }
//     });

//   } catch (error) {
//     console.error('Error cancelling scheduled email:', error);
    
//     if (error.message.includes('not found')) {
//       return res.status(404).json({
//         success: false,
//         error: error.message
//       });
//     }
    
//     if (error.message.includes('Cannot cancel')) {
//       return res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: 'Failed to cancel scheduled email',
//       message: error.message
//     });
//   }
// });

// /**
//  * POST /scheduled-emails/:jobId/send-now - Send scheduled email immediately
//  */
// router.post('/:jobId/send-now', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const email = await emailScheduler.sendScheduledEmailNow(jobId);

//     res.json({
//       success: true,
//       message: 'Email sent immediately',
//       data: {
//         jobId: email.jobId,
//         status: email.status
//       }
//     });

//   } catch (error) {
//     console.error('Error sending email immediately:', error);
    
//     if (error.message.includes('not found')) {
//       return res.status(404).json({
//         success: false,
//         error: error.message
//       });
//     }
    
//     if (error.message.includes('already been sent') || error.message.includes('currently being sent')) {
//       return res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: 'Failed to send email immediately',
//       message: error.message
//     });
//   }
// });

// /**
//  * GET /scheduled-emails/status/overview - Get scheduler status
//  */
// router.get('/status/overview', async (req, res) => {
//   try {
//     const status = await emailScheduler.getSchedulerStatus();
    
//     res.json({
//       success: true,
//       data: status
//     });

//   } catch (error) {
//     console.error('Error getting scheduler status:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to get scheduler status',
//       message: error.message
//     });
//   }
// });

// module.exports = router;


// const express = require('express');
// const router = express.Router();
// const emailScheduler = require('../services/emailSchedulerService');

// /**
//  * POST /scheduled-emails/schedule - Schedule new email
//  */
// router.post('/schedule', async (req, res) => {
//   try {
//     const emailData = req.body;
//     const schedule = await emailScheduler.scheduleEmail(emailData);

//     res.status(201).json({
//       success: true,
//       message: 'Email scheduled successfully',
//       data: {
//         jobId: schedule.jobId,
//         scheduledFor: schedule.scheduledFor,
//         recipientCount: schedule.recipients.length,
//         status: schedule.status
//       }
//     });

//   } catch (error) {
//     console.error('Error scheduling email:', error);
    
//     if (error.message.includes('required') || error.message.includes('must be')) {
//       return res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: 'Failed to schedule email',
//       message: error.message
//     });
//   }
// });

// /**
//  * GET /scheduled-emails/scheduled - Get all scheduled emails
//  */
// router.get('/scheduled', async (req, res) => {
//   try {
//     const emails = await emailScheduler.getAllScheduledEmails();
    
//     res.json({
//       success: true,
//       data: emails
//     });

//   } catch (error) {
//     console.error('Error fetching scheduled emails:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch scheduled emails',
//       message: error.message
//     });
//   }
// });

// /**
//  * GET /scheduled-emails/scheduled/:jobId - Get specific scheduled email
//  */
// router.get('/scheduled/:jobId', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const email = await emailScheduler.getScheduledEmail(jobId);

//     res.json({
//       success: true,
//       data: email
//     });

//   } catch (error) {
//     console.error('Error fetching scheduled email:', error);
    
//     if (error.message.includes('not found')) {
//       return res.status(404).json({
//         success: false,
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch scheduled email',
//       message: error.message
//     });
//   }
// });

// /**
//  * PUT /scheduled-emails/scheduled/:jobId - Update scheduled email
//  */
// router.put('/scheduled/:jobId', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const updates = req.body;
    
//     const updated = await emailScheduler.updateScheduledEmail(jobId, updates);

//     res.json({
//       success: true,
//       message: 'Scheduled email updated successfully',
//       data: updated
//     });

//   } catch (error) {
//     console.error('Error updating scheduled email:', error);
    
//     if (error.message.includes('not found')) {
//       return res.status(404).json({
//         success: false,
//         error: error.message
//       });
//     }
    
//     if (error.message.includes('Cannot update') || error.message.includes('must be')) {
//       return res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: 'Failed to update scheduled email',
//       message: error.message
//     });
//   }
// });

// /**
//  * DELETE /scheduled-emails/scheduled/:jobId - Cancel scheduled email
//  */
// router.delete('/scheduled/:jobId', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const cancelled = await emailScheduler.cancelScheduledEmail(jobId);

//     res.json({
//       success: true,
//       message: 'Email cancelled successfully',
//       data: {
//         jobId: cancelled.jobId,
//         status: cancelled.status
//       }
//     });

//   } catch (error) {
//     console.error('Error cancelling scheduled email:', error);
    
//     if (error.message.includes('not found')) {
//       return res.status(404).json({
//         success: false,
//         error: error.message
//       });
//     }
    
//     if (error.message.includes('Cannot cancel')) {
//       return res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: 'Failed to cancel scheduled email',
//       message: error.message
//     });
//   }
// });

// /**
//  * POST /scheduled-emails/scheduled/:jobId/send-now - Send scheduled email immediately
//  */
// router.post('/scheduled/:jobId/send-now', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const email = await emailScheduler.sendScheduledEmailNow(jobId);

//     res.json({
//       success: true,
//       message: 'Email sent immediately',
//       data: {
//         jobId: email.jobId,
//         status: email.status
//       }
//     });

//   } catch (error) {
//     console.error('Error sending email immediately:', error);
    
//     if (error.message.includes('not found')) {
//       return res.status(404).json({
//         success: false,
//         error: error.message
//       });
//     }
    
//     if (error.message.includes('already been sent') || error.message.includes('currently being sent')) {
//       return res.status(400).json({
//         success: false,
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: 'Failed to send email immediately',
//       message: error.message
//     });
//   }
// });

// /**
//  * GET /scheduled-emails/status - Get scheduler status
//  */
// router.get('/status', async (req, res) => {
//   try {
//     const status = await emailScheduler.getSchedulerStatus();
    
//     res.json({
//       success: true,
//       data: status
//     });

//   } catch (error) {
//     console.error('Error getting scheduler status:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to get scheduler status',
//       message: error.message
//     });
//   }
// });

// /**
//  * POST /scheduled-emails/trigger - Manually trigger scheduler (for testing)
//  */
// router.post('/trigger', async (req, res) => {
//   try {
//     await emailScheduler.processDueEmails();
    
//     res.json({
//       success: true,
//       message: 'Scheduler triggered successfully'
//     });

//   } catch (error) {
//     console.error('Error triggering scheduler:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to trigger scheduler',
//       message: error.message
//     });
//   }
// });

// module.exports = router;

const express = require('express');
const router = express.Router();
const emailScheduler = require('../services/emailSchedulerService');

/**
 * POST /scheduled-emails/schedule - Schedule new email
 */
router.post('/schedule', async (req, res) => {
  try {
    const emailData = req.body;
    const schedule = await emailScheduler.scheduleEmail(emailData);

    res.status(201).json({
      success: true,
      message: 'Email scheduled successfully',
      data: {
        jobId: schedule.jobId,
        scheduledFor: schedule.scheduledFor,
        recipientCount: schedule.recipients.length,
        status: schedule.status
      }
    });

  } catch (error) {
    console.error('Error scheduling email:', error);
    
    if (error.message.includes('required') || error.message.includes('must be')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to schedule email',
      message: error.message
    });
  }
});

/**
 * GET /scheduled-emails/scheduled - Get all scheduled emails
 */
router.get('/scheduled', async (req, res) => {
  try {
    const emails = await emailScheduler.getAllScheduledEmails();
    
    res.json({
      success: true,
      data: emails
    });

  } catch (error) {
    console.error('Error fetching scheduled emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled emails',
      message: error.message
    });
  }
});

/**
 * GET /scheduled-emails/scheduled/:jobId - Get specific scheduled email
 */
router.get('/scheduled/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const email = await emailScheduler.getScheduledEmail(jobId);

    res.json({
      success: true,
      data: email
    });

  } catch (error) {
    console.error('Error fetching scheduled email:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled email',
      message: error.message
    });
  }
});

/**
 * PUT /scheduled-emails/scheduled/:jobId - Update scheduled email
 */
router.put('/scheduled/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const updates = req.body;
    
    const updated = await emailScheduler.updateScheduledEmail(jobId, updates);

    res.json({
      success: true,
      message: 'Scheduled email updated successfully',
      data: updated
    });

  } catch (error) {
    console.error('Error updating scheduled email:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('Cannot update') || error.message.includes('must be')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update scheduled email',
      message: error.message
    });
  }
});

/**
 * DELETE /scheduled-emails/scheduled/:jobId - Cancel scheduled email
 */
router.delete('/scheduled/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const cancelled = await emailScheduler.cancelScheduledEmail(jobId);

    res.json({
      success: true,
      message: 'Email cancelled successfully',
      data: {
        jobId: cancelled.jobId,
        status: cancelled.status
      }
    });

  } catch (error) {
    console.error('Error cancelling scheduled email:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('Cannot cancel')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to cancel scheduled email',
      message: error.message
    });
  }
});

/**
 * POST /scheduled-emails/scheduled/:jobId/send-now - Send scheduled email immediately
 */
router.post('/scheduled/:jobId/send-now', async (req, res) => {
  try {
    const { jobId } = req.params;
    const email = await emailScheduler.sendScheduledEmailNow(jobId);

    res.json({
      success: true,
      message: 'Email sent immediately',
      data: {
        jobId: email.jobId,
        status: email.status
      }
    });

  } catch (error) {
    console.error('Error sending email immediately:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('already been sent') || error.message.includes('currently being sent')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send email immediately',
      message: error.message
    });
  }
});

/**
 * GET /scheduled-emails/status - Get scheduler status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await emailScheduler.getSchedulerStatus();
    
    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status',
      message: error.message
    });
  }
});

/**
 * POST /scheduled-emails/trigger - Manually trigger scheduler (for testing)
 */
router.post('/trigger', async (req, res) => {
  try {
    await emailScheduler.processDueEmails();
    
    res.json({
      success: true,
      message: 'Scheduler triggered successfully'
    });

  } catch (error) {
    console.error('Error triggering scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger scheduler',
      message: error.message
    });
  }
});

module.exports = router;

 