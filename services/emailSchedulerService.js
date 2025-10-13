
// // server/services/emailScheduler.js
// const cron = require('node-cron');
// const mongoose = require('mongoose');
// const { sendEmailViaSES } = require('../services/sesService');
// const { replaceTemplateVariables } = require('../services/templateService');

// class EmailScheduler {
//   constructor() {
//     this.isProcessing = false;
//     this.retryDelays = [2000, 5000, 10000, 30000]; // Increased initial delay
//     this.processingIds = new Set();
//     this.maxConcurrent = 3; // Process fewer emails at once
//   }

//   async init() {
//     // Clean up any emails stuck in processing state
//     await this.cleanupStuckEmails();
    
//     // Schedule job to run every 2 minutes instead of every minute
//     cron.schedule('*/2 * * * *', () => this.processScheduledEmails());
//     console.log('Email scheduler initialized with 2-minute intervals');
//   }

//   async cleanupStuckEmails() {
//     try {
//       const ScheduledEmail = mongoose.model('ScheduledEmail');
//       // Reset emails that were stuck in processing state for more than 15 minutes
//       const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
//       const result = await ScheduledEmail.updateMany(
//         {
//           processing: true,
//           lastProcessingAttempt: { $lt: fifteenMinutesAgo },
//           sent: false
//         },
//         {
//           $set: {
//             processing: false,
//             lastError: 'Reset after being stuck in processing state'
//           }
//         }
//       );
      
//       console.log(`Cleaned up ${result.modifiedCount} stuck emails`);
//     } catch (error) {
//       console.error('Error cleaning up stuck emails:', error);
//     }
//   }

//   async processScheduledEmails() {
//     if (this.isProcessing) {
//       console.log('Skipping: Already processing emails');
//       return;
//     }

//     this.isProcessing = true;
    
//     try {
//       const now = new Date();
//       const ScheduledEmail = mongoose.model('ScheduledEmail');
      
//       // Find emails that are due and not processed - use more specific query
//       const emailsToProcess = await ScheduledEmail.find({
//         scheduleDateTime: { $lte: now },
//         sent: false,
//         processing: false,
//         failed: { $ne: true },
//         $or: [
//           { nextRetry: { $lte: now } },
//           { nextRetry: { $exists: false } }
//         ]
//       })
//       .sort({ scheduleDateTime: 1 }) // Process oldest first
//       .limit(this.maxConcurrent); // Process fewer emails at once

//       console.log(`Found ${emailsToProcess.length} emails to process`);

//       // Process each email sequentially with delays to avoid conflicts
//       for (const email of emailsToProcess) {
//         if (this.processingIds.has(email._id.toString())) {
//           console.log(`Skipping email ${email._id}: Already being processed`);
//           continue;
//         }

//         this.processingIds.add(email._id.toString());
        
//         try {
//           // Add a small delay between processing each email
//           await new Promise(resolve => setTimeout(resolve, 500));
          
//           await this.processSingleEmail(email);
//         } catch (error) {
//           console.error(`Failed to process email ${email._id}:`, error);
//         } finally {
//           this.processingIds.delete(email._id.toString());
//         }
//       }
//     } catch (error) {
//       console.error('Error in email scheduler:', error);
//     } finally {
//       this.isProcessing = false;
//     }
//   }

//   async processSingleEmail(email) {
//     const ScheduledEmail = mongoose.model('ScheduledEmail');
    
//     try {
//       // Use findOneAndUpdate with atomic operations to avoid conflicts
//       const updatedEmail = await ScheduledEmail.findOneAndUpdate(
//         {
//           _id: email._id,
//           processing: false, // Only update if not already processing
//           sent: false
//         },
//         {
//           $set: {
//             processing: true,
//             lastProcessingAttempt: new Date()
//           }
//         },
//         { 
//           new: true,
//           runValidators: true 
//         }
//       );

//       if (!updatedEmail) {
//         console.log(`Email ${email._id} is already being processed or sent`);
//         return;
//       }

//       // Send the email
//       await this.sendScheduledEmail(updatedEmail);
      
//       // Mark as sent using atomic operation
//       await ScheduledEmail.findOneAndUpdate(
//         { _id: updatedEmail._id },
//         {
//           $set: {
//             sent: true,
//             sentAt: new Date(),
//             processing: false
//           }
//         },
//         { runValidators: true }
//       );
      
//       console.log(`Successfully sent scheduled email: ${updatedEmail._id}`);
//     } catch (error) {
//       console.error(`Error processing email ${email._id}:`, error);
      
//       // Handle retry logic with atomic operation
//       await this.handleProcessingError(email, error);
//     }
//   }

//   async sendScheduledEmail(email) {
//     // Get company settings for template variables
//     const UserSettings = mongoose.model('UserSettings');
//     const settings = await UserSettings.findOne();
//     const companySettings = settings ? settings.companySettings : {};

//     if (email.recipients.length === 1 && email.recipientContacts && email.recipientContacts.length > 0) {
//       // Individual email - personalize it
//       const recipientContact = email.recipientContacts[0];
      
//       // Personalize subject and body
//       const personalizedSubject = replaceTemplateVariables(email.subject, recipientContact, companySettings);
//       const personalizedBody = replaceTemplateVariables(email.body, recipientContact, companySettings);
      
//       // Create personalized sender settings
//       const personalizedSender = {
//         ...email.sender,
//         replyTo: email.recipients[0]
//       };
      
//       const emailPayload = {
//         recipients: email.recipients,
//         subject: personalizedSubject,
//         body: personalizedBody,
//         sender: personalizedSender,
//         attachments: email.attachments || [],
//         design: email.design || 'default'
//       };
      
//       await sendEmailViaSES(emailPayload);
//     } else {
//       // Bulk email - send as is
//       const emailPayload = {
//         recipients: email.recipients,
//         subject: email.subject,
//         body: email.body,
//         sender: email.sender,
//         attachments: email.attachments || [],
//         design: email.design || 'default'
//       };
      
//       await sendEmailViaSES(emailPayload);
//     }
//   }

//   async handleProcessingError(email, error) {
//     const ScheduledEmail = mongoose.model('ScheduledEmail');
    
//     try {
//       // Get the latest version of the email with atomic operation
//       const currentEmail = await ScheduledEmail.findOneAndUpdate(
//         { _id: email._id },
//         { 
//           $inc: { retryCount: 1 },
//           $set: { lastError: error.message }
//         },
//         { new: true, runValidators: true }
//       );
      
//       if (!currentEmail) return;
      
//       const retryCount = currentEmail.retryCount || 1;
      
//       // Check if we should retry again
//       if (retryCount <= this.retryDelays.length) {
//         // Schedule next retry
//         const delayMs = this.retryDelays[retryCount - 1];
//         const nextRetry = new Date(Date.now() + delayMs);
        
//         await ScheduledEmail.findOneAndUpdate(
//           { _id: email._id },
//           {
//             $set: {
//               nextRetry,
//               processing: false
//             }
//           },
//           { runValidators: true }
//         );
        
//         console.log(`Scheduled retry ${retryCount} for email ${email._id} in ${delayMs}ms`);
//       } else {
//         // Max retries exceeded, mark as failed
//         await ScheduledEmail.findOneAndUpdate(
//           { _id: email._id },
//           {
//             $set: {
//               sent: false,
//               processing: false,
//               failed: true,
//               lastError: `Max retries exceeded: ${error.message}`
//             }
//           },
//           { runValidators: true }
//         );
        
//         console.error(`Max retries exceeded for email ${email._id}`);
//       }
//     } catch (updateError) {
//       console.error(`Error updating retry status for email ${email._id}:`, updateError);
//     }
//   }

//   // Method to get scheduler status for diagnostics
//   async getStatus() {
//     const ScheduledEmail = mongoose.model('ScheduledEmail');
//     const now = new Date();
    
//     const stats = await ScheduledEmail.aggregate([
//       {
//         $facet: {
//           total: [{ $count: "count" }],
//           sent: [{ $match: { sent: true } }, { $count: "count" }],
//           pending: [{ $match: { sent: false, failed: false } }, { $count: "count" }],
//           failed: [{ $match: { failed: true } }, { $count: "count" }],
//           processing: [{ $match: { processing: true } }, { $count: "count" }],
//           due: [
//             { 
//               $match: { 
//                 scheduleDateTime: { $lte: now },
//                 sent: false,
//                 failed: false
//               } 
//             }, 
//             { $count: "count" }
//           ]
//         }
//       }
//     ]);
    
//     return {
//       ...stats[0],
//       processingIds: Array.from(this.processingIds),
//       isProcessing: this.isProcessing
//     };
//   }
// }

// module.exports = EmailScheduler;   




// server/services/emailScheduler.js
const cron = require('node-cron');
const mongoose = require('mongoose');

class EmailScheduler {
  constructor() {
    this.isProcessing = false;
    this.processingIds = new Set();
    this.maxConcurrent = 3;
  }

  async init() {
    // Clean up any stuck processing emails on startup
    await this.cleanupStuckEmails();
    
    // Schedule job to run every 2 minutes
    cron.schedule('*/2 * * * *', () => this.processScheduledEmails());
    console.log('✅ Backend email scheduler initialized with 2-minute intervals');
  }

  async cleanupStuckEmails() {
    try {
      const ScheduledEmail = mongoose.model('ScheduledEmail');
      // Reset emails stuck in processing for more than 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
      const result = await ScheduledEmail.updateMany(
        {
          processing: true,
          lastProcessingAttempt: { $lt: tenMinutesAgo },
          sent: false
        },
        {
          $set: {
            processing: false,
            lastError: 'Reset after being stuck in processing state'
          },
          $unset: { lastProcessingAttempt: 1 }
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`🔄 Cleaned up ${result.modifiedCount} stuck emails`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up stuck emails:', error);
    }
  }

  async processScheduledEmails() {
    if (this.isProcessing) {
      console.log('⏭️  Skipping: Already processing emails');
      return;
    }

    this.isProcessing = true;
    
    try {
      const now = new Date();
      const ScheduledEmail = mongoose.model('ScheduledEmail');
      
      // Find emails that are due, not sent, and not currently being processed
      const emailsToProcess = await ScheduledEmail.find({
        scheduleDateTime: { $lte: now },
        sent: false,
        processing: { $ne: true }
      })
      .sort({ scheduleDateTime: 1 })
      .limit(this.maxConcurrent);

      if (emailsToProcess.length > 0) {
        console.log(`📧 Found ${emailsToProcess.length} emails to process`);
      }

      // Process emails with proper error handling
      for (const email of emailsToProcess) {
        if (this.processingIds.has(email._id.toString())) {
          console.log(`⏭️  Skipping email ${email._id}: Already in processing`);
          continue;
        }

        this.processingIds.add(email._id.toString());
        
        try {
          // Mark as processing immediately in database
          await ScheduledEmail.findByIdAndUpdate(email._id, {
            processing: true,
            lastProcessingAttempt: new Date()
          });

          console.log(`🔄 Processing email: ${email._id}`);
          await this.processSingleEmail(email);
          
          // Mark as sent successfully
          await ScheduledEmail.findByIdAndUpdate(email._id, {
            sent: true,
            sentAt: new Date(),
            processing: false,
            $unset: { 
              lastProcessingAttempt: 1, 
              lastError: 1,
              nextRetry: 1 
            }
          });
          
          console.log(`✅ Successfully sent scheduled email: ${email._id}`);
        } catch (error) {
          console.error(`❌ Failed to process email ${email._id}:`, error);
          
          // Mark as failed but allow retry
          await ScheduledEmail.findByIdAndUpdate(email._id, {
            processing: false,
            lastError: error.message,
            $inc: { retryCount: 1 }
          });
        } finally {
          this.processingIds.delete(email._id.toString());
        }
      }
    } catch (error) {
      console.error('❌ Error in email scheduler main loop:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processSingleEmail(email) {
    const { sendEmailViaSES } = require('./sesService');
    const { replaceTemplateVariables } = require('./templateService');

    try {
      // Get company settings
      const UserSettings = mongoose.model('UserSettings');
      const settings = await UserSettings.findOne();
      const companySettings = settings?.companySettings || {};

      if (email.recipients.length === 1 && email.recipientContacts?.length > 0) {
        // Individual email - personalize it
        const recipientContact = email.recipientContacts[0];
        
        const personalizedSubject = replaceTemplateVariables(email.subject, recipientContact, companySettings);
        const personalizedBody = replaceTemplateVariables(email.body, recipientContact, companySettings);
        
        const personalizedSender = {
          ...email.sender,
          replyTo: email.recipients[0]
        };
        
        const emailPayload = {
          recipients: email.recipients,
          subject: personalizedSubject,
          body: personalizedBody,
          sender: personalizedSender,
          attachments: email.attachments || [],
          design: email.design || 'default'
        };
        
        await sendEmailViaSES(emailPayload);
      } else {
        // Bulk email
        const emailPayload = {
          recipients: email.recipients,
          subject: email.subject,
          body: email.body,
          sender: email.sender,
          attachments: email.attachments || [],
          design: email.design || 'default'
        };
        
        await sendEmailViaSES(emailPayload);
      }
    } catch (error) {
      console.error(`❌ Error sending email ${email._id}:`, error);
      throw error; // Re-throw to handle in parent function
    }
  }

  // Method to get scheduler status for diagnostics
  async getStatus() {
    const ScheduledEmail = mongoose.model('ScheduledEmail');
    const now = new Date();
    
    const stats = await ScheduledEmail.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          sent: [{ $match: { sent: true } }, { $count: "count" }],
          pending: [
            { 
              $match: { 
                scheduleDateTime: { $lte: now },
                sent: false,
                processing: false
              } 
            }, 
            { $count: "count" }
          ],
          processing: [{ $match: { processing: true } }, { $count: "count" }],
          future: [
            { 
              $match: { 
                scheduleDateTime: { $gt: now },
                sent: false
              } 
            }, 
            { $count: "count" }
          ],
          failed: [
            { 
              $match: { 
                lastError: { $exists: true },
                sent: false
              } 
            }, 
            { $count: "count" }
          ]
        }
      }
    ]);
    
    return {
      ...stats[0],
      processingIds: Array.from(this.processingIds),
      isProcessing: this.isProcessing,
      timestamp: new Date()
    };
  }
}

module.exports = EmailScheduler;