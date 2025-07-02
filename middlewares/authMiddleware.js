const asyncHandler = require("express-async-handler")
const jwt = require("jsonwebtoken")
const User = require("../models/userModels")

const authMiddleware = asyncHandler(async(req, res, next)=>{
    let token;
    if(req.headers.authorization.startsWith("Bearer")){
     token=req.headers.authorization.split(" ")[1];
     if(token){
          const decode= jwt.verify(token, process.env.JWT_PASS_SEC)
          const user = await User.findById(decode?.id)
          req.user = user
          next()
     }
     else{
        throw new Error("Invalid Token")
     }
    }
    else{
        throw new Error("Can not find token in Header")
    }
})

const isAdmin = asyncHandler(async(req, res, next)=>{
if(!req.user){
    return res.status(401).json({message:"Not Authorized, No user found"})
}
const {email}=req.user;
const findAdmin = await User.findOne({email:email})
if(findAdmin.role!=="admin"){
    throw new Error("You are not an Admin")
}
else{
    next()
}
})

module.exports = {authMiddleware, isAdmin}