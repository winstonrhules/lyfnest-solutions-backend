const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const EmailSchedule = require('../models/emailScheduleModels');
const { sendEmailViaSES } = require('./SESService');
const { replaceTemplateVariables } = require('./TemplateService');

class EmailSchedulerService {
  constructor() {
    this.processorId = `email-processor-${uuidv4().substring(0, 8)}`;
    this.isRunning = false;
    this.processingJobs = new Set();
    this.cronJob = null;
  }

  /**
   * Start the email scheduler
   */
  async start() {
    if (this.isRunning) {
      console.log('Email scheduler already running');
      return;
    }

    console.log(`🚀 Starting Email Scheduler [${this.processorId}]`);
    
    // Clean up stale locks on startup
    await this.cleanupStaleLocks();
    
    // Start cron job that runs every minute
    this.cronJob = cron.schedule('* * * * *', () => {
      this.processDueEmails();
    });

    // Clean up old emails daily at 2 AM
    cron.schedule('0 2 * * *', () => {
      this.cleanupOldEmails();
    });

    this.isRunning = true;
    console.log('✅ Email scheduler started successfully');
  }

  /**
   * Stop the email scheduler
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
   * Schedule a new email
   */
  async scheduleEmail(emailData) {
    try {
      const {
        recipients,
        recipientContacts = [],
        subject,
        body,
        design = 'default',
        sender,
        attachments = [],
        scheduleDateTime
      } = emailData;

      // Validate required fields
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('At least one recipient is required');
      }
      if (!subject || !subject.trim()) {
        throw new Error('Subject is required');
      }
      if (!body || !body.trim()) {
        throw new Error('Email body is required');
      }
      if (!scheduleDateTime) {
        throw new Error('Schedule date/time is required');
      }

      // Validate schedule time
      const scheduledFor = new Date(scheduleDateTime);
      if (isNaN(scheduledFor.getTime())) {
        throw new Error('Invalid schedule date/time');
      }
      if (scheduledFor <= new Date()) {
        throw new Error('Schedule time must be in the future');
      }

      // Create job ID
      const jobId = `email-${uuidv4()}`;

      // Prepare recipients with contact data
      const formattedRecipients = recipients.map((email, index) => ({
        email: email.trim(),
        contactData: recipientContacts[index] || {}
      }));

      // Create schedule
      const schedule = new EmailSchedule({
        jobId,
        recipients: formattedRecipients,
        subject: subject.trim(),
        bodyTemplate: body,
        design,
        sender,
        attachments,
        scheduledFor,
        status: 'scheduled'
      });

      await schedule.save();

      console.log(`📅 Scheduled email: ${jobId} for ${recipients.length} recipient(s) at ${scheduledFor}`);
      return schedule;

    } catch (error) {
      console.error('❌ Error scheduling email:', error);
      throw new Error(`Failed to schedule email: ${error.message}`);
    }
  }

  /**
   * Process due emails
   */
  async processDueEmails() {
    try {
      const dueEmails = await EmailSchedule.findDueEmails(10);
      
      if (dueEmails.length === 0) {
        return;
      }

      console.log(`📬 Processing ${dueEmails.length} due email(s)`);

      // Process emails in parallel with concurrency control
      const processingPromises = dueEmails.map(email => 
        this.processEmail(email)
      );
      
      await Promise.allSettled(processingPromises);

    } catch (error) {
      console.error('❌ Error in email processor:', error);
    }
  }

  /**
   * Process a single email
   */
  async processEmail(email) {
    if (this.processingJobs.has(email.jobId)) {
      return; // Already processing
    }

    this.processingJobs.add(email.jobId);

    try {
      // Acquire lock
      const lockAcquired = await email.acquireLock(this.processorId);
      if (!lockAcquired) {
        console.log(`🔒 Could not acquire lock for ${email.jobId}`);
        return;
      }

      console.log(`🔄 Processing email: ${email.jobId}`);
      
      // Send to all recipients
      const results = await this.sendToRecipients(email);
      
      // Mark as sent
      await email.markSent(results);
      
      console.log(`✅ Successfully sent email: ${email.jobId}`);

    } catch (error) {
      console.error(`❌ Failed to process email ${email.jobId}:`, error);
      
      try {
        await email.markFailed(error.message);
      } catch (markError) {
        console.error(`❌ Failed to mark email as failed: ${markError.message}`);
      }
    } finally {
      this.processingJobs.delete(email.jobId);
    }
  }

  /**
   * Send email to all recipients
   */
  async sendToRecipients(email) {
    const results = [];
    const UserSettings = require('../models/UserSettings');
    
    // Get company settings for template variables
    const settings = await UserSettings.findOne();
    const companySettings = settings?.companySettings || {};

    for (const recipient of email.recipients) {
      try {
        // Personalize content
        const personalizedSubject = replaceTemplateVariables(
          email.subject,
          recipient.contactData,
          companySettings
        );
        
        const personalizedBody = replaceTemplateVariables(
          email.bodyTemplate,
          recipient.contactData,
          companySettings
        );

        // Send email
        const emailResult = await sendEmailViaSES({
          recipients: [recipient.email],
          subject: personalizedSubject,
          body: personalizedBody,
          sender: email.sender,
          attachments: email.attachments,
          design: email.design
        });

        results.push({
          recipientEmail: recipient.email,
          success: true,
          sentAt: new Date(),
          messageId: emailResult.messageId
        });

        console.log(`✉️ Sent to ${recipient.email}`);

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
   * Get all scheduled emails with filtering
   */
  async getScheduledEmails(options = {}) {
    const {
      status,
      limit = 50,
      page = 1
    } = options;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      EmailSchedule.find(query)
        .sort({ scheduledFor: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      EmailSchedule.countDocuments(query)
    ]);

    return {
      emails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get specific scheduled email
   */
  async getScheduledEmail(jobId) {
    const email = await EmailSchedule.findOne({ jobId });
    if (!email) {
      throw new Error(`Scheduled email not found: ${jobId}`);
    }
    return email;
  }

  /**
   * Update scheduled email
   */
  async updateScheduledEmail(jobId, updates) {
    const email = await EmailSchedule.findOne({ jobId });
    if (!email) {
      throw new Error(`Scheduled email not found: ${jobId}`);
    }

    // Cannot update emails that are processing or sent
    if (email.status === 'processing') {
      throw new Error('Cannot update email that is currently being sent');
    }
    if (email.status === 'sent') {
      throw new Error('Cannot update email that has already been sent');
    }

    // Apply updates
    const allowedUpdates = [
      'recipients', 'subject', 'bodyTemplate', 'design', 
      'sender', 'attachments', 'scheduledFor'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        email[field] = updates[field];
      }
    });

    // If updating scheduled time, validate it's in the future
    if (updates.scheduledFor) {
      const newTime = new Date(updates.scheduledFor);
      if (newTime <= new Date()) {
        throw new Error('New schedule time must be in the future');
      }
      email.scheduledFor = newTime;
    }

    // Reset status if it was failed/cancelled
    if (['failed', 'cancelled'].includes(email.status)) {
      email.status = 'scheduled';
      email.attempts = 0;
      email.lastError = null;
      email.errorHistory = [];
    }

    // Clear any locks
    email.lockedAt = null;
    email.lockedBy = null;

    await email.save();
    return email;
  }

  /**
   * Cancel scheduled email
   */
  async cancelScheduledEmail(jobId) {
    const email = await EmailSchedule.findOne({ jobId });
    if (!email) {
      throw new Error(`Scheduled email not found: ${jobId}`);
    }

    if (email.status === 'sent') {
      throw new Error('Cannot cancel email that has already been sent');
    }
    if (email.status === 'processing') {
      throw new Error('Cannot cancel email that is currently being sent');
    }

    email.status = 'cancelled';
    email.lockedAt = null;
    email.lockedBy = null;
    
    await email.save();
    
    console.log(`🚫 Cancelled scheduled email: ${jobId}`);
    return email;
  }

  /**
   * Send scheduled email immediately
   */
  async sendScheduledEmailNow(jobId) {
    const email = await EmailSchedule.findOne({ jobId });
    if (!email) {
      throw new Error(`Scheduled email not found: ${jobId}`);
    }

    if (email.status === 'sent') {
      throw new Error('Email has already been sent');
    }
    if (email.status === 'processing') {
      throw new Error('Email is currently being sent');
    }

    // Update schedule to now and process immediately
    email.scheduledFor = new Date();
    email.status = 'scheduled';
    await email.save();

    // Process immediately
    await this.processEmail(email);

    return email;
  }

  /**
   * Cleanup stale locks
   */
  async cleanupStaleLocks() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const result = await EmailSchedule.updateMany(
      {
        status: 'processing',
        lockedAt: { $lt: fiveMinutesAgo }
      },
      {
        $set: {
          status: 'scheduled',
          lockedAt: null,
          lockedBy: null
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`🔓 Cleaned ${result.modifiedCount} stale locks`);
    }
  }

  /**
   * Cleanup old sent emails
   */
  async cleanupOldEmails() {
    const result = await EmailSchedule.cleanupOldEmails(30);
    console.log(`🗑️ Cleaned up ${result.deletedCount} old emails`);
  }

  /**
   * Get scheduler status
   */
  async getSchedulerStatus() {
    const stats = await EmailSchedule.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {
      scheduled: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      total: 0
    };

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
      statusCounts.total += stat.count;
    });

    return {
      ...statusCounts,
      processorId: this.processorId,
      isRunning: this.isRunning,
      processingJobs: this.processingJobs.size,
      lastUpdated: new Date()
    };
  }
}

// Create and export singleton instance
module.exports = new EmailSchedulerService();