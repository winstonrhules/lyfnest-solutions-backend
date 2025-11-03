// const express = require('express');
// const router = express.Router();
// const ScheduledEmail = require('../models/emailScheduleModels');

// // GET all scheduled emails
// router.get('/', async (req, res) => {
//   try {
//     const scheduledEmails = await ScheduledEmail.find().sort({ scheduleDateTime: 1 });
//     res.json(scheduledEmails);
//   } catch (error) {
//     console.error('Error fetching scheduled emails:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// // POST create scheduled email
// router.post('/', async (req, res) => {
//   try {
//     const scheduledEmail = new ScheduledEmail(req.body);
//     await scheduledEmail.save();
//     res.status(201).json(scheduledEmail);
//   } catch (error) {
//     console.error('Error creating scheduled email:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// // PATCH update scheduled email status
// router.patch('/:id', async (req, res) => {
//   try {
//     // ISSUE 1 FIX: When marking as sent, also mark as processed
//     const updateData = { ...req.body };
//     if (updateData.sent === true) {
//       updateData.processed = true;
//       updateData.sentAt = updateData.sentAt || new Date().toISOString();
//     }
    
//     const scheduledEmail = await ScheduledEmail.findByIdAndUpdate(
//       req.params.id,
//       updateData,
//       { new: true }
//     );
    
//     if (!scheduledEmail) {
//       return res.status(404).json({ message: 'Scheduled email not found' });
//     }
    
//     res.json(scheduledEmail);
//   } catch (error) {
//     console.error('Error updating scheduled email:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// // DELETE scheduled email
// router.delete('/:id', async (req, res) => {
//   try {
//     const scheduledEmail = await ScheduledEmail.findByIdAndDelete(req.params.id);
    
//     if (!scheduledEmail) {
//       return res.status(404).json({ message: 'Scheduled email not found' });
//     }
    
//     res.json({ message: 'Scheduled email deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting scheduled email:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// // ISSUE 1 FIX: New route to get pending emails for processing
// // GET pending emails for processing
// router.get('/pending', async (req, res) => {
//   try {
//     const now = new Date();
//     const pendingEmails = await ScheduledEmail.find({
//       sent: false,
//       processing: { $ne: true },
//       scheduleDateTime: { $lte: now },
//       $or: [
//         { lastProcessingAttempt: { $exists: false } },
//         { lastProcessingAttempt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } } // 5 minutes ago
//       ]
//     }).sort({ scheduleDateTime: 1 });
    
//     res.json(pendingEmails);
//   } catch (error) {
//     console.error('Error fetching pending emails:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// module.exports = router;



// server/routes/scheduledEmailRoutes.js
// const express = require('express');
// const router = express.Router();
// const ScheduledEmail = require('../models/emailScheduleModels');

// // GET all scheduled emails
// router.get('/', async (req, res) => {
//   try {
//     const scheduledEmails = await ScheduledEmail.find().sort({ scheduleDateTime: 1 });
//     res.json(scheduledEmails);
//   } catch (error) {
//     console.error('Error fetching scheduled emails:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// // POST create scheduled email
// router.post('/', async (req, res) => {
//   try {
//     const scheduledEmail = new ScheduledEmail({
//       ...req.body,
//       sent: false,
//       processed: false,
//       processing: false
//     });
//     await scheduledEmail.save();
//     res.status(201).json(scheduledEmail);
//   } catch (error) {
//     console.error('Error creating scheduled email:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// // PATCH update scheduled email status
// router.patch('/:id', async (req, res) => {
//   try {
//     const updateData = { ...req.body };
    
//     // CRITICAL FIX: When marking as sent, also mark as processed
//     if (updateData.sent === true) {
//       updateData.processed = true;
//       updateData.processing = false;
//       updateData.sentAt = updateData.sentAt || new Date().toISOString();
//     }
    
//     // Use findOneAndUpdate with conditions to prevent race conditions
//     const scheduledEmail = await ScheduledEmail.findOneAndUpdate(
//       { 
//         _id: req.params.id,
//         // Only update if not already processed (prevent duplicate updates)
//         $or: [
//           { processed: { $ne: true } },
//           { sent: { $ne: true } }
//         ]
//       },
//       updateData,
//       { new: true }
//     );
    
//     if (!scheduledEmail) {
//       return res.status(404).json({ 
//         message: 'Scheduled email not found or already processed' 
//       });
//     }
    
//     res.json(scheduledEmail);
//   } catch (error) {
//     console.error('Error updating scheduled email:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// // DELETE scheduled email
// router.delete('/:id', async (req, res) => {
//   try {
//     const scheduledEmail = await ScheduledEmail.findByIdAndDelete(req.params.id);
    
//     if (!scheduledEmail) {
//       return res.status(404).json({ message: 'Scheduled email not found' });
//     }
    
//     res.json({ message: 'Scheduled email deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting scheduled email:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// // GET pending emails for processing (used by backend scheduler)
// router.get('/pending', async (req, res) => {
//   try {
//     const now = new Date();
//     const pendingEmails = await ScheduledEmail.find({
//       sent: false,
//       processed: { $ne: true },
//       processing: { $ne: true },
//       scheduleDateTime: { $lte: now }
//     })
//     .sort({ scheduleDateTime: 1 })
//     .limit(10);
    
//     res.json(pendingEmails);
//   } catch (error) {
//     console.error('Error fetching pending emails:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// // POST trigger immediate send (for manual "Send Now" button)
// router.post('/:id/send-now', async (req, res) => {
//   try {
//     const email = await ScheduledEmail.findById(req.params.id);
    
//     if (!email) {
//       return res.status(404).json({ message: 'Scheduled email not found' });
//     }

//     if (email.sent) {
//       return res.status(400).json({ message: 'Email already sent' });
//     }

//     // Update schedule time to now to trigger immediate processing
//     email.scheduleDateTime = new Date();
//     await email.save();
    
//     res.json({ 
//       message: 'Email queued for immediate sending',
//       email 
//     });
//   } catch (error) {
//     console.error('Error triggering immediate send:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// module.exports = router;

// routes/emailScheduleRoutes.js
const express = require('express');
const router = express.Router();
const emailScheduler = require('../services/emailSchedulerService');


/**
 * POST - Schedule a new email
 */
router.post('/schedule', async (req, res) => {
  try {
    const {
      recipients,
      recipientContacts,
      subject,
      body,
      design,
      sender,
      attachments,
      scheduleDateTime
    } = req.body;

    // Validation
    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'At least one recipient is required' 
      });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Subject is required' 
      });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Email body is required' 
      });
    }

    if (!scheduleDateTime) {
      return res.status(400).json({ 
        success: false,
        error: 'Schedule date/time is required' 
      });
    }

    // Validate schedule time is in the future
    const scheduleTime = new Date(scheduleDateTime);
    const now = new Date();
    
    if (isNaN(scheduleTime.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid schedule date/time format' 
      });
    }

    if (scheduleTime <= now) {
      return res.status(400).json({ 
        success: false,
        error: 'Schedule time must be in the future' 
      });
    }

    // Schedule the email
    const schedule = await emailScheduler.scheduleEmail({
      recipients,
      recipientContacts,
      subject,
      body,
      design,
      sender,
      attachments,
      scheduleDateTime
    });

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
    res.status(500).json({ 
      success: false,
      error: 'Failed to schedule email',
      details: error.message 
    });
  }
});

/**
 * GET - Get all scheduled emails
 */
router.get('/scheduled', async (req, res) => {
  try {
    const scheduledEmails = await emailScheduler.getAllScheduledEmails();
    
    res.json({
      success: true,
      count: scheduledEmails.length,
      data: scheduledEmails
    });

  } catch (error) {
    console.error('Error fetching scheduled emails:', error);
    res.status(500).json({ 
      error: 'Failed to fetch scheduled emails',
      details: error.message 
    });
  }
});

/**
 * GET - Get specific scheduled email by jobId
 */
router.get('/scheduled/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const schedule = await emailScheduler.getScheduledEmail(jobId);

    if (!schedule) {
      return res.status(404).json({ 
        error: 'Scheduled email not found' 
      });
    }

    res.json({
      success: true,
      data: schedule
    });

  } catch (error) {
    console.error('Error fetching scheduled email:', error);
    res.status(500).json({ 
      error: 'Failed to fetch scheduled email',
      details: error.message 
    });
  }
});

/**
 * POST - Send scheduled email immediately
 */
router.post('/scheduled/:jobId/send-now', async (req, res) => {
  try {
    const { jobId } = req.params;
    const EmailSchedule = require('../models/EmailSchedule');
    
    // Update schedule time to now
    const schedule = await EmailSchedule.findOneAndUpdate(
      { jobId, status: 'pending' },
      { $set: { scheduledFor: new Date() } },
      { new: true }
    );

    if (!schedule) {
      return res.status(404).json({ 
        error: 'Scheduled email not found or already processed' 
      });
    }

    // Trigger immediate processing
    await emailScheduler.processScheduledEmails();

    res.json({
      success: true,
      message: 'Email queued for immediate sending',
      data: {
        jobId: schedule.jobId,
        status: schedule.status
      }
    });

  } catch (error) {
    console.error('Error triggering immediate send:', error);
    res.status(500).json({ 
      error: 'Failed to trigger immediate send',
      details: error.message 
    });
  }
});

/**
 * DELETE - Cancel scheduled email
 */
router.delete('/scheduled/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const schedule = await emailScheduler.cancelEmail(jobId);

    res.json({
      success: true,
      message: 'Email cancelled successfully',
      data: {
        jobId: schedule.jobId,
        status: schedule.status
      }
    });

  } catch (error) {
    console.error('Error cancelling email:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ 
      error: 'Failed to cancel email',
      details: error.message 
    });
  }
});

/**
 * GET - Get scheduler status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await emailScheduler.getStatus();
    
    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error fetching scheduler status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch scheduler status',
      details: error.message 
    });
  }
});

/**
 * POST - Manually trigger scheduler (for testing/admin)
 */
router.post('/trigger', async (req, res) => {
  try {
    await emailScheduler.processScheduledEmails();
    
    res.json({
      success: true,
      message: 'Scheduler triggered successfully'
    });

  } catch (error) {
    console.error('Error triggering scheduler:', error);
    res.status(500).json({ 
      error: 'Failed to trigger scheduler',
      details: error.message 
    });
  }
});

module.exports = router;

// /**
//  * POST - Schedule a new email
//  */
// router.post('/schedule', async (req, res) => {
//   try {
//     const {
//       recipients,
//       recipientContacts,
//       subject,
//       body,
//       design,
//       sender,
//       attachments,
//       scheduleDateTime
//     } = req.body;

//     // Validation
//     if (!recipients || recipients.length === 0) {
//       return res.status(400).json({ 
//         error: 'At least one recipient is required' 
//       });
//     }

//     if (!subject || !body) {
//       return res.status(400).json({ 
//         error: 'Subject and body are required' 
//       });
//     }

//     if (!scheduleDateTime) {
//       return res.status(400).json({ 
//         error: 'Schedule date/time is required' 
//       });
//     }

//     // Schedule the email
//     const schedule = await emailScheduler.scheduleEmail({
//       recipients,
//       recipientContacts,
//       subject,
//       body,
//       design,
//       sender,
//       attachments,
//       scheduleDateTime
//     });

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
//     res.status(500).json({ 
//       error: 'Failed to schedule email',
//       details: error.message 
//     });
//   }
// });

// /**
//  * GET - Get all scheduled emails
//  */
// router.get('/scheduled', async (req, res) => {
//   try {
//     const scheduledEmails = await emailScheduler.getAllScheduledEmails();
    
//     res.json({
//       success: true,
//       count: scheduledEmails.length,
//       data: scheduledEmails
//     });

//   } catch (error) {
//     console.error('Error fetching scheduled emails:', error);
//     res.status(500).json({ 
//       error: 'Failed to fetch scheduled emails',
//       details: error.message 
//     });
//   }
// });

// /**
//  * GET - Get specific scheduled email by jobId
//  */
// router.get('/scheduled/:jobId', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const schedule = await emailScheduler.getScheduledEmail(jobId);

//     if (!schedule) {
//       return res.status(404).json({ 
//         error: 'Scheduled email not found' 
//       });
//     }

//     res.json({
//       success: true,
//       data: schedule
//     });

//   } catch (error) {
//     console.error('Error fetching scheduled email:', error);
//     res.status(500).json({ 
//       error: 'Failed to fetch scheduled email',
//       details: error.message 
//     });
//   }
// });

// /**
//  * POST - Send scheduled email immediately
//  */
// router.post('/scheduled/:jobId/send-now', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const EmailSchedule = require('../models/emailScheduleModels');
    
//     // Update schedule time to now
//     const schedule = await EmailSchedule.findOneAndUpdate(
//       { jobId, status: 'pending' },
//       { $set: { scheduledFor: new Date() } },
//       { new: true }
//     );

//     if (!schedule) {
//       return res.status(404).json({ 
//         error: 'Scheduled email not found or already processed' 
//       });
//     }

//     // Trigger immediate processing
//     await emailScheduler.processScheduledEmails();

//     res.json({
//       success: true,
//       message: 'Email queued for immediate sending',
//       data: {
//         jobId: schedule.jobId,
//         status: schedule.status
//       }
//     });

//   } catch (error) {
//     console.error('Error triggering immediate send:', error);
//     res.status(500).json({ 
//       error: 'Failed to trigger immediate send',
//       details: error.message 
//     });
//   }
// });

// /**
//  * DELETE - Cancel scheduled email
//  */
// router.delete('/scheduled/:jobId', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const schedule = await emailScheduler.cancelEmail(jobId);

//     res.json({
//       success: true,
//       message: 'Email cancelled successfully',
//       data: {
//         jobId: schedule.jobId,
//         status: schedule.status
//       }
//     });

//   } catch (error) {
//     console.error('Error cancelling email:', error);
    
//     if (error.message.includes('not found')) {
//       return res.status(404).json({ error: error.message });
//     }

//     res.status(500).json({ 
//       error: 'Failed to cancel email',
//       details: error.message 
//     });
//   }
// });

// /**
//  * GET - Get scheduler status
//  */
// router.get('/status', async (req, res) => {
//   try {
//     const status = await emailScheduler.getStatus();
    
//     res.json({
//       success: true,
//       data: status
//     });

//   } catch (error) {
//     console.error('Error fetching scheduler status:', error);
//     res.status(500).json({ 
//       error: 'Failed to fetch scheduler status',
//       details: error.message 
//     });
//   }
// });

// /**
//  * POST - Manually trigger scheduler (for testing/admin)
//  */
// router.post('/trigger', async (req, res) => {
//   try {
//     await emailScheduler.processScheduledEmails();
    
//     res.json({
//       success: true,
//       message: 'Scheduler triggered successfully'
//     });

//   } catch (error) {
//     console.error('Error triggering scheduler:', error);
//     res.status(500).json({ 
//       error: 'Failed to trigger scheduler',
//       details: error.message 
//     });
//   }
// });

// module.exports = router;

