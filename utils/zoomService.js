const axios = require('axios');
const ZoomMeeting = require('../models/zoomMeetingModels');
const Appointment = require('../models/appointmentModels');
const Notification = require('../models/notificationModels');

// Get Zoom access token
const getZoomAccessToken = async () => {
  try {
    const response = await axios.post('https://zoom.us/oauth/token', 
      `grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Zoom token error:', error.response?.data || error.message);
    throw error;
  }
};

const safeUniversalContactUserByEmail = async (req, res) => {
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

    const isValidEmail = (email) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(email);
    if (!isValidEmail(userEmail)) {
      return res.status(400).json({success: false, error: 'Invalid email format' });
    }

    // Find the appointment
    const appointment = await Appointment.findById(appointmentId).populate('formId');
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    console.log(`Processing appointment ${appointmentId} with formType: ${appointment.formType}`);

    // CREATE ZOOM MEETING when sending scheduler link
    let zoomMeetingData = null;
    let schedulerLink = process.env.ZOOM_URL; // Fallback scheduler link
    
    try {
      const accessToken = await getZoomAccessToken();
      
      // Get form type for meeting title
      const getFormTypeName = (formType) => {
        const formTypeNames = {
          'mainForm': 'General Insurance',
          'termForm': 'Term Life Insurance',
          'wholeForm': 'Whole Life Insurance',
          'indexedForm': 'Indexed Universal Life',
          'finalForm': 'Final Expense Insurance'
        };
        return formTypeNames[formType] || 'Insurance';
      };

      // Create Zoom meeting
      const meetingData = {
        topic: `${getFormTypeName(appointment.formType)} Consultation - ${userName}`,
        type: 2, // Scheduled meeting
        start_time: new Date(appointment.assignedSlot).toISOString(),
        duration: 60, // 60 minutes
        timezone: 'America/New_York',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
          approval_type: 0, // Automatically approve
          registration_type: 1, // Attendees register once
          enforce_login: false
        }
      };

      const response = await axios.post(
        'https://api.zoom.us/v2/users/me/meetings',
        meetingData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const meeting = response.data;

      // Save meeting to ZoomMeeting model
      const zoomMeeting = new ZoomMeeting({
        appointment: appointmentId,
        meetingId: meeting.id,
        joinUrl: meeting.join_url,
        startUrl: meeting.start_url || '', 
        hostEmail: meeting.host_email,
        createdAt: new Date(meeting.created_at),
        schedulerUrl: `https://scheduler.zoom.us/nattye-a/discovery-and-guidance-call?meeting_id=${meeting.id}`
      });

      await zoomMeeting.save();

      // Store Zoom data for appointment update
      zoomMeetingData = {
        id: meeting.id,
        meetingId: meeting.id,
        topic: meeting.topic,
        startTime: meeting.start_time,
        joinUrl: meeting.join_url,
        startUrl: meeting.start_url || '',
        password: meeting.password,
        schedulerUrl: zoomMeeting.schedulerUrl,
        zoomMeetingRecordId: zoomMeeting._id,
        createdAt: new Date()
      };

      // Use Zoom scheduler URL if available
      schedulerLink = zoomMeeting.schedulerUrl;

      console.log('Zoom meeting created successfully:', meeting.id);
    } catch (zoomError) {
      console.error('Failed to create Zoom meeting:', zoomError.response?.data || zoomError.message);
      // Continue without Zoom meeting - will use fallback scheduler
    }

    // SAFE form data extraction - only handle known forms, fallback gracefully
    const getFormDataSafely = () => {
      try {
        // Only handle termForm for now since we know it works
        if (appointment.formType === 'termForm' && appointment.formId) {
          return appointment.formId; // Already populated
        }
        
        // For other forms, try to get data from appointment.formData if available
        if (appointment.formData) {
          console.log('Using formData from appointment object');
          return appointment.formData;
        }
        
        // If formId exists but not populated, try to extract basic info
        if (appointment.formId) {
          console.log('Using formId data from appointment object');
          return appointment.formId;
        }
        
        console.log('No form data available, proceeding with basic email');
        return null;
      } catch (error) {
        console.error('Error getting form data:', error);
        return null;
      }
    };

    const formData = getFormDataSafely();
    console.log('Form data extracted:', formData ? 'Yes' : 'No');
    
    // SAFE content generation with fallbacks
    const generateSafeContent = (formType, formData) => {
      const baseGreeting = `Hi ${userName},\n\nThank you for submitting your request! I'm following up to schedule your consultation.`;
      
      const meetingInfo = zoomMeetingData ? 
        `Please use the link below to confirm your Zoom meeting:\n${schedulerLink}\n\nThis will be a secure Zoom meeting where we can discuss your needs in detail.` :
        `Please use the link below to pick a time that works best for you:\n${schedulerLink}`;
      
      const baseClosing = `Once you ${zoomMeetingData ? 'confirm your meeting time' : 'schedule your preferred time'}, I'll receive a notification and we'll be all set for our meeting.\n\nBest regards,\n${adminName || 'LyfNest Solutions Team'}\nEmail: ${process.env.SES_SENDER_EMAIL}`;

      // Form-specific subjects and details
      const formConfig = {
        mainForm: {
          subject: 'Schedule Your Insurance Consultation - LyfNest Solutions',
          getDetails: (data) => data ? `Based on your inquiry:\n${formData.coverageType ? `• Coverage Type: ${formData.coverageType.join(', ')}\n` : ''} ${formData.primaryGoal ? `• Primary Goal: ${formData.primaryGoal}\n` : ''}${formData.contactMethod ? `• Preferred Contact: ${formData.contactMethod}\n` : ''} ${formData.phoneNumber ? `• Phone: ${formData.phoneNumber}\n` : ''}` : ''
        },
        termForm: {
          subject: 'Schedule Your Term Life Insurance Consultation - LyfNest Solutions',
          getDetails: (data) => data ? `Based on your submitted information:\n${formData.coverageAmount ? `• Coverage Amount: ${formData.coverageAmount}\n` : ''}${formData.preferredTerm ? `• Preferred Term: ${formData.preferredTerm}\n` : ''}${formData.phoneNumber ? `• Phone: ${formData.phoneNumber}\n` : ''}` : ''
        },
        wholeForm: {
          subject: 'Schedule Your Whole Life Insurance Consultation - LyfNest Solutions',
          getDetails: (data) => data ? `Based on your inquiry:\n${formData.coverage ? `• Desired Coverage: ${formData.coverage}\n` : ''}${formData.premiumTerms ? `• Preferred Term: ${formData.premiumTerms}\n` : ''}${formData.contactMethod ? `• Preferred Contact: ${formData.contactMethod}\n` : ''} ${formData.phoneNumber ? `• Phone: ${formData.phoneNumber}\n` : ''}` : ''
        },
        indexedForm: {
          subject: 'Schedule Your Indexed Universal Life Consultation - LyfNest Solutions',
          getDetails: (data) => data ? `Based on your inquiry:\n${formData.coverage ? `• Desired Coverage: ${formData.coverage}\n` : ''}${formData.premiumTerms ? `• Preferred Term: ${formData.premiumTerms}\n` : ''}${formData.contactMethod ? `• Preferred Contact: ${formData.contactMethod}\n` : ''} ${formData.phoneNumber ? `• Phone: ${formData.phoneNumber}\n` : ''}` : ''
        },
        finalForm: {
          subject: 'Schedule Your Final Expense Insurance Consultation - LyfNest Solutions',
          getDetails: (data) => data ? `Based on your inquiry:\n ${formData.monthlyBudget ? `• Monthly Budget: $${formData.monthlyBudget}\n` : ''} ${formData.coverageAmount ? `• Coverage Amount: $${formData.coverageAmount}\n` : ''}${formData.contactMethod ? `• Preferred Contact: ${formData.contactMethod}\n` : ''}${formData.phoneNumber ? `• Phone: ${formData.phoneNumber}\n` : ''}` : ''
        }
      };

      const config = formConfig[formType] || formConfig.termForm; // Fallback to termForm
      const details = config.getDetails(formData);
      
      return {
        subject: config.subject,
        message: `${baseGreeting}\n\n${meetingInfo}\n\n${details}\n${baseClosing}`
      };
    };

    const emailContent = generateSafeContent(appointment.formType, formData);
    const emailSubject = subject || emailContent.subject;
    const emailMessage = message || emailContent.message;

    console.log('Generated email subject:', emailSubject);

    // SAFE HTML generation - NEW DESIGN
    const generateSafeHTMLContent = (formType, formData, emailMessage, schedulerLink, zoomMeetingData) => {
      // Safe form details generation
      const generateSafeFormDetailsHTML = (formType, formData) => {
        if (!formData) return '';

        try {
          const commonFields = [
            { key: 'coverageAmount', label: 'Coverage Amount', getValue: (data) => data.coverageAmount },
            { key: 'preferredTerm', label: 'Preferred Term', getValue: (data) => data.preferredTerm },
            { key: 'coverage', label: 'Coverage', getValue: (data) => data.coverage },
            { key: 'monthlyBudget', label: 'Monthly Budget', getValue: (data) => data.monthlyBudget ? `$${data.monthlyBudget}` : null },
            { key: 'premiumTerms', label: 'Premium Terms', getValue: (data) => data.premiumTerms },
            { key: 'contactMethod', label: 'Contact Method', getValue: (data) => data.contactMethod },
            { key: 'phoneNumber', label: 'Phone', getValue: (data) => data.phoneNumber },
            { key: 'coverageType', label: 'Coverage Type', getValue: (data) => data.coverageType ? data.coverageType.join(', ') : null },
            { key: 'primaryGoal', label: 'Primary Goal', getValue: (data) => data.primaryGoal }
          ];

          const validFields = commonFields
            .map(field => ({ ...field, value: field.getValue(formData) }))
            .filter(field => field.value);

          if (validFields.length === 0) return '';

          return `
            <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4caf50;">
              <h3 style="color: #2e7d32; margin-top: 0;">Your Inquiry Details:</h3>
              <ul style="color: #555; margin: 10px 0;">
                ${validFields.map(field => `<li><strong>${field.label}:</strong> ${field.value}</li>`).join('')}
              </ul>
            </div>
          `;
        } catch (error) {
          console.error('Error generating form details HTML:', error);
          return '';
        }
      };

      // Use the provided design template
      return `
        <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>LyfNest Welcome Email</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600&display=swap" rel="stylesheet" />
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #f3f7f6; color: #333;">
    <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #dcebea;">
      
      <!-- Banner with overlays -->
       <div style="background: linear-gradient(135deg, #e1f0ef 0%, #cfe6e4 100%); position: relative; padding: 20px; overflow: hidden;">

  <!-- Overlay with subtle thin gold lines -->
  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background-image: repeating-linear-gradient(45deg, rgba(212,175,55,0.25) 0px, rgba(158, 126, 22, 0.25) 1px, transparent 1px, transparent 30px);
              z-index: 1;">
  </div>
        <!-- Logo and Welcome text -->
        <img src="https://res.cloudinary.com/dma2ht84k/image/upload/v1753279441/lyfnest-logo_byfywb.png" alt="LyfNest Logo" style="width: 60px; height: auto; position: absolute; top: 20px; left: 20px; z-index: 2;">
        <h1 style="font-family: 'Poppins', sans-serif; font-size: 28px; font-weight: 600; text-align: center; margin: 0; color: #0e94d0; letter-spacing: 1.5px; position: relative; z-index: 2;">WELCOME!</h1>
      </div>

      <div style="padding: 30px; font-size: 16px; line-height: 1.6; color: #2f4f4f;">
              <p>Hi ${userName},</p>
              <p>Thanks for submitting your request on our website! I'm following up as promised to schedule your Zoom call to review your request. Please use the link below to pick a time that works best for you:</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${schedulerLink}" style="background-color: #34a853; color: #ffffff; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 8px; text-decoration: none; display: inline-block; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
                  ${zoomMeetingData ? 'Confirm Zoom Meeting' : 'Schedule Meeting'}
                </a>
              </div>

              ${generateSafeFormDetailsHTML(formType, formData)}

              ${zoomMeetingData ? `
              <div style="background: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2196f3;">
                <h3 style="color: #1976d2; margin-top: 0;">Zoom Meeting Details:</h3>
                <ul style="color: #555; margin: 10px 0;">
                  <li><strong>Meeting ID:</strong> ${zoomMeetingData.meetingId}</li>
                  <li><strong>Scheduled Time:</strong> ${new Date(appointment.assignedSlot).toLocaleString()}</li>
                </ul>
              </div>
              ` : ''}

              <p>Best regards,<br/>
              ${adminName || 'LyfNest Solutions Team'}<br/>
              <a href="mailto:${process.env.SES_SENDER_EMAIL}" style="color: #1a73e8; text-decoration: none;">${process.env.SES_SENDER_EMAIL}</a></p>
            </div>

            <div style="background-color: #f0f5f4; text-align: center; padding: 20px; font-size: 14px; color: #666;">
              LyfNest Solutions<br/>
              Email: <a href="mailto:${process.env.SES_SENDER_EMAIL}" style="color: #339989; text-decoration: none;">${process.env.SES_SENDER_EMAIL}</a>
            </div>
          </div>
        </body>
        </html>
      `;
    };

    // Send email (using your existing SES setup)
    const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
    
    const sesClient = new SESClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const params = {
      Destination: { ToAddresses: [userEmail] },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: generateSafeHTMLContent(appointment.formType, formData, emailMessage, schedulerLink, zoomMeetingData)
          },
          Text: {
            Charset: "UTF-8",
            Data: `${emailMessage}\n\n${zoomMeetingData ? 'Confirm meeting' : 'Schedule your meeting'}: ${schedulerLink}`
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
      console.log('Email sent successfully to:', userEmail);
      emailSent = true;
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to send scheduler email',
        error: emailError.message 
      });
    }

    // Update appointment with contacted status and Zoom data
    const updateData = {
      status: 'contacted',
      lastContactDate: new Date(),
      contactMethod: contactMethod,
      contactedBy: adminName || 'Admin'
    };

    if (zoomMeetingData) {
      updateData.zoomMeeting = zoomMeetingData;
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      updateData,
      { new: true }
    ).populate('formId').lean();

    // Enrich with user data for WebSocket
    let userData = {
      firstName: userName.split(' ')[0] || 'Unknown',
      lastName: userName.split(' ')[1] || 'User',
      email: userEmail,
      phoneNumber: formData?.phoneNumber || 'N/A'
    };

    if (updatedAppointment.formData) {
      userData = {
        firstName: updatedAppointment.formData.firstName || userData.firstName,
        lastName: updatedAppointment.formData.lastName || userData.lastName,
        email: updatedAppointment.formData.Email || updatedAppointment.formData.email || userData.email,
        phoneNumber: updatedAppointment.formData.phoneNumber || userData.phoneNumber
      };
    } else if (updatedAppointment.formId) {
      userData = {
        firstName: updatedAppointment.formId.firstName || userData.firstName,
        lastName: updatedAppointment.formId.lastName || userData.lastName,
        email: updatedAppointment.formId.Email || updatedAppointment.formId.email || userData.email,
        phoneNumber: updatedAppointment.formId.phoneNumber || userData.phoneNumber
      };
    }

    const appointmentWithUser = {
      ...updatedAppointment,
      user: userData
    };

    // EMIT WEBSOCKET UPDATE EVENT IMMEDIATELY
    if (req.io) {
      try {
        req.io.emit('updateAppointment', appointmentWithUser);
        req.io.to('admins').emit('updateAppointment', appointmentWithUser);
        console.log('WebSocket update event emitted for appointment:', appointmentId);
      } catch (wsError) {
        console.error('WebSocket emission failed:', wsError);
      }
    }

    res.status(200).json({
      success: true,
      message: zoomMeetingData ? 'Zoom meeting created and scheduler link sent successfully' : 'Scheduler link sent successfully',
      appointment: appointmentWithUser,
      zoomMeeting: zoomMeetingData,
      appointmentId,
      contactMethod: 'email',
      sentAt: new Date(),
      recipient: userEmail,
      schedulerLink: schedulerLink,
      emailSent: emailSent,
      statusUpdated: true
    });

  } catch (error) {
    console.error("Safe Universal Contact Email Error:", error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send contact email',
      error: error.message 
    });
  }
};

// Safe universal enhanced contact user function with proper error handling
// const safeUniversalContactUserByEmail = async (req, res) => {
//   try {
//     const { 
//       appointmentId, 
//       userEmail, 
//       userName, 
//       subject, 
//       message,
//       adminName,
//       contactMethod = 'email'
//     } = req.body;

//     // Validation
//     if (!appointmentId || !userEmail || !userName) {
//       return res.status(400).json({ 
//         success: false,
//         error: 'Missing required fields: appointmentId, userEmail, userName' 
//       });
//     }

//     const isValidEmail = (email) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(email);
//     if (!isValidEmail(userEmail)) {
//       return res.status(400).json({success: false, error: 'Invalid email format' });
//     }

//     // Find the appointment
//     const appointment = await Appointment.findById(appointmentId).populate('formId');
//     if (!appointment) {
//       return res.status(404).json({ success: false, error: 'Appointment not found' });
//     }

//     console.log(`Processing appointment ${appointmentId} with formType: ${appointment.formType}`);

//     // CREATE ZOOM MEETING when sending scheduler link
//     let zoomMeetingData = null;
//     let schedulerLink = process.env.ZOOM_URL; // Fallback scheduler link
    
//     try {
//       const accessToken = await getZoomAccessToken();
      
//       // Get form type for meeting title
//       const getFormTypeName = (formType) => {
//         const formTypeNames = {
//           'mainForm': 'General Insurance',
//           'termForm': 'Term Life Insurance',
//           'wholeForm': 'Whole Life Insurance',
//           'indexedForm': 'Indexed Universal Life',
//           'finalForm': 'Final Expense Insurance'
//         };
//         return formTypeNames[formType] || 'Insurance';
//       };

//       // Create Zoom meeting
//       const meetingData = {
//         topic: `${getFormTypeName(appointment.formType)} Consultation - ${userName}`,
//         type: 2, // Scheduled meeting
//         start_time: new Date(appointment.assignedSlot).toISOString(),
//         duration: 60, // 60 minutes
//         timezone: 'America/New_York',
//         settings: {
//           host_video: true,
//           participant_video: true,
//           join_before_host: false,
//           mute_upon_entry: true,
//           waiting_room: true,
//           approval_type: 0, // Automatically approve
//           registration_type: 1, // Attendees register once
//           enforce_login: false
//         }
//       };

//       const response = await axios.post(
//         'https://api.zoom.us/v2/users/me/meetings',
//         meetingData,
//         {
//           headers: {
//             'Authorization': `Bearer ${accessToken}`,
//             'Content-Type': 'application/json'
//           }
//         }
//       );

//       const meeting = response.data;

//       // Save meeting to ZoomMeeting model
//       const zoomMeeting = new ZoomMeeting({
//         appointment: appointmentId,
//         meetingId: meeting.id,
//         joinUrl: meeting.join_url,
//         startUrl: meeting.start_url || '',
//         hostEmail: meeting.host_email,
//         createdAt: new Date(meeting.created_at),
//         schedulerUrl: `https://scheduler.zoom.us/nattye-a/discovery-and-guidance-call?meeting_id=${meeting.id}`
//       });

//       await zoomMeeting.save();

//       // Store Zoom data for appointment update
//       zoomMeetingData = {
//         id: meeting.id,
//         meetingId: meeting.id,
//         topic: meeting.topic,
//         startTime: meeting.start_time,
//         joinUrl: meeting.join_url,
//         startUrl: meeting.start_url || '',
//         password: meeting.password,
//         schedulerUrl: zoomMeeting.schedulerUrl,
//         zoomMeetingRecordId: zoomMeeting._id,
//         createdAt: new Date()
//       };

//       // Use Zoom scheduler URL if available
//       schedulerLink = zoomMeeting.schedulerUrl;

//       console.log('Zoom meeting created successfully:', meeting.id);
//     } catch (zoomError) {
//       console.error('Failed to create Zoom meeting:', zoomError.response?.data || zoomError.message);
//       // Continue without Zoom meeting - will use fallback scheduler
//     }

//     // SAFE form data extraction - only handle known forms, fallback gracefully
//     const getFormDataSafely = () => {
//       try {
//         // Only handle termForm for now since we know it works
//         if (appointment.formType === 'termForm' && appointment.formId) {
//           return appointment.formId; // Already populated
//         }
        
//         // For other forms, try to get data from appointment.formData if available
//         if (appointment.formData) {
//           console.log('Using formData from appointment object');
//           return appointment.formData;
//         }
        
//         // If formId exists but not populated, try to extract basic info
//         if (appointment.formId) {
//           console.log('Using formId data from appointment object');
//           return appointment.formId;
//         }
        
//         console.log('No form data available, proceeding with basic email');
//         return null;
//       } catch (error) {
//         console.error('Error getting form data:', error);
//         return null;
//       }
//     };

//     const formData = getFormDataSafely();
//     console.log('Form data extracted:', formData ? 'Yes' : 'No');
    
//     // SAFE content generation with fallbacks
//     const generateSafeContent = (formType, formData) => {
//       const baseGreeting = `Hi ${userName},\n\nThank you for submitting your request! I'm following up to schedule your consultation.`;
      
//       const meetingInfo = zoomMeetingData ? 
//         `Please use the link below to confirm your Zoom meeting:\n${schedulerLink}\n\nThis will be a secure Zoom meeting where we can discuss your needs in detail.` :
//         `Please use the link below to pick a time that works best for you:\n${schedulerLink}`;
      
//       const baseClosing = `Once you ${zoomMeetingData ? 'confirm your meeting time' : 'schedule your preferred time'}, I'll receive a notification and we'll be all set for our meeting.\n\nBest regards,\n${adminName || 'LyfNest Solutions Team'}\nEmail: ${process.env.SES_SENDER_EMAIL}`;

//       // Form-specific subjects and details
//       const formConfig = {
//         mainForm: {
//           subject: 'Schedule Your Insurance Consultation - LyfNest Solutions',
//           getDetails: (data) => data ? `Based on your inquiry:\n${formData.coverageType ? `• Coverage Type: ${formData.coverageType.join(', ')}\n` : ''} ${formData.primaryGoal ? `• Primary Goal: ${formData.primaryGoal}\n` : ''}${formData.contactMethod ? `• Preferred Contact: ${formData.contactMethod}\n` : ''} ${formData.phoneNumber ? `• Phone: ${formData.phoneNumber}\n` : ''}` : ''
//         },
//         termForm: {
//           subject: 'Schedule Your Term Life Insurance Consultation - LyfNest Solutions',
//           getDetails: (data) => data ? `Based on your submitted information:\n${formData.coverageAmount ? `• Coverage Amount: ${formData.coverageAmount}\n` : ''}${formData.preferredTerm ? `• Preferred Term: ${formData.preferredTerm}\n` : ''}${formData.phoneNumber ? `• Phone: ${formData.phoneNumber}\n` : ''}` : ''
//         },
//         wholeForm: {
//           subject: 'Schedule Your Whole Life Insurance Consultation - LyfNest Solutions',
//           getDetails: (data) => data ? `Based on your inquiry:\n${formData.coverage ? `• Desired Coverage: ${formData.coverage}\n` : ''}${formData.premiumTerms ? `• Preferred Term: ${formData.premiumTerms}\n` : ''}${formData.contactMethod ? `• Preferred Contact: ${formData.contactMethod}\n` : ''} ${formData.phoneNumber ? `• Phone: ${formData.phoneNumber}\n` : ''}` : ''
//         },
//         indexedForm: {
//           subject: 'Schedule Your Indexed Universal Life Consultation - LyfNest Solutions',
//           getDetails: (data) => data ? `Based on your inquiry:\n${formData.coverage ? `• Desired Coverage: ${formData.coverage}\n` : ''}${formData.premiumTerms ? `• Preferred Term: ${formData.premiumTerms}\n` : ''}${formData.contactMethod ? `• Preferred Contact: ${formData.contactMethod}\n` : ''} ${formData.phoneNumber ? `• Phone: ${formData.phoneNumber}\n` : ''}` : ''
//         },
//         finalForm: {
//           subject: 'Schedule Your Final Expense Insurance Consultation - LyfNest Solutions',
//           getDetails: (data) => data ? `Based on your inquiry:\n ${formData.monthlyBudget ? `• Monthly Budget: $${formData.monthlyBudget}\n` : ''} ${formData.coverageAmount ? `• Coverage Amount: $${formData.coverageAmount}\n` : ''}${formData.contactMethod ? `• Preferred Contact: ${formData.contactMethod}\n` : ''}${formData.phoneNumber ? `• Phone: ${formData.phoneNumber}\n` : ''}` : ''
//         }
//       };


//       const config = formConfig[formType] || formConfig.termForm; // Fallback to termForm
//       const details = config.getDetails(formData);
      
//       return {
//         subject: config.subject,
//         message: `${baseGreeting}\n\n${meetingInfo}\n\n${details}\n${baseClosing}`
//       };
//     };

//     const emailContent = generateSafeContent(appointment.formType, formData);
//     const emailSubject = subject || emailContent.subject;
//     const emailMessage = message || emailContent.message;

//     console.log('Generated email subject:', emailSubject);

//     // SAFE HTML generation
//     const generateSafeHTMLContent = (formType, formData, emailMessage, schedulerLink, zoomMeetingData) => {
//       const getFormTypeDisplayName = (formType) => {
//         const names = {
//           'mainForm': 'Insurance Consultation',
//           'termForm': 'Term Life Insurance Consultation',
//           'wholeForm': 'Whole Life Insurance Consultation',
//           'indexedForm': 'Indexed Universal Life Consultation',
//           'finalForm': 'Final Expense Insurance Consultation'
//         };
//         return names[formType] || 'Insurance Consultation';
//       };

//       // Safe form details generation
//       const generateSafeFormDetailsHTML = (formType, formData) => {
//         if (!formData) return '';

//         try {
//           const commonFields = [
//             { key: 'coverageAmount', label: 'Coverage Amount', getValue: (data) => data.coverageAmount },
//             { key: 'preferredTerm', label: 'Preferred Term', getValue: (data) => data.preferredTerm },
//             { key: 'coverage', label: 'Coverage', getValue: (data) => data.coverage },
//             { key: 'monthlyBudget', label: 'Monthly Budget', getValue: (data) => data.monthlyBudget ? `$${data.monthlyBudget}` : null },
//             { key: 'premiumTerms', label: 'Premium Terms', getValue: (data) => data.premiumTerms },
//             { key: 'contactMethod', label: 'Contact Method', getValue: (data) => data.contactMethod },
//             { key: 'phoneNumber', label: 'Phone', getValue: (data) => data.phoneNumber },
//             { key: 'coverageType', label: 'Coverage Type', getValue: (data) =>  data.coverageType.join(', ') }
//             ];

        
//           const validFields = commonFields
//             .map(field => ({ ...field, value: field.getValue(formData) }))
//             .filter(field => field.value);

//           if (validFields.length === 0) return '';

//           return `
//             <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4caf50;">
//               <h3 style="color: #2e7d32; margin-top: 0;">Your Inquiry Details:</h3>
//               <ul style="color: #555; margin: 10px 0;">
//                 ${validFields.map(field => `<li><strong>${field.label}:</strong> ${field.value}</li>`).join('')}
//               </ul>
//             </div>
//           `;
//         } catch (error) {
//           console.error('Error generating form details HTML:', error);
//           return '';
//         }
//       };

//       return `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//           <div style="background: #a4dcd7; color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
//             <img src="https://res.cloudinary.com/dma2ht84k/image/upload/v1753279441/lyfnest-logo_byfywb.png" alt="LyfNest Solutions Logo" style="width: 50px; height: 50px; margin-bottom: 10px;">
//             <h2 style="margin: 0;">${zoomMeetingData ? 'Confirm Your Zoom Consultation' : 'Schedule Your Consultation'}</h2>
//             <p style="margin: 5px 0 0 0; opacity: 0.9;">${getFormTypeDisplayName(formType)}</p>
//           </div>
        
//           <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
//             <div style="white-space: pre-line; line-height: 1.6; color: #333;">
//               ${emailMessage.replace(/\n/g, '<br>')}
//             </div>
            
//             <div style="text-align: center; margin: 30px 0;">
//               <a href="${schedulerLink}" 
//                  style="background: ${zoomMeetingData ? '#0070f3' : '#4caf50'}; 
//                         color: white; 
//                         padding: 15px 30px; 
//                         text-decoration: none; 
//                         border-radius: 5px;
//                         font-weight: bold;
//                         font-size: 16px;
//                         display: inline-block;">
//                 ${zoomMeetingData ? 'Confirm Zoom Meeting' : 'Schedule My Meeting'}
//               </a>
//             </div>
            
//             ${zoomMeetingData ? `
//             <div style="background: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2196f3;">
//               <h3 style="color: #1976d2; margin-top: 0;">Zoom Meeting Details:</h3>
//               <ul style="color: #555; margin: 10px 0;">
//                 <li><strong>Meeting ID:</strong> ${zoomMeetingData.meetingId}</li>
//                 <li><strong>Scheduled Time:</strong> ${new Date(appointment.assignedSlot).toLocaleString()}</li>
//               </ul>
//             </div>
//             ` : ''}
            
//             ${generateSafeFormDetailsHTML(formType, formData)}
//           </div>
          
//           <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
//             <p style="margin: 0; color: #666; font-size: 14px;">
//               <strong>LyfNest Solutions</strong><br>
//               Email: ${process.env.SES_SENDER_EMAIL}
//             </p>
//           </div>
//         </div>
//       `;
//     };

//     // Send email (using your existing SES setup)
//     const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
    
//     const sesClient = new SESClient({
//       region: process.env.AWS_REGION,
//       credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
//       }
//     });

//     const params = {
//       Destination: { ToAddresses: [userEmail] },
//       Message: {
//         Body: {
//           Html: {
//             Charset: "UTF-8",
//             Data: generateSafeHTMLContent(appointment.formType, formData, emailMessage, schedulerLink, zoomMeetingData)
//           },
//           Text: {
//             Charset: "UTF-8",
//             Data: `${emailMessage}\n\n${zoomMeetingData ? 'Confirm meeting' : 'Schedule your meeting'}: ${schedulerLink}`
//           }
//         },
//         Subject: {
//           Charset: "UTF-8",
//           Data: emailSubject
//         }
//       },
//       Source: process.env.SES_SENDER_EMAIL
//     };

//     // Send the email
//     let emailSent = false;
//     try {
//       await sesClient.send(new SendEmailCommand(params));
//       console.log('Email sent successfully to:', userEmail);
//       emailSent = true;
//     } catch (emailError) {
//       console.error('Email sending failed:', emailError);
//       return res.status(500).json({ 
//         success: false,
//         message: 'Failed to send scheduler email',
//         error: emailError.message 
//       });
//     }

//     // Update appointment with contacted status and Zoom data
//     const updateData = {
//       status: 'contacted',
//       lastContactDate: new Date(),
//       contactMethod: contactMethod,
//       contactedBy: adminName || 'Admin'
//     };

//     if (zoomMeetingData) {
//       updateData.zoomMeeting = zoomMeetingData;
//     }

//     const updatedAppointment = await Appointment.findByIdAndUpdate(
//       appointmentId,
//       updateData,
//       { new: true }
//     ).populate('formId').lean();

//     // Enrich with user data for WebSocket
//     let userData = {
//       firstName: userName.split(' ')[0] || 'Unknown',
//       lastName: userName.split(' ')[1] || 'User',
//       email: userEmail,
//       phoneNumber: formData?.phoneNumber || 'N/A'
//     };

//     if (updatedAppointment.formData) {
//       userData = {
//         firstName: updatedAppointment.formData.firstName || userData.firstName,
//         lastName: updatedAppointment.formData.lastName || userData.lastName,
//         email: updatedAppointment.formData.Email || updatedAppointment.formData.email || userData.email,
//         phoneNumber: updatedAppointment.formData.phoneNumber || userData.phoneNumber
//       };
//     } else if (updatedAppointment.formId) {
//       userData = {
//         firstName: updatedAppointment.formId.firstName || userData.firstName,
//         lastName: updatedAppointment.formId.lastName || userData.lastName,
//         email: updatedAppointment.formId.Email || updatedAppointment.formId.email || userData.email,
//         phoneNumber: updatedAppointment.formId.phoneNumber || userData.phoneNumber
//       };
//     }

//     const appointmentWithUser = {
//       ...updatedAppointment,
//       user: userData
//     };

//     // EMIT WEBSOCKET UPDATE EVENT IMMEDIATELY
//     if (req.io) {
//       try {
//         req.io.emit('updateAppointment', appointmentWithUser);
//         req.io.to('admins').emit('updateAppointment', appointmentWithUser);
//         console.log('WebSocket update event emitted for appointment:', appointmentId);
//       } catch (wsError) {
//         console.error('WebSocket emission failed:', wsError);
//       }
//     }

//     res.status(200).json({
//       success: true,
//       message: zoomMeetingData ? 'Zoom meeting created and scheduler link sent successfully' : 'Scheduler link sent successfully',
//       appointment: appointmentWithUser,
//       zoomMeeting: zoomMeetingData,
//       appointmentId,
//       contactMethod: 'email',
//       sentAt: new Date(),
//       recipient: userEmail,
//       schedulerLink: schedulerLink,
//       emailSent: emailSent,
//       statusUpdated: true
//     });

//   } catch (error) {
//     console.error("Safe Universal Contact Email Error:", error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Failed to send contact email',
//       error: error.message 
//     });
//   }
// };


// Enhanced syncZoomMeetings with meeting completion detection
const syncZoomMeetingsWithCompletion = async () => {
  try {
    console.log('Starting enhanced Zoom meeting sync with completion detection...');
    const accessToken = await getZoomAccessToken();
    
    // Get both upcoming and past meetings
    const [upcomingResponse, pastResponse] = await Promise.all([
      axios.get(
        'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=300',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ),
      axios.get(
        'https://api.zoom.us/v2/users/me/meetings?type=previous_meetings&page_size=300',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    ]);

    const upcomingMeetings = upcomingResponse.data.meetings || [];
    const pastMeetings = pastResponse.data.meetings || [];
    
    console.log(`Found ${upcomingMeetings.length} upcoming meetings and ${pastMeetings.length} past meetings`);

    // Process upcoming meetings (existing logic for booking detection)
    await processUpcomingMeetings(upcomingMeetings, accessToken);
    
    // Process past meetings (new logic for completion/missed detection)
    await processPastMeetings(pastMeetings, accessToken);

    console.log('Enhanced Zoom sync with completion detection completed successfully');
    
  } catch (error) {
    console.error('Enhanced Zoom sync error:', error.response?.data || error.message);
    throw error;
  }
};

// Process upcoming meetings (your existing logic)
const processUpcomingMeetings = async (meetings, accessToken) => {
  for (const meeting of meetings) {
    try {
      const meetingStartTime = new Date(meeting.start_time);
      if (isNaN(meetingStartTime.getTime())) continue;

      const meetingDuration = meeting.duration || 60;
      const meetingEndTime = new Date(meetingStartTime.getTime() + (meetingDuration * 60000));

      // Check if this meeting is already processed
      let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
      
      if (existingZoomMeeting) {
        // Handle existing meeting updates (time changes, etc.)
        const appointment = await Appointment.findById(existingZoomMeeting.appointment).populate('formId');
        
        if (appointment) {
          const timeChanged = appointment.assignedSlot.getTime() !== meetingStartTime.getTime();
          
          let updateData = { lastUpdated: new Date() };
          
          if (timeChanged) {
            updateData.assignedSlot = meetingStartTime;
            updateData.contactWindowStart = meetingStartTime;
            updateData.contactWindowEnd = meetingEndTime;
            console.log(`Time changed for appointment ${appointment._id}: ${appointment.assignedSlot} -> ${meetingStartTime}`);
          }
          
          // Update status from contacted to booked if needed
          if (appointment.status === 'contacted') {
            updateData.status = 'booked';
            updateData.customerBookedAt = new Date();
          }
          
          if (Object.keys(updateData).length > 1) {
            const updatedAppointment = await Appointment.findByIdAndUpdate(
              appointment._id,
              updateData,
              { runValidators: true, new: true }
            ).populate('formId').lean();
    
            // EMIT WEBSOCKET UPDATE
            if (global.io && updatedAppointment) {
              const appointmentWithUser = await enrichAppointmentWithUser(updatedAppointment);
              global.io.emit('updateAppointment', appointmentWithUser);
              console.log(`WebSocket update emitted for existing appointment: ${appointment._id}`);
            }
          }
        }
        continue;
      }

      // NEW MEETING - Handle new bookings (your existing matching logic)
      console.log(`Processing new upcoming meeting: ${meeting.id} - "${meeting.topic}" at ${meetingStartTime.toISOString()}`);
      
      const availableAppointments = await Appointment.find({
        status: 'contacted',
        'zoomMeeting.meetingId': { $exists: false },
        lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).populate('formId').sort({ lastContactDate: -1 });

      if (availableAppointments.length === 0) {
        console.log(`No available appointments for meeting ${meeting.id}`);
        continue;
      }

      let matchedAppointment = null;
      let matchReason = 'none';

      // Your existing matching logic
      if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
        const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim().toLowerCase();
        
        matchedAppointment = availableAppointments.find(app => {
          const userData = app.formData || app.formId || {};
          const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim().toLowerCase();
          return fullName === nameFromTopic;
        });
        
        if (matchedAppointment) {
          matchReason = `exact name match: "${nameFromTopic}"`;
        }
      }

      if (!matchedAppointment && meeting.topic) {
        const topicLower = meeting.topic.toLowerCase();
        
        matchedAppointment = availableAppointments.find(app => {
          const userData = app.formData || app.formId || {};
          const firstName = (userData.firstName || '').toLowerCase();
          const lastName = (userData.lastName || '').toLowerCase();
          
          return firstName.length >= 3 && lastName.length >= 3 &&
                 topicLower.includes(firstName) && topicLower.includes(lastName);
        });
        
        if (matchedAppointment) {
          const userData = matchedAppointment.formData || matchedAppointment.formId || {};
          matchReason = `both names match: ${userData.firstName} ${userData.lastName}`;
        }
      }

      if (!matchedAppointment && availableAppointments.length === 1) {
        const singleApp = availableAppointments[0];
        const appDate = new Date(singleApp.assignedSlot);
        const meetingDate = new Date(meetingStartTime);
        
        const sameDay = appDate.getDate() === meetingDate.getDate() &&
                        appDate.getMonth() === meetingDate.getMonth() &&
                        appDate.getFullYear() === meetingDate.getFullYear();
        
        if (sameDay) {
          matchedAppointment = singleApp;
          matchReason = 'single appointment same day';
        }
      }

      if (matchedAppointment) {
        console.log(`Matched appointment ${matchedAppointment._id} with upcoming meeting ${meeting.id} - Reason: ${matchReason}`);
        
        // Create ZoomMeeting record
        const newZoomMeeting = new ZoomMeeting({
          appointment: matchedAppointment._id,
          meetingId: meeting.id,
          joinUrl: meeting.join_url,
          startUrl: meeting.start_url || '',
          hostEmail: meeting.host_email,
          createdAt: new Date(meeting.created_at) || new Date(),
          syncedAt: new Date()
        });

        await newZoomMeeting.save();
        
        // Update appointment to booked status
        const updatedAppointment = await Appointment.findByIdAndUpdate(
          matchedAppointment._id,
          {
            ...(Math.abs(new Date(matchedAppointment.assignedSlot).getTime() - meetingStartTime.getTime()) > 30 * 60 * 1000 ? {
              assignedSlot: meetingStartTime,
              contactWindowStart: meetingStartTime,
              contactWindowEnd: meetingEndTime
            } : {}),
            status: 'booked',
            customerBookedAt: new Date(),
            zoomMeeting: {
              id: meeting.id,
              meetingId: meeting.id,
              topic: meeting.topic,
              joinUrl: meeting.join_url,
              startUrl: meeting.start_url || '',
              zoomMeetingRecordId: newZoomMeeting._id,
              createdAt: new Date()
            },
            lastUpdated: new Date()
          },
          { runValidators: true, new: true }
        ).populate('formId').lean();

        // EMIT WEBSOCKET UPDATE FOR NEW BOOKING
        if (global.io && updatedAppointment) {
          const appointmentWithUser = await enrichAppointmentWithUser(updatedAppointment);
          global.io.emit('updateAppointment', appointmentWithUser);
          console.log(`WebSocket update emitted for new booking: ${matchedAppointment._id}`);
        }
      }

    } catch (meetingError) {
      console.error(`Error processing upcoming meeting ${meeting.id}:`, meetingError.message);
    }
  }
};

const processPastMeetings = async (pastMeetings, accessToken) => {
  console.log('Processing past meetings for completion detection...');

  for (const meeting of pastMeetings) {
    try {
      const meetingStartTime = new Date(meeting.start_time);
      if (isNaN(meetingStartTime.getTime())) continue;

      // Only process meetings from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (meetingStartTime < sevenDaysAgo) continue;

      // Find our stored ZoomMeeting by numeric meeting.id (your existing schema)
      const zoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
      if (!zoomMeeting) continue;

      const appointment = await Appointment.findById(zoomMeeting.appointment).populate('formId');
      if (!appointment) continue;

      // Skip if already finalized
      if (['completed', 'missed'].includes(appointment.status)) continue;

      console.log(`Checking past meeting ${meeting.id} for appointment ${appointment._id}`);

      // Prefer UUID for Zoom "past_meetings" endpoints; encode slashes if present
      const rawUUID = (meeting.uuid ?? meeting.id ?? '').toString();
      const meetingUUID = encodeURIComponent(rawUUID);

      let participants = [];
      let actualDuration = 0; // minutes of the *actual* past meeting, not scheduled duration
      let waitingFlag = false;

      // 1) Try to fetch past meeting details to get the *actual* duration
      try {
        const detailsResp = await axios.get(
          `https://api.zoom.us/v2/past_meetings/${meetingUUID}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (typeof detailsResp.data?.duration === 'number') {
          actualDuration = detailsResp.data.duration;
        }
        // Some payloads may include a status; if it's "waiting", the meeting never started
        if (typeof detailsResp.data?.status === 'string' && detailsResp.data.status.toLowerCase() === 'waiting') {
          waitingFlag = true;
        }
        // If API didn’t return duration, fall back to list item (may be scheduled duration)
        if (!actualDuration && typeof meeting.duration === 'number') {
          actualDuration = meeting.duration;
        }
      } catch (err) {
        console.warn(`Past meeting details unavailable for ${meeting.id} (${err.response?.status}: ${err.response?.data?.message || err.message})`);
        // Fall back to the list's duration if present (note: may just be scheduled duration)
        if (typeof meeting.duration === 'number') {
          actualDuration = meeting.duration;
        }
      }

      // 2) If Zoom explicitly says the meeting never started, mark as missed immediately
      if (waitingFlag || (meeting.status && meeting.status.toLowerCase() === 'waiting')) {
        console.log(`Meeting ${meeting.id} never started (status=waiting) → marked as MISSED`);
        const updatedAppointment = await Appointment.findByIdAndUpdate(
          appointment._id,
          { status: 'missed', missedAt: new Date(), lastUpdated: new Date() },
          { runValidators: true, new: true }
        ).populate('formId').lean();

        if (global.io && updatedAppointment) {
          const appointmentWithUser = await enrichAppointmentWithUser(updatedAppointment);
          global.io.emit('updateAppointment', appointmentWithUser);
          console.log(`📡 WebSocket update emitted for appointment ${appointment._id}`);
        }

        const userName =
          (updatedAppointment.formData?.firstName || updatedAppointment.formId?.firstName || 'Client') +
          ' ' +
          (updatedAppointment.formData?.lastName || updatedAppointment.formId?.lastName || '').trim();

        await Notification.create({
          message: `Meeting missed: ${userName.trim()} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
          formType: updatedAppointment.formType || `meeting_missed`,
          read: false,
          appointmentId: updatedAppointment._id
        });
        continue;
      }

      // 3) Fetch participants (may be empty or exclude host)
      try {
        const participantsResponse = await axios.get(
          `https://api.zoom.us/v2/past_meetings/${meetingUUID}/participants`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        participants = participantsResponse.data?.participants || [];
        console.log(`Meeting ${meeting.id} participants retrieved: ${participants.length}`);
      } catch (err) {
        console.warn(`No participants data for meeting ${meeting.id} (${err.response?.status}: ${err.response?.data?.message || err.message})`);
        participants = [];
      }

      // 4) Decide completion vs missed
      // RULE: Trust actual duration first. If >= 10 minutes → completed, regardless of participants array.
      // For shorter meetings, fall back to participants engagement checks.
      let wasCompleted = false;

      if (actualDuration >= 10) {
        wasCompleted = true;
        console.log(`Meeting ${meeting.id} marked as COMPLETED (actual duration ${actualDuration}m)`);
      } else {
        // Short meeting → use participant logic
        if (participants.length === 0) {
          wasCompleted = false;
          console.log(`Meeting ${meeting.id} marked as MISSED - No participants and duration < 10m (duration: ${actualDuration}m)`);
        } else if (participants.length === 1) {
          const singleParticipant = participants[0];
          const singleDur = Number(singleParticipant?.duration) || 0;
          if (singleDur >= 5) {
            wasCompleted = true;
            console.log(`Meeting ${meeting.id} marked as COMPLETED - Single participant stayed ${singleDur}m`);
          } else {
            wasCompleted = false;
            console.log(`Meeting ${meeting.id} marked as MISSED - Single participant only ${singleDur}m`);
          }
        } else {
          // Multiple participants
          const meaningful = participants
            .map(p => ({ ...p, duration: Number(p.duration) || 0 }))
            .filter(p => p.duration >= 0.5);

          if (meaningful.length < 2) {
            wasCompleted = false;
            console.log(`Meeting ${meeting.id} marked as MISSED - Not enough meaningful participants (${meaningful.length}/2 required)`);
          } else {
            const hasRealEngagement = meaningful.some(p => p.duration >= 2);
            const totalEngagement = meaningful.reduce((sum, p) => sum + p.duration, 0);

            if (hasRealEngagement && totalEngagement >= 3) {
              wasCompleted = true;
              console.log(`Meeting ${meeting.id} marked as COMPLETED - ${meaningful.length} meaningful participants, total engagement ${totalEngagement}m`);
            } else {
              wasCompleted = false;
              console.log(`Meeting ${meeting.id} marked as MISSED - Insufficient engagement (total ${totalEngagement}m)`);
            }
          }

          console.log(`Meeting ${meeting.id} participant breakdown:`);
          participants.forEach(p => {
            const d = Number(p.duration) || 0;
            const status = d >= 2 ? '(good)' : d >= 0.5 ? '(brief)' : '(very brief)';
            console.log(`  - ${p.name}: ${d} minutes ${status}`);
          });
        }
      }

      // 5) Persist result + side effects
      const newStatus = wasCompleted ? 'completed' : 'missed';
      const updateData = {
        status: newStatus,
        lastUpdated: new Date(),
        ...(wasCompleted ? { completedAt: new Date() } : { missedAt: new Date() })
      };

      const updatedAppointment = await Appointment.findByIdAndUpdate(
        appointment._id,
        updateData,
        { runValidators: true, new: true }
      ).populate('formId').lean();

      console.log(`✅ Updated appointment ${appointment._id} from '${appointment.status}' to '${newStatus}'`);

      if (global.io && updatedAppointment) {
        const appointmentWithUser = await enrichAppointmentWithUser(updatedAppointment);
        global.io.emit('updateAppointment', appointmentWithUser);
        console.log(`📡 WebSocket update emitted for appointment ${appointment._id}`);
      }

      const userName =
        (updatedAppointment.formData?.firstName || updatedAppointment.formId?.firstName || 'Client') +
        ' ' +
        (updatedAppointment.formData?.lastName || updatedAppointment.formId?.lastName || '').trim();

      await Notification.create({
        message: `Meeting ${newStatus}: ${userName.trim()} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
        formType: updatedAppointment.formType || `meeting_${newStatus}`,
        read: false,
        appointmentId: updatedAppointment._id
      });

    } catch (err) {
      console.error(`❌ Error processing past meeting ${meeting.id}:`, err.message);
    }
  }
};




// const processPastMeetings = async (pastMeetings, accessToken) => {
//   console.log('Processing past meetings for completion detection...');

//   for (const meeting of pastMeetings) {
//     try {
//       const meetingStartTime = new Date(meeting.start_time);
//       if (isNaN(meetingStartTime.getTime())) continue;

//       const sevenDaysAgo = new Date();
//       sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
//       if (meetingStartTime < sevenDaysAgo) continue;

//       const zoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
//       if (!zoomMeeting) continue;

//       const appointment = await Appointment.findById(zoomMeeting.appointment).populate('formId');
//       if (!appointment) continue;

//       if (['completed', 'missed'].includes(appointment.status)) continue;

//       console.log(`Checking past meeting ${meeting.id} for appointment ${appointment._id}`);

//       let wasCompleted = false;
//       let participants = [];   

//       try {
//         // Fetch participants
//         const participantsResponse = await axios.get(
//           `https://api.zoom.us/v2/past_meetings/${meeting.id}/participants`,
//           { headers: { Authorization: `Bearer ${accessToken}` } }
//         );
//         participants = participantsResponse.data.participants || [];
        
//         console.log(`Meeting ${meeting.id} participants data retrieved: ${participants.length} participants`);
//       } catch (err) {
//         console.warn(`No participants data for meeting ${meeting.id} (${err.response?.status}: ${err.response?.data?.message || err.message})`);
//       }

//       // CORRECTED LOGIC
//       if (participants.length === 0) {
//         // NO PARTICIPANTS = ALWAYS MISSED
//         // This means either:
//         // 1. Nobody joined at all
//         // 2. Zoom couldn't track participants (technical issue)
//         // Either way, it's safer to mark as missed
//         wasCompleted = false;
//         console.log(`Meeting ${meeting.id} marked as MISSED - No participants joined (duration: ${meeting.duration || 0}m)`);
        
//       } else if (participants.length === 1) {
//         // ONLY ONE PARTICIPANT = USUALLY MISSED
//         // This typically means only the host joined and waited
//         const singleParticipant = participants[0];
        
//         // Only mark as completed if the single participant stayed a very long time (10+ minutes)
//         // This might indicate a phone call or different meeting format
//         if (singleParticipant.duration >= 10) {
//           wasCompleted = true;
//           console.log(`Meeting ${meeting.id} marked as COMPLETED - Single participant stayed ${singleParticipant.duration} minutes (assuming phone meeting)`);
//         } else {
//           wasCompleted = false;
//           console.log(`Meeting ${meeting.id} marked as MISSED - Only one participant: ${singleParticipant.name} (${singleParticipant.duration}m)`);
//         }
        
//       } else {
//         // MULTIPLE PARTICIPANTS = CHECK ENGAGEMENT
//         // Filter out very brief joins (less than 1 minute = accidental)
//         const meaningful = participants.filter(p => p.duration >= 1);
        
//         if (meaningful.length < 2) {
//           // Not enough meaningful participants
//           wasCompleted = false;
//           console.log(`Meeting ${meeting.id} marked as MISSED - Not enough meaningful participants (${meaningful.length}/2 required)`);
          
//         } else {
//           // Check if it was a substantial meeting
//           const hasSubstantialEngagement = meaningful.some(p => p.duration >= 3);
          
//           if (!hasSubstantialEngagement) {
//             wasCompleted = false;
//             console.log(`Meeting ${meeting.id} marked as MISSED - No substantial engagement (max duration: ${Math.max(...meaningful.map(p => p.duration))}m)`);
//           } else {
//             wasCompleted = true;
//             console.log(`Meeting ${meeting.id} marked as COMPLETED - ${meaningful.length} meaningful participants, max duration: ${Math.max(...meaningful.map(p => p.duration))}m`);
//           }
//         }
        
//         console.log(`Meeting ${meeting.id} participant breakdown:`);
//         participants.forEach(p => {
//           console.log(`  - ${p.name}: ${p.duration} minutes${p.duration < 1 ? ' (too brief)' : ''}${p.duration >= 3 ? ' (substantial)' : ''}`);
//         });
//       }

//       // Additional fallback check for edge cases
//       if (wasCompleted && participants.length === 0) {
//         // Safety check: never mark as completed if no participants
//         wasCompleted = false;
//         console.log(`Safety override: Meeting ${meeting.id} changed to MISSED - Cannot be completed without participants`);
//       }

//       // Update appointment
//       const newStatus = wasCompleted ? 'completed' : 'missed';
//       const updateData = {
//         status: newStatus,
//         lastUpdated: new Date(),
//         ...(wasCompleted ? { completedAt: new Date() } : { missedAt: new Date() })
//       };

//       const updatedAppointment = await Appointment.findByIdAndUpdate(
//         appointment._id,
//         updateData,
//         { runValidators: true, new: true }
//       ).populate('formId').lean();

//       console.log(`✅ Updated appointment ${appointment._id} from '${appointment.status}' to '${newStatus}'`);

//       // Emit WebSocket update
//       if (global.io && updatedAppointment) {
//         const appointmentWithUser = await enrichAppointmentWithUser(updatedAppointment);
//         global.io.emit('updateAppointment', appointmentWithUser);
//         console.log(`📡 WebSocket update emitted for appointment ${appointment._id}`);
//       }

//       // Create notification
//       const userName = (updatedAppointment.formData?.firstName || updatedAppointment.formId?.firstName || 'Client') + 
//                        ' ' + 
//                        (updatedAppointment.formData?.lastName || updatedAppointment.formId?.lastName || '').trim();

//       await Notification.create({
//         message: `Meeting ${newStatus}: ${userName.trim()} - ${meetingStartTime.toLocaleDateString()} at ${meetingStartTime.toLocaleTimeString()}`,
//         formType: updatedAppointment.formType || `meeting_${newStatus}`,
//         read: false,
//         appointmentId: updatedAppointment._id
//       });

//     } catch (err) {
//       console.error(`❌ Error processing past meeting ${meeting.id}:`, err.message);
//     }
//   }
// };



// Helper function to enrich appointment with user data (existing)
const enrichAppointmentWithUser = async (appointment) => {
  let userData = {
    firstName: 'Unknown',
    lastName: 'User',
    email: 'N/A',
    phoneNumber: 'N/A'
  };

  if (appointment.formData) {
    userData = {
      firstName: appointment.formData.firstName || userData.firstName,
      lastName: appointment.formData.lastName || userData.lastName,
      email: appointment.formData.Email || appointment.formData.email || userData.email,
      phoneNumber: appointment.formData.phoneNumber || userData.phoneNumber
    };
  } else if (appointment.formId) {
    userData = {
      firstName: appointment.formId.firstName || userData.firstName,
      lastName: appointment.formId.lastName || userData.lastName,
      email: appointment.formId.Email || appointment.formId.email || userData.email,
      phoneNumber: appointment.formId.phoneNumber || userData.phoneNumber
    };
  }

  return {
    ...appointment,
    user: userData
  };
};



module.exports = {      
  // universalContactUserByEmail,
  // syncZoomMeetings,  
  safeUniversalContactUserByEmail,  
  syncZoomMeetings: syncZoomMeetingsWithCompletion,
  processUpcomingMeetings, 
  processPastMeetings,  
  enrichAppointmentWithUser,   
  getZoomAccessToken,
  // Keep your other existing functions
  getAllZoomMeetings: async (req, res) => {
    try {
      const zoomMeetings = await ZoomMeeting.find()
        .populate({
          path: 'appointment',
          populate: { path: 'formId' }
        })
        .sort({ createdAt: -1 });

      res.status(200).json(zoomMeetings);
    } catch (error) {
      console.error('Get zoom meetings error:', error);
      res.status(500).json({ error: 'Failed to fetch zoom meetings' });
    }
  },
  
  manualSync: async (req, res) => {
    try {
      await syncZoomMeetings();
      res.status(200).json({ message: 'Enhanced manual sync completed' });
    } catch (error) {
      console.error('Enhanced manual sync error:', error);
      res.status(500).json({ error: 'Manual sync failed', details: error.message });
    }
  }
};



//  const enhancedContactUserByEmail = async (req, res) => { 
//   try {
//     const { 
//       appointmentId, 
//       userEmail, 
//       userName, 
//       subject, 
//       message,
//       adminName,
//       contactMethod = 'email'
//     } = req.body;

//     // Validation
//     if (!appointmentId || !userEmail || !userName) {
//       return res.status(400).json({ 
//         success: false,
//         error: 'Missing required fields: appointmentId, userEmail, userName' 
//       });
//     }

//     const isValidEmail = (email) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(email);
//     if (!isValidEmail(userEmail)) {
//       return res.status(400).json({success: false, error: 'Invalid email format' });
//     }

//     // Find the appointment
//     const appointment = await Appointment.findById(appointmentId).populate('formId');
//     if (!appointment) {
//       return res.status(404).json({ success: false, error: 'Appointment not found' });
//     }

//     // CREATE ZOOM MEETING when sending scheduler link
//     let zoomMeetingData = null;
//     let schedulerLink = process.env.ZOOM_URL; // Fallback scheduler link
    
//     try {
//       const accessToken = await getZoomAccessToken();
      
//       // Create Zoom meeting
//       const meetingData = {
//         topic: `Financial Consultation - ${userName}`,
//         type: 2, // Scheduled meeting
//         start_time: new Date(appointment.assignedSlot).toISOString(),
//         duration: 60, // 60 minutes
//         timezone: 'America/New_York',
//         settings: {
//           host_video: true,
//           participant_video: true,
//           join_before_host: false,
//           mute_upon_entry: true,
//           waiting_room: true,
//           approval_type: 0, // Automatically approve
//           registration_type: 1, // Attendees register once
//           enforce_login: false
//         }
//       };

//       const response = await axios.post(
//         'https://api.zoom.us/v2/users/me/meetings',
//         meetingData,
//         {
//           headers: {
//             'Authorization': `Bearer ${accessToken}`,
//             'Content-Type': 'application/json'
//           }
//         }
//       );

//       const meeting = response.data;

//       // Save meeting to ZoomMeeting model
//       const zoomMeeting = new ZoomMeeting({
//         appointment: appointmentId,
//         meetingId: meeting.id,
//         joinUrl: meeting.join_url,
//         startUrl: meeting.start_url,
//         hostEmail: meeting.host_email,
//         createdAt: new Date(meeting.created_at),
//         schedulerUrl: `https://scheduler.zoom.us/nattye-a/discovery-and-guidance-call?meeting_id=${meeting.id}`
//       });

//       await zoomMeeting.save();

//       // Store Zoom data for appointment update (compatible with your existing structure)
//       zoomMeetingData = {
//         id: meeting.id,
//         meetingId: meeting.id,
//         topic: meeting.topic,
//         startTime: meeting.start_time,
//         joinUrl: meeting.join_url,
//         startUrl: meeting.start_url,
//         password: meeting.password,
//         schedulerUrl: zoomMeeting.schedulerUrl,
//         zoomMeetingRecordId: zoomMeeting._id, // Reference to ZoomMeeting model
//         createdAt: new Date()
//       };

//       // Use Zoom scheduler URL if available
//       schedulerLink = zoomMeeting.schedulerUrl;

//       console.log('Zoom meeting created successfully:', meeting.id);
//     } catch (zoomError) {
//       console.error('Failed to create Zoom meeting:', zoomError.response?.data || zoomError.message);
//       // Continue without Zoom meeting - will use fallback scheduler
//     }

//     // Get form details
//     let formData = null;
//     if (appointment.formType === 'termForm' && appointment.formId) {
//       formData = appointment.formId;
//     }
    
//     // Email content with Zoom integration
//     const emailSubject = subject || `Schedule Your Financial Consultation - LyfNest Solutions`;
    
//     const defaultMessage = `Hi ${userName},

// Thank you for submitting your request! I'm following up to schedule your financial consultation.

// ${zoomMeetingData ? 
//   `Please use the link below to confirm your Zoom meeting:
// ${schedulerLink}

// This will be a secure Zoom meeting where we can discuss your financial needs in detail.` :
//   `Please use the link below to pick a time that works best for you:
// ${schedulerLink}`}

// ${formData ? `Based on your submitted information:
// ${formData.coverageAmount ? `• Coverage Amount: ${formData.coverageAmount}\n` : ''}
// ${formData.preferredTerm ? `• Preferred Term: ${formData.preferredTerm}\n` : ''}
// ` : ''}

// Once you ${zoomMeetingData ? 'confirm your meeting time' : 'schedule your preferred time'}, I'll receive a notification and we'll be all set for our meeting.

// Best regards,
// ${adminName || 'LyfNest Solutions Team'}
// Email: ${process.env.SES_SENDER_EMAIL}`;

//     const emailMessage = message || defaultMessage;

//     // Send email (using your existing SES setup)
//     const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
    
//     const sesClient = new SESClient({
//       region: process.env.AWS_REGION,
//       credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
//       }
//     });

//     const params = {
//       Destination: { ToAddresses: [userEmail] },
//       Message: {
//         Body: {
//           Html: {
//             Charset: "UTF-8",
//             Data: `
//               <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                 <div style="background: #a4dcd7; color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
//                   <img src="https://res.cloudinary.com/dma2ht84k/image/upload/v1753279441/lyfnest-logo_byfywb.png" alt="LyfNest Solutions Logo" style="width: 50px; height: 50px; margin-bottom: 10px;">
//                   <h2 style="margin: 0;">${zoomMeetingData ? 'Confirm Your Zoom Consultation' : 'Schedule Your Consultation'}</h2>
//                 </div>
              
//                 <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
//                   <div style="white-space: pre-line; line-height: 1.6; color: #333;">
//                     ${emailMessage.replace(/\n/g, '<br>')}
//                   </div>
                  
//                   <div style="text-align: center; margin: 30px 0;">
//                     <a href="${schedulerLink}" 
//                        style="background: ${zoomMeetingData ? '#0070f3' : '#4caf50'}; 
//                               color: white; 
//                               padding: 15px 30px; 
//                               text-decoration: none; 
//                               border-radius: 5px;
//                               font-weight: bold;
//                               font-size: 16px;
//                               display: inline-block;">
//                       ${zoomMeetingData ? 'Confirm Zoom Meeting' : 'Schedule My Meeting'}
//                     </a>
//                   </div>
                  
//                   ${zoomMeetingData ? `
//                   <div style="background: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2196f3;">
//                     <h3 style="color: #1976d2; margin-top: 0;">Zoom Meeting Details:</h3>
//                     <ul style="color: #555; margin: 10px 0;">
//                       <li><strong>Meeting ID:</strong> ${zoomMeetingData.meetingId}</li>
//                       <li><strong>Scheduled Time:</strong> ${new Date(appointment.assignedSlot).toLocaleString()}</li>
//                     </ul>
//                   </div>
//                   ` : ''}
                  
//                   ${formData ? `
//                   <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4caf50;">
//                     <h3 style="color: #2e7d32; margin-top: 0;">Your Inquiry Details:</h3>
//                     <ul style="color: #555; margin: 10px 0;">
//                       ${formData.coverageAmount ? `<li><strong>Coverage Amount:</strong> ${formData.coverageAmount}</li>` : ''}
//                       ${formData.preferredTerm ? `<li><strong>Preferred Term:</strong> ${formData.preferredTerm}</li>` : ''}
//                       ${formData.phoneNumber ? `<li><strong>Phone:</strong> ${formData.phoneNumber}</li>` : ''}
//                     </ul>
//                   </div>
//                   ` : ''}
//                 </div>
                
//                 <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
//                   <p style="margin: 0; color: #666; font-size: 14px;">
//                     <strong>LyfNest Solutions</strong><br>
//                     Email: ${process.env.SES_SENDER_EMAIL}
//                   </p>
//                 </div>
//               </div> 
//             `
//           },
//           Text: {
//             Charset: "UTF-8",
//             Data: `${emailMessage}\n\n${zoomMeetingData ? 'Confirm meeting' : 'Schedule your meeting'}: ${schedulerLink}`
//           }
//         },
//         Subject: {
//           Charset: "UTF-8",
//           Data: emailSubject
//         }
//       },
//       Source: process.env.SES_SENDER_EMAIL
//     };

//     // Send the email
//     let emailSent = false;
//     try {
//       await sesClient.send(new SendEmailCommand(params));
//       console.log('Email sent successfully to:', userEmail);
//       emailSent = true;
//     } catch (emailError) {
//       console.error('Email sending failed:', emailError);
//       return res.status(500).json({ 
//         success: false,
//         message: 'Failed to send scheduler email',
//         error: emailError.message 
//       });
//     }

//     // Update appointment with contacted status and Zoom data
//     const updateData = {
//       status: 'contacted',
//       lastContactDate: new Date(),
//       contactMethod: contactMethod,
//       contactedBy: adminName || 'Admin'
//     };

//     if (zoomMeetingData) {
//       updateData.zoomMeeting = zoomMeetingData;
//     }

//     const updatedAppointment = await Appointment.findByIdAndUpdate(
//       appointmentId,
//       updateData,
//       { new: true }
//     ).populate('formId').lean();

//     // Enrich with user data for WebSocket
//     let userData = {
//       firstName: userName.split(' ')[0] || 'Unknown',
//       lastName: userName.split(' ')[1] || 'User',
//       email: userEmail,
//       phoneNumber: formData?.phoneNumber || 'N/A'
//     };

//     if (updatedAppointment.formData) {
//       userData = {
//         firstName: updatedAppointment.formData.firstName || userData.firstName,
//         lastName: updatedAppointment.formData.lastName || userData.lastName,
//         email: updatedAppointment.formData.Email || updatedAppointment.formData.email || userData.email,
//         phoneNumber: updatedAppointment.formData.phoneNumber || userData.phoneNumber
//       };
//     } else if (updatedAppointment.formId) {
//       userData = {
//         firstName: updatedAppointment.formId.firstName || userData.firstName,
//         lastName: updatedAppointment.formId.lastName || userData.lastName,
//         email: updatedAppointment.formId.Email || updatedAppointment.formId.email || userData.email,
//         phoneNumber: updatedAppointment.formId.phoneNumber || userData.phoneNumber
//       };
//     }

//     const appointmentWithUser = {
//       ...updatedAppointment,
//       user: userData
//     };

//     // EMIT WEBSOCKET UPDATE EVENT IMMEDIATELY
//     if (req.io) {
//       try {
//         req.io.emit('updateAppointment', appointmentWithUser);
//         req.io.to('admins').emit('updateAppointment', appointmentWithUser);
//         console.log('WebSocket update event emitted for appointment:', appointmentId);
//       } catch (wsError) {
//         console.error('WebSocket emission failed:', wsError);
//       }
//     }

//     res.status(200).json({
//       success: true,
//       message: zoomMeetingData ? 'Zoom meeting created and scheduler link sent successfully' : 'Scheduler link sent successfully',
//       appointment: appointmentWithUser,
//       zoomMeeting: zoomMeetingData,
//       appointmentId,
//       contactMethod: 'email',
//       sentAt: new Date(),
//       recipient: userEmail,
//       schedulerLink: schedulerLink,
//       emailSent: emailSent,
//       statusUpdated: true
//     });

//   } catch (error) {
//     console.error("Enhanced Contact Email Error:", error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Failed to send contact email',
//       error: error.message 
//     });
//   }
// }; 



// Corrected syncZoomMeetings with precise matching logic
// const syncZoomMeetings = async () => {
//   try {
//     console.log('Starting corrected Zoom meeting sync...');
//     const accessToken = await getZoomAccessToken();
    
//     const response = await axios.get(
//       'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=300',
//       { headers: { Authorization: `Bearer ${accessToken}` } }
//     );

//     const meetings = response.data.meetings || [];
//     console.log(`Found ${meetings.length} Zoom meetings`);

//     for (const meeting of meetings) {
//       try {
//         const meetingStartTime = new Date(meeting.start_time);
//         if (isNaN(meetingStartTime.getTime())) continue;

//         const meetingDuration = meeting.duration || 60;
//         const meetingEndTime = new Date(meetingStartTime.getTime() + (meetingDuration * 60000));
//         const meetingEnded = meetingEndTime < new Date();

//         // Check if this meeting is already processed
//         let existingZoomMeeting = await ZoomMeeting.findOne({ meetingId: meeting.id });
        
//         if (existingZoomMeeting) {
//           // Handle existing meeting updates
//           const appointment = await Appointment.findById(existingZoomMeeting.appointment).populate('formId');
          
//           if (appointment) {
//             const timeChanged = appointment.assignedSlot.getTime() !== meetingStartTime.getTime();
            
//             let updateData = { lastUpdated: new Date() };
            
//             if (timeChanged) {
//               updateData.assignedSlot = meetingStartTime;
//               updateData.contactWindowStart = meetingStartTime;
//               updateData.contactWindowEnd = meetingEndTime;
//               console.log(`Time changed for appointment ${appointment._id}: ${appointment.assignedSlot} -> ${meetingStartTime}`);
//             }
            
//             // Update status if meeting ended
//             if (meetingEnded && appointment.status === 'booked') {
//               updateData.status = 'completed';
//               updateData.completedAt = new Date();
//             } else if (appointment.status === 'contacted') {
//               updateData.status = 'booked';
//               updateData.customerBookedAt = new Date();
//             }
            
//             if (Object.keys(updateData).length > 1) { // More than just lastUpdated
//               const updatedAppointment = await Appointment.findByIdAndUpdate(
//                 appointment._id,
//                 updateData,
//                 { runValidators: true, new: true }
//               ).populate('formId').lean();
      
//               // EMIT WEBSOCKET UPDATE
//               if (global.io && updatedAppointment) {
//                 const appointmentWithUser = await enrichAppointmentWithUser(updatedAppointment);
//                 global.io.emit('updateAppointment', appointmentWithUser);
//                 console.log(`WebSocket update emitted for existing appointment: ${appointment._id}`);
//               }
//             }
//           }
//           continue; // Skip to next meeting since this one is already processed
//         }

//         // NEW MEETING - Corrected matching logic
//         console.log(`Processing new meeting: ${meeting.id} - "${meeting.topic}" at ${meetingStartTime.toISOString()}`);
        
//         // Get contacted appointments that don't already have Zoom meetings
//         const availableAppointments = await Appointment.find({
//           status: 'contacted',
//           'zoomMeeting.meetingId': { $exists: false }, // Don't already have a Zoom meeting
//           lastContactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
//         }).populate('formId').sort({ lastContactDate: -1 }); // Most recently contacted first

//         console.log(`Found ${availableAppointments.length} available contacted appointments`);

//         if (availableAppointments.length === 0) {
//           console.log(`No available appointments for meeting ${meeting.id}`);
//           continue;
//         }

//         let matchedAppointment = null;
//         let matchReason = 'none';

//         // CORRECTED MATCHING LOGIC - More Precise

//         // 1. Try exact name matching from meeting topic
//         if (meeting.topic && meeting.topic.includes('Financial Consultation -')) {
//           const nameFromTopic = meeting.topic.replace('Financial Consultation - ', '').trim().toLowerCase();
          
//           matchedAppointment = availableAppointments.find(app => {
//             const userData = app.formData || app.formId || {};
//             const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim().toLowerCase();
//             return fullName === nameFromTopic;
//           });
          
//           if (matchedAppointment) {
//             matchReason = `exact name match: "${nameFromTopic}"`;
//           }
//         }

//         // 2. Try partial name matching with stricter criteria
//         if (!matchedAppointment && meeting.topic) {
//           const topicLower = meeting.topic.toLowerCase();
          
//           // Find appointments where BOTH first AND last name appear in topic
//           matchedAppointment = availableAppointments.find(app => {
//             const userData = app.formData || app.formId || {};
//             const firstName = (userData.firstName || '').toLowerCase();
//             const lastName = (userData.lastName || '').toLowerCase();
            
//             // Both names must be present and be at least 3 characters
//             return firstName.length >= 3 && lastName.length >= 3 &&
//                    topicLower.includes(firstName) && topicLower.includes(lastName);
//           });
          
//           if (matchedAppointment) {
//             const userData = matchedAppointment.formData || matchedAppointment.formId || {};
//             matchReason = `both names match: ${userData.firstName} ${userData.lastName}`;
//           }
//         }

//         // 3. REMOVED: Time-based matching (this was causing the issue)
//         // This was matching appointments based on proximity, causing cross-contamination
        
//         // 4. STRICT: Only match if there's exactly ONE available appointment AND name matching failed
//         // This should only happen in very rare cases
//         if (!matchedAppointment && availableAppointments.length === 1) {
//           // Additional safety check: meeting must be within same day as the single appointment
//           const singleApp = availableAppointments[0];
//           const appDate = new Date(singleApp.assignedSlot);
//           const meetingDate = new Date(meetingStartTime);
          
//           // Check if they're on the same day
//           const sameDay = appDate.getDate() === meetingDate.getDate() &&
//                           appDate.getMonth() === meetingDate.getMonth() &&
//                           appDate.getFullYear() === meetingDate.getFullYear();
          
//           if (sameDay) {
//             matchedAppointment = singleApp;
//             matchReason = 'single appointment same day';
//           } else {
//             console.log(`Single appointment found but different days: App=${appDate.toDateString()}, Meeting=${meetingDate.toDateString()}`);
//           }
//         }

//         // 5. ENHANCED SAFETY CHECK: If multiple appointments available but no specific match, log details and skip
//         if (!matchedAppointment && availableAppointments.length > 1) {
//           console.log(`Skipping meeting ${meeting.id} - multiple appointments available but no name match found`);
//           console.log(`Meeting topic: "${meeting.topic}"`);
//           console.log(`Available appointments:`);
//           availableAppointments.forEach((app, index) => {
//             const userData = app.formData || app.formId || {};
//             console.log(`  ${index + 1}. ${userData.firstName} ${userData.lastName} (${app._id}) - ${new Date(app.assignedSlot).toLocaleString()}`);
//           });
//           continue;
//         }

//         // 6. Final safety check: Ensure we're not matching the same appointment twice
//         if (matchedAppointment) {
//           // Double-check this appointment doesn't already have a zoom meeting
//           const doubleCheck = await Appointment.findById(matchedAppointment._id);
//           if (doubleCheck.zoomMeeting && doubleCheck.zoomMeeting.meetingId) {
//             console.log(`Appointment ${matchedAppointment._id} already has zoom meeting ${doubleCheck.zoomMeeting.meetingId}, skipping`);
//             continue;
//           }
//         }

//         if (matchedAppointment) {
//           console.log(`✅ Matched appointment ${matchedAppointment._id} with meeting ${meeting.id}`);
//           console.log(`   Reason: ${matchReason}`);
//           console.log(`   Appointment time: ${new Date(matchedAppointment.assignedSlot).toLocaleString()}`);
//           console.log(`   Meeting time: ${meetingStartTime.toLocaleString()}`);
          
//           // Create ZoomMeeting record
//           const newZoomMeeting = new ZoomMeeting({
//             appointment: matchedAppointment._id,
//             meetingId: meeting.id,
//             joinUrl: meeting.join_url,
//             startUrl: meeting.start_url || '', // Handle missing startUrl
//             hostEmail: meeting.host_email,
//             createdAt: new Date(meeting.created_at) || new Date(),
//             syncedAt: new Date()
//           });

//           await newZoomMeeting.save();
//           console.log(`Created ZoomMeeting record: ${newZoomMeeting._id}`);
          
//           // Update appointment to booked status - PRESERVE ORIGINAL TIME UNLESS EXPLICITLY CHANGED
//           const updatedAppointment = await Appointment.findByIdAndUpdate(
//             matchedAppointment._id,
//             {
//               // CRITICAL FIX: Only update time if it's significantly different (more than 30 minutes)
//               ...(Math.abs(new Date(matchedAppointment.assignedSlot).getTime() - meetingStartTime.getTime()) > 30 * 60 * 1000 ? {
//                 assignedSlot: meetingStartTime,
//                 contactWindowStart: meetingStartTime,
//                 contactWindowEnd: meetingEndTime
//               } : {}),
//               status: meetingEnded ? 'completed' : 'booked',
//               customerBookedAt: new Date(),
//               zoomMeeting: {
//                 id: meeting.id,
//                 meetingId: meeting.id,
//                 topic: meeting.topic,
//                 joinUrl: meeting.join_url,
//                 startUrl: meeting.start_url || '',
//                 zoomMeetingRecordId: newZoomMeeting._id,
//                 createdAt: new Date()
//               },
//               lastUpdated: new Date()
//             },
//             { runValidators: true, new: true }
//           ).populate('formId').lean();

//           console.log(`Updated appointment ${matchedAppointment._id} status to ${updatedAppointment.status}`);
//           console.log(`Final appointment time: ${new Date(updatedAppointment.assignedSlot).toLocaleString()}`);

//           // EMIT WEBSOCKET UPDATE FOR NEW BOOKING
//           if (global.io && updatedAppointment) {
//             const appointmentWithUser = await enrichAppointmentWithUser(updatedAppointment);
//             global.io.emit('updateAppointment', appointmentWithUser);
//             console.log(`WebSocket update emitted for new booking: ${matchedAppointment._id}`);
//           }

//           // Create notification
//           const userData = updatedAppointment.formData || updatedAppointment.formId || {};
//           await Notification.create({
//             message: `New meeting scheduled: ${userData.firstName || 'Client'} ${userData.lastName || ''} - ${new Date(updatedAppointment.assignedSlot).toLocaleDateString()} at ${new Date(updatedAppointment.assignedSlot).toLocaleTimeString()}`,
//             formType: updatedAppointment.formType || 'meeting_scheduled',
//             read: false,
//             appointmentId: updatedAppointment._id
//           });
//         } else {
//           console.log(`❌ No suitable appointment found for meeting ${meeting.id} - "${meeting.topic}"`);
//         }

//       } catch (meetingError) {
//         console.error(`Error processing meeting ${meeting.id}:`, meetingError.message);
//       }
//     }

//     console.log('✅ Corrected Zoom sync completed successfully');
    
//   } catch (error) {
//     console.error('❌ Corrected Zoom sync error:', error.response?.data || error.message);
//     throw error;
//   }
// };

// // Helper function to enrich appointment with user data
// const enrichAppointmentWithUser = async (appointment) => {
//   let userData = {
//     firstName: 'Unknown',
//     lastName: 'User',
//     email: 'N/A',
//     phoneNumber: 'N/A'
//   };

//   if (appointment.formData) {
//     userData = {
//       firstName: appointment.formData.firstName || userData.firstName,
//       lastName: appointment.formData.lastName || userData.lastName,
//       email: appointment.formData.Email || appointment.formData.email || userData.email,
//       phoneNumber: appointment.formData.phoneNumber || userData.phoneNumber
//     };
//   } else if (appointment.formId) {
//     userData = {
//       firstName: appointment.formId.firstName || userData.firstName,
//       lastName: appointment.formId.lastName || userData.lastName,
//       email: appointment.formId.Email || appointment.formId.email || userData.email,
//       phoneNumber: appointment.formId.phoneNumber || userData.phoneNumber
//     };
//   }

//   return {
//     ...appointment,
//     user: userData
//   };
// }