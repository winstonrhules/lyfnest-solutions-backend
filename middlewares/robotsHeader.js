const robotsBlock = (req, res, next) => {
//   const adminPaths = ['/dashboard', '/team', '/claims', '/login', '/signup'];
//   const isAdminPath = adminPaths.some(path => req.path.startsWith(path));
  
//   if (isAdminPath || req.path === '/') {
//     res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
//     res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
//   }
//   next();

  const adminPaths = ['/admin', '/dashboard', '/team', '/claims', '/login', '/signup'];
  const isAdminPath = adminPaths.some(path => req.path.startsWith(path));
  
  if (isAdminPath) {
    // Block admin routes from indexing
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    // Allow public routes to be indexed
    res.setHeader('X-Robots-Tag', 'index, follow');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  next();
};



module.exports = robotsBlock;
