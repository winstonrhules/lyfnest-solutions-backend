const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var tformSchema = new mongoose.Schema({
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

      coverageAmount: {
        type: Number,
        required: true,
        min: [1, "Coverage amount cannot be negative"],
        validate: {
        validator: Number.isInteger,
    }
  },


      preferredTerm: {
        type: String,
        enum: [
          "10 years",
          "20 years",
          "30 years",
        ],
        required: true,
      },

      tobacco: {
        type: String,
        enum: ["yes", "no"],
        required: true,
      },

      healthStatus: {
        type: String,
        enum: [
          "Excellent",
          "Good",
          "Average",
          "Below Average",
        ],
        required: true,
      },

      preExistingConditions: {
        type: String,
        trim: true,
        match: [
          /^[A-Za-z\s\-,.'()]+$/,
          "Only letters, spaces, and basic punctuation allowed"
        ]
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
        type: Number,
        required: true,
        min: [1, "Annual Income cannot be negative"],
        validate: {
        validator: Number.isInteger,
      }
    },
     
      dependents: {
        type: String,
        enum: [
            "none",
            "1",
            "2",
            "3+"
          ],
        required: true,
      },

     livingBenefits: {
        type: String,
        enum: ["yes", "no"],
      },

      permanentCoverageOptions: {
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
    
    
//Export the model
module.exports = mongoose.model('Tform', tformSchema);


