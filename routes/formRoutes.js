const express = require('express');
const router = express.Router();
const verificationLimiter = require('../middlewares/rateLimiter');
const {initialVerificationChecks, sendEmailVerification, verifyCode, submissionForm, verifyEmailCode, getallForms, getNotifs, getAllNotifs, createNotifs, deleteNotifs, deleteANotifs } = require('../controllers/formController');


router.post('/start-verification', verificationLimiter,  initialVerificationChecks);
router.post('/verify-code',  verificationLimiter,   verifyCode);
router.post('/submit-form',  verificationLimiter,  submissionForm);
router.get('/all-forms', getallForms)
router.post('/send-email-verification',  verificationLimiter, sendEmailVerification);
router.post('/verify-email-code',  verificationLimiter, verifyEmailCode);
router.post('/create-notifs',  createNotifs);
router.get('/get-notifs', getNotifs)
router.get('/get-all-notifs', getAllNotifs,)
router.delete('/delete-notifs',  deleteNotifs);
router.delete('/:id', deleteANotifs)

module.exports = router;