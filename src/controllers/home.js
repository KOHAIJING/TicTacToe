// IMPORT CONFIG
const mysql = AppRoot('/src/config/database');
const query = AppRoot('/src/config/query');

class Home {

  menu(req, res) {
    return res.render('menu', { name: req.session.name });
  }

  game(req, res) {
    return res.render('game', { clientId: req.session.id, name: req.session.name });
  }

  //SCOREBOARD
  async scoreboard(req, res){
    try{
      const [userResult] = await mysql.execute(query.searchUserScore, [req.session.id]);
      const [allUserResult] = await mysql.execute(query.searchAllUserScore);
      console.log(allUserResult.length);
      if(userResult.length == 1){
        return res.render('scoreboard', { userResult: userResult, allUserResult: allUserResult});
      }
    }
    catch(error){
      //REDERING SCOREBOARD PAGE WITH SCOREBOARD ERRORS
      console.log(error);
      await req.flash('showScoreErrors', 'ShowScore: Something went wrong! Internal server error!');
      return res.redirect('/scoreboard');
    }
  }

}

module.exports = new Home();
