const express = require('express')
const DBconnect = require('./config/DBconnect')
const app = express()
const dotenv = require('dotenv').config()
const authRouter = require('./routes/authRoutes')
const formRouter = require('./routes/formRoutes')
const tformRouter = require('./routes/tformRoutes')
const wformRouter = require('./routes/wformRoutes')
const iformRouter = require('./routes/iformRoutes')
const fformRouter = require('./routes/fformRoutes')
const corsConfig = require('./middlewares/corsConfig')
const cookieParser = require('cookie-parser')
const { notFound, errorHandler } = require('./middlewares/errorHandler')
DBconnect()
const PORT = process.env.PORT || 4000
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true}));
app.use(corsConfig)
app.use('/api/user',  authRouter)
app.use('/api/forms', formRouter)
app.use('/api/tforms', tformRouter)
app.use('/api/wforms', wformRouter)
app.use('/api/iforms', iformRouter)
app.use('/api/fforms', fformRouter)
app.use(notFound)
app.use(errorHandler)
app.listen(PORT, ()=>{
    console.log(`server running at PORT ${PORT}`)
})