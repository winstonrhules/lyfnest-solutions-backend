const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});



const sendEmailViaSES = async (emailData) => {
  const {
    recipients,
    subject,
    body,
    sender,
    attachments = [],
    design = 'default'
  } = emailData;

  try {
    // Apply template design
    const selectedDesign = templateDesigns[design] || templateDesigns.default;
    const htmlBody = selectedDesign.generate(subject, body, sender.fromName);

    // Prepare SES parameters
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
            Data: htmlBody,
            Charset: 'UTF-8'
          }
        }
      },
      ReplyToAddresses: [sender.replyTo || sender.fromEmail]
    };

    // Send email - FIXED: Removed .promise()
    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);
    
    console.log('Email sent successfully:', result.MessageId);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = { sendEmailViaSES };