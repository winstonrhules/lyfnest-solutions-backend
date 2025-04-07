const cors = require('cors')
const corsOption = {
    origin:['http://localhost:5174', 'http://localhost:5173'],
    credentials:true
}

module.exports = cors(corsOption)