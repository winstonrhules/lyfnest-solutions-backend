const mongoose = require('mongoose'); 
const bcrypt = require("bcrypt")
const crypto = require("crypto")

// Declare the Schema of the Mongo model
var userSchema = new mongoose.Schema({
    firstname:{
        type:String,
        required:true,
    },

     lastname:{
        type:String,
        required:true,
    },
    
    email:{
        type:String,
        required:true,
        unique:true,
    },
 
    password:{
        type:String,
        required:true,
    },

    role:{
        type:String,
        default:"admin"
    },
    refreshToken:{},
    passwordChangeAt:Date
    //passwordResetToken:String,
    //passwordResetTokenExpires:Date,

},
{timestamps:true}
);

userSchema.pre("save", async function(next){
    if(!this.isModified('password')){
        next()
    }
  const salt = await bcrypt.genSaltSync(10)
  this.password = await bcrypt.hash(this.password, salt)
})
userSchema.methods.isPasswordMatched=async function(enteredPassword){
    return await bcrypt.compare(enteredPassword, this.password)
};

//     userSchema.methods.iscreatePasswordResetToken=async function(){
//     resetToken=crypto.randomBytes(32).toString("hex")
//     this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex")
//     this.passwordResetTokenExpires = Date.now() + 32 *60 *1000
//     return resetToken

// };
//Export the model
module.exports = mongoose.model('User', userSchema); 