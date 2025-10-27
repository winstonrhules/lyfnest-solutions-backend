
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
// const cron = require('node-cron');
// const mongoose = require('mongoose');


// class EmailScheduler {
//   constructor() {
//     this.isProcessing = false;
//     this.processingIds = new Set();
//     this.maxConcurrent = 3;
//   }

//   async init() {
//     // Clean up any stuck processing emails on startup
//     await this.cleanupStuckEmails();
    
//     // Schedule job to run every 5 minutes
//     cron.schedule('*/5 * * * *', () => this.processScheduledEmails());
//     console.log('✅ Backend email scheduler initialized with 5-minute intervals');
//   }

//   async cleanupStuckEmails() {
//     try {
//       const ScheduledEmail = mongoose.model('ScheduledEmail');
//       // Reset emails stuck in processing for more than 10 minutes
//       const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
//       const result = await ScheduledEmail.updateMany(
//         {
//           processing: true,
//           lastProcessingAttempt: { $lt: tenMinutesAgo },
//           sent: false
//         },
//         {
//           $set: {
//             processing: false,
//             lastError: 'Reset after being stuck in processing state'
//           },
//           $unset: { lastProcessingAttempt: 1 }
//         }
//       );
      
//       if (result.modifiedCount > 0) {
//         console.log(`🔄 Cleaned up ${result.modifiedCount} stuck emails`);
//       }
//     } catch (error) {
//       console.error('❌ Error cleaning up stuck emails:', error);
//     }
//   }
//   async processScheduledEmails() {
//   if (this.isProcessing) {
//     console.log('⏭️  Skipping: Already processing emails');
//     return;
//   }

//   this.isProcessing = true;
  
//   try {
//     const now = new Date();
//     const ScheduledEmail = mongoose.model('ScheduledEmail');
    
//     // CRITICAL FIX: Use atomic update to mark emails as processing
//     // This prevents multiple cron jobs from processing the same email
//     const markedEmails = await ScheduledEmail.updateMany(
//       {
//         scheduleDateTime: { $lte: now },
//         sent: false,
//         processing: false,
//         $or: [
//           { lastProcessingAttempt: { $exists: false } },
//           { lastProcessingAttempt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }
//         ]
//       },
//       {
//         $set: {
//           processing: true,
//           lastProcessingAttempt: new Date()
//         }
//       }
//     );

//     if (markedEmails.modifiedCount > 0) {
//       console.log(`📧 Marked ${markedEmails.modifiedCount} emails for processing`);
//     }

//     // Now find only the emails we just marked as processing
//     const emailsToProcess = await ScheduledEmail.find({
//       scheduleDateTime: { $lte: now },
//       sent: false,
//       processing: true,
//       lastProcessingAttempt: new Date() // Very recent
//     })
//     .sort({ scheduleDateTime: 1 })
//     .limit(this.maxConcurrent);

//     if (emailsToProcess.length > 0) {
//       console.log(`🔄 Processing ${emailsToProcess.length} emails`);
//     }

//     // Process emails with proper error handling
//     for (const email of emailsToProcess) {
//       if (this.processingIds.has(email._id.toString())) {
//         console.log(`⏭️  Skipping email ${email._id}: Already in processing`);
//         continue;
//       }

//       this.processingIds.add(email._id.toString());
      
//       try {
//         console.log(`🔄 Processing email: ${email._id}`);
//         await this.processSingleEmail(email);
        
//         // Mark as sent successfully
//         await ScheduledEmail.findByIdAndUpdate(email._id, {
//           sent: true,
//           sentAt: new Date(),
//           processing: false,
//           processed: true, // ADD THIS
//           $unset: { 
//             lastProcessingAttempt: 1, 
//             lastError: 1
//           }
//         });
        
//         console.log(`✅ Successfully sent scheduled email: ${email._id}`);
//       } catch (error) {
//         console.error(`❌ Failed to process email ${email._id}:`, error);
        
//         // Mark as failed but allow retry
//         await ScheduledEmail.findByIdAndUpdate(email._id, {
//           processing: false,
//           lastError: error.message,
//           $inc: { retryCount: 1 }
//         });
//       } finally {
//         this.processingIds.delete(email._id.toString());
//       }
//     }
//   } catch (error) {
//     console.error('❌ Error in email scheduler main loop:', error);
//   } finally {
//     this.isProcessing = false;
//   }
// } 

//     async processSingleEmail(email) {
//     const { sendEmailViaSES } = require('./sesService');
//     const { replaceTemplateVariables } = require('./templateService');

//     try {
//       // Get company settings
//       const UserSettings = mongoose.model('UserSettings');
//       const settings = await UserSettings.findOne();
//       const companySettings = settings?.companySettings || {};

//       if (email.recipients.length === 1 && email.recipientContacts?.length > 0) {
//         // Individual email - personalize it
//         const recipientContact = email.recipientContacts[0];
        
//         const personalizedSubject = replaceTemplateVariables(email.subject, recipientContact, companySettings);
//         const personalizedBody = replaceTemplateVariables(email.body, recipientContact, companySettings);
        
//         const personalizedSender = {
//           ...email.sender,
//           replyTo: email.recipients[0]
//         };
        
//         const emailPayload = {
//           recipients: email.recipients,
//           subject: personalizedSubject,
//           body: personalizedBody,
//           sender: personalizedSender,
//           attachments: email.attachments || [],
//           design: email.design || 'default'
//         };
        
//         await sendEmailViaSES(emailPayload);
//       } else {
//         // Bulk email
//         const emailPayload = {
//           recipients: email.recipients,
//           subject: email.subject,
//           body: email.body,
//           sender: email.sender,
//           attachments: email.attachments || [],
//           design: email.design || 'default'
//         };
        
//         await sendEmailViaSES(emailPayload);
//       }
//     } catch (error) {
//       console.error(`❌ Error sending email ${email._id}:`, error);
//       throw error; // Re-throw to handle in parent function
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
//           pending: [
//             { 
//               $match: { 
//                 scheduleDateTime: { $lte: now },
//                 sent: false,
//                 processing: false
//               } 
//             }, 
//             { $count: "count" }
//           ],
//           processing: [{ $match: { processing: true } }, { $count: "count" }],
//           future: [
//             { 
//               $match: { 
//                 scheduleDateTime: { $gt: now },
//                 sent: false
//               } 
//             }, 
//             { $count: "count" }
//           ],
//           failed: [
//             { 
//               $match: { 
//                 lastError: { $exists: true },
//                 sent: false
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
//       isProcessing: this.isProcessing,
//       timestamp: new Date()
//     };
//   }
// }

// module.exports = EmailScheduler;



// // server/services/emailScheduler.js
// const cron = require('node-cron');
// const mongoose = require('mongoose');

// class EmailScheduler {
//   constructor() {
//     this.isProcessing = false;
//     this.processingIds = new Set();
//     this.maxConcurrent = 3;
//   }

//   async init() {
//     // Clean up any stuck processing emails on startup
//     await this.cleanupStuckEmails();
    
//     // Schedule job to run every 2 minutes
//     cron.schedule('*/2 * * * *', () => this.processScheduledEmails());
//     console.log('✅ Backend email scheduler initialized with 2-minute intervals');
//   }

//   async cleanupStuckEmails() {
//     try {
//       const ScheduledEmail = mongoose.model('ScheduledEmail');
//       // Reset emails stuck in processing for more than 10 minutes
//       const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
//       const result = await ScheduledEmail.updateMany(
//         {
//           processing: true,
//           lastProcessingAttempt: { $lt: tenMinutesAgo },
//           sent: false
//         },
//         {
//           $set: {
//             processing: false,
//             lastError: 'Reset after being stuck in processing state'
//           }
//         }
//       );
      
//       if (result.modifiedCount > 0) {
//         console.log(`🔄 Cleaned up ${result.modifiedCount} stuck emails`);
//       }
//     } catch (error) {
//       console.error('❌ Error cleaning up stuck emails:', error);
//     }
//   }

//   async processScheduledEmails() {
//     if (this.isProcessing) {
//       console.log('⏭️  Skipping: Already processing emails');
//       return;
//     }

//     this.isProcessing = true;
    
//     try {
//       const now = new Date();
//       const ScheduledEmail = mongoose.model('ScheduledEmail');
      
//       // CRITICAL FIX: Use findOneAndUpdate with atomic operations to prevent duplicates
//       // Process emails one at a time with proper locking
//       for (let i = 0; i < this.maxConcurrent; i++) {
//         // Atomically find and mark an email as processing
//         const emailToProcess = await ScheduledEmail.findOneAndUpdate(
//           {
//             scheduleDateTime: { $lte: now },
//             sent: false,
//             processing: false, // Only get emails NOT being processed
//             $or: [
//               { processed: { $exists: false } },
//               { processed: false }
//             ]
//           },
//           {
//             $set: {
//               processing: true,
//               lastProcessingAttempt: new Date()
//             }
//           },
//           {
//             sort: { scheduleDateTime: 1 }, // Process oldest first
//             new: false // Return original document before update
//           }
//         );

//         // If no email found, break the loop
//         if (!emailToProcess) {
//           if (i === 0) {
//             console.log('📭 No pending emails to process');
//           }
//           break;
//         }

//         // Check if already in processing set (extra safety)
//         if (this.processingIds.has(emailToProcess._id.toString())) {
//           console.log(`⏭️  Skipping email ${emailToProcess._id}: Already in local processing`);
//           continue;
//         }

//         this.processingIds.add(emailToProcess._id.toString());
        
//         try {
//           console.log(`🔄 Processing email: ${emailToProcess._id}`);
//           await this.processSingleEmail(emailToProcess);
          
//           // CRITICAL FIX: Mark as sent AND processed with atomic update
//           await ScheduledEmail.findOneAndUpdate(
//             { 
//               _id: emailToProcess._id,
//               sent: false // Only update if not already sent
//             },
//             {
//               $set: {
//                 sent: true,
//                 processed: true, // Mark as processed
//                 sentAt: new Date(),
//                 processing: false
//               },
//               $unset: { 
//                 lastProcessingAttempt: 1,
//                 lastError: 1
//               }
//             }
//           );
          
//           console.log(`✅ Successfully sent scheduled email: ${emailToProcess._id}`);
//         } catch (error) {
//           console.error(`❌ Failed to process email ${emailToProcess._id}:`, error);
          
//           // Mark as failed but allow retry (don't mark as processed)
//           await ScheduledEmail.findByIdAndUpdate(emailToProcess._id, {
//             processing: false,
//             lastError: error.message,
//             $inc: { retryCount: 1 }
//           });
//         } finally {
//           this.processingIds.delete(emailToProcess._id.toString());
//         }
//       }
//     } catch (error) {
//       console.error('❌ Error in email scheduler main loop:', error);
//     } finally {
//       this.isProcessing = false;
//     }
//   }

//   async processSingleEmail(email) {
//     const { sendEmailViaSES } = require('./sesService');
//     const { replaceTemplateVariables } = require('./templateService');

//     try {
//       // Get company settings
//       const UserSettings = mongoose.model('UserSettings');
//       const settings = await UserSettings.findOne();
//       const companySettings = settings?.companySettings || {};

//       if (email.recipients.length === 1 && email.recipientContacts?.length > 0) {
//         // Individual email - personalize it
//         const recipientContact = email.recipientContacts[0];
        
//         const personalizedSubject = replaceTemplateVariables(email.subject, recipientContact, companySettings);
//         const personalizedBody = replaceTemplateVariables(email.body, recipientContact, companySettings);
        
//         const personalizedSender = {
//           ...email.sender,
//           replyTo: email.recipients[0]
//         };
        
//         const emailPayload = {
//           recipients: email.recipients,
//           subject: personalizedSubject,
//           body: personalizedBody,
//           sender: personalizedSender,
//           attachments: email.attachments || [],
//           design: email.design || 'default'
//         };
        
//         await sendEmailViaSES(emailPayload);
//       } else {
//         // Bulk email
//         const emailPayload = {
//           recipients: email.recipients,
//           subject: email.subject,
//           body: email.body,
//           sender: email.sender,
//           attachments: email.attachments || [],
//           design: email.design || 'default'
//         };
        
//         await sendEmailViaSES(emailPayload);
//       }
//     } catch (error) {
//       console.error(`❌ Error sending email ${email._id}:`, error);
//       throw error;
//     }
//   }

//   async getStatus() {
//     const ScheduledEmail = mongoose.model('ScheduledEmail');
//     const now = new Date();
    
//     const stats = await ScheduledEmail.aggregate([
//       {
//         $facet: {
//           total: [{ $count: "count" }],
//           sent: [{ $match: { sent: true } }, { $count: "count" }],
//           pending: [
//             { 
//               $match: { 
//                 scheduleDateTime: { $lte: now },
//                 sent: false,
//                 processing: false
//               } 
//             }, 
//             { $count: "count" }
//           ],
//           processing: [{ $match: { processing: true } }, { $count: "count" }],
//           future: [
//             { 
//               $match: { 
//                 scheduleDateTime: { $gt: now },
//                 sent: false
//               } 
//             }, 
//             { $count: "count" }
//           ],
//           failed: [
//             { 
//               $match: { 
//                 lastError: { $exists: true },
//                 sent: false
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
//       isProcessing: this.isProcessing,
//       timestamp: new Date()
//     };
//   }
// }

// module.exports = EmailScheduler;



const cron = require('node-cron');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

class RobustEmailScheduler {
  constructor() {
    this.processing = new Map();
    this.maxConcurrent = 5;
    this.lockDuration = 300000; // 5 minutes
    this.cleanupInterval = 60000; // 1 minute
  }

  async init() {
    // Clean up any stuck emails on startup
    await this.cleanupStuckEmails();
    
    // Schedule main processing job every minute
    cron.schedule('* * * * *', () => this.processScheduledEmails());
    
    // Schedule cleanup job every 5 minutes
    cron.schedule('*/5 * * * *', () => this.cleanupStuckEmails());
    
    console.log('✅ Robust email scheduler initialized');
  }

  async cleanupStuckEmails() {
    try {
      const ScheduledEmail = mongoose.model('ScheduledEmail');
      const now = new Date();
      
      // Reset emails stuck in processing for longer than lock duration
      const result = await ScheduledEmail.updateMany(
        {
          status: 'processing',
          processingLockExpires: { $lt: now }
        },
        {
          $set: {
            status: 'pending',
            processingLock: null,
            processingLockExpires: null,
            lastError: 'Reset after processing timeout'
          },
          $inc: { retryCount: 1 }
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
    try {
      const ScheduledEmail = mongoose.model('ScheduledEmail');
      const processableEmails = await ScheduledEmail.findProcessableEmails(this.maxConcurrent);
      
      if (processableEmails.length === 0) {
        return;
      }

      console.log(`📧 Processing ${processableEmails.length} scheduled emails`);
      
      const processingPromises = processableEmails.map(email => 
        this.processSingleEmail(email)
      );
      
      await Promise.allSettled(processingPromises);
      
    } catch (error) {
      console.error('❌ Error in email scheduler main loop:', error);
    }
  }

  async processSingleEmail(email) {
    const lockId = uuidv4();
    let lockAcquired = false;

    try {
      // Try to acquire lock for this email
      lockAcquired = await email.acquireLock(lockId, this.lockDuration);
      
      if (!lockAcquired) {
        console.log(`⏭️  Skipping email ${email._id}: Could not acquire lock`);
        return;
      }

      console.log(`🔄 Processing email: ${email._id}`);
      
      // Track processing in memory
      this.processing.set(email._id.toString(), {
        lockId,
        startedAt: new Date()
      });

      // Send the email
      await this.sendEmail(email);
      
      // Mark as sent successfully
      await this.markEmailAsSent(email, lockId);
      
      console.log(`✅ Successfully sent scheduled email: ${email._id}`);
      
    } catch (error) {
      console.error(`❌ Failed to process email ${email._id}:`, error);
      await this.handleProcessingError(email, lockId, error);
    } finally {
      // Clean up processing tracking
      this.processing.delete(email._id.toString());
      
      // Release lock if we acquired it
      if (lockAcquired) {
        try {
          await email.releaseLock(lockId);
        } catch (releaseError) {
          console.error(`❌ Error releasing lock for email ${email._id}:`, releaseError);
        }
      }
    }
  }

  async sendEmail(email) {
    const { sendEmailViaSES } = require('./sesService');
    const { replaceTemplateVariables } = require('./templateService');

    try {
      // Get company settings
      const UserSettings = mongoose.model('UserSettings');
      const settings = await UserSettings.findOne();
      const companySettings = settings?.companySettings || {};

      let emailPayload;

      if (email.recipients.length === 1 && email.recipientContacts?.length > 0) {
        // Individual email - personalize it
        const recipientContact = email.recipientContacts[0];
        
        const personalizedSubject = replaceTemplateVariables(email.subject, recipientContact, companySettings);
        const personalizedBody = replaceTemplateVariables(email.body, recipientContact, companySettings);
        
        const personalizedSender = {
          ...email.sender,
          replyTo: email.recipients[0]
        };
        
        emailPayload = {
          recipients: email.recipients,
          subject: personalizedSubject,
          body: personalizedBody,
          sender: personalizedSender,
          attachments: email.attachments || [],
          design: email.design || 'default'
        };
      } else {
        // Bulk email
        emailPayload = {
          recipients: email.recipients,
          subject: email.subject,
          body: email.body,
          sender: email.sender,
          attachments: email.attachments || [],
          design: email.design || 'default'
        };
      }
      
      await sendEmailViaSES(emailPayload);
      
    } catch (error) {
      console.error(`❌ Error in sendEmail for ${email._id}:`, error);
      throw error;
    }
  }

  async markEmailAsSent(email, lockId) {
    const ScheduledEmail = mongoose.model('ScheduledEmail');
    
    const result = await ScheduledEmail.updateOne(
      {
        _id: email._id,
        processingLock: lockId
      },
      {
        $set: {
          sent: true,
          status: 'sent',
          sentAt: new Date(),
          processingLock: null,
          processingLockExpires: null
        },
        $unset: {
          lastProcessingAttempt: 1,
          error: 1
        }
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Failed to mark email as sent - lock validation failed');
    }
  }

  async handleProcessingError(email, lockId, error) {
    const ScheduledEmail = mongoose.model('ScheduledEmail');
    
    try {
      const updateData = {
        $set: {
          status: email.retryCount >= email.maxRetries ? 'failed' : 'pending',
          processingLock: null,
          processingLockExpires: null,
          lastError: error.message,
          lastProcessingAttempt: new Date()
        },
        $inc: { retryCount: 1 }
      };

      await ScheduledEmail.updateOne(
        { _id: email._id },
        updateData
      );
      
      if (email.retryCount >= email.maxRetries) {
        console.log(`🛑 Email ${email._id} marked as failed after ${email.retryCount} retries`);
      }
    } catch (updateError) {
      console.error(`❌ Error updating failed email ${email._id}:`, updateError);
    }
  }

  async getStatus() {
    const ScheduledEmail = mongoose.model('ScheduledEmail');
    
    const stats = await ScheduledEmail.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          sent: [{ $match: { sent: true } }, { $count: "count" }],
          pending: [
            { 
              $match: { 
                scheduleDateTime: { $lte: new Date() },
                sent: false,
                status: 'pending'
              } 
            }, 
            { $count: "count" }
          ],
          processing: [{ $match: { status: 'processing' } }, { $count: "count" }],
          future: [
            { 
              $match: { 
                scheduleDateTime: { $gt: new Date() },
                sent: false
              } 
            }, 
            { $count: "count" }
          ],
          failed: [
            { 
              $match: { 
                status: 'failed'
              } 
            }, 
            { $count: "count" }
          ]
        }
      }
    ]);
    
    return {
      ...stats[0],
      processingCount: this.processing.size,
      timestamp: new Date()
    };
  }
}

module.exports = RobustEmailScheduler;