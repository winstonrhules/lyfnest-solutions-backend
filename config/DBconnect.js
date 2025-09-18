const mongoose = require("mongoose")
const EmailScheduler = require('../services/emailSchedulerService');

const emailScheduler = new EmailScheduler();

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
