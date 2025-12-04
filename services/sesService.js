const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});



// const sendEmailViaSES = async (emailData) => {
//   const {
//     recipients,   
//     subject,
//     body,
//     sender,
//     attachments = [],
//     design = 'default'
//   } = emailData;

//   try {
//     // Apply template design
//     const selectedDesign = templateDesigns[design] || templateDesigns.default;
//     const htmlBody = selectedDesign.generate(subject, body, sender.fromName);

//     // Prepare SES parameters
//     const params = {
//       Source: `${sender.fromName} <${sender.fromEmail}>`,
//       Destination: {
//         ToAddresses: recipients,   
//         CcAddresses: emailData.cc || [],
//         BccAddresses: emailData.bcc || []
//       },
//       Message: {
//         Subject: { 
//           Data: subject,
//           Charset: 'UTF-8'
//         },
//         Body: {
//           Html: {
//             Data: htmlBody,
//             Charset: 'UTF-8'
//           }
//         }
//       },
//       ReplyToAddresses: [sender.replyTo || sender.fromEmail]
//     };

//     // Send email - FIXED: Removed .promise()
//     const command = new SendEmailCommand(params);
//     const result = await sesClient.send(command);
    
//     console.log('Email sent successfully:', result.MessageId);
//     return result;
//   } catch (error) {
//     console.error('Error sending email:', error);
//     throw error;
//   }
// };

// module.exports = { sendEmailViaSES };


const sendEmailViaSES = async (emailData) => {
  const {
    recipients,
    subject,
    body,
    sender,
    attachments = [],
  } = emailData;

  try {
    // Validate required fields
    if (!recipients || recipients.length === 0) {
      throw new Error('No recipients specified');
    }
    
    if (!sender || !sender.fromEmail) {
      throw new Error('Sender email is required');
    }
    
    if (!subject) {
      throw new Error('Email subject is required');
    }
    
    if (!body) {
      throw new Error('Email body is required');
    }

    // Prepare SES parameters
    // Body should already be fully formatted HTML from the scheduler
    const params = {
      Source: `${sender.fromName} <${sender.fromEmail}>`,
      Destination: {
        ToAddresses: recipients,
        CcAddresses: emailData.cc || [],
        BccAddresses: emailData.bcc || []
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: body,  // Use body as-is (already formatted)
            Charset: 'UTF-8'
          }
        }
      },
      ReplyToAddresses: [sender.replyTo || sender.fromEmail]
    };

    // Send email
    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);
    
    console.log(`✅ Email sent successfully to ${recipients[0]}, MessageId: ${result.MessageId}`);
    return result;
    
  } catch (error) {
    console.error(`❌ SES Error sending to ${recipients?.[0] || 'unknown'}:`, error.message);
    
    // Create a more informative error
    const enhancedError = new Error(
      error.message || 'Failed to send email via SES'
    );
    enhancedError.originalError = error;
    enhancedError.recipient = recipients?.[0];
    
    throw enhancedError;
  }
};

module.exports = { sendEmailViaSES };