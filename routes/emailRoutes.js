// const express = require('express');
// const router = express.Router();
// const { sendEmailViaSES } = require('../utils/sesServices');

// router.post('/send-email', async (req, res) => {
//   try {
//     const result = await sendEmailViaSES(req.body);
//     res.json({ success: true, messageId: result.MessageId });
//   } catch (error) {
//     console.error('Email sending failed:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: error.message 
//     });
//   }
// });

// module.exports = router;