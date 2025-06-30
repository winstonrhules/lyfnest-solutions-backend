const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var fformSchema = new mongoose.Schema({
  
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
    
    phoneType: {
       type: String,
        enum: [
          "mobile",
          "landline"
        ],
        required: true,
        default: "mobile",
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
        ],
        required: true,
      },

       address: {
        street: {
          type: String,
          required: [true, 'Street address is required'],
          trim: true
        },
        city: {
          type: String,
          required: [true, 'City is required'],
          trim: true,
           match: [
          /^[A-Za-z\s\-,.'()]+$/,
          "Only letters, spaces, and basic punctuation allowed"
        ]
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
      
      // state: {
      //   type: String,
      //   required: [true, 'State is required'],
      //   uppercase: true,
      //   trim: true,
      //   minlength: [2, 'State must be exactly 2 characters'],
      //   maxlength: [2, 'State must be exactly 2 characters'],
      //   validate: {
      //     validator: function(v) {
      //       return /^[A-Z]{2}$/.test(v);
      //     },
      //     message: props => `${props.value} is not a valid state code!`
      //   }
      // },
       state: {
          type: String,
        enum: [
          "AL",
          "AK",
          "AR",
          "CA",
          "CO",
         "CT",
          "DE",
          "DC",
          "FL",
          "GA",
         "HI",
          "ID",
          "IL",
          "IN",
          "IA",
        "KS",
        "KY",
        "LA",
        "ME",
        "MD",
        "MA",
       "MI",
        "MN",
        "MS",
        "MO",
        "MT",
       "NE",
        "NV",
       "NH",
        "NJ",
        "NM",
        "NY",
       "NC",
       "ND",
       "OH",
       "OK",
       "OR",
        "PA",
       "RI",
        "SC",
        "SD",
        "TN",
        "TX",
       "UT",
       "VT",
        "VA",
        "WA",
       "WV",
        "WI",
       "WY",
        "AZ",
        ],
        required: true,
      },
    
    
      coverageAmount: {
        type: String,
        enum: ["$5,000", "$10,000", "$20,000",  "$30,000", "$40,000", "$50,000"],
        required: true,
      },

     monthlyBudget: {
        type: String,
        enum: ["Under $50", "$50-$100", "Above $100"],
        required: true,
      },
    
      tobacco: {
        type: String,
        enum: ["yes", "no"],
        required: true,
      },

      
      coverageTimeline: {
        type: String,
         enum: ["Immediately", "Within 1 month", "Within 3 months"],
        required: true,
      },

      healthStatus: {
        type: String,
        enum: [
          "Excellent",
          "Good",
          "Fair",
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

      contactMethod: {
        type: String,
      enum: ["phone", "email", "sms"],
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