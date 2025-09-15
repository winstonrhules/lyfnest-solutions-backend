// // routes/scheduledEmails.js
// const express = require('express');
// const router = express.Router();
// const ScheduledEmail = require('../models/emailScheduleModels');
// // const {} = require('../middleware/auth');

// // GET all scheduled emails for user
// router.get('/',  async (req, res) => {
//   try {
//     const scheduledEmails = await ScheduledEmail.find({ userId: req.user.id })
//       .sort({ scheduleDateTime: 1 });
//     res.json(scheduledEmails);
//   } catch (error) {
//     console.error('Error fetching scheduled emails:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // POST create scheduled email
// router.post('/',  async (req, res) => {
//   try {
//     const scheduledEmail = new ScheduledEmail({
//       ...req.body,
//       userId: req.user.id
//     });
    
//     await scheduledEmail.save();
//     res.status(201).json(scheduledEmail);
//   } catch (error) {
//     console.error('Error creating scheduled email:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // PATCH update scheduled email status
// router.patch('/:id',  async (req, res) => {
//   try {
//     const scheduledEmail = await ScheduledEmail.findOneAndUpdate(
//       { _id: req.params.id, userId: req.user.id },
//       req.body,
//       { new: true }
//     );
    
//     if (!scheduledEmail) {
//       return res.status(404).json({ message: 'Scheduled email not found' });
//     }
    
//     res.json(scheduledEmail);
//   } catch (error) {
//     console.error('Error updating scheduled email:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // DELETE scheduled email
// router.delete('/:id', async (req, res) => {
//   try {
//     const scheduledEmail = await ScheduledEmail.findOneAndDelete({
//       _id: req.params.id,
//       userId: req.user.id
//     });
    
//     if (!scheduledEmail) {
//       return res.status(404).json({ message: 'Scheduled email not found' });
//     }
    
//     res.json({ message: 'Scheduled email deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting scheduled email:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// module.exports = router;



const express = require('express');
const router = express.Router();
const ScheduledEmail = require('../models/emailScheduleModels');

// GET all scheduled emails
router.get('/', async (req, res) => {
  try {
    const scheduledEmails = await ScheduledEmail.find().sort({ scheduleDateTime: 1 });
    res.json(scheduledEmails);
  } catch (error) {
    console.error('Error fetching scheduled emails:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST create scheduled email
router.post('/', async (req, res) => {
  try {
    const scheduledEmail = new ScheduledEmail(req.body);
    await scheduledEmail.save();
    res.status(201).json(scheduledEmail);
  } catch (error) {
    console.error('Error creating scheduled email:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PATCH update scheduled email status
router.patch('/:id', async (req, res) => {
  try {
    // ISSUE 1 FIX: When marking as sent, also mark as processed
    const updateData = { ...req.body };
    if (updateData.sent === true) {
      updateData.processed = true;
      updateData.sentAt = updateData.sentAt || new Date().toISOString();
    }
    
    const scheduledEmail = await ScheduledEmail.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
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
    const scheduledEmail = await ScheduledEmail.findByIdAndDelete(req.params.id);
    
    if (!scheduledEmail) {
      return res.status(404).json({ message: 'Scheduled email not found' });
    }
    
    res.json({ message: 'Scheduled email deleted successfully' });
  } catch (error) {
    console.error('Error deleting scheduled email:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ISSUE 1 FIX: New route to get pending emails for processing
router.get('/pending', async (req, res) => {
  try {
    const now = new Date();
    const pendingEmails = await ScheduledEmail.find({
      sent: false,
      processed: false,
      scheduleDateTime: { $lte: now }
    }).sort({ scheduleDateTime: 1 });
    
    res.json(pendingEmails);
  } catch (error) {
    console.error('Error fetching pending emails:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
