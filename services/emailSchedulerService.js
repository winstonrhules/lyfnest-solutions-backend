
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

// services/EmailSchedulerService.js
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const EmailSchedule = require('../models/emailScheduleModels');
const { sendEmailViaSES } = require('./sesService');
const { replaceTemplateVariables } = require('./templateService');
const mongoose = require('mongoose');

class EmailSchedulerService {
  constructor() {
    this.processId = `scheduler-${uuidv4().substring(0, 8)}`;
    this.isRunning = false;
    this.cronJob = null;
    this.processingJobs = new Map();
    this.dbConnected = false;
    
    // Listen for connection events
    mongoose.connection.on('connected', () => {
      this.dbConnected = true;
      console.log('✅ Database connected - scheduler ready');
    });
    
    mongoose.connection.on('disconnected', () => {
      this.dbConnected = false;
      console.log('❌ Database disconnected - scheduler paused');
    });
  }

  /**
   * Initialize the scheduler
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Email scheduler already running');
      return;
    }

    console.log(`🚀 Starting Email Scheduler [${this.processId}]`);
    
    // Wait for database connection before starting
    if (!this.dbConnected) {
      console.log('⏳ Waiting for database connection before starting scheduler...');
      await this.waitForConnection();
    }
    
    // Cleanup any stale locks on startup
    await this.cleanupStaleLocks();
    
    // Run immediately on startup
    await this.processScheduledEmails();
    
    // Schedule to run every minute
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.processScheduledEmails();
    });
    
    // Cleanup old jobs daily at midnight
    cron.schedule('0 0 * * *', async () => {
      await this.cleanupOldJobs();
    });
    
    this.isRunning = true;
    console.log('✅ Email scheduler started successfully');
  }

  /**
   * Wait for database connection
   */
  async waitForConnection(maxWaitTime = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      if (mongoose.connection.readyState === 1) {
        this.dbConnected = true;
        return true;
      }
      // Wait for 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Database connection timeout');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 Email scheduler stopped');
  }

  /**
   * Main processing loop
   */
  async processScheduledEmails() {
    try {
      // Check database connection first
      if (!this.dbConnected || mongoose.connection.readyState !== 1) {
        console.log('⏳ Skipping processing - database not connected');
        return;
      }

      // Find jobs ready to process
      const jobs = await EmailSchedule.findJobsToProcess(5, this.processId);
      
      if (jobs.length === 0) {
        return;  // Nothing to process
      }

      console.log(`📬 Found ${jobs.length} jobs to process`);

      // Process jobs in parallel with controlled concurrency
      const processPromises = jobs.map(job => this.processJob(job));
      await Promise.allSettled(processPromises);
      
    } catch (error) {
      console.error('❌ Error in scheduler loop:', error);
    }
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    const jobId = job.jobId;
    
    // Check if already processing this job
    if (this.processingJobs.has(jobId)) {
      console.log(`⏭️  Job ${jobId} already being processed`);
      return;
    }

    this.processingJobs.set(jobId, true);

    try {
      // Try to acquire lock
      const lockAcquired = await job.acquireLock(this.processId);
      
      if (!lockAcquired) {
        console.log(`🔒 Could not acquire lock for job ${jobId}`);
        return;
      }

      console.log(`🔄 Processing job ${jobId} for ${job.recipients.length} recipient(s)`);

      // Process all recipients
      const results = await this.sendToAllRecipients(job);
      
      // Mark as completed
      await job.markCompleted(results);
      
      console.log(`✅ Job ${jobId} completed successfully`);
      
    } catch (error) {
      console.error(`❌ Error processing job ${jobId}:`, error);
      
      // Mark as failed (will retry if attempts < maxAttempts)
      await job.markFailed(error.message);
      
    } finally {
      this.processingJobs.delete(jobId);
    }
  }

  /**
   * Send email to all recipients
   */
  async sendToAllRecipients(job) {
    const results = [];
    
    // Get company settings for variable replacement
    const UserSettings = require('../models/userSettingModels');
    const settings = await UserSettings.findOne();
    const companySettings = settings?.companySettings || {};

    for (const recipient of job.recipients) {
      try {
        // Personalize email for this recipient
        const personalizedSubject = replaceTemplateVariables(
          job.subject,
          recipient.contactData || {},
          companySettings
        );
        
        const personalizedBody = replaceTemplateVariables(
          job.bodyTemplate,
          recipient.contactData || {},
          companySettings
        );

        // Prepare email payload
        const emailPayload = {
          recipients: [recipient.email],
          subject: personalizedSubject,
          body: personalizedBody,
          sender: job.sender,
          attachments: job.attachments || [],
          design: job.design || 'default'
        };

        // Send email
        await sendEmailViaSES(emailPayload);
        
        results.push({
          recipientEmail: recipient.email,
          success: true,
          sentAt: new Date()
        });
        
        console.log(`✉️  Sent to ${recipient.email}`);
        
      } catch (error) {
        console.error(`❌ Failed to send to ${recipient.email}:`, error);
        
        results.push({
          recipientEmail: recipient.email,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Cleanup stale locks (locks older than 5 minutes)
   */
  async cleanupStaleLocks() {
    // Wait for database connection
    if (!this.dbConnected || mongoose.connection.readyState !== 1) {
      console.log('⏳ Database not connected, skipping stale lock cleanup');
      return;
    }

    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const result = await EmailSchedule.updateMany(
        {
          status: 'processing',
          lockedAt: { $lt: fiveMinutesAgo }
        },
        {
          $set: {
            status: 'pending',
            lockedAt: null,
            lockedBy: null
          }
        }
      ).maxTimeMS(30000); // Increase timeout to 30 seconds

      if (result.modifiedCount > 0) {
        console.log(`🔓 Cleaned up ${result.modifiedCount} stale locks`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up stale locks:', error.message);
      // Don't throw error, just log it
    }
  }

  /**
   * Cleanup old completed jobs
   */
  async cleanupOldJobs() {
    // Check database connection first
    if (!this.dbConnected || mongoose.connection.readyState !== 1) {
      console.log('⏳ Database not connected, skipping old job cleanup');
      return;
    }

    try {
      const result = await EmailSchedule.cleanupOldJobs(30);
      console.log(`🗑️  Cleaned up ${result.deletedCount} old jobs`);
    } catch (error) {
      console.error('❌ Error cleaning up old jobs:', error.message);
    }
  }

  /**
   * Get scheduler status
   */
  async getStatus() {
    // Check database connection first
    if (!this.dbConnected || mongoose.connection.readyState !== 1) {
      return {
        processId: this.processId,
        isRunning: this.isRunning,
        currentlyProcessing: this.processingJobs.size,
        databaseStatus: 'disconnected',
        stats: {},
        timestamp: new Date()
      };
    }

    try {
      const stats = await EmailSchedule.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const statusMap = {};
      stats.forEach(stat => {
        statusMap[stat._id] = stat.count;
      });

      return {
        processId: this.processId,
        isRunning: this.isRunning,
        currentlyProcessing: this.processingJobs.size,
        databaseStatus: 'connected',
        stats: {
          pending: statusMap.pending || 0,
          processing: statusMap.processing || 0,
          completed: statusMap.completed || 0,
          failed: statusMap.failed || 0,
          cancelled: statusMap.cancelled || 0
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting scheduler status:', error);
      return {
        processId: this.processId,
        isRunning: this.isRunning,
        currentlyProcessing: this.processingJobs.size,
        databaseStatus: 'error',
        stats: {},
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Schedule a new email
   */
  async scheduleEmail(emailData) {
    // Check database connection first
    if (!this.dbConnected || mongoose.connection.readyState !== 1) {
      throw new Error('Cannot schedule email - database not connected');
    }

    const jobId = uuidv4();
    
    const schedule = new EmailSchedule({
      jobId,
      recipients: emailData.recipients.map(email => {
        // Find contact data for this email
        const contactData = emailData.recipientContacts?.find(
          c => c.email === email
        );
        
        return {
          email,
          contactData: contactData || {}
        };
      }),
      subject: emailData.subject,
      bodyTemplate: emailData.body,
      design: emailData.design || 'default',
      sender: emailData.sender,
      attachments: emailData.attachments || [],
      scheduledFor: new Date(emailData.scheduleDateTime),
      status: 'pending'
    });

    await schedule.save();
    
    console.log(`📅 Scheduled email job ${jobId} for ${schedule.scheduledFor}`);
    
    return schedule;
  }

  /**
   * Cancel a scheduled email
   */
  async cancelEmail(jobId) {
    // Check database connection first
    if (!this.dbConnected || mongoose.connection.readyState !== 1) {
      throw new Error('Cannot cancel email - database not connected');
    }

    const result = await EmailSchedule.findOneAndUpdate(
      { jobId, status: 'pending' },
      { $set: { status: 'cancelled' } },
      { new: true }
    );

    if (!result) {
      throw new Error('Email not found or already processed');
    }

    return result;
  }

  /**
   * Get scheduled email by jobId
   */
  async getScheduledEmail(jobId) {
    // Check database connection first
    if (!this.dbConnected || mongoose.connection.readyState !== 1) {
      throw new Error('Cannot fetch email - database not connected');
    }

    return await EmailSchedule.findOne({ jobId });
  }

  /**
   * Get all scheduled emails
   */
  async getAllScheduledEmails() {
    // Check database connection first
    if (!this.dbConnected || mongoose.connection.readyState !== 1) {
      throw new Error('Cannot fetch emails - database not connected');
    }

    return await EmailSchedule.find()
      .sort({ scheduledFor: 1 })
      .limit(100);
  }
}

// Create singleton instance
const schedulerInstance = new EmailSchedulerService();

module.exports = schedulerInstance;