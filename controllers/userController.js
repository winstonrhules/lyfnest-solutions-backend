const generateRefreshToken = require("../config/generateRefreshToken");
const generateToken= require("../config/generateToken");
const User = require("../models/userModels");

const asyncHandler = require("express-async-handler");
const validateMongoDb= require("../utils/validateMongoDb");
const jwt = require("jsonwebtoken")


const registerUser = asyncHandler(async(req, res)=>{
  try{
    const {email, firstname, lastname, password} = req.body
    const findUser = await User.findOne({email:email})
    if(!findUser){
        const newUser = await User.create({
          firstname,
          lastname,
          email,
          password
        })
        res.status(201).json(newUser)
    }
    else{
      res.status(400).json({ error: 'User Already Exist' });
    }
  }catch(error){
    res.status(400).json({
      error:error.message ||"validation failed"
    })
  }
    
})

const loginUser = asyncHandler(async(req, res)=>{
    const {email, password}=req.body;
    const findUser = await User.findOne({email:email})
    if(findUser && await findUser.isPasswordMatched(password)){
        const refreshToken = generateRefreshToken(findUser?._id)
        const updateuser= await User.findByIdAndUpdate(findUser.id, {refreshToken:refreshToken}, {new:true})
        res.cookie("refreshToken", refreshToken, 
            {
            httpOnly:true,
            maxAge:15*60*1000
           })
        res.json({
            _id:findUser?._id,
            firstname:findUser?.firstname,
            lastname:findUser?.lastname,
            email:findUser?.email,
            token:generateToken(findUser?._id)
        })
    }
    else{
        res.status(400).json({ error: "Wrong Credentials, failed to login" });
    }     
})



const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 1. Find admin user
  const admin = await User.findOne({ email });
  if (!admin || admin.role !== "admin") {
    res.status(400).json({ error: "Not authorized" });
  }

  // 2. Verify password
  if (!(await admin.isPasswordMatched(password))) {
    res.status(400).json({ error: "Invalid credentials" });
  }

  // 3. Generate tokens
  const refreshToken = generateRefreshToken(admin._id);
  const accessToken = generateToken(admin._id);

  // 4. Update user with refresh token
  await User.findByIdAndUpdate(admin._id, { refreshToken });

  // 5. Set refresh token cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.JWT_PASS_SEC,
    sameSite: "None",
    maxAge:15*60*1000 // 3 days
  });

  // 6. Send response with user data
  res.json({
    accessToken,
    user: {
      _id: admin._id,
      email: admin.email,
      firstname: admin.firstname,
      lastname: admin.lastname,
      role: admin.role
    }
  });
});




const getallUsers = asyncHandler(async(req, res)=>{
    try{
      const getUsers = await User.find()
      res.status(200).json(getUsers)
    }
    catch(error){
        res.status(400).json({ error: "failed to get all users" });
    }
})

const getaUser = asyncHandler(async(req, res)=>{
    const {id}= req.params
    validateMongoDb(id)
    try{
      const getUser =await User.findById(id)
      res.json(getUser)
    }
    catch(error){
        res.status(400).json({ error: "failed to get user" });
    }
})

const deleteaUser = asyncHandler(async(req, res)=>{
    const {id}= req.params
    validateMongoDb(id)
    try{
      const deletedUser =await User.findByIdAndDelete(id)
      res.json(deletedUser)
    }
    catch(error){
        res.status(400).json({ error: "failed to delete a user" });
    }
})





const updateUser = asyncHandler(async(req, res)=>{
    const {_id} = req.user
    validateMongoDb(_id)
    try{
      const updatedUser =await User.findByIdAndUpdate(_id, 
      {
        firstname:req?.body?.firstname,
        lastname:req?.body?.lastname,
        email:req?.body?.email,
     
      }, 
      {new:true}
    )
      res.json(updatedUser)
    }
    catch(error){
       
        res.status(400).json({ error: "failed to update a user" });
    }
})


const updatePassword= asyncHandler(async(req, res)=>{
  const {password}= req.body;
  const {_id}=req.user;
  validateMongoDb(_id);
  const user = await User.findById(_id);
  if(password){
    user.password=password;
    const updatedPassword = await user.save()
  res.json(updatedPassword)
  }
  else{
    res.json(user)
  }
})




// const forgotPassword= asyncHandler(async(req, res)=>{
//   const {email}= req.body
//   const user = await User.findOne({email:email});
//   if(!user) throw new Error("Email is invalid")
//   const token = await user.iscreatePasswordResetToken();
//   await user.save()
//   const resetUrls = `Hey, please follow this link to reset password<a href="http://127.00.1:5000/api/user/reset-password/${token}">Click Here</a>`
//   const data ={
//     to:email,
//     subject:"Find the link attached",
//     text:"Hey User",
//     htm:resetUrls
//   }
//   sendEmail(data)
//   res.json(token)
// })

// const resetPasswordToken= asyncHandler(async(req, res)=>{
//   const {password}=req.body
//   const {token}=req.params
 
//   const hashedToken = crypto.createHash("sha256").update(token).digest("hex")
//   const user =await User.findOne({
//     passwordResetToken:hashedToken,
//     passwordResetTokenExpires:{$gt:Date.now()}
//   })
//   if(!user) throw new Error("Token is expired,Try again")
//     user.password=password;
//     user.passwordResetToken=undefined;
//     user.passwordResetTokenExpires=undefined;
//     await user.save()
//  res.json(user)
// })



//  const handleRefreshToken = asyncHandler(async(req, res)=>{
//   const cookie = req.cookies;
//    if(!cookie?.refreshToken) throw new Error("No refreshToken in Cookies")
//      const refreshToken = cookie.refreshToken
//      const user = await User.findOne({refreshToken:refreshToken})
//      if(!user) throw new Error("No refreshToken match in the Database")
//         jwt.verify(refreshToken, process.env.JWT_PASS_SEC, (err, decoded)=>{
//          if(err || user.id !== decoded.id){
//             throw new Error("Something Went wrong with the refreshToken")         }
//         const accessToken =  generateToken(user?._id)
//         res.json({accessToken,  user: { 
//           _id: user._id,
//           email: user.email,
//            role: user.role,
//           firstname: user.firstname,
//           lastname: user.lastname
//          }})
//      })
       
//  })

const handleRefreshToken = asyncHandler(async (req, res) => {
   const { refreshToken } = req.cookies;
  
   // 1. Validate refresh token existence
   if (!refreshToken) throw new Error("No refreshToken in Cookies");

   // 2. Find user with matching refresh token
   const user = await User.findOne({ refreshToken });
   if (!user) throw new Error("Invalid refreshToken");

   // 3. Verify token validity
   jwt.verify(refreshToken, process.env.JWT_PASS_SEC, (err, decoded) => {
     if (err || user.id !== decoded.id) {
       throw new Error("Invalid or expired refreshToken");
     }

     // 4. Generate new access token and user data
     const accessToken = generateToken(user._id);
     res.json({
       accessToken,
       user: { // Explicitly send required user data
        _id: user._id,
         email: user.email,
         role: user.role,
         firstname: user.firstname,
         lastname: user.lastname
       }
     });
   });
 });




const logout = asyncHandler(async(req, res)=>{
    const cookie = req.cookies;
    if(!cookie?.refreshToken) throw new Error("No refreshToken in Cookie")
      const refreshToken = cookie.refreshToken
      const user = await User.findOne({refreshToken:refreshToken})
      if(!user) throw new Error("No refreshToken match in the Database")
          res.clearCookie("refreshToken", {
            httpOnly:true,
            secure:true
        })
        res.sendStatus(204);
        await User.findOneAndUpdate(refreshToken, {refreshToken:""}, {new:true})
        res.clearCookie("refreshToken", {
            httpOnly:true,
            secure:true
        })
        res.sendStatus(204);
  })


  


module.exports = {
    registerUser, 
    loginUser, 
    loginAdmin,
     getallUsers,
     getaUser,
     deleteaUser,
     updateUser,
     updatePassword,
     
     handleRefreshToken,
     logout,
     /*forgotPassword,*/
     /*resetPasswordToken,*/
 
    }