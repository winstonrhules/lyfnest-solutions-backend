// const mongoose = require('mongoose');

// const clientContactSchema = new mongoose.Schema({
//   firstName: {
//     type: String,
//     required: true
//   },
//   lastName: {
//     type: String,
//     required: true
//   },
//    Email: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       trim: true,
//       match: [
//         /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
//         "Invalid email format"
//       ]
//     },
//    phoneNumber: {
//         type: String,
//         required: true,
//         match: [/^\+\d{1,3}\d{6,14}$/, "Phone number must be 10 digits"],
//       },
//  address: {
//         street: {
//           type: String,
//           required: [true, 'Street address is required'],
//           trim: true
//         },
        
//         city: {
//           type: String,
//           required: [true, 'City is required'],
//           trim: true,
//           match: [
//           /^[A-Za-z\s\-,.'()]+$/,
//           "Only letters, spaces, and basic punctuation allowed"
//         ]
//         },
//         zip: {
//           type: String,
//           required: [true, 'Zip code is required'],
//           validate: {
//             validator: function(v) {
//               return /^\d{5}(-\d{4})?$/.test(v);
//             },
//             message: props => `${props.value} is not a valid zip code!`
//           }
//         }
//       },
      
//     Dob: {
//         type: Date,
//         required: true,
//       },
//   policyType: {
//     type: String,
//     enum: ['IUL', 'WL', 'Term', 'Final Expense'],
//     required: true
//   },
//   carrierName: {
//     type:String,
//     required:true
//   },

//   policyEffectiveDate: {
//     type: Date,
//     required: true
//   },

//   annualReviewDate: Date,
//   policyStatus: {
//     type: String,
//     enum: ['active', 'inactive', 'lapsed', 'cancelled'],
//     default: 'active'
//   },
//   clientSince: {
//     type: Date,
//     default: Date.now
//   },
//   lastContactedAt: Date,
//   nextFollowUpAt: Date,
//   clientSource: {
//     type: String,
//     enum: [
//       'Website Form', 
//       'Referral', 
//       'Landing page', 
//       'In-Person Event', 
//       'Networking', 
//       'Family/Friend', 
//       'Client Re-Engagement', 
//       'Past Lead (Converted)'
//     ]
//   },
//   referredBy: String,
//   tags: [String],
//   notes: String
// }, {
//   timestamps: true
// });

// module.exports = mongoose.model('ClientContact', clientContactSchema);

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

module.exports = mongoose.model('ClientContact', clientContactSchema);
