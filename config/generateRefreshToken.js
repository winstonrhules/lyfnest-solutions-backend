const jwt = require("jsonwebtoken")

const generateRefreshToken = (id)=>{
 return jwt.sign({id}, process.env.JWT_PASS_SEC, {expiresIn:"3d"})
}

module.exports = generateRefreshToken