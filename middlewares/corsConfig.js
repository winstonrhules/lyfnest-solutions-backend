const cors = require('cors')
const corsOption = {
    origin:[process.env.CORS_ORIGIN, process.env.LFRONT_URL_ORIGIN, process.env.CORS_ORIGIN_ADMIN, process.env.LADMIN_URL_ORIGIN ],
    credentials:true
}

module.exports = cors(corsOption)