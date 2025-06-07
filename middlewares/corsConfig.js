const cors = require('cors')
const corsOption = {
    origin:['https://life.lyfnestsolutions.com',  'http://localhost:5174', 'https://natbetadmin.lyfnestsolutions.com',  process.env.CORS_ORIGIN_ADMIN],
    credentials:true
}

module.exports = cors(corsOption)