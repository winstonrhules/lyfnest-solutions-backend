const mongoose = require("mongoose")




const DBconnect = ()=>{
    try{
        const conn = mongoose.connect(process.env.MONGO_URL)
        console.log("Database connected successfully")
      
    }
    catch(error){
        console.log("Database Failed to connect")  
    }   

  


}

module.exports = DBconnect
