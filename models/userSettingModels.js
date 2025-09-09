// const mongoose = require('mongoose');
// const userSettingsSchema = new mongoose.Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//     unique: true
//   },
//   companySettings: {
//     companyName: {
//       type: String,
//       default: 'Lyfnest Solutions'
//     },
//     agentName: String,
//     agentEmail: String,
//     agentPhone: String,
//     officeAddress: String,
//     schedulingLink: {
//       type: String,
//       default: 'https://scheduler.zoom.us/nattye-a/discovery-and-guidance-call'
//     }
//   },
//   senderSettings: {
//     fromName: {
//       type: String,
//       default: 'Lyfnest Solutions'
//     },
//     fromEmail: String,
//     replyTo: String
//   },
//   emailPreferences: {
//     defaultDesign: {
//       type: String,
//       default: 'default'
//     },
//     autoSave: {
//       type: Boolean,
//       default: true
//     },
//     schedulerInterval: {
//       type: Number,
//       default: 60 // seconds
//     }
//   }
// }, {
//   timestamps: true
// });

// module.exports = mongoose.model('UserSettings', userSettingsSchema);


const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema({
  companySettings: {
    companyName: {
      type: String,
      default: 'Lyfnest Solutions'
    },
    agentName: String,
    agentEmail: String,
    agentPhone: String,
    officeAddress: String,
    schedulingLink: {
      type: String,
      default: 'https://scheduler.zoom.us/nattye-a/discovery-and-guidance-call'
    }
  },
  senderSettings: {
    fromName: {
      type: String,
      default: 'Lyfnest Solutions'
    },
    fromEmail: String,
    replyTo: String
  },
  emailPreferences: {
    defaultDesign: {
      type: String,
      default: 'default'
    },
    autoSave: {
      type: Boolean,
      default: true
    },
    schedulerInterval: {
      type: Number,
      default: 60 // seconds
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('UserSettings', userSettingsSchema);