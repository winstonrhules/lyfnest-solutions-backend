const mongoose = require("mongoose")
const RobustEmailScheduler = require('../services/emailSchedulerService');

const emailScheduler = new RobustEmailScheduler();

const DBconnect = ()=>{
    try{
        const conn = mongoose.connect(process.env.MONGO_URL)
        console.log("Database connected successfully")
        emailScheduler.init();
    }
    catch(error){
        console.log("Database Failed to connect")  
    }

}

module.exports = DBconnect
