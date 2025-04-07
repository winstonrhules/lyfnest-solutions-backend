const express = require('express');
const router = express.Router();
//const verificationLimiter = require('../middlewares/rateLimiter');
const {initialVerificationChecks, sendEmailVerification, verifyCode, verifyEmailCode, submissionForm, getallFforms} = require('../controllers/fformController');


router.post('/start-verification',   initialVerificationChecks);
router.post('/verify-code',   verifyCode);
router.post('/submit-form',  submissionForm);
router.get('/all-forms', getallFforms)
router.post('/send-email-verification', sendEmailVerification);
router.post('/verify-email-code', verifyEmailCode);

module.exports = router;