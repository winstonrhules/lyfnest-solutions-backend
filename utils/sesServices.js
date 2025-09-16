// const AWS = require("@aws-sdk/client-ses");

// // Configure AWS SES
// const ses = new AWS.SES({
//   region: process.env.AWS_REGION,
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
// });

// const sendEmailViaSES = async (emailData) => {
//   try {
//     const params = {
//       Source: `${emailData.sender.fromName} <${emailData.sender.fromEmail}>`,
//       Destination: {
//         ToAddresses: emailData.recipients,
//         CcAddresses: emailData.cc || [],
//         BccAddresses: emailData.bcc || []
//       },
//       Message: {
//         Subject: {
//           Data: emailData.subject,
//           Charset: 'UTF-8'
//         },
//         Body: {
//           Html: {
//             Data: emailData.body,
//             Charset: 'UTF-8'
//           }
//         }
//       },
//       ReplyToAddresses: [emailData.sender.replyTo || emailData.sender.fromEmail]
//     };

//     const result = await ses.sendEmail(params).promise();
//     return result;
//   } catch (error) {
//     console.error('SES Error:', error);
//     throw error;
//   }  
// };

// module.exports = { sendEmailViaSES };