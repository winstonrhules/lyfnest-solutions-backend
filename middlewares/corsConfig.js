const cors = require('cors')
const corsOption = {
    origin:['https://life.lyfnestsolutions.com', 'http://localhost:5174',  'http://localhost:5173'],
    credentials:true
}

module.exports = cors(corsOption)