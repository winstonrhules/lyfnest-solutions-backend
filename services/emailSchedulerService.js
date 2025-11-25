// const cron = require('node-cron');
// const { v4: uuidv4 } = require('uuid');
// const EmailSchedule = require('../models/emailScheduleModels');
// const { sendEmailViaSES } = require('./sesService');
// const { replaceTemplateVariables } = require('./templateService');
// const mongoose = require('mongoose');

// class EmailSchedulerService {
//   constructor() {
//     this.processId = `scheduler-${uuidv4().substring(0, 8)}`;
//     this.isRunning = false;
//     this.cronJob = null;
//     this.processingJobs = new Map();
//     this.dbConnected = false;

//     // Track DB connection
//     mongoose.connection.on('connected', () => {
//       this.dbConnected = true;
//       console.log('✅ Database connected - scheduler ready');
//     });

//     mongoose.connection.on('disconnected', () => {
//       this.dbConnected = false;
//       console.log('❌ Database disconnected - scheduler paused');
//     });
//   }

//   /**
//    * ✅ Schedule a new email
//    */
//   async scheduleEmail({ recipients, recipientContacts, subject, body, design, sender, attachments, scheduleDateTime }) {
//     try {
//       if (!recipients || recipients.length === 0) {
//         throw new Error('At least one recipient is required');
//       }

//       const jobId = `job-${uuidv4()}`;

//       const newSchedule = new EmailSchedule({
//         jobId,
//         recipients: recipients.map((email, index) => ({
//           email,
//           contactData: recipientContacts?.[index] || {}
//         })),
//         subject,
//         bodyTemplate: body,
//         design: design || 'default',
//         sender,
//         attachments: attachments || [],
//         scheduledFor: new Date(scheduleDateTime),
//         status: 'pending'
//       });

//       await newSchedule.save();

//       console.log(`📅 Scheduled new email job: ${jobId} for ${recipients.length} recipient(s)`);
//       return newSchedule;
//     } catch (error) {
//       console.error('❌ Error scheduling email:', error);
//       throw new Error('Failed to schedule email: ' + error.message);
//     }
//   }

//   /**
//    * ✅ Update an existing scheduled email (full edit)
//    */
//   async updateEmail(jobId, updates) {
//     const schedule = await EmailSchedule.findOne({ jobId });
//     if (!schedule) {
//       throw new Error(`Scheduled email with ID ${jobId} not found`);
//     }

//     // Do not allow editing while actively sending or after completion
//     if (schedule.status === 'processing') {
//       throw new Error('Cannot edit an email that is currently processing');
//     }

//     if (schedule.status === 'completed') {
//       throw new Error('Cannot edit an email that has already been completed');
//     }

//     // Recipients (array of { email, contactData })
//     if (Array.isArray(updates.recipients)) {
//       schedule.recipients = updates.recipients.map(r => ({
//         email: r.email,
//         contactData: r.contactData || {}
//       }));
//     }

//     // Subject
//     if (typeof updates.subject === 'string') {
//       schedule.subject = updates.subject;
//     }

//     // Body template (HTML)
//     if (typeof updates.body === 'string') {
//       schedule.bodyTemplate = updates.body;
//     }

//     // Design key
//     if (typeof updates.design === 'string') {
//       schedule.design = updates.design;
//     }

//     // Sender info
//     if (updates.sender) {
//       schedule.sender = {
//         ...schedule.sender,
//         ...updates.sender
//       };
//     }

//     // Attachments
//     if (Array.isArray(updates.attachments)) {
//       schedule.attachments = updates.attachments;
//     }

//     // Schedule date/time
//     if (updates.scheduleDateTime) {
//       const newTime = new Date(updates.scheduleDateTime);
//       if (isNaN(newTime.getTime())) {
//         throw new Error('Invalid schedule date/time');
//       }
//       schedule.scheduledFor = newTime;
//     }

//     // If previously failed/cancelled, reset it back to pending & clear old errors
//     if (['failed', 'cancelled'].includes(schedule.status)) {
//       schedule.status = 'pending';
//       schedule.attempts = 0;
//       schedule.lastError = null;
//       schedule.errorHistory = [];
//       schedule.results = [];
//       schedule.completedAt = null;
//       schedule.executedAt = null;
//     }

//     // Always drop locks when editing
//     schedule.lockedAt = null;
//     schedule.lockedBy = null;

//     await schedule.save();
//     return schedule;
//   }

//   /**
//    * ✅ Start the scheduler (runs every minute)
//    */
//   async start() {
//     if (this.isRunning) {
//       console.log('⚠️ Email scheduler already running');
//       return;
//     }

//     console.log(`🚀 Starting Email Scheduler [${this.processId}]`);

//     if (!this.dbConnected) {
//       console.log('⏳ Waiting for DB connection...');
//       await this.waitForConnection();
//     }

//     await this.cleanupStaleLocks();
//     await this.processScheduledEmails();

//     // Run every minute
//     this.cronJob = cron.schedule('* * * * *', async () => {
//       await this.processScheduledEmails();
//     });

//     // Clean up completed jobs daily at midnight
//     cron.schedule('0 0 * * *', async () => {
//       await this.cleanupOldJobs();
//     });

//     this.isRunning = true;
//     console.log('✅ Email scheduler started successfully');
//   }

//   async waitForConnection(maxWaitTime = 30000) {
//     const startTime = Date.now();
//     while (Date.now() - startTime < maxWaitTime) {
//       if (mongoose.connection.readyState === 1) {
//         this.dbConnected = true;
//         return true;
//       }
//       await new Promise(resolve => setTimeout(resolve, 1000));
//     }
//     throw new Error('Database connection timeout');
//   }

//   stop() {
//     if (this.cronJob) {
//       this.cronJob.stop();
//       this.cronJob = null;
//     }
//     this.isRunning = false;
//     console.log('🛑 Email scheduler stopped');
//   }

//   /**
//    * ✅ Main job processor
//    */
//   async processScheduledEmails() {
//     try {
//       if (!this.dbConnected || mongoose.connection.readyState !== 1) {
//         console.log('⏳ Skipping processing - DB not connected');
//         return;
//       }

//       const jobs = await EmailSchedule.findJobsToProcess(5, this.processId);
//       if (jobs.length === 0) return;

//       console.log(`📬 Found ${jobs.length} jobs to process`);
//       const processPromises = jobs.map(job => this.processJob(job));
//       await Promise.allSettled(processPromises);
//     } catch (error) {
//       console.error('❌ Error in scheduler loop:', error);
//     }
//   }

//   /**
//    * Process one job
//    */
//   async processJob(job) {
//     const jobId = job.jobId;

//     if (this.processingJobs.has(jobId)) {
//       console.log(`⏭️ Job ${jobId} already processing`);
//       return;
//     }

//     this.processingJobs.set(jobId, true);

//     try {
//       const lockAcquired = await job.acquireLock(this.processId);
//       if (!lockAcquired) {
//         console.log(`🔒 Could not acquire lock for job ${jobId}`);
//         return;
//       }

//       console.log(`🔄 Processing job ${jobId} for ${job.recipients.length} recipient(s)`);

//       const results = await this.sendToAllRecipients(job);

//       await job.markCompleted(results);
//       console.log(`✅ Job ${jobId} completed successfully`);
//     } catch (error) {
//       console.error(`❌ Error processing job ${jobId}:`, error);
//       await job.markFailed(error.message);
//     } finally {
//       this.processingJobs.delete(jobId);
//     }
//   }

//   /**
//    * Send email to all recipients
//    */
//   async sendToAllRecipients(job) {
//     const results = [];
//     const UserSettings = require('../models/userSettingModels');
//     const settings = await UserSettings.findOne();
//     const companySettings = settings?.companySettings || {};

//     for (const recipient of job.recipients) {
//       try {
//         const personalizedSubject = replaceTemplateVariables(
//           job.subject,
//           recipient.contactData || {},
//           companySettings
//         );
//         const personalizedBody = replaceTemplateVariables(
//           job.bodyTemplate,
//           recipient.contactData || {},
//           companySettings
//         );

//         const emailPayload = {
//           recipients: [recipient.email],
//           subject: personalizedSubject,
//           body: personalizedBody,
//           sender: job.sender,
//           attachments: job.attachments || [],
//           design: job.design || 'default'
//         };

//         await sendEmailViaSES(emailPayload);

//         results.push({
//           recipientEmail: recipient.email,
//           success: true,
//           sentAt: new Date()
//         });

//         console.log(`✉️ Sent to ${recipient.email}`);
//       } catch (error) {
//         console.error(`❌ Failed to send to ${recipient.email}:`, error);
//         results.push({
//           recipientEmail: recipient.email,
//           success: false,
//           error: error.message
//         });
//       }
//     }

//     return results;
//   }

//   /**
//    * ✅ Get all scheduled emails
//    */
//   async getAllScheduledEmails() {
//     try {
//       const emails = await EmailSchedule.find({
//         status: { $in: ['pending', 'processing', 'cancelled', 'failed', 'completed'] }
//       }).sort({ scheduledFor: 1 });

//       return emails;
//     } catch (error) {
//       console.error('❌ Error fetching scheduled emails:', error);
//       throw new Error('Failed to fetch scheduled emails');
//     }
//   }

//   /**
//    * ✅ Get one scheduled email by jobId
//    */
//   async getScheduledEmail(jobId) {
//     const schedule = await EmailSchedule.findOne({ jobId });
//     if (!schedule) throw new Error(`Scheduled email with ID ${jobId} not found`);
//     return schedule;
//   }

//   /**
//    * ✅ Cancel scheduled email
//    */
//   async cancelEmail(jobId) {
//     const schedule = await EmailSchedule.findOne({ jobId });
//     if (!schedule) throw new Error(`Scheduled email with ID ${jobId} not found`);

//     if (['completed', 'failed'].includes(schedule.status)) {
//       throw new Error('Cannot cancel an email that has already been processed');
//     }

//     schedule.status = 'cancelled';
//     await schedule.save();

//     console.log(`🚫 Cancelled scheduled email [${jobId}]`);
//     return schedule;
//   }

//   /**
//    * Clean up stale locks
//    */
//   async cleanupStaleLocks() {
//     if (!this.dbConnected || mongoose.connection.readyState !== 1) {
//       console.log('⏳ Skipping stale lock cleanup - DB disconnected');
//       return;
//     }

//     try {
//       const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
//       const result = await EmailSchedule.updateMany(
//         { status: 'processing', lockedAt: { $lt: fiveMinutesAgo } },
//         { $set: { status: 'pending', lockedAt: null, lockedBy: null } }
//       );

//       if (result.modifiedCount > 0) {
//         console.log(`🔓 Cleaned up ${result.modifiedCount} stale locks`);
//       }
//     } catch (error) {
//       console.error('❌ Error cleaning up stale locks:', error.message);
//     }
//   }

//   /**
//    * Clean up old completed jobs
//    */
//   async cleanupOldJobs() {
//     if (!this.dbConnected || mongoose.connection.readyState !== 1) {
//       console.log('⏳ DB not connected, skipping cleanup');
//       return;
//     }

//     try {
//       const result = await EmailSchedule.cleanupOldJobs(30);
//       console.log(`🗑️ Cleaned up ${result.deletedCount} old jobs`);
//     } catch (error) {
//       console.error('❌ Error cleaning up old jobs:', error.message);
//     }
//   }

//   /**
//    * ✅ Scheduler status (for dashboard)
//    */
//   async getStatus() {
//     const total = await EmailSchedule.countDocuments();
//     const pending = await EmailSchedule.countDocuments({ status: 'pending' });
//     const processing = await EmailSchedule.countDocuments({ status: 'processing' });
//     const completed = await EmailSchedule.countDocuments({ status: 'completed' });
//     const failed = await EmailSchedule.countDocuments({ status: 'failed' });
//     const cancelled = await EmailSchedule.countDocuments({ status: 'cancelled' });

//     return {
//       processId: this.processId,
//       total,
//       pending,
//       processing,
//       completed,
//       failed,
//       cancelled,
//       isRunning: this.isRunning,
//       lastUpdated: new Date()
//     };
//   }
// }

// module.exports = new EmailSchedulerService();


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
    this.lockCleanupJob = null;
    this.activeProcessing = new Set();
    
    console.log(`📧 Email Scheduler Service initialized [${this.processId}]`);
  }

  /**
   * Schedule a new email
   */
  async scheduleEmail(emailData) {
    try {
      // Validate required fields
      if (!emailData.recipients || emailData.recipients.length === 0) {
        throw new Error('At least one recipient is required');
      }

      if (!emailData.subject || !emailData.body) {
        throw new Error('Subject and body are required');
      }

      if (!emailData.scheduleDateTime) {
        throw new Error('Schedule date/time is required');
      }

      // Validate schedule time is in future
      const scheduledTime = new Date(emailData.scheduleDateTime);
      if (scheduledTime <= new Date()) {
        throw new Error('Schedule time must be in the future');
      }

      const jobId = `email-${Date.now()}-${uuidv4().substring(0, 8)}`;

      const schedule = new EmailSchedule({
        jobId,
        recipients: emailData.recipients.map((email, index) => ({
          email,
          contactData: emailData.recipientContacts?.[index] || {}
        })),
        subject: emailData.subject,
        bodyTemplate: emailData.body,
        design: emailData.design || 'default',
        sender: emailData.sender || {},
        attachments: emailData.attachments || [],
        scheduledFor: scheduledTime,
        status: 'scheduled'
      });

      await schedule.save();

      console.log(`✅ Email scheduled successfully [${jobId}]`);
      console.log(`   Recipients: ${emailData.recipients.length}`);
      console.log(`   Scheduled for: ${scheduledTime.toISOString()}`);

      return schedule;
    } catch (error) {
      console.error('❌ Error scheduling email:', error);
      throw error;
    }
  }

  /**
   * Update an existing scheduled email
   */
  async updateScheduledEmail(jobId, updates) {
    try {
      const schedule = await EmailSchedule.findOne({ jobId });
      
      if (!schedule) {
        throw new Error(`Scheduled email with ID ${jobId} not found`);
      }

      // Don't allow updates if processing or completed
      if (schedule.status === 'processing') {
        throw new Error('Cannot update email that is currently being processed');
      }

      if (schedule.status === 'completed') {
        throw new Error('Cannot update email that has already been sent');
      }

      // Update recipients
      if (updates.recipients) {
        schedule.recipients = updates.recipients.map((item) => ({
          email: item.email,
          contactData: item.contactData || {}
        }));
      }

      // Update email content
      if (updates.subject) schedule.subject = updates.subject;
      if (updates.body) schedule.bodyTemplate = updates.body;
      if (updates.design) schedule.design = updates.design;
      if (updates.sender) schedule.sender = updates.sender;
      if (updates.attachments) schedule.attachments = updates.attachments;

      // Update schedule time
      if (updates.scheduleDateTime) {
        const newScheduleTime = new Date(updates.scheduleDateTime);
        if (newScheduleTime <= new Date()) {
          throw new Error('Schedule time must be in the future');
        }
        schedule.scheduledFor = newScheduleTime;
      }

      // Reset status to scheduled if it was failed or cancelled
      if (['failed', 'cancelled'].includes(schedule.status)) {
        schedule.status = 'scheduled';
        schedule.executionAttempts = 0;
        schedule.errors = [];
        schedule.results = [];
      }

      // Release any locks
      schedule.processingLock = {
        isLocked: false,
        lockedAt: null,
        lockedBy: null,
        lockExpiry: null
      };

      await schedule.save();

      console.log(`✅ Email schedule updated [${jobId}]`);
      return schedule;
    } catch (error) {
      console.error('❌ Error updating scheduled email:', error);
      throw error;
    }
  }

  /**
   * Get all scheduled emails
   */
  async getAllScheduledEmails(filters = {}) {
    try {
      const query = {};
      
      if (filters.status) {
        query.status = filters.status;
      }

      const emails = await EmailSchedule.find(query)
        .sort({ scheduledFor: 1, createdAt: -1 })
        .lean();

      return emails;
    } catch (error) {
      console.error('❌ Error fetching scheduled emails:', error);
      throw error;
    }
  }

  /**
   * Get a single scheduled email
   */
  async getScheduledEmail(jobId) {
    try {
      const schedule = await EmailSchedule.findOne({ jobId }).lean();
      
      if (!schedule) {
        throw new Error(`Scheduled email with ID ${jobId} not found`);
      }

      return schedule;
    } catch (error) {
      console.error('❌ Error fetching scheduled email:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled email
   */
  async cancelScheduledEmail(jobId) {
    try {
      const schedule = await EmailSchedule.findOne({ jobId });
      
      if (!schedule) {
        throw new Error(`Scheduled email with ID ${jobId} not found`);
      }

      if (schedule.status === 'completed') {
        throw new Error('Cannot cancel an email that has already been sent');
      }

      if (schedule.status === 'processing') {
        throw new Error('Cannot cancel an email that is currently being processed');
      }

      schedule.status = 'cancelled';
      await schedule.save();

      console.log(`🚫 Email cancelled [${jobId}]`);
      return schedule;
    } catch (error) {
      console.error('❌ Error cancelling email:', error);
      throw error;
    }
  }

  /**
   * Send scheduled email immediately
   */
  async sendImmediately(jobId) {
    try {
      const schedule = await EmailSchedule.findOne({ jobId });
      
      if (!schedule) {
        throw new Error(`Scheduled email with ID ${jobId} not found`);
      }

      if (schedule.status === 'completed') {
        throw new Error('This email has already been sent');
      }

      if (schedule.status === 'processing') {
        throw new Error('This email is currently being processed');
      }

      // Update schedule time to now
      schedule.scheduledFor = new Date();
      schedule.status = 'scheduled';
      await schedule.save();

      console.log(`⚡ Email queued for immediate sending [${jobId}]`);

      // Trigger immediate processing
      setTimeout(() => this.processScheduledEmails(), 1000);

      return schedule;
    } catch (error) {
      console.error('❌ Error sending email immediately:', error);
      throw error;
    }
  }

  /**
   * Start the scheduler
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler already running');
      return;
    }

    console.log(`🚀 Starting Email Scheduler [${this.processId}]`);

    // Wait for database connection
    if (mongoose.connection.readyState !== 1) {
      console.log('⏳ Waiting for database connection...');
      await this.waitForDatabaseConnection();
    }

    // Clean up any expired locks on startup
    await this.cleanupExpiredLocks();

    // Process immediately on startup
    await this.processScheduledEmails();

    // Schedule to run every minute
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.processScheduledEmails();
    });

    // Schedule lock cleanup every 5 minutes
    this.lockCleanupJob = cron.schedule('*/5 * * * *', async () => {
      await this.cleanupExpiredLocks();
    });

    // Schedule old job cleanup daily at midnight
    cron.schedule('0 0 * * *', async () => {
      await this.cleanupOldJobs();
    });

    this.isRunning = true;
    console.log('✅ Email Scheduler started successfully');
    console.log('   Processing interval: Every 1 minute');
    console.log('   Lock cleanup: Every 5 minutes');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    if (this.lockCleanupJob) {
      this.lockCleanupJob.stop();
      this.lockCleanupJob = null;
    }

    this.isRunning = false;
    console.log('🛑 Email Scheduler stopped');
  }

  /**
   * Wait for database connection
   */
  async waitForDatabaseConnection(maxWaitTime = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      if (mongoose.connection.readyState === 1) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Database connection timeout');
  }

  /**
   * Process scheduled emails
   */
  async processScheduledEmails() {
    try {
      // Skip if database not connected
      if (mongoose.connection.readyState !== 1) {
        console.log('⏭️ Skipping processing - database not connected');
        return;
      }

      // Find ready jobs
      const readyJobs = await EmailSchedule.findReadyJobs(10);

      if (readyJobs.length === 0) {
        return;
      }

      console.log(`📬 Found ${readyJobs.length} jobs ready for processing`);

      // Process each job
      const processingPromises = readyJobs.map(job => 
        this.processIndividualJob(job)
      );

      await Promise.allSettled(processingPromises);

    } catch (error) {
      console.error('❌ Error in processing loop:', error);
    }
  }

  /**
   * Process individual job
   */
  async processIndividualJob(job) {
    const jobId = job.jobId;

    // Skip if already processing
    if (this.activeProcessing.has(jobId)) {
      console.log(`⏭️ Job ${jobId} already being processed`);
      return;
    }

    this.activeProcessing.add(jobId);

    try {
      // Acquire lock
      const lockAcquired = await job.acquireProcessingLock(this.processId);
      
      if (!lockAcquired) {
        console.log(`🔒 Could not acquire lock for job ${jobId}`);
        return;
      }

      console.log(`🔄 Processing job ${jobId}`);
      console.log(`   Recipients: ${job.recipients.length}`);
      console.log(`   Scheduled for: ${job.scheduledFor.toISOString()}`);

      // Send to all recipients
      const results = await this.sendToAllRecipients(job);

      // Mark as completed
      await job.markAsCompleted(results);

      const successCount = results.filter(r => r.status === 'sent').length;
      console.log(`✅ Job ${jobId} completed`);
      console.log(`   Sent: ${successCount}/${results.length}`);

    } catch (error) {
      console.error(`❌ Error processing job ${jobId}:`, error);
      await job.markAsFailed(error.message);
    } finally {
      this.activeProcessing.delete(jobId);
    }
  }

  /**
   * Send email to all recipients
   */
  async sendToAllRecipients(job) {
    const results = [];
    const UserSettings = require('../models/userSettingModels');
    
    let companySettings = {};
    try {
      const settings = await UserSettings.findOne();
      companySettings = settings?.companySettings || {};
    } catch (error) {
      console.warn('Could not load company settings:', error.message);
    }

    for (const recipient of job.recipients) {
      try {
        // Personalize content
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

        // Send email
        const emailPayload = {
          recipients: [recipient.email],
          subject: personalizedSubject,
          body: personalizedBody,
          sender: job.sender,
          attachments: job.attachments || [],
          design: job.design || 'default'
        };

        await sendEmailViaSES(emailPayload);

        results.push({
          recipientEmail: recipient.email,
          status: 'sent',
          sentAt: new Date()
        });

        console.log(`   ✉️ Sent to ${recipient.email}`);

      } catch (error) {
        console.error(`   ❌ Failed to send to ${recipient.email}:`, error.message);
        
        results.push({
          recipientEmail: recipient.email,
          status: 'failed',
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Clean up expired locks
   */
  async cleanupExpiredLocks() {
    try {
      if (mongoose.connection.readyState !== 1) {
        return;
      }

      const count = await EmailSchedule.cleanupExpiredLocks();
      
      if (count > 0) {
        console.log(`🔓 Cleaned up ${count} expired locks`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up locks:', error);
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs() {
    try {
      if (mongoose.connection.readyState !== 1) {
        return;
      }

      const result = await EmailSchedule.cleanupOldJobs(30);
      
      if (result.deletedCount > 0) {
        console.log(`🗑️ Cleaned up ${result.deletedCount} old jobs`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old jobs:', error);
    }
  }

  /**
   * Get scheduler status
   */
  async getStatus() {
    try {
      const total = await EmailSchedule.countDocuments();
      const scheduled = await EmailSchedule.countDocuments({ status: 'scheduled' });
      const processing = await EmailSchedule.countDocuments({ status: 'processing' });
      const completed = await EmailSchedule.countDocuments({ status: 'completed' });
      const failed = await EmailSchedule.countDocuments({ status: 'failed' });
      const cancelled = await EmailSchedule.countDocuments({ status: 'cancelled' });

      return {
        processId: this.processId,
        isRunning: this.isRunning,
        activeProcessing: this.activeProcessing.size,
        stats: {
          total,
          scheduled,
          processing,
          completed,
          failed,
          cancelled
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ Error getting status:', error);
      return {
        processId: this.processId,
        isRunning: this.isRunning,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const schedulerService = new EmailSchedulerService();

module.exports = schedulerService;