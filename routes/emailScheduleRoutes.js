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
 * PUT - Update an existing scheduled email
 */
router.put('/scheduled/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const updates = req.body;
    const updated = await emailScheduler.updateEmail(jobId, updates);

    res.json({
      success: true,
      message: 'Scheduled email updated successfully',
      data: updated
    });

  } catch (error) {
    console.error('Error updating scheduled email:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.startsWith('Cannot edit')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ 
      error: 'Failed to update scheduled email',
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
    const EmailSchedule = require('../models/emailScheduleModels');
    
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