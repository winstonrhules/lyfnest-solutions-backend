const dotenv = require('dotenv').config();
const express = require('express');
const DBconnect = require('./config/DBconnect');
const http = require('http');
const {syncZoomMeetings} = require('./utils/zoomService');
// Add this to your main server file
const mongoose = require('mongoose'); 
const emailScheduler = require('./services/emailSchedulerService');

const app = express();

const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// Import routes
const authRouter = require('./routes/authRoutes');
const formRouter = require('./routes/formRoutes');
const tformRouter = require('./routes/tformRoutes');
const wformRouter = require('./routes/wformRoutes');
const iformRouter = require('./routes/iformRoutes');
const fformRouter = require('./routes/fformRoutes');
const appointmentRouter = require('./routes/appointmentRoutes');
const clientContactRouter = require('./routes/clientContactRoutes');
const zoomRoutes = require('./routes/zoomRoutes');
const emailTemplateRouter = require('./routes/emailTemplateRoutes');
const emailScheduleRouter = require('./routes/emailScheduleRoutes');
const userSettingRouter = require('./routes/userSettingRoutes');
// const emailRouter = require('./routes/emailRoutes');

const Appointment = require('./models/appointmentModels'); // Import the Appointment model
// Middleware
const corsConfig = require('./middlewares/corsConfig');
const robotsBlock = require('./middlewares/robotsHeader');
const { notFound, errorHandler } = require('./middlewares/errorHandler');


async function startServer() {
  try{
       // Connect to database
       await DBconnect()
       console.log("database connected, starting email scheduler...");
       
       // Start email scheduler
       emailScheduler.start();
       console.log("email scheduler started.");
  }catch(error){
       console.error("Error starting server:", error);
  }
}

startServer(); 



process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  emailScheduler.stop();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  emailScheduler.stop();
  await mongoose.connection.close();
  process.exit(0);
});




const socketIo = require('socket.io');
const server = http.createServer(app);

setInterval(() => {
  try {
    syncZoomMeetings();
  } catch (error) {
    console.error("Error synchronizing Zoom meetings:", error);
  }
}, 5 * 60 * 1000); // Sync every 5 minutes
console.log("Zoom meetings synchronized");




// Enhanced CORS configuration
const io = socketIo(server, {
  cors: {
    origin: [
      process.env.CORS_ORIGIN_FRONT,  
      process.env.CORS_ORIGIN_LFRONT, 
      process.env.CORS_ORIGIN_ADMIN,  
      process.env.CORS_ORIGIN_LADMIN
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  transports: ['websocket', 'polling'] // Add websocket transport
});

// Add CORS middleware for preflight requests
app.options('*', corsConfig);

// Attach io to app locals
global.io = io;

const PORT = process.env.PORT || 4000;

// 1. Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://www.google-analytics.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.googletagmanager.com", "https://*.google-analytics.com"],
      connectSrc: ["'self'", "https://*.google-analytics.com", "https://*.googletagmanager.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      reportUri: ['/api/csp-violation-report-endpoint']
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  crossOriginEmbedderPolicy: false
}));

// 2. Robots Blocking Middleware
app.use(robotsBlock);

// 3. Standard Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(corsConfig);

// 4. Serve Static Files
const publicDistPath = path.join(__dirname, '../lyfnest-solutions/dist');
const adminDistPath = path.join(__dirname, '../lyfnest-solutions-admin/dist');

app.use(express.static(publicDistPath)); // Public site
app.use('/admin', express.static(adminDistPath)); // Admin site under /admin


app.get('/robots.txt', (req, res) => {
  res.type('text/plain')
  res.send(`User-agent: *
# Allow all public pages to be indexed
Allow: /
Allow: /term-life
Allow: /whole-life
Allow: /indexed-insurance
Allow: /final-expense
Allow: /privacy
Allow: /term-use
Allow: /compliance
Allow: /thank-you

# Block all admin-related paths
Disallow: /admin/
Disallow: /dashboard/
Disallow: /team/
Disallow: /claims/
Disallow: /login
Disallow: /signup
Disallow: /api/user/
Disallow: /api/forms/
Disallow: /api/tforms/
Disallow: /api/wforms/
Disallow: /api/iforms/
Disallow: /api/fforms/
Disallow: /api/appointments/
Disallow: /api/client-contacts/
Disallow: /api/auth/
Disallow: /api/csp-violation-report-endpoint
Disallow: /api/appointment-forms/







# Crawl delay for better server performance
Crawl-delay: 1

# Sitemap location
Sitemap: https://life.lyfnestsolutions.com/sitemap.xml`)
})

// Add sitemap.xml route
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml')
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <url>
    <loc>https://life.lyfnestsolutions.com/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>

  <url>
    <loc>https://life.lyfnestsolutions.com/term-life</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>

  <url>
    <loc>https://life.lyfnestsolutions.com/whole-life</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>

  <url>
    <loc>https://life.lyfnestsolutions.com/indexed-insurance</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>

  <url>
    <loc>https://life.lyfnestsolutions.com/final-expense</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>

  <url>
   <loc>https://life.lyfnestsolutions.com/privacy</loc>
   <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <url>
    <loc>https://life.lyfnestsolutions.com/term-use</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <url>
    <loc>https://life.lyfnestsolutions.com/compliance</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

   <url>
    <loc>https://life.lyfnestsolutions.com/thank-you</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

</urlset>`)
})


// 5. API Routes
app.use('/api/user', authRouter);
app.use('/api/forms', formRouter);
app.use('/api/tforms', tformRouter);
app.use('/api/wforms', wformRouter);
app.use('/api/iforms', iformRouter);
app.use('/api/fforms', fformRouter);
app.use('/api/appointments', appointmentRouter);
app.use('/api/contacts', clientContactRouter);
app.use('/api/zoom', zoomRoutes);
app.use('/api/email-templates', emailTemplateRouter);
app.use('/api/scheduled-emails', emailScheduleRouter);
app.use('/api/user-settings', userSettingRouter);
// app.use('/api/send-email', emailRouter);

// 6. Admin Routes - Serve Admin SPA
const adminPaths = [
  '/admin', 
  '/admin/*',
  '/dashboard', 
  '/dashboard/*',
  '/team',
  '/claims',
  '/login',
  '/signup',
  '/admin/appointment-forms',
  '/admin/appointment-forms/*',
  '/admin/contacts',
  '/admin/contacts/*',
  '/admin/appointments',
  '/admin/appointments/*',
  '/admin/forms',
  '/admin/forms/*',
  '/admin/tforms',
  '/admin/tforms/*',
  '/admin/wforms',
  '/admin/wforms/*',
  '/admin/iforms',
  '/admin/iforms/*',
  '/admin/fforms',
  '/admin/fforms/*',
  '/admin/auth',
  '/admin/auth/*',
  '/admin/csp-violation-report-endpoint',
  '/admin/csp-violation-report-endpoint/*'
];

app.get(adminPaths, (req, res) => {
  res.sendFile(path.join(adminDistPath, 'index.html'));
});

// 7. Public Routes - Serve Public SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDistPath, 'index.html'));
});


// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle appointment events
  socket.on('joinAppointments', () => {
    console.log(`Client ${socket.id} joined appointments room`);
    socket.join('appointments');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Add this middleware to emit events from controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// 8. Error Handling
app.use(notFound);
app.use(errorHandler);



// Start Server
server.listen(PORT, () => {
  console.log(`Server running at PORT ${PORT}`);
  console.log(`WebSocket server running at ws://localhost:${PORT}`);
});





