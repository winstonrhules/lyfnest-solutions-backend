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

    // Track DB connection
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
   * ✅ Schedule a new email
   */
  async scheduleEmail({ recipients, recipientContacts, subject, body, design, sender, attachments, scheduleDateTime }) {
    try {
      if (!recipients || recipients.length === 0) {
        throw new Error('At least one recipient is required');
      }

      const jobId = `job-${uuidv4()}`;

      const newSchedule = new EmailSchedule({
        jobId,
        recipients: recipients.map((email, index) => ({
          email,
          contactData: recipientContacts?.[index] || {}
        })),
        subject,
        bodyTemplate: body,
        design: design || 'default',
        sender,
        attachments: attachments || [],
        scheduledFor: new Date(scheduleDateTime),
        status: 'pending'
      });

      await newSchedule.save();

      console.log(`📅 Scheduled new email job: ${jobId} for ${recipients.length} recipient(s)`);
      return newSchedule;
    } catch (error) {
      console.error('❌ Error scheduling email:', error);
      throw new Error('Failed to schedule email: ' + error.message);
    }
  }

  /**
   * ✅ Update an existing scheduled email (full edit)
   */
  async updateEmail(jobId, updates) {
    const schedule = await EmailSchedule.findOne({ jobId });
    if (!schedule) {
      throw new Error(`Scheduled email with ID ${jobId} not found`);
    }

    // Do not allow editing while actively sending or after completion
    if (schedule.status === 'processing') {
      throw new Error('Cannot edit an email that is currently processing');
    }

    if (schedule.status === 'completed') {
      throw new Error('Cannot edit an email that has already been completed');
    }

    // Recipients (array of { email, contactData })
    if (Array.isArray(updates.recipients)) {
      schedule.recipients = updates.recipients.map(r => ({
        email: r.email,
        contactData: r.contactData || {}
      }));
    }

    // Subject
    if (typeof updates.subject === 'string') {
      schedule.subject = updates.subject;
    }

    // Body template (HTML)
    if (typeof updates.body === 'string') {
      schedule.bodyTemplate = updates.body;
    }

    // Design key
    if (typeof updates.design === 'string') {
      schedule.design = updates.design;
    }

    // Sender info
    if (updates.sender) {
      schedule.sender = {
        ...schedule.sender,
        ...updates.sender
      };
    }

    // Attachments
    if (Array.isArray(updates.attachments)) {
      schedule.attachments = updates.attachments;
    }

    // Schedule date/time
    if (updates.scheduleDateTime) {
      const newTime = new Date(updates.scheduleDateTime);
      if (isNaN(newTime.getTime())) {
        throw new Error('Invalid schedule date/time');
      }
      schedule.scheduledFor = newTime;
    }

    // If previously failed/cancelled, reset it back to pending & clear old errors
    if (['failed', 'cancelled'].includes(schedule.status)) {
      schedule.status = 'pending';
      schedule.attempts = 0;
      schedule.lastError = null;
      schedule.errorHistory = [];
      schedule.results = [];
      schedule.completedAt = null;
      schedule.executedAt = null;
    }

    // Always drop locks when editing
    schedule.lockedAt = null;
    schedule.lockedBy = null;

    await schedule.save();
    return schedule;
  }

  /**
   * ✅ Start the scheduler (runs every minute)
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Email scheduler already running');
      return;
    }

    console.log(`🚀 Starting Email Scheduler [${this.processId}]`);

    if (!this.dbConnected) {
      console.log('⏳ Waiting for DB connection...');
      await this.waitForConnection();
    }

    await this.cleanupStaleLocks();
    await this.processScheduledEmails();

    // Run every minute
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.processScheduledEmails();
    });

    // Clean up completed jobs daily at midnight
    cron.schedule('0 0 * * *', async () => {
      await this.cleanupOldJobs();
    });

    this.isRunning = true;
    console.log('✅ Email scheduler started successfully');
  }

  async waitForConnection(maxWaitTime = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      if (mongoose.connection.readyState === 1) {
        this.dbConnected = true;
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Database connection timeout');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 Email scheduler stopped');
  }

  /**
   * ✅ Main job processor
   */
  async processScheduledEmails() {
    try {
      if (!this.dbConnected || mongoose.connection.readyState !== 1) {
        console.log('⏳ Skipping processing - DB not connected');
        return;
      }

      const jobs = await EmailSchedule.findJobsToProcess(5, this.processId);
      if (jobs.length === 0) return;

      console.log(`📬 Found ${jobs.length} jobs to process`);
      const processPromises = jobs.map(job => this.processJob(job));
      await Promise.allSettled(processPromises);
    } catch (error) {
      console.error('❌ Error in scheduler loop:', error);
    }
  }

  /**
   * Process one job
   */
  async processJob(job) {
    const jobId = job.jobId;

    if (this.processingJobs.has(jobId)) {
      console.log(`⏭️ Job ${jobId} already processing`);
      return;
    }

    this.processingJobs.set(jobId, true);

    try {
      const lockAcquired = await job.acquireLock(this.processId);
      if (!lockAcquired) {
        console.log(`🔒 Could not acquire lock for job ${jobId}`);
        return;
      }

      console.log(`🔄 Processing job ${jobId} for ${job.recipients.length} recipient(s)`);

      const results = await this.sendToAllRecipients(job);

      await job.markCompleted(results);
      console.log(`✅ Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`❌ Error processing job ${jobId}:`, error);
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
    const UserSettings = require('../models/userSettingModels');
    const settings = await UserSettings.findOne();
    const companySettings = settings?.companySettings || {};

    for (const recipient of job.recipients) {
      try {
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
          success: true,
          sentAt: new Date()
        });

        console.log(`✉️ Sent to ${recipient.email}`);
           if(job.recipients.length>1){
            await new Promise(resolve=>setTimeout(resolve, 100))
           }

      } catch (error) {
        console.error(`❌ Failed to send to ${recipient.email}:`, error);
        results.push({
          recipientEmail: recipient.email,
          success: false,
          error: error.message
          sentAt:new Date()
        });
        continue;
      }
    }

    return results;
  }

  /**
   * ✅ Get all scheduled emails
   */
  async getAllScheduledEmails() {
    try {
      const emails = await EmailSchedule.find({
        status: { $in: ['pending', 'processing', 'cancelled', 'failed', 'completed'] }
      }).sort({ scheduledFor: 1 });

      return emails;
    } catch (error) {
      console.error('❌ Error fetching scheduled emails:', error);
      throw new Error('Failed to fetch scheduled emails');
    }
  }

  /**
   * ✅ Get one scheduled email by jobId
   */
  async getScheduledEmail(jobId) {
    const schedule = await EmailSchedule.findOne({ jobId });
    if (!schedule) throw new Error(`Scheduled email with ID ${jobId} not found`);
    return schedule;
  }

  /**
   * ✅ Cancel scheduled email
   */
  async cancelEmail(jobId) {
    const schedule = await EmailSchedule.findOne({ jobId });
    if (!schedule) throw new Error(`Scheduled email with ID ${jobId} not found`);

    if (['completed', 'failed'].includes(schedule.status)) {
      throw new Error('Cannot cancel an email that has already been processed');
    }

    schedule.status = 'cancelled';
    await schedule.save();

    console.log(`🚫 Cancelled scheduled email [${jobId}]`);
    return schedule;
  }

  /**
   * Clean up stale locks
   */
  async cleanupStaleLocks() {
    if (!this.dbConnected || mongoose.connection.readyState !== 1) {
      console.log('⏳ Skipping stale lock cleanup - DB disconnected');
      return;
    }

    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = await EmailSchedule.updateMany(
        { status: 'processing', lockedAt: { $lt: fiveMinutesAgo } },
        { $set: { status: 'pending', lockedAt: null, lockedBy: null } }
      );

      if (result.modifiedCount > 0) {
        console.log(`🔓 Cleaned up ${result.modifiedCount} stale locks`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up stale locks:', error.message);
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs() {
    if (!this.dbConnected || mongoose.connection.readyState !== 1) {
      console.log('⏳ DB not connected, skipping cleanup');
      return;
    }

    try {
      const result = await EmailSchedule.cleanupOldJobs(30);
      console.log(`🗑️ Cleaned up ${result.deletedCount} old jobs`);
    } catch (error) {
      console.error('❌ Error cleaning up old jobs:', error.message);
    }
  }

  /**
   * ✅ Scheduler status (for dashboard)
   */
  async getStatus() {
    const total = await EmailSchedule.countDocuments();
    const pending = await EmailSchedule.countDocuments({ status: 'pending' });
    const processing = await EmailSchedule.countDocuments({ status: 'processing' });
    const completed = await EmailSchedule.countDocuments({ status: 'completed' });
    const failed = await EmailSchedule.countDocuments({ status: 'failed' });
    const cancelled = await EmailSchedule.countDocuments({ status: 'cancelled' });

    return {
      processId: this.processId,
      total,
      pending,
      processing,
      completed,
      failed,
      cancelled,
      isRunning: this.isRunning,
      lastUpdated: new Date()
    };
  }
}

module.exports = new EmailSchedulerService();