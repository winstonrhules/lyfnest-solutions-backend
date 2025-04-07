const express = require('express');
const router = express.Router();
//const verificationLimiter = require('../middlewares/rateLimiter');
const {initialVerificationChecks, sendEmailVerification, verifyCode, verifyEmailCode, submissionForm, getallWforms} = require('../controllers/wformController');


router.post('/start-verification',   initialVerificationChecks);
router.post('/verify-code',   verifyCode);
router.post('/submit-form',  submissionForm);
router.get('/all-forms', getallWforms)
router.post('/send-email-verification', sendEmailVerification);
router.post('/verify-email-code', verifyEmailCode);


module.exports = router;