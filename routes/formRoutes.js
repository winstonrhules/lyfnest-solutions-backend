const express = require('express');
const router = express.Router();
// const verificationLimiter = require('../middlewares/rateLimiter');
const {initialVerificationChecks, sendEmailVerification, verifyCode, submissionForm, verifyEmailCode, getallForms,  getAllNotifs, createNotifs, contactUserByEmail, deleteNotifs, deleteANotifs } = require('../controllers/formController');


router.post('/start-verification', initialVerificationChecks);
router.post('/verify-code',  verifyCode);
router.post('/submit-form',    submissionForm);
router.get('/all-forms', getallForms)
router.post('/send-email-verification', sendEmailVerification);
router.post('/verify-email-code',  verifyEmailCode);
router.post('/create-notifs',  createNotifs);
router.post('/contact-email', contactUserByEmail)
// router.get('/get-notifs', getNotifs)
router.get('/get-all-notifs', getAllNotifs,)
router.delete('/delete-notifs',  deleteNotifs);
router.delete('/:id', deleteANotifs)


module.exports = router;