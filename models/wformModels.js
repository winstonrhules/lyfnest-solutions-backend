const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var wformSchema = new mongoose.Schema({
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


      currentInsurance: {
        type: String,
        enum: ["yes", "no"],
        required: true,
      },

      preferredCoverageAmount: {
        type: Number,
        required: true,
        min: [1, "Preferred Coverage Amount cannot be negative"],
        validate: {
        validator: Number.isInteger,
      }
      },

      medicalConditions: {
        type: String,
        enum: ["yes", "no"],
        required: true,
      },

      premiumTerms: {
        type: String,
        enum: [
          "Flexible Premium",
          "Fixed Premium",
        ],
        required: true,
      },

      coverage: {
        type: String,
        enum: ["ASAP", "1-3 months", "3-6 months", "No rush"],
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

      comments: {
        type: String,
        trim: true,
        match: [
          /^[A-Za-z\s\-,.'()]+$/,
          "Only letters, spaces, and basic punctuation allowed"
        ]
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
    
   wformSchema.pre("save", function (next) {
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
module.exports = mongoose.model('Wform', wformSchema);