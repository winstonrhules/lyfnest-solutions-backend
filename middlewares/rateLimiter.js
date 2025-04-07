const rateLimit = require('express-rate-limit')

const verificationLimiter = rateLimit({
    windowMs:15*60*1000,
    max:3,
    message:{
        error: "Too many verification attempts"
    },
    standardHeaders:true,
    legacyHeaders:false,
});

module.exports = verificationLimiter
