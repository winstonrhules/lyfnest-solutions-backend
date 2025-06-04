const cors = require('cors')
const corsOption = {
    origin:[process.env.CORS_ORIGIN, 'http://localhost:5174', process.env.CORS_ORIGIN_ADMIN,   'http://localhost:5173'],
    credentials:true
}

module.exports = cors(corsOption)