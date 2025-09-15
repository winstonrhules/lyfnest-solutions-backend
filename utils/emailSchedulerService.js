const ScheduledEmail = require('../models/emailScheduleModels');
const { sendEmailViaSES } = require('./sesServices');

class EmailSchedulerService {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.processedEmails = new Set();
  }

  start(intervalMinutes = 1) {
    if (this.isRunning) {
      console.log('Email scheduler already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting email scheduler with ${intervalMinutes} minute interval`);

    this.processScheduledEmails();

    this.interval = setInterval(() => {
      this.processScheduledEmails();
    }, intervalMinutes * 60 * 1000);

    this.cleanupInterval = setInterval(() => {
      this.cleanupProcessedEmails();
    }, 60 * 60 * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    this.processedEmails.clear();
    console.log('Email scheduler stopped');
  }

  async processScheduledEmails() {
    try {
      const now = new Date();
      const pendingEmails = await ScheduledEmail.find({
        sent: false,
        processed: false,
        scheduleDateTime: { $lte: now }
      }).sort({ scheduleDateTime: 1 });

      console.log(`Found ${pendingEmails.length} emails to process`);

      for (const email of pendingEmails) {
        const emailKey = `${email._id.toString()}-${email.scheduleDateTime.toISOString()}`;
        
        if (this.processedEmails.has(emailKey)) {
          continue;
        }

        try {
          this.processedEmails.add(emailKey);
          
          await ScheduledEmail.findByIdAndUpdate(email._id, {
            processed: true
          });

          const emailPayload = {
            recipients: email.recipients,
            subject: email.subject,
            body: email.body,
            sender: email.sender,
            attachments: email.attachments || [],
            design: email.design || 'default'
          };

          await sendEmailViaSES(emailPayload);

          await ScheduledEmail.findByIdAndUpdate(email._id, {
            sent: true,
            sentAt: new Date()
          });

          console.log(`Successfully sent scheduled email: ${email.subject}`);

        } catch (error) {
          console.error(`Failed to send scheduled email ${email._id}:`, error);
          
          this.processedEmails.delete(emailKey);
          
          await ScheduledEmail.findByIdAndUpdate(email._id, {
            processed: false,
            error: error.message,
            retryCount: (email.retryCount || 0) + 1
          });
        }
      }
    } catch (error) {
      console.error('Error processing scheduled emails:', error);
    }
  }

  cleanupProcessedEmails() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const keysToRemove = [];
    
    this.processedEmails.forEach(key => {
      const parts = key.split('-');
      const timestamp = parts.slice(1).join('-');
      if (new Date(timestamp).getTime() < oneDayAgo) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => this.processedEmails.delete(key));
    console.log(`Cleaned up ${keysToRemove.length} old processed email records`);
  }
}

const emailScheduler = new EmailSchedulerService();
module.exports = emailScheduler;