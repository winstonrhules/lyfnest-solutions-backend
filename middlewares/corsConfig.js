const cors = require('cors')
const corsOption = {
    origin:[process.env.CORS_ORIGIN_FRONT,  process.env.CORS_ORIGIN_LFRONT, process.env.CORS_ORIGIN_ADMIN,  process.env.CORS_ORIGIN_LADMIN],
    credentials:true
}

module.exports = cors(corsOption)

