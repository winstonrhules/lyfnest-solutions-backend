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