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

const express = require('express');
const router = express.Router();
const ScheduledEmail = require('../models/emailScheduleModels');

// GET all scheduled emails with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const scheduledEmails = await ScheduledEmail.find()
      .sort({ scheduleDateTime: 1 })
      .skip(skip)
      .limit(limit);
    
    const total = await ScheduledEmail.countDocuments();

    res.json({
      emails: scheduledEmails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching scheduled emails:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST create scheduled email
router.post('/', async (req, res) => {
  try {
    const scheduledEmail = new ScheduledEmail({
      ...req.body,
      sent: false,
      status: 'pending'
    });
    
    await scheduledEmail.save();
    
    res.status(201).json(scheduledEmail);
  } catch (error) {
    console.error('Error creating scheduled email:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PATCH update scheduled email
router.patch('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // If marking as sent, update status accordingly
    if (updateData.sent === true) {
      updateData.status = 'sent';
      updateData.sentAt = updateData.sentAt || new Date();
    }
    
    const scheduledEmail = await ScheduledEmail.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!scheduledEmail) {
      return res.status(404).json({ message: 'Scheduled email not found' });
    }
    
    res.json(scheduledEmail);
  } catch (error) {
    console.error('Error updating scheduled email:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE scheduled email
router.delete('/:id', async (req, res) => {
  try {
    const scheduledEmail = await ScheduledEmail.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    );
    
    if (!scheduledEmail) {
      return res.status(404).json({ message: 'Scheduled email not found' });
    }
    
    res.json({ message: 'Scheduled email cancelled successfully', email: scheduledEmail });
  } catch (error) {
    console.error('Error deleting scheduled email:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST trigger immediate send
router.post('/:id/send-now', async (req, res) => {
  try {
    const email = await ScheduledEmail.findById(req.params.id);
    
    if (!email) {
      return res.status(404).json({ message: 'Scheduled email not found' });
    }

    if (email.sent) {
      return res.status(400).json({ message: 'Email already sent' });
    }

    // Update schedule time to now and reset status
    email.scheduleDateTime = new Date();
    email.status = 'pending';
    email.retryCount = 0;
    
    await email.save();
    
    res.json({ 
      message: 'Email queued for immediate sending',
      email 
    });
  } catch (error) {
    console.error('Error triggering immediate send:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET scheduler status
router.get('/status/overview', async (req, res) => {
  try {
    const ScheduledEmail = mongoose.model('ScheduledEmail');
    const now = new Date();
    
    const stats = await ScheduledEmail.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          sent: [{ $match: { sent: true } }, { $count: "count" }],
          pending: [
            { 
              $match: { 
                scheduleDateTime: { $lte: now },
                sent: false,
                status: 'pending'
              } 
            }, 
            { $count: "count" }
          ],
          processing: [{ $match: { status: 'processing' } }, { $count: "count" }],
          future: [
            { 
              $match: { 
                scheduleDateTime: { $gt: now },
                sent: false
              } 
            }, 
            { $count: "count" }
          ],
          failed: [{ $match: { status: 'failed' } }, { $count: "count" }]
        }
      }
    ]);
    
    res.json(stats[0]);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;