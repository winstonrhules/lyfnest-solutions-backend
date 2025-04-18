const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var formSchema = new mongoose.Schema({
    

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
  
    Email: {
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

      // address: {
      //   type: String,
      //   required: true,
      //   trim: true,
      // },

      // state: {
      //   type: String,
      //   required: true,
      //   trim: true,
      //   match: [
      //     /^[A-Za-z\s\-,.'()]+$/,
      //     "Only letters, spaces, and basic punctuation allowed"
      //   ]
      // },

      address: {
        street: {
          type: String,
          required: [true, 'Street address is required'],
          trim: true
        },
        city: {
          type: String,
          required: [true, 'City is required'],
          trim: true
        },
        zip: {
          type: String,
          required: [true, 'Zip code is required'],
          validate: {
            validator: function(v) {
              return /^\d{5}(-\d{4})?$/.test(v);
            },
            message: props => `${props.value} is not a valid zip code!`
          }
        }
      },
      
      state: {
        type: String,
        required: [true, 'State is required'],
        uppercase: true,
        trim: true,
        minlength: [2, 'State must be exactly 2 characters'],
        maxlength: [2, 'State must be exactly 2 characters'],
        validate: {
          validator: function(v) {
            return /^[A-Z]{2}$/.test(v);
          },
          message: props => `${props.value} is not a valid state code!`
        }
      },
    

      Dependents: {
        type: String,
        enum: ["yes", "no"],
        required: true,
      },
      dependentsNumber: {
        type: Number,
        min: 1,
        required: function () {
          return this.dependents === "yes";
        },
      },
      primaryGoal: {
        type: String,
        enum: [
          "protecting-family",
          "funeral-expenses",
          "building-wealth",
          "retirement-income",
          "child-education",
          "other",
        ],
        required: true,
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
            

      Occupation: {
        type: String,
        required: true,
        trim: true,
        match: [
          /^[A-Za-z\s\-,.'()]+$/,
          "Only letters, spaces, and basic punctuation allowed"
        ]
      },

      consideredInsurance: {
        type: String,
        enum: ["yes", "no"],
      },
      coverageType: {
        type: [String],
        enum: ["term", "whole-life", "iul", "final-expense", "unsure"],
        default: [],
      },
      currentInsurance: {
        type: String,
        enum: ["yes", "no"],
      },
      currentInsuranceType: {
        type: [String],
        enum: ["term", "whole-life", "iul", "final-expense"],
        required: function () {
          return this.currentInsurance === "yes";
        },
      },
      buildCash: {
        type: String,
        enum: ["yes", "no", "not-sure"],
      },
      premiumType: {
        type: String,
        enum: ["flexible", "fixed", "not-sure"],
        required: true,
      },
      coverageTimeline: {
        type: String,
        enum: ["asap", "1-3-months", "3-6-months", "no-rush"],
        required: true,
      },
      monthlyBudget: {
        type: String,
        enum: ["under-50", "50-100", "100-200", "over-200"],
        required: true,
      },
      contactMethod: {
        type: String,
        enum: ["phone", "text"],
        required: true,
      },
      contactTime: {
        type: String,
        enum: ["morning", "afternoon", "evening"],
        required: true,
      },
      Comments: {
        type: String,
        trim: true,
        match: [
          /^[A-Za-z\s\-,.'()]+$/,
          "Only letters, spaces, and basic punctuation allowed"
        ],
      },
    }, { timestamps: true });
    
    
    formSchema.pre("save", function (next) {
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
module.exports = mongoose.model('Form', formSchema);