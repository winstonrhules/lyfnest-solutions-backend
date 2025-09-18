// server/services/emailScheduler.js
const cron = require('node-cron');
const mongoose = require('mongoose');
const { sendEmailViaSES } = require('../services/sesService');
const { replaceTemplateVariables } = require('../services/templateService');

class EmailScheduler {
  constructor() {  
    this.isProcessing = false;
    this.retryDelays = [1000, 5000, 15000, 30000]; // Exponential backoff
  }

  async init() {
    // Schedule job to run every minute
    cron.schedule('* * * * *', () => this.processScheduledEmails());
    console.log('Email scheduler initialized');
  }

  async processScheduledEmails() {
    if (this.isProcessing) {
      console.log('Skipping: Already processing emails');
      return;
    }

    this.isProcessing = true;
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const now = new Date();
      const ScheduledEmail = mongoose.model('ScheduledEmail');
      
      // Find emails that are due and not processed
      const emailsToProcess = await ScheduledEmail.find({
        scheduleDateTime: { $lte: now },
        sent: false,
        processing: false,
        $or: [
          { nextRetry: { $lte: now } },
          { nextRetry: { $exists: false } }
        ]
      }).session(session).limit(10); // Process in batches

      for (const email of emailsToProcess) {
        try {
          // Mark as processing to prevent other instances from picking it up
          email.processing = true;
          email.lastProcessingAttempt = new Date();
          await email.save({ session });

          // Send the email
          await this.sendScheduledEmail(email);
          
          // Mark as sent
          email.sent = true;
          email.sentAt = new Date();
          email.processing = false;
          await email.save({ session });
          
          console.log(`Successfully sent scheduled email: ${email._id}`);
        } catch (error) {
          console.error(`Failed to process email ${email._id}:`, error);
          
          // Handle retry logic
          await this.handleProcessingError(email, error, session);
        }
      }

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      console.error('Error in email scheduler transaction:', error);
    } finally {
      session.endSession();
      this.isProcessing = false;
    }
  }

  async sendScheduledEmail(email) {
    // Get company settings for template variables
    const UserSettings = mongoose.model('UserSettings');
    const settings = await UserSettings.findOne();
    const companySettings = settings ? settings.companySettings : {};

    if (email.recipients.length === 1 && email.recipientContacts && email.recipientContacts.length > 0) {
      // Individual email - personalize it
      const recipientContact = email.recipientContacts[0];
      
      // Personalize subject and body
      const personalizedSubject = replaceTemplateVariables(email.subject, recipientContact, companySettings);
      const personalizedBody = replaceTemplateVariables(email.body, recipientContact, companySettings);
      
      // Create personalized sender settings
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
      // Bulk email - send as is
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
  }

  async handleProcessingError(email, error, session) {
    const ScheduledEmail = mongoose.model('ScheduledEmail');
    
    // Increment retry count
    email.retryCount = (email.retryCount || 0) + 1;
    email.lastError = error.message;
    
    // Check if we should retry again
    if (email.retryCount < this.retryDelays.length) {
      // Schedule next retry
      const delayMs = this.retryDelays[email.retryCount - 1];
      email.nextRetry = new Date(Date.now() + delayMs);
      email.processing = false;
      
      console.log(`Scheduled retry ${email.retryCount} for email ${email._id} in ${delayMs}ms`);
    } else {
      // Max retries exceeded, mark as failed
      email.sent = false;
      email.processing = false;
      email.failed = true;
      console.error(`Max retries exceeded for email ${email._id}`);
    }
    
    await email.save({ session });
  }
}

module.exports = EmailScheduler;