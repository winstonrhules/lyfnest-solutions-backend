const mongoose = require("mongoose")
const { syncJob } = require('../utils/cron');
const DBconnect = ()=>{
    try{
        const conn = mongoose.connect(process.env.MONGO_URL)
        console.log("Database connected successfully")
        syncJob.start();
    }
    catch(error){
        console.log("Database Failed to connect")
    }

}

module.exports = DBconnect
