const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var fformSchema = new mongoose.Schema({
    // firstName: {
    //     type: String,
    //     required: true,
    //     trim: true,
    //   },

    //   lastName: {
    //     type: String,
    //     required: true,
    //     trim: true,
    //   },

    //   email: {
    //     type: String,
    //     required: true,
    //     unique: true,
    //     lowercase: true,
    //     trim: true,
    //   },
    firstName: {
      type: String,
      required: true,
      trim: true,
      match: [/^[A-Za-z\s'-]+$/, "Only letters, spaces, apostrophes, and hyphens allowed"]
    },
  
    lastName: {
      type: String,
      required: true,
      trim: true,
      match: [/^[A-Za-z\s'-]+$/, "Only letters, spaces, apostrophes, and hyphens allowed"]
    },
  
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


      maritalStatus: {
        type: String,
        enum: [
          "Single",
          "Married",
          "Divorced"
        ],
        required: true,
      },

      address: {
        type: String,
        required: true,
        trim: true,
      },

      state: {
        type: String,
        required: true,
        trim: true,
        match: [
          /^[A-Za-z\s\-,.'()]+$/,
          "Only letters, spaces, and basic punctuation allowed"
        ]
      },

      coverageAmount: {
        type: String,
        enum: ["$5,000", "$10,000", "$25,000","$50,000"],
        required: true,
      },

      monthlyBudget: {
        type: Number,
        required: true,
        min: [1, "Monthly Budget cannot be negative"],
        validate: {
        validator: Number.isInteger,
      },
    },

      tobacco: {
        type: String,
        enum: ["yes", "no"],
        required: true,
      },

      contactMethod: {
        type: String,
        enum: ["Phone", "Email", "Text"],
        required: true,
      },

      contactTime: {
        type: String,
        enum: ["morning", "afternoon", "evening"],
        required: true,
      },

      coverageTimeline: {
        type: String,
        enum: ["ASAP", "Within 1 Month", "Within 3 Months", "Exploring Options"],
        required: true,
      },

      healthStatus: {
        type: String,
        enum: [
          "Excellent",
          "Good",
          "Fair",
          "Poor",
        ],
        required: true,
      },
    
      healthCondition: {
        type: String,
        trim: true,
        match: [
          /^[A-Za-z\s\-,.'()]+$/,
          "Only letters, spaces, and basic punctuation allowed"
        ]
      },
   
      insurancePolicy: {
        type: String,
        enum: ["yes", "no"],
      },

      verification:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Verification',
        required:true,
      },
        
      emailVerified: { type: Boolean, default: false },
      emailVerification: { 
             type: mongoose.Schema.Types.ObjectId,
             ref: 'EmailVerification'
           },
           
    }, { timestamps: true });
    
fformSchema.pre("save", function (next) {
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
module.exports = mongoose.model('Fform', fformSchema);