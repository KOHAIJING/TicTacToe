// IMPORT CONFIG
const mysql = AppRoot('/src/config/database');
const query = AppRoot('/src/config/query');

class Home {

  menu(req, res) {
    return res.render('menu', { name: req.session.name });
  }

  gameWithPlayer(req, res) {
    return res.render('gameWithPlayer', { name: req.session.name, clientId: req.session.clientId });
  }

  gameWithAI(req, res) {
    return res.render('gameWithAI', { name: req.session.name });
  }

  //SCOREBOARD
  async scoreboard(req, res) {
    try {
      const [userResult] = await mysql.execute(query.searchUserById, [req.session.clientId]);
      const [allUserResult] = await mysql.execute(query.searchAllUsersByTotalPlayed);
      if (userResult.length == 1) {
        return res.render('scoreboard', { userResult: userResult, allUserResult: allUserResult });
      }
    }
    catch (error) {
      //REDERING SCOREBOARD PAGE WITH SCOREBOARD ERRORS
      console.log(error);
      await req.flash('showScoreErrors', 'ShowScore: Something went wrong! Internal server error!');
      return res.redirect('/scoreboard');
    }
  }

}

module.exports = new Home();
