class Home {

  menu(req, res) {
    return res.render('menu', { name: req.session.name });
  }

  game(req, res) {
    return res.render('game', { clientId: req.session.id, name: req.session.name });
  }
}

module.exports = new Home();
