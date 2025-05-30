const robotsBlock = (req, res, next) => {
  const adminPaths = ['/dashboard', '/team', '/claims', '/login', '/signup'];
  const isAdminPath = adminPaths.some(path => req.path.startsWith(path));
  
  if (isAdminPath || req.path === '/') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
};

module.exports = robotsBlock;
