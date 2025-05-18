const twilio = require('twilio');
const Verification = require('../models/verificationModels');
const Iform = require('../models/iformModel');
const asyncHandler = require('express-async-handler')
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const EmailVerification = require('../models/emailVerificationsModels');

const client = twilio(
  process.env.TWILIO_SID, 
  process.env.TWILIO_AUTH_TOKEN
);


// Configure email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const initialVerificationChecks = asyncHandler (async (req, res)=>{
  try {
    const { phoneNumber } = req.body;
    
    // Validate E.164 format
    const verification = await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phoneNumber, channel: 'sms' });

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

  await transporter.sendMail({
    to: email,
    subject: 'Verify Your Email',
    text: `Lyfnest Solutions will NEVER proactively call or text you for this code.DO NOT share it.
    Your VERIFICATION CODE is: ${token}. This code is active for 10 minutes from the time of request.
    Please do not reply to this email.if you have any questions, or didn't request a code, please contact support for assistance.`
  });

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
    const { verification: verificationId, email, ...formData } = req.body;

 // Verify the verification record
  //     const verification = await Verification.findById(verificationId);
  //    if (!verification || verification.status !== 'verified') {
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
  const dobDate = new Date(year, month-1, day)

  const today = new Date();
  const cutoffDate = new Date(
  today.getFullYear() - 18,
  today.getMonth(),
  today.getDate()
);

if (dobDate > cutoffDate) {
 return res.status(400).json({ error: "You must be at least 18 years old" });
}


   const newIform = new Iform({
     ...formData,
     Dob:dobDate,
     verification: verificationId,
     verifiedAt: new Date(),
     email,
     emailVerification: emailVerification._id,
     emailVerified: true
  });

  await  newIform.save();

   // Optional: Send confirmation SMS
  //  await client.messages.create({
  //    body: 'Your insurance submission was received!',
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //    to: formData.phoneNumber,
  //  });

  res.status(201).json({ message: 'indexed Life Insurance Form Submission successful' });

 } catch (error) {
  console.error(error)
  res.status(500).json({ error: error.message });
 }

})

const getallIforms = asyncHandler(async(req, res)=>{
  try{
    const getIforms = await Iform.find()
    res.status(200).json(getIforms)
  }
  catch(error){
    throw new Error("failed to get all forms")
  }
  
})





module.exports = {initialVerificationChecks, sendEmailVerification, verifyCode, verifyEmailCode, submissionForm, getallIforms}

