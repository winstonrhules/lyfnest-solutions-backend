const twilio = require('twilio');
const Verification = require('../models/verificationModels');
const Tform = require('../models/tformModels');
const Appointment = require('../models/appointmentModels');
const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const EmailVerification = require('../models/emailVerificationsModels');
const Notification = require('../models/notificationModels');
const User = require("../models/userModels");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { safeUniversalContactUserByEmail} = require('../utils/zoomService');

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Security constants
const VERIFICATION_EXPIRY_MINUTES = 10;
const VERIFICATION_WINDOW_MINUTES = 30;
const MAX_ATTEMPTS = 3;
const CONTACT_WINDOW_START = 2; // hours
const CONTACT_WINDOW_END = 48;   // hours
const SLOT_DURATION = 30;        // minutes

// Helper functions
const generateNumericToken = () => crypto.randomInt(100000, 1000000).toString();
const isE164Format = (phone) => /^\+\d{1,3}\d{6,14}$/.test(phone);
const isValidEmail = (email) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(email);


const scheduleAppointment = async () => {
  try {
    // Set a stable starting point for scheduling
    const now = new Date();
    const contactWindowStart = new Date(now);
     const contactWindowEnd = new Date(now.getTime() + CONTACT_WINDOW_END * 60 * 60 * 1000);
    // Query for ALL future appointments to avoid conflicts
    const existingAppointments = await Appointment.find({
      assignedSlot: { $gte: now }
    }).sort({ assignedSlot: 1 });

    const slots = [];
    let currentSlot = new Date(contactWindowStart);

    while (currentSlot < contactWindowEnd) {
      slots.push(new Date(currentSlot));
      currentSlot = new Date(currentSlot.getTime() + SLOT_DURATION * 60 * 1000);
    }

    let assignedSlot = null;

    // Find the first slot that is not taken
    for (const slot of slots) {
      const slotTaken = existingAppointments.some(app =>
        app.assignedSlot.getTime() === slot.getTime()
      );
      if (!slotTaken) {
        assignedSlot = slot;
        break;
      }
    }

    // If all slots are taken, fall back to the end of the window
    if (!assignedSlot) {
      assignedSlot = contactWindowEnd;
    }

    return {
      contactWindowStart,
      contactWindowEnd,
      assignedSlot
    };
  } catch (error) {
    console.error("Scheduling Error:", error);
    // Fallback mechanism
    const now = new Date();
    const randomOffset = Math.floor(
      Math.random() *
      (CONTACT_WINDOW_END - CONTACT_WINDOW_START) * 60 * 60 * 1000
    );
    return {
      contactWindowStart: new Date(now),
      contactWindowEnd: new Date(now.getTime() + CONTACT_WINDOW_END * 60 * 60 * 1000),
      assignedSlot: new Date(now.getTime() + CONTACT_WINDOW_START * 60 * 60 * 1000 + randomOffset)
    };
  }
};

// Phone verification initiation
const initialVerificationChecks = asyncHandler(async (req, res) => {
  try {
    const { phoneNumber, phoneType } = req.body;

    if (!['mobile', 'landline'].includes(phoneType)) {
      return res.status(400).json({ error: 'Invalid phone type' });
    }

    if (!isE164Format(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone format. Must be E.164' });
    }

    const channel = phoneType === 'landline' ? 'call' : 'sms';
    const verification = await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phoneNumber, channel });

    const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MINUTES * 60 * 1000);
    const newVerification = new Verification({
      phoneNumber,
      phoneType,
      twilioSid: verification.sid,
      expiresAt,
      attempts: 0
    });

    await newVerification.save();
    
    res.status(200).json({
      message: `Verification ${channel === 'call' ? 'call initiated' : 'SMS sent'}`,
      expiresAt
    });

  } catch (error) {
    console.error("Verification Error:", {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    
    if (error.code === 21211) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    res.status(500).json({ error: 'Failed to start verification' });
  }
});

// Email verification initiation
const sendEmailVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const token = generateNumericToken();
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MINUTES * 60 * 1000);

  await EmailVerification.findOneAndUpdate(
    { email },
    { token, expiresAt, status: 'pending', attempts: 0 },
    { upsert: true, new: true }
  );

  const params = {
    Destination: { ToAddresses: [email] },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `
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
          </div>`
        },
        Text: {
          Charset: "UTF-8",
          Data: `
          LyfNest Solutions will NEVER proactively call or text you for this code. DO NOT share it.
           Your verification code is: ${token}
          This code is active for 10 minutes from the time of request.`
        }
      },
      Subject: {
        Charset: "UTF-8",
        Data: "Verify Your Email Address"
      }
    },
    Source: process.env.SES_SENDER_EMAIL
  };

  try {
    await sesClient.send(new SendEmailCommand(params));
    res.status(200).json({ message: 'Verification email sent', expiresAt });
  } catch (error) {
    console.error('SES Error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// Phone verification code check
const verifyCode = asyncHandler(async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    const verification = await Verification.findOne({
      phoneNumber,
      status: 'pending'
    });

    if (!verification) {
      return res.status(400).json({ error: 'Verification not found' });
    }

    if (verification.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many attempts' });
    }

    if (new Date() > verification.expiresAt) {
      verification.status = 'expired';
      await verification.save();
      return res.status(400).json({ error: 'Code expired' });
    }

    const check = await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verificationChecks
      .create({ verificationSid: verification.twilioSid, code });

    if (check.status !== 'approved') {
      verification.attempts += 1;
      await verification.save();
      return res.status(400).json({ error: 'Invalid code' });
    }

    verification.status = 'verified';
    verification.verifiedAt = new Date();
    await verification.save();

    res.status(200).json({ 
      message: 'Verification successful',
      verificationId: verification._id 
    });

  } catch (error) {
    console.error("Verification Check Error:", error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Email verification code check
const verifyEmailCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const record = await EmailVerification.findOne({ email });

  if (!record || record.status !== 'pending') {
    return res.status(400).json({ error: 'Invalid request' });
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many attempts' });
  }

  if (new Date() > record.expiresAt) {
    record.status = 'expired';
    await record.save();
    return res.status(400).json({ error: 'Code expired' });
  }

  // Timing-safe comparison
  const tokenMatch = crypto.timingSafeEqual(
    Buffer.from(record.token),
    Buffer.from(code)
  );

  if (!tokenMatch) {
    record.attempts += 1;
    await record.save();
    return res.status(400).json({ error: 'Invalid code' });
  }

  record.status = 'verified';
  record.verifiedAt = new Date();
  await record.save();

  res.status(200).json({ message: 'Email verified' });
});

// FORM SUBMISSION HANDLER
const submissionForm = asyncHandler(async (req, res) => {
  try {
    // Destructure with proper field names
    const { 
      verification: verificationId, 
      Email: email, 
      ...formData 
    } = req.body;

    // Validate inputs
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!isE164Format(formData.phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone format' });
    }

    // Phone verification check
    const phoneVerification = await Verification.findById(verificationId);
    const phoneVerificationWindow = new Date(
      Date.now() - VERIFICATION_WINDOW_MINUTES * 60 * 1000
    );

    if (
      !phoneVerification ||
      phoneVerification.status !== 'verified' ||
      phoneVerification.verifiedAt < phoneVerificationWindow
    ) {
      return res.status(400).json({ error: 'Phone verification required or expired' });
    }

    const emailVerification = await EmailVerification.findOne({ email });
    if (!emailVerification) {
      return res.status(400).json({ error: 'Email verification not found' });
    }
    if (emailVerification.status !== 'verified') {
      return res.status(400).json({ error: 'Email not verified yet' });
    }
    if (emailVerification.verifiedAt < phoneVerificationWindow) {
      return res.status(400).json({ error: 'Email verification expired' });
    }

    // Age validation
    const dobDate = new Date(formData.Dob);
    if (isNaN(dobDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 18);
    if (dobDate > cutoffDate) {
      return res.status(400).json({ error: "Must be at least 18 years old" });
    }

    // Save form with proper mapping
    const newTform = new Tform({
      ...formData,
      Dob: dobDate,
      verification: verificationId,
      verifiedAt: new Date(),
      Email: email,
      emailVerification: emailVerification._id
    });

    const savedForm = await newTform.save();


    const appointmentDetails = await scheduleAppointment();
    const newAppointment = new Appointment({
      formId: savedForm._id,
      formType: 'termForm',
      formData: req.body,
      contactWindowStart: appointmentDetails.contactWindowStart,
      contactWindowEnd: appointmentDetails.contactWindowEnd,
      assignedSlot: appointmentDetails.assignedSlot,
      initialSlot: appointmentDetails.assignedSlot,
      policyType: 'Term',
      status: 'scheduled' // ✅ SET INITIAL STATUS TO SCHEDULED
    });


    const savedAppointment = await newAppointment.save();

       if (req.io) {
      const appointmentWithUser = {
        ...savedAppointment.toObject(),
        user: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: email,
          phoneNumber: formData.phoneNumber
        }
      };
            req.io.emit('newAppointment', appointmentWithUser);
      console.log('✅ WebSocket event emitted IMMEDIATELY for new appointment:', savedAppointment._id);
      
      // Also emit to a specific admin room if available
      req.io.to('admins').emit('newAppointment', appointmentWithUser);
    } else {
      console.warn('⚠️  req.io is not available - WebSocket not emitted');
    }
 

    // Send confirmation email to user
    let userEmailSent = false;
    try {
      const userParams = {
        Destination: { ToAddresses: [email] },
        Message: {
          Body: {
            Html: {
              Charset: "UTF-8",
              Data:  `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #1a237e;">Submission Confirmed</h2>
                   <p>Thank you for submitting your form to <strong>LyfNest Solutions</strong>!</p>
                   <p>We've received your information and will contact you between 24-72 hours</p>
                  <div style="background: #f5f5f5; padding: 20px; margin: 20px 0;">
                  Contact our support team at <a href="mailto:${process.env.SES_SENDER_EMAIL}">${process.env.SES_SENDER_EMAIL}</a>
                  </div>
                  <p style="color: #616161;">
                    <strong>Please note:</strong>
                    <ul>
                      <li>This is an automated message - please do not reply</li>
                      <li>We'll contact you using your preferred method</li>
                    </ul>
                  </p>
                </div>`
            },
            Text: {
              Charset: "UTF-8",
              Data: `Thank you for submitting your form to LyfNest Solutions!\n\nWe've received your information and will contact you within 24-72 hours.\n\nSecurity notice: Never share personal information via email.`,
            }
          },
          Subject: {
            Charset: "UTF-8",
            Data: "Form Submission Confirmation"
          }
        },
        Source: process.env.SES_SENDER_EMAIL
      };
      
      await sesClient.send(new SendEmailCommand(userParams));
      userEmailSent = true;
    } catch (userMailError) {
      console.error("User Email Confirmation Failed", userMailError);
    }

    // Send notification to admins
    let adminAlertSent = false;
    try {
      const admins = await User.find({ role: "admin" }).select("email");
      if (admins.length > 0) {
        const adminEmails = admins.map(admin => admin.email);
        const formattedSlot = appointmentDetails.assignedSlot.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const adminParams = {
          Destination: { 
            ToAddresses: [process.env.SES_NO_REPLY_EMAIL],
            BccAddresses: adminEmails 
          },
          Message: {
            Body: {
              Html: {
                Charset: "UTF-8",
                Data: `  
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc3545;">NEW TERM FORM SUBMISSION ALERT</h2> 
                    <p><strong>User:</strong> ${formData.firstName} ${formData.lastName}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
                                  <div style="background: #e9f7ef; padding: 15px; margin: 20px 0; border-left: 4px solid #28a745;">
                      <h3 style="color: #28a745; margin-top: 0;">Scheduled Contact Slot</h3>
                      <p style="margin: 5px 0;"><strong>Initial Time:</strong> ${formattedSlot}</p>
                      <p style="margin: 5px 0;"><strong>Contact Window:</strong><br>
                        ${appointmentDetails.contactWindowStart.toLocaleString()} to<br>
                        ${appointmentDetails.contactWindowEnd.toLocaleString()}
                      </p>
                    </div>
                    <div style="background: #f8d7da; padding: 15px; margin: 20px 0;">
                      <p style="margin: 0;">
                        A new term form submission has been received. Please review it in the admin panel.
                        <p style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                          REVIEW SUBMISSION
                        </p>
                      </p>
                    </div>
                    <p style="color: #6c757d;">
                      <strong>Quick Details:</strong>
                     <ul>
                    <li>Phone: ${formData.phoneNumber}</li>
                    <li>Preferred Term: ${formData.preferredTerm}</li>
                    <li>Coverage Amount: ${formData.coverageAmount}</li>
                    <li>Submission ID: ${newTform._id}</li>
                    <li>Appointment ID: ${newAppointment._id}</li>
                  </ul>
                    </p>
                  </div>`
              },
              Text: {
                Charset: "UTF-8",
                Data: `New Term Form submission from ${formData.firstName} ${formData.lastName} (${email})\n\nReview in admin panel.`
              }
            },
            Subject: {
              Charset: "UTF-8",
              Data: "🚨 New Term Form Submission Alert"
            }
          },
          Source: process.env.SES_SENDER_EMAIL
        };
        
        await sesClient.send(new SendEmailCommand(adminParams));
        adminAlertSent = true;
      }
    } catch (adminEmailError) {
      console.error('Admin Email failed', adminEmailError);
    }

    // Create notification
    try {
      const formattedSlot = appointmentDetails.assignedSlot.toLocaleTimeString([], {
        hour: '2-digit', 
        minute: '2-digit'
      });

      await Notification.create({
        message: `New term form submission from ${formData.firstName} ${formData.lastName} at ${formattedSlot}`,
        formType: 'termForm',
        read: false
      });
    } catch (notifError) {
      console.error("Notification Creation Failed:", notifError);
    }

        res.status(201).json({
      message: 'Term Life Insurance Form Submission Successful', 
      userEmail: userEmailSent,
      adminAlert: adminAlertSent,
      appointment: {
        id: savedAppointment._id,
        slot: appointmentDetails.assignedSlot,
        windowStart: appointmentDetails.contactWindowStart,
        windowEnd: appointmentDetails.contactWindowEnd,
        status: 'scheduled'
      },
    });

  } catch (error) {
    console.error("SUBMISSION FAILURE DETAILS:", error);
    res.status(500).json({ error: 'Form submission failed: ' + error.message }); 
  }
});


// GET all term forms
const getallTforms  = asyncHandler(async (req, res) => {
  try {
    const getTforms = await Tform.find().sort({ createdAt: -1 });
    res.status(200).json(getTforms);
  } catch (error) {
    console.error("Get Forms Error:", error);
    res.status(500).json({ error: 'Failed to retrieve forms' });
  }
});

const deleteForm = asyncHandler(async (req, res) => {
  try {
    const form = await Tform.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    
    // Delete associated appointment
    await Appointment.deleteOne({ formId: form._id });
    
    await form.remove();
    res.status(200).json({ success: true, message: 'Term Form and appointment deleted successfully' });
  } catch (error) {
    console.error("Delete Form Error:", error);
    res.status(500).json({ error: 'Failed to delete form' });
  }
})


const contactUserByEmail = asyncHandler(safeUniversalContactUserByEmail);
 

// Notification handlers
const getAllNotifs = asyncHandler(async (req, res) => {
  try {
    const notifs = await Notification.find().sort({ createdAt: -1 });
    res.status(200).json(notifs);
  } catch (error) {
    console.error("Get Notifications Error:", error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

const createNotifs = asyncHandler(async (req, res) => {
  try {
    const newNotif = await Notification.create({
      message: req.body.message,
      formType: req.body.formType,
      read: false
    });
    res.status(201).json(newNotif);
  } catch (error) {
    console.error("Create Notification Error:", error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

const deleteNotifs = asyncHandler(async (req, res) => {
  try {
    await Notification.deleteMany({});
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete Notifications Error:", error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

const deleteANotifs = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete Notification Error:", error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }   
});


module.exports = {
  initialVerificationChecks, 
  sendEmailVerification, 
  verifyCode, 
  verifyEmailCode, 
  submissionForm, 
  getallTforms, 
  deleteForm,
  getAllNotifs, 
  createNotifs, 
  deleteNotifs, 
  deleteANotifs,
  contactUserByEmail,
};







