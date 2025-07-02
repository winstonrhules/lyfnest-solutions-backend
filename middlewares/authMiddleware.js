const asyncHandler = require("express-async-handler")
const jwt = require("jsonwebtoken")
const User = require("../models/userModels")

// const authMiddleware = asyncHandler(async(req, res, next)=>{
//     let token;
//     if(req.headers.authorization.startsWith("Bearer")){
//      token=req.headers.authorization.split(" ")[1];
//      if(token){
//           const decode= jwt.verify(token, process.env.JWT_PASS_SEC)
//           const user = await User.findById(decode?.id)
//           req.user = user
//           next()
//      }
//      else{
//         throw new Error("Invalid Token")
//      }
//     }
//     else{
//         throw new Error("Can not find token in Header")
//     }
// })
const authMiddleware = asyncHandler(async(req, res, next) => {
  let token;
  
  // 1. Check if authorization header exists
  if (!req.headers.authorization || !req.headers.authorization.startsWith("Bearer")) {
    return res.status(401).json({ error: "Authorization token missing" });
  }

  try {
    // 2. Extract token
    token = req.headers.authorization.split(" ")[1];
    
    // 3. Verify token
    const decode = jwt.verify(token, process.env.JWT_PASS_SEC);
    
    // 4. Find user
    const user = await User.findById(decode?.id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    
    // 5. Attach user to request
    req.user = user;
    next();
  } catch (error) {
    // 6. Handle different error cases
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(500).json({ error: "Authentication failed" });
  }
});





// const isAdmin = asyncHandler(async(req, res, next)=>{
// if(!req.user){
//     return res.status(401).json({message:"Not Authorized, No user found"})
// }

// const findAdmin = await User.findOne({email:req.user.email})
// if(findAdmin.role!=="admin"){
//     throw new Error("You are not an Admin")
// }
// else{
//     next()
// }
// })

const isAdmin = asyncHandler(async(req, res, next) => {
  if(!req.user) {
    return res.status(401).json({ error: "User not authenticated" });
  }
  
  const adminUser = await User.findOne({ email: req.user.email });
  
  if(!adminUser || adminUser.role !== "admin") {
    return res.status(403).json({ error: "Admin privileges required" });
  }
  
  next();
});


module.exports = {authMiddleware, isAdmin}