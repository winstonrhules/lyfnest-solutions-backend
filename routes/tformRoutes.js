const express = require('express');
const router = express.Router();
//const verificationLimiter = require('../middlewares/rateLimiter');
const {initialVerificationChecks,  sendEmailVerification, verifyCode, verifyEmailCode, submissionForm, getallTforms} = require('../controllers/tformController');


router.post('/start-verification',   initialVerificationChecks);
router.post('/verify-code',   verifyCode);
router.post('/submit-form',  submissionForm);
router.get('/all-forms', getallTforms)
router.post('/send-email-verification', sendEmailVerification);
router.post('/verify-email-code', verifyEmailCode);

module.exports = router;