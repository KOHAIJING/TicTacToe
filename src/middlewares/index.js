//DECLARING CUSTOM MIDDLEWARE - IF USER HAVEN'T LOGIN
exports.ifNotLoggedin = async (req, res, next) => {
  try {
    if (!req.session.isLoggedIn && !req.url.includes('/login') && !req.url.includes('/register')) {
      return res.redirect('/login');
    }
    next();
  }
  catch (error) {
    await request.flash('errors', 'Middleware: Something went wrong! Internal server error!');
    return response.redirect('/login');
  }
}

//DECLARING CUSTOM MIDDLEWARE - IF USER HAVE LOGIN
exports.ifLoggedin = (req, res, next) => {
  try {
    if (req.session.isLoggedIn) {
      return res.redirect('/home');
    }
    next();
  } catch (error) {
    next();
  }
};
