const cors = require('cors')
const corsOption = {
    origin:[process.env.FRONT_URL, process.env.LFRONT_URL,  process.env.LADMIN_URL],
    credentials:true
}

module.exports = cors(corsOption)