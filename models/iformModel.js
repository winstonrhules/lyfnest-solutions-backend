const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var iformSchema = new mongoose.Schema({
    // firstName: {
    //     type: String,
    //     required: true,
    //     trim: true,
    //   },

    firstName: {
      type: String,
      required: true,
      trim: true,
      match: [/^[A-Za-z\s'-]+$/, "Only letters, spaces, apostrophes, and hyphens allowed"]
    },

      // lastName: {
      //   type: String,
      //   required: true,
      //   trim: true,
      // },

      lastName: {
        type: String,
        required: true,
        trim: true,
        match: [/^[A-Za-z\s'-]+$/, "Only letters, spaces, apostrophes, and hyphens allowed"]
      },

      // email: {
      //   type: String,
      //   required: true,
      //   unique: true,
      //   lowercase: true,
      //   trim: true,
      // },

      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
          "Invalid email format"
        ]
      },

      phoneNumber: {
        type: String,
        required: true,
        match: [/^\+\d{1,3}\d{6,14}$/, "Phone number must be 10 digits"],
      },

      Dob: {
        type: Date,
        required: true,
      },

      gender: {
        type: String,
        enum: [
          "Male",
          "Female"
        ],
        required: true,
      },

      occupation: {
        type: String,
        required: true,
        trim: true,
        match: [
          /^[A-Za-z\s\-,.'()]+$/,
          "Only letters, spaces, and basic punctuation allowed"
        ]
      },

      annualIncome: {
        type: String,
        enum: [
          "Under $50k",
          "50k-100k",
           "100k-150k",
           "Over $150k"
        ],
      },

      insuranceAgent: {
        type: String,
        enum: ["yes", "no"],
      },

      financialGoal: {
        type: [String],
        enum: ["Protecting my family’s financial future", "Saving for education", " Preparing for retirement", "Reducing tax liabilities", "Accessing funds for emergencies or opportunities", "Other(please specify)"],
      },

      otherSpecify: {
        type: String,
        required: function () {
          return this.financialGoal.includes("Other(please specify)");
        },
      },

      premiumTerms: {
        type: String,
        enum: [
          "Flexible Premium",
          "Fixed Premium",
          "Not Sure"
        ],
        required: true,
      },

      coverage: {
        type: String,
        enum: ["ASAP", "1-3 months", "3-6 months", "No rush"],
        required: true,                
      },
      
      emailVerified: { type: Boolean, default: false },
      emailVerification: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmailVerification'
      },
      
     
      verification:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Verification',
        required:true,
      },

    }, { timestamps: true });
    
    iformSchema.pre("save", function (next) {
      const dob = this.Dob;
      const today = new Date();
      const cutoffDate = new Date(
        today.getFullYear() - 18,
        today.getMonth(),
        today.getDate()
      );
    
      if (dob > cutoffDate) {
        const error = new mongoose.Error.ValidationError();
        error.message = "User must be at least 18 years old";
        next(error);
      } else {
        next();
      }
    });
//Export the model
module.exports = mongoose.model('Iform', iformSchema);