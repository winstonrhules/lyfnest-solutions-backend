// routes/userSettings.js
const express = require('express');
const router = express.Router();
const UserSettings = require('../models/userSettingModels');
// const auth = require('../middleware/auth');

// GET user settings
router.get('/',  async (req, res) => {
  try {
    let settings = await UserSettings.findOne({ userId: req.user.id });
    
    if (!settings) {
      // Create default settings if none exist
      settings = new UserSettings({
        userId: req.user.id,
        companySettings: {
          companyName: 'Lyfnest Solutions',
          schedulingLink: 'https://scheduler.zoom.us/nattye-a/discovery-and-guidance-call'
        },
        senderSettings: {
          fromName: 'Lyfnest Solutions'
        }
      });
      await settings.save();
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update user settings
router.put('/',  async (req, res) => {
      try {
    let settings = await UserSettings.findOneAndUpdate(
      { userId: req.user.id },
      req.body,
      { new: true, upsert: true, runValidators: true }
    );
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;  