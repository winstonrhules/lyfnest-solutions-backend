const express = require('express');
const router = express.Router();
//const verificationLimiter = require('../middlewares/rateLimiter');
const {initialVerificationChecks, sendEmailVerification, verifyCode, verifyEmailCode, submissionForm, getallWforms,  getAllNotifs, createNotifs, deleteNotifs, deleteANotifs} = require('../controllers/wformController');


router.post('/start-verification',   initialVerificationChecks);
router.post('/verify-code',   verifyCode);
router.post('/submit-form',  submissionForm);
router.get('/all-forms', getallWforms)
router.post('/send-email-verification', sendEmailVerification);
router.post('/verify-email-code', verifyEmailCode);
router.post('/create-notifs',  createNotifs);
// router.get('/get-notifs', getNotifs)
router.get('/get-all-notifs', getAllNotifs,)
router.delete('/delete-notifs',  deleteNotifs);
router.delete('/:id', deleteANotifs)


module.exports = router;