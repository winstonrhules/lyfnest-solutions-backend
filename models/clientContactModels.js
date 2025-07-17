

const mongoose = require('mongoose');

const clientContactSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  Email: {
    type: String,
    required: true,
    unique: true,
    match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/
  },
  phoneNumber: { type: String, required: true },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { 
      type: String, 
      required: true,
      validate: {
        validator: v => /^\d{5}(-\d{4})?$/.test(v),
        message: 'Invalid zip code'
      }
    }
  },
  Dob: { type: Date, required: true },
  policyType: {
    type: String,
    enum: ['IUL', 'WL', 'Term', 'Final Expense'],
    required: true
  },
  carrierName: { type: String, required: true },
  policyEffectiveDate: { type: Date, required: true },
  annualReviewDate: Date,
  policyStatus: {
    type: String,
    enum: ['active', 'inactive', 'lapsed', 'cancelled'],
    default: 'active'
  },
  clientSince: { type: Date, default: Date.now },
  lastContactedAt: Date,
  nextFollowUpAt: Date,
  clientSource: {
    type: String,
    enum: [
      'Website Form', 'Referral', 'Landing page', 
      'In-Person Event', 'Networking', 'Family/Friend', 
      'Client Re-Engagement', 'Past Lead (Converted)'
    ]
  },
  referredBy: String,
  tags: [String],
  notes: String
}, { timestamps: true });

clientContactSchema.index({policyStatus:1})
clientContactSchema.index({Dob:1})
clientContactSchema.index({annualReviewDate:1})
clientContactSchema.index({nextFollowUpAt:1})
clientContactSchema.index({lastContactedAt:1})
clientContactSchema.index({clientSince:1})




module.exports = mongoose.model('ClientContact', clientContactSchema);
