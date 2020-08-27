class Home {
  home(req, res) {
    return res.render('home', { name: req.session.name });
  }
}

module.exports = new Home();
