const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const templateDesigns = {
  default: {
    name: 'Professional Default',
    preview: 'Clean and professional design with minimal styling',
    generate: (subject, body, senderName) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
        <div style="border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 25px;">
          <h2 style="color: #007bff; margin: 0;">${subject}</h2>
        </div>
        <div style="margin-bottom: 30px;">
          ${body}
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
          Best regards,<br>
          <strong>${senderName}</strong>
        </div>
      </div>
    `
  },
  elegant: {
    name: 'Elegant Minimalist',
    preview: 'Sophisticated design with subtle gradients and modern typography',
    generate: (subject, body, senderName) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 40px 20px;">
        <div style="background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 300;">${subject}</h1>
          </div>
          <div style="padding: 40px; line-height: 1.8; color: #444;">
            ${body}
          </div>
          <div style="padding: 20px 40px; background: #f8f9fa; border-top: 1px solid #e9ecef; font-style: italic; color: #6c757d;">
            Warm regards,<br>
            <span style="color: #495057; font-weight: 500;">${senderName}</span>
          </div>
        </div>
      </div>
    `
  },
  modern: {
    name: 'Modern Corporate',
    preview: 'Bold, contemporary design with geometric elements',
    generate: (subject, body, senderName) => `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(90deg, #ff6b6b, #ffd93d, #6bcf7f, #4ecdc4, #45b7d1); height: 5px;"></div>
        <div style="padding: 40px;">
          <div style="background: #2d2d2d; margin: -20px -20px 30px -20px; padding: 30px 20px; border-radius: 0 0 20px 20px;">
            <h1 style="color: #45b7d1; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">${subject}</h1>
          </div>
          <div style="line-height: 1.7; color: #e0e0e0;">
            ${body}
          </div>
          <div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #45b7d1; text-align: center;">
            <div style="color: #45b7d1; font-size: 18px; font-weight: bold;">${senderName}</div>
          </div>
        </div>
      </div>
    `
  },
  vibrant: {
    name: 'Vibrant & Colorful',
    preview: 'Eye-catching design with vibrant colors and playful elements',
    generate: (subject, body, senderName) => `
      <div style="font-family: 'Comic Sans MS', cursive, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(45deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%); padding: 20px; border-radius: 20px;">
        <div style="background: white; border-radius: 20px; padding: 0; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; position: relative;">
            <div style="position: absolute; top: 10px; right: 20px; width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 50%;"></div>
            <div style="position: absolute; bottom: 10px; left: 20px; width: 30px; height: 30px; background: rgba(255,255,255,0.3); border-radius: 50%;"></div>
            <h1 style="color: white; margin: 0; font-size: 22px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${subject}</h1>
          </div>
          <div style="padding: 30px; line-height: 1.6; color: #333; font-size: 16px;">
            ${body}
          </div>
          <div style="background: linear-gradient(90deg, #ff6b6b, #ffd93d, #6bcf7f); padding: 20px; text-align: center; color: white; font-weight: bold; font-size: 16px;">
            ${senderName}
          </div>
        </div>
      </div>
    `
  },
  luxury: {
    name: 'Luxury Premium',
    preview: 'Premium design with gold accents and sophisticated styling',
    generate: (subject, body, senderName) => `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; background: #0f0f0f; color: #e8e8e8; border: 2px solid #d4af37; border-radius: 8px;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border-bottom: 3px solid #d4af37; padding: 30px; text-align: center;">
          <div style="border: 1px solid #d4af37; padding: 20px; border-radius: 5px; display: inline-block;">
            <h1 style="color: #d4af37; margin: 0; font-size: 24px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">${subject}</h1>
          </div>
        </div>
        <div style="padding: 40px; line-height: 1.8; font-size: 16px;">
          ${body}
        </div>
        <div style="background: linear-gradient(135deg, '1a1a1a' 0%, '2d2d2d' 100%); border-top: 3px solid #d4af37; padding: 25px; text-align: center;">
          <div style="color: #d4af37; font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
            ${senderName}
          </div>
          <div style="color: #888; font-size: 12px; margin-top: 5px; font-style: italic;">
            Premium Service Excellence
          </div>
        </div>
      </div>
    `
  }
};

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

    // Send email
    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command).promise();
    console.log('Email sent successfully:', result.MessageId);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = { sendEmailViaSES };