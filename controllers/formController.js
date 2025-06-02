const twilio = require('twilio');
const Verification = require('../models/verificationModels');
const Form = require('../models/formModels');
const asyncHandler = require('express-async-handler')
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const EmailVerification = require('../models/emailVerificationsModels');
const Notification = require('../models/notificationModels');
const User = require("../models/userModels");

const client = twilio(
  process.env.TWILIO_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  
});


const initialVerificationChecks = asyncHandler (async (req, res)=>{
  try {
    const { phoneNumber } = req.body;
    
    // Validate E.164 format
    const verification = await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phoneNumber,  channel: 'sms' });

    // Create verification record
    const newVerification = new Verification({
      phoneNumber,
      twilioSid: verification.sid,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    await newVerification.save();
    console.log("Verification record saved", newVerification)
    
    res.status(200).json({ 
      message: 'Verification code sent',
      expiresAt: newVerification.expiresAt
    });

  } catch (error) {
    console.error("database record saved", error.message)
    res.status(500).json({ error: 'Failed to start verification' });
  }
})

// Send Email Verification Code
const sendEmailVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const token = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-digit code
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  await EmailVerification.findOneAndUpdate(
    { email },
    { token, expiresAt, status: 'pending', attempts: 0 },
    { upsert: true }
  );
 try{
  await transporter.sendMail({
      to: email,
      subject: 'Verify Your Email Address',
      text: `LyfNest Solutions will NEVER proactively call or text you for this code. DO NOT share it.
      Your verification code is: ${token}
      This code is active for 10 minutes from the time of request.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a237e;">Email Verification</h2>
          <p>Your verification code is:</p>
          <div style="background: #f5f5f5; padding: 20px; font-size: 24px; letter-spacing: 2px; margin: 20px 0;">
            ${token}
          </div>
          <p style="color: #616161;">
            <strong>Important:</strong>
            <ul>
              <li>This code expires in 10 minutes</li>
              <li>Never share this code with anyone</li>
              <li>If you didn't request this code, please contact support</li>
            </ul>
          </p>
        </div>
          `
  });
 }catch(mailError){
  console.error("error sending mail", mailError)
  return res.status(500).json({ error: ' Failed to send Verification email' });
 }
  res.status(200).json({ message: 'Verification email sent', expiresAt });
});

const verifyCode = asyncHandler(async(req, res)=>{
  try {
    const { phoneNumber, code } = req.body;
    
    // Check verification attempts
    const verification = await Verification.findOne({
      phoneNumber,
      status: 'pending'
    });

    if (!verification || verification.attempts >= 3) {
      return res.status(400).json({ error: 'Invalid verification request' });
    }

    // Verify with Twilio
    const check = await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verificationChecks
      .create({ verificationSid: verification.twilioSid, code:code });

    if (check.status !== 'approved') {
      verification.attempts += 1;
      await verification.save();
      return res.status(400).json({ error: 'Invalid code' });
    }

    // Update verification status
    verification.status = 'verified';
    await verification.save();

    res.status(200).json({ 
      message: 'Verification successful',
      verificationId: verification._id 
    });

  } catch (error) {
    console.error("Verification Error", error.message)
    res.status(500).json({ error: 'Verification failed' });
  }

})  

// Verify Email Code
const verifyEmailCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const record = await EmailVerification.findOne({ email });

  if (!record || record.status !== 'pending') {
    return res.status(400).json({ error: 'Invalid request' });
  }

  if (record.attempts >= 3) {
    return res.status(400).json({ error: 'Too many attempts' });
  }

  if (record.token !== code) {
    record.attempts += 1;
    await record.save();
    return res.status(400).json({ error: 'Invalid code' });
  }

  if (new Date() > record.expiresAt) {
    return res.status(400).json({ error: 'Code expired' });
  }

  record.status = 'verified';
  await record.save();
  res.status(200).json({ message: 'Email verified' });
});


const submissionForm = asyncHandler(async(req, res)=>{

  try {
    // const {verification: verificationId, ...formData } = req.body;
    const { verification: verificationId, Email: email, ...formData } = req.body;

 // Verify the verification record
  //     const verification = await Verification.findById(verificationId);
  
  //  if (!verification || verification.status !== 'verified') {
  //    return res.status(400).json({ error: 'Verification required' });
  //  }

   const phoneVerification = await Verification.findById(verificationId);
    if (!phoneVerification || phoneVerification.status !== 'verified') {
      return res.status(400).json({ error: 'Phone verification required' });
    }
  
    const emailVerification = await EmailVerification.findOne({ 
        email,
        status: 'verified' 
      });
      if (!emailVerification) {
        return res.status(400).json({ error: 'Email verification required' });
      }
  

   // Create user submission
   const [year, month, day]= formData.Dob.split('-')
   const dobDate = new Date(year, month - 1, day)


   const today = new Date();
   const cutoffDate = new Date(
   today.getFullYear() - 18,
   today.getMonth(),
   today.getDate()
);

if (dobDate > cutoffDate) {
  return res.status(400).json({ error: "You must be at least 18 years old" });
}

   const newForm = new Form({
    ...formData,
       Dob:dobDate,
       verification: verificationId,
       verifiedAt: new Date(),
       Email:email,
       emailVerification: emailVerification._id,
       emailVerified: true
  });
 

  await newForm.save();
  try{
  await transporter.sendMail({
      to: email,
      subject: 'Form Submission Confirmation',
        text: `Thank you for submitting your form to LyfNest Solutions!\n\nWe've received your information and will contact you within 24-48 hours. Please do not reply to this automated message.\n\nIf you have urgent questions, contact support at ${process.env.SUPPORT_EMAIL}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a237e;">Submission Confirmed</h2>
        <p>Thank you for submitting your form to <strong>LyfNest Solutions</strong>!</p>
        <p>We've received your information and will contact you within 24-48 hours.</p>
        
        <div style="background:  #f5f5f5; padding: 20px; margin: 20px 0;">
          Contact our support team at <a href="mailto:${ process.env.EMAIL_USER}">${ process.env.EMAIL_USER}</a></p>
        </div>

        <p style="color: #616161;">
          <strong>Please note:</strong>
          <ul>
            <li>This is an automated message - please do not reply</li>
            <li>We'll contact you using your preferred method</li>
          </ul>
        </p>
      </div>
          `
  });
  res.status(200).json({ message: 'Confirmation email sent'});
 }catch(mailError){
  console.error("error sending mail", mailError)
  return res.status(500).json({ error: ' Failed to send Confirmation email' });
 }
 
// In your submissionForm controller (emailback.txt), modify the admin notification section:

// After user confirmation email
try {
  // Get all admin emails from DB
  const admins = await User.find({ role: "admin" }).select("email -_id");
  
  if (admins.length > 0) {
    const adminEmails = admins.map(admin => admin.email);
    
    await transporter.sendMail({
      bcc: adminEmails, // Use BCC to preserve privacy
      subject: '🚨 New Form Submission Alert',
      text: `New submission from ${formData.firstName} ${formData.lastName} (${email})\n\nReview in admin panel.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">NEW SUBMISSION ALERT</h2>
          <p><strong>User:</strong> ${formData.firstName} ${formData.lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
          
          <div style="background: #f8d7da; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;">
                 A new form submission has been received. Please review it in the admin panel.
                 style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                REVIEW SUBMISSION
              </a>
            </p>
          </div>

          <p style="color: #6c757d;">
            <strong>Quick Details:</strong>
            <ul>
              <li>Phone: ${formData.phoneNumber}</li>
               <li>Primary Goal: ${formData.primaryGoal}</li>
              <li>Requested Coverage: ${formData.coverageType.join(', ')}</li>
              <li>Submission ID: ${newForm._id}</li>
            </ul>
          </p>
        </div>
      `
    });

     res.status(200).json({ message: `Admin alerts sent to ${adminEmails.length} recipients`});
  }
} catch (adminEmailError) {
  return res.status(500).json({ error: 'Admin alerts failed', details: adminEmailError.message });
}


   // Optional: Send confirmation SMS
  //  await client.messages.create({
  //    body: 'Your insurance submission was received!',
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //    to: formData.phoneNumber,
  //  });

  res.status(201).json({ message: 'Form Submission successful' });

 } catch (error) {
  console.error(error)
  res.status(500).json({ error: error.message });
 }

})

const getallForms = asyncHandler(async(req, res)=>{
  try{
    const getForms = await Form.find()
    res.status(200).json(getForms)
  }
  catch(error){
    throw new Error("failed to get all forms")
  }
  
})

const getNotifs = asyncHandler(async(req, res)=>{
  try{
 const notifs = await Notification.find().sort({ timestamp: -1 });
  res.json(notifs);
  }
   catch(error){
    throw new Error("failed to get notifications")
  }
})
// GET all notifications
const getAllNotifs = asyncHandler(async(req, res)=>{
  try{
    const notifs = await Notification.find().sort({ timestamp: -1 });
    res.status(200).json(notifs);
  }
  catch(error){
    throw new Error("failed to get all notifications")
  }
}) 
// POST a new notification
const createNotifs = asyncHandler(async(req, res)=>{

  try {
    const newNotif = new Notification({ 
      message:req.body.message, 
      formType:req.body.formType,
      timestamp: new Date(req.body.timestamp),
      read:req.body.read||false
     });
    await newNotif.save();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("save error", err)
    res.status(500).json({ error: 'Failed to save notification', details:err.message });
  }
});

// DELETE all notifications
const deleteNotifs = asyncHandler(async(req, res)=>{
  try{
  await Notification.deleteMany({});
  res.json({ success: true });
  }catch (err) {
    console.error("save error", err)
    res.status(500).json({ error: 'Failed to clear notification', details:err.message });
  }

});

// DELETE a specific notification
const deleteANotifs = asyncHandler(async(req, res)=>{
  const { id } = req.params;
  await Notification.findByIdAndDelete(id);
  res.json({ success: true });
});


module.exports = {initialVerificationChecks, sendEmailVerification, verifyCode, verifyEmailCode, submissionForm, getallForms, getNotifs, getAllNotifs, createNotifs, deleteNotifs, deleteANotifs}
