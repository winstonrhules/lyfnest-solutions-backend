const cors = require('cors')
const corsOption = {
    origin:[process.env.FRONT_ORIGIN, process.env.LFRONT_ORIGIN,  process.env.LADMIN_ORIGIN],
    credentials:true
}

module.exports = cors(corsOption)


