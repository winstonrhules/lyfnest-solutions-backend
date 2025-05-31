// const express = require('express')
// const DBconnect = require('./config/DBconnect')
// const app = express()
// const dotenv = require('dotenv').config()
// const authRouter = require('./routes/authRoutes')
// const formRouter = require('./routes/formRoutes')
// const tformRouter = require('./routes/tformRoutes')
// const wformRouter = require('./routes/wformRoutes')
// const iformRouter = require('./routes/iformRoutes')
// const fformRouter = require('./routes/fformRoutes')
// const corsConfig = require('./middlewares/corsConfig')
// const cookieParser = require('cookie-parser')
// const { notFound, errorHandler } = require('./middlewares/errorHandler')
// const robotsBlock = require('./middlewares/robotsHeader')
// const path = require('path')
// DBconnect()
// const PORT = process.env.PORT || 4000
// app.use(cookieParser())
// app.use(express.json())
// app.use(express.urlencoded({ extended: true}))
// app.use(corsConfig)
// app.use(robotsBlock);
// app.use('/api/user',  authRouter)
// app.use('/api/forms', formRouter)
// app.use('/api/tforms', tformRouter)
// app.use('/api/wforms', wformRouter)
// app.use('/api/iforms', iformRouter)
// app.use('/api/fforms', fformRouter)

// app.use(express.static(path.join(__dirname, '../lyfnest-solutions-admin/build')));

// // Admin routes with additional security
// app.use('/admin/*', (req, res, next) => {
//   res.sendFile(path.join(__dirname, '../lyfnest-solutions-admin/build', 'index.html'));
// });

// app.use(notFound)
// app.use(errorHandler)
// app.listen(PORT, ()=>{
//     console.log(`server running at PORT ${PORT}`)
// })


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
const robotsBlock = require('./middlewares/robotsHeader')
const path = require('path')
const helmet = require('helmet')

DBconnect()

const PORT = process.env.PORT || 4000

app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true}))
app.use(corsConfig)

// Serve robots.txt from public directory
app.use(express.static(path.join(__dirname, 'public')));

app.use(robotsBlock);

// API routes
app.use('/api/user', authRouter)
app.use('/api/forms', formRouter)
app.use('/api/tforms', tformRouter)
app.use('/api/wforms', wformRouter)
app.use('/api/iforms', iformRouter)
app.use('/api/fforms', fformRouter)

// Serve static files from build directory
app.use(express.static(path.join(__dirname, '../lyfnest-solutions-admin/dist')));

// More secure catch-all route - only serve admin app for specific routes
app.use('/admin', express.static(path.join(__dirname, '../lyfnest-solutions-admin/dist')));
app.use(express.static(path.join(__dirname, '../lyfnest-solutions/dist')));

// Route handling
// Admin routes (protected from indexing)
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../lyfnest-solutions-admin/dist', 'index.html'));
});

// Admin dashboard routes (for backward compatibility)
const adminRoutes = ['/dashboard', '/team', '/claims', '/login', '/signup'];
app.get(adminRoutes, (req, res) => {
  res.sendFile(path.join(__dirname, '../lyfnest-solutions-admin/dist', 'index.html'));
});

app.get('/dashboard/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../lyfnest-solutions-admin/dist', 'index.html'));
});

app.get('/claims/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../lyfnest-solutions-admin/dist', 'index.html'));
});

// Public routes (SEO-friendly)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../lyfnest-solutions/dist', 'index.html'));
});

// Add security headers using Helmet
app.use(helmet({
contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust as needed
      styleSrc: ["'self'", "'unsafe-inline'"],
    }
  }
}
));

app.use(notFound)
app.use(errorHandler)

app.listen(PORT, ()=>{
    console.log(`server running at PORT ${PORT}`)
})
