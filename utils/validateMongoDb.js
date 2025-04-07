const mongoose = require("mongoose")

const validateMongoDb = (id)=>{
    const isValid=mongoose.Types.ObjectId.isValid(id)
    if(!isValid) throw new Error("ID does not match in Database")
}

module.exports = validateMongoDb