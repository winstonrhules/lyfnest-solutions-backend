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
const VERIFICATION_WINDOW_MINUTES = 60;
const MAX_ATTEMPTS = 3;
const CONTACT_WINDOW_START = 24; // hours
const CONTACT_WINDOW_END = 48;   // hours
const SLOT_DURATION = 30;        // minutes

// Helper functions
const generateNumericToken = () => crypto.randomInt(100000, 1000000).toString();
const isE164Format = (phone) => /^\+\d{1,3}\d{6,14}$/.test(phone);
const isValidEmail = (email) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(email);

const generatePrefillUrl = (baseUrl, appointmentId, user) => {
  try {
    const url = new URL(baseUrl);
    url.searchParams.append('appointmentId', appointmentId);
    url.searchParams.append('firstName', user.firstName);
    url.searchParams.append('lastName', user.lastName);
    url.searchParams.append('email', user.email);
    return url.toString();
  } catch (error) {
    console.error('Error generating pre-fill URL:', error);
    return baseUrl;
  }
};

const scheduleAppointment = async () => {
  try {
    const now = new Date();

    // Set a stable starting point for scheduling
    const contactWindowStart = new Date(now.getTime() + CONTACT_WINDOW_START * 60 * 60 * 1000);
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
      contactWindowStart: new Date(now.getTime() + CONTACT_WINDOW_START * 60 * 60 * 1000),
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
                   <p>We've received your information and will contact you between 24-48 hours</p>
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
              Data: `Thank you for submitting your form to LyfNest Solutions!\n\nWe've received your information and will contact you within 24-48 hours.\n\nSecurity notice: Never share personal information via email.`,
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
                    <h2 style="color: #dc3545;">NEW TERM FORM SUBMISSION</h2>
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
                Data: `New term form submission from ${formData.firstName} ${formData.lastName} (${email})\n\nReview in admin panel.`
              }
            },
            Subject: {
              Charset: "UTF-8",
              Data: "🚨 New Term Form Submission"
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
    res.status(200).json({ success: true, message: 'Form and appointment deleted successfully' });
  } catch (error) {
    console.error("Delete Form Error:", error);
    res.status(500).json({ error: 'Failed to delete form' });
  }
})

const contactUserByEmail = asyncHandler(async (req, res) => {
  try {
    const { 
      appointmentId, 
      userEmail, 
      userName, 
      subject, 
      message,
      adminName,
      contactMethod = 'email'
    } = req.body;

    // Validation
    if (!appointmentId || !userEmail || !userName) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: appointmentId, userEmail, userName' 
      });
    }

    if (!isValidEmail(userEmail)) {
      return res.status(400).json({success: false, error: 'Invalid email format' });
    }

    // ✅ FIX 1: Find the appointment and validate its current status
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    // ✅ FIX 2: Prevent sending emails to appointments that are already contacted/booked
    if (appointment.status === 'contacted' && appointment.lastContactDate) {
      const timeSinceLastContact = new Date() - new Date(appointment.lastContactDate);
      const oneHour = 60 * 60 * 1000;
      
      if (timeSinceLastContact < oneHour) {
        return res.status(400).json({ 
          success: false, 
          error: 'Scheduler link was already sent recently. Please wait before resending.' 
        });
      }
    }

    // ✅ Generate unique scheduler link with appointment-specific parameters
    const schedulerLink = generatePrefillUrl(
      process.env.ZOOM_URL, 
      appointmentId, {
       firstName: userName.split(' ')[0],
       lastName: userName.split(' ')[1] || '',
       email: userEmail,
       // ✅ Add unique identifier to prevent cross-contamination
       appointmentRef: appointmentId
     });

    // Get form details only for termForm
    let formData = null;
    if (appointment.formType === 'termForm' && appointment.formId) {
      formData = await Tform.findById(appointment.formId);
    }
    
    // Default subject and message
    const emailSubject = subject || `Schedule Your Financial Consultation - LyfNest Solutions`;
    
    const defaultMessage = `Hi ${userName},

Thank you for submitting your request! I'm following up to schedule your financial consultation.

Please use the link below to pick a time that works best for you:
${schedulerLink}

${formData ? `Based on your submitted information:
${formData.coverageAmount ? `• Coverage Amount: ${formData.coverageAmount}\n` : ''}
${formData.preferredTerm ? `• Preferred Term: ${formData.preferredTerm}\n` : ''}
` : ''}

Once you schedule your preferred time, I'll receive a notification and we'll be all set for our meeting.

Best regards,
${adminName || 'LyfNest Solutions Team'}
Email: ${process.env.SES_SENDER_EMAIL}`;

    const emailMessage = message || defaultMessage;

    // Send email with scheduler link
    const params = {
      Destination: { ToAddresses: [userEmail] },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #a4dcd7; color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                  <img src="https://res.cloudinary.com/dma2ht84k/image/upload/v1753279441/lyfnest-logo_byfywb.png" alt="LyfNest Solutions Logo" style="width: 50px; height: 50px; margin-bottom: 10px;">
                  <h2 style="margin: 0;">Schedule Your Consultation</h2>
                </div>
              
                <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
                  <div style="white-space: pre-line; line-height: 1.6; color: #333;">
                    ${emailMessage.replace(/\n/g, '<br>')}
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${schedulerLink}" 
                       style="background: #4caf50; 
                              color: white; 
                              padding: 15px 30px; 
                              text-decoration: none; 
                              border-radius: 5px;
                              font-weight: bold;
                              font-size: 16px;
                              display: inline-block;">
                      📅 Schedule My Meeting
                    </a>
                  </div>
                  
                  ${formData ? `
                  <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4caf50;">
                    <h3 style="color: #2e7d32; margin-top: 0;">Your Inquiry Details:</h3>
                    <ul style="color: #555; margin: 10px 0;">
                      ${formData.coverageAmount ? `<li><strong>Coverage Amount:</strong> ${formData.coverageAmount}</li>` : ''}
                      ${formData.preferredTerm ? `<li><strong>Preferred Term:</strong> ${formData.preferredTerm}</li>` : ''}
                      ${formData.phoneNumber ? `<li><strong>Phone:</strong> ${formData.phoneNumber}</li>` : ''}
                    </ul>
                  </div>
                  ` : ''}
                  
                  <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin-top: 20px;">
                    <p style="margin: 0; color: #1976d2; font-size: 14px;">
                      <strong>📝 Note:</strong> After you schedule, I'll receive an automatic notification with your chosen time and will prepare for our meeting accordingly.
                    </p>
                  </div>
                </div>
                
                <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
                  <p style="margin: 0; color: #666; font-size: 14px;">
                    <strong>LyfNest Solutions</strong><br>
                    Email: ${process.env.SES_SENDER_EMAIL}
                  </p>
                </div>
              </div>
            `
          },
          Text: {
            Charset: "UTF-8",
            Data: `${emailMessage}\n\nSchedule your meeting: ${schedulerLink}`
          }
        },
        Subject: {
          Charset: "UTF-8",
          Data: emailSubject
        }
      },
      Source: process.env.SES_SENDER_EMAIL
    };

    // Send the email
    let emailSent = false;
    try {
      await sesClient.send(new SendEmailCommand(params));
      console.log('✅ Email sent successfully to:', userEmail);
      emailSent = true;
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to send scheduler email',
        error: emailError.message 
      });
    }

    // ✅ FIX 3: Update appointment status to 'contacted' with precise data
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        status: 'contacted', // ✅ Ensure status is exactly 'contacted'
        lastContactDate: new Date(),
        contactMethod: contactMethod,
        contactedBy: adminName || 'Admin',
        // ✅ IMPORTANT: Don't change assignedSlot here - preserve original slot
        lastUpdated: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!updatedAppointment) {
      console.error('❌ Failed to update appointment status');
      return res.status(500).json({ 
        success: false,
        message: 'Email sent but failed to update appointment status'
      });
    }

    console.log('✅ Appointment status updated to contacted:', updatedAppointment._id);

    // ✅ FIX 4: Emit WebSocket update with precise data
    if (req.io && updatedAppointment) {
      try {
        const appointmentWithUser = await Appointment.findById(appointmentId)
          .populate('formId')
          .lean();
        
        // ✅ Add user info for frontend with fallback data
        if (appointmentWithUser.formData || appointmentWithUser.formId) {
          const formInfo = appointmentWithUser.formData || appointmentWithUser.formId;
          appointmentWithUser.user = {
            firstName: formInfo.firstName || userName.split(' ')[0] || 'N/A',
            lastName: formInfo.lastName || userName.split(' ')[1] || 'N/A',
            email: formInfo.Email || formInfo.email || userEmail || 'N/A',
            phoneNumber: formInfo.phoneNumber || 'N/A'
          };
        } else {
          // Fallback user info
          appointmentWithUser.user = {
            firstName: userName.split(' ')[0] || 'N/A',
            lastName: userName.split(' ')[1] || 'N/A',
            email: userEmail || 'N/A',
            phoneNumber: 'N/A'
          };
        }
        
        // ✅ Ensure correct status and preserve original time slot
        appointmentWithUser.status = 'contacted';
        appointmentWithUser.lastContactDate = updatedAppointment.lastContactDate;
        appointmentWithUser.contactMethod = updatedAppointment.contactMethod;
        appointmentWithUser.contactedBy = updatedAppointment.contactedBy;
        
        // ✅ Emit to all clients and admin room with specific event
        req.io.emit('updateAppointment', appointmentWithUser);
        req.io.to('admins').emit('updateAppointment', appointmentWithUser);
        console.log('✅ WebSocket update event emitted for contacted appointment:', appointmentId);
      } catch (wsError) {
        console.error('❌ WebSocket emission failed:', wsError);
        // Don't fail the request if WebSocket fails
      }
    } else {
      console.warn('⚠️  req.io is not available - WebSocket not emitted');
    }

    // ✅ FIX 5: Return success response with only contacted status data
    res.status(200).json({
      success: true,
      message: 'Scheduler link sent successfully',
      appointment: {
        _id: updatedAppointment._id,
        status: 'contacted', // ✅ Explicitly return contacted status
        lastContactDate: updatedAppointment.lastContactDate,
        contactMethod: updatedAppointment.contactMethod,
        contactedBy: updatedAppointment.contactedBy,
        assignedSlot: updatedAppointment.assignedSlot, // ✅ Original slot preserved
        formType: updatedAppointment.formType,
        formData: updatedAppointment.formData,
        user: {
          firstName: userName.split(' ')[0] || 'N/A',
          lastName: userName.split(' ')[1] || 'N/A',
          email: userEmail,
          phoneNumber: formData?.phoneNumber || 'N/A'
        }
      },
      appointmentId,
      contactMethod: 'email',
      sentAt: new Date(),
      recipient: userEmail,
      schedulerLink: schedulerLink,
      emailSent: emailSent,
      statusUpdated: true
    });

  } catch (error) {
    console.error("❌ Contact Email Error:", error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send contact email',
      error: error.message 
    });
  }
});




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

// MARK APPOINTMENTS AS MISSED (CRON JOB)
const markMissedAppointments = async () => {
  try {
    const now = new Date();
    const result = await Appointment.updateMany(
      {
        status: 'booked',
        assignedSlot: { $lt: now }
      },
      {
        $set: { status: 'missed' }
      }
    );
    console.log(`✅ Marked ${result.nModified} appointments as missed`);
    
    // Emit refresh event if any appointments were updated
    if (result.nModified > 0 && global.io) {
      global.io.emit('refreshAppointments');
    }
  } catch (error) {
    console.error('❌ Error marking missed appointments:', error);
  }
};

// Run every 30 minutes
setInterval(markMissedAppointments, 30 * 60 * 1000);

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



