// const robotsBlock = (req, res, next) => {

//   const adminPaths = ['/admin', '/dashboard', '/team', '/claims', '/login', '/signup'];
//   const isAdminPath = adminPaths.some(path => req.path.startsWith(path));
  
//   if (isAdminPath) {
//     // Block admin routes from indexing
//     res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
//     res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
//   } else {
//     // Allow public routes to be indexed
//     res.setHeader('X-Robots-Tag', 'index, follow');
//     res.setHeader('Cache-Control', 'public, max-age=3600');
//   }
//   next();
// };



// module.exports = robotsBlock;


const robotsBlock = (req, res, next) => {
  // Paths that should be blocked from indexing
  const blockedPaths = [
    /^\/admin(\/|$)/,
    /^\/dashboard(\/|$)/,
    /^\/team(\/|$)/,
    /^\/claims(\/|$)/,
    /^\/login(\/|$)/,
    /^\/signup(\/|$)/,
    /^\/api\/(user|forms|tforms|wforms|iforms|fforms)(\/|$)/
  ];

  const isBlocked = blockedPaths.some(regex => regex.test(req.path));

  if (isBlocked) {
    // Block from indexing
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
  } else {
    // Allow indexing for public pages
    res.setHeader('X-Robots-Tag', 'index, follow');
    
    // Cache static assets longer
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }

  next();
};

module.exports = robotsBlock;

