// IMPORT CONFIG
const mysql = AppRoot('/src/config/database');
const query = AppRoot('/src/config/query');

class Home {

  menu(req, res) {
    return res.render('menu', { userInfo: req.session.userInfo });
  }

  gameWithPlayer(req, res) {
    return res.render('gameWithPlayer', { userInfo: req.session.userInfo });
  }

  gameWithAI(req, res) {
    return res.render('gameWithAI', { userInfo: req.session.userInfo });
  }

  //SCOREBOARD
  async scoreboard(req, res) {
    try {
      const [userResult] = await mysql.execute(query.searchUserById, [req.session.userInfo.id]);
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
