//IMPORT MODULES
const bcrypt = require('bcryptjs');
const { check, body, validationResult } = require('express-validator');

// IMPORT CONFIG
const mysql = AppRoot('/src/config/database');
const query = AppRoot('/src/config/query');

class Auth {

//DIRECT TO LOGIN PAGE
async login(req, res){
  return res.render('login', {
    errors: await req.flash('error'),
    success: await req.flash('success'),
  });
}

//DIRECT TO REGISTER PAGE
async register(req, res){
  return res.render('registration', {
    errors: await req.flash('error')
  });
}

//LOGIN
async loginUser(req, res){
  try{
    //DATA VALIDATION (USING EXPRESS-VALIDATOR)
    await check('user_email', 'Invalid email address format!').isEmail().run(req);
    await check('user_pass', 'The password must be of minimum length 6 characters!').isLength({ min: 6 }).run(req);
    const validation_result = validationResult(req);
    const {user_email, user_pass} = req.body;
    //IF VALIDATION_RESULT HAS NO ERROR
    if (validation_result.isEmpty()) {
      //CHECK WHETHER EMAIL REGISTERED IS MATCH OR NOT
      const [result] = await mysql.execute(query.searchUser, [user_email]);
      if(result.length <= 0){
        await req.flash('loginErrors', 'Invalid Email Address!');
        return res.redirect('/login');
      }
      //CHECK WHETHER PASSWORD REGISTERED IS MATCH OR NOT
      const bool = await bcrypt.compare(user_pass, result[0].password);
      if(!bool){
        await req.flash('loginErrors', 'Invalid Password!');
        return res.redirect('/login');
      }
      //SET LOGIN SESSION AND REDERING HOME PAGE
      req.session.isLoggedIn = true;
      req.session.userID = result[0].id;
      req.session.name = result[0].name;
      //req.session.save();
      return res.redirect('/home');
    }
    else{
      //REDERING LOGIN PAGE WITH LOGIN VALIDATION ERRORS
      const allErrors = validation_result.errors.map((error) => error.msg);
      await req.flash('loginErrors',allErrors);
      return res.redirect('/login');
    }
  }
  catch(error){
    //REDERING LOGIN PAGE WITH LOGIN ERRORS
    console.log(error);
    await req.flash('loginErrors', 'Login: Something went wrong! Internal server error!');
    return res.redirect('/login');
  }
}

//REGISTER
async registerUser(req, res){
  try{
    //DATA VALIDATION (USING EXPRESS-VALIDATOR)
    await check('user_email', 'Invalid email address format!').isEmail().run(req);
    await check('user_name', 'Name is Empty!').trim().not().isEmpty().run(req);
    await check('user_pass', 'The password must be of minimum length 6 characters!').isLength({ min: 6 }).run(req);
    await check('user_cpass', 'The confirm password must be same with the password!').trim()
    .custom((value, { req }) => value === req.body.user_pass).run(req);
    const validation_result = validationResult(req);
    const {user_name, user_pass, user_email, user_cpass} = req.body;
    //IF VALIDATION_RESULT HAS NO ERROR
    if (validation_result.isEmpty()) {
      //CHECK WHETHER EMAIL HAS BEEN REGISTERED
      const [result] = await mysql.execute(query.searchUser, [user_email]);
      if(result.length > 0){
        await req.flash('registerErrors', 'This E-mail already in use!');
        return res.redirect('/register');
      }
      //PASSWORD ENCRYPTION
      const hash_pass = await new Promise((resolve, reject) => {
          bcrypt.hash(user_pass, 12, function(err, hash) {
            if (err) reject(err)
            resolve(hash)
          });
        });
      //INSERTING USER INTO DATABASE
      const doneInsertData = await mysql.execute(query.insertUser, [user_name, user_email, hash_pass]);
      if(doneInsertData){
        await req.flash('success', `${user_name}'s account created successfully!`);
        return res.redirect('/login');
      }
    }
    else{
      //REDERING REGISTER PAGE WITH REGISTER VALIDATION ERRORS
      const allErrors = validation_result.errors.map((error) => error.msg);
      await req.flash('registerErrors',allErrors);
      return res.redirect('/register');
    }
  }
  catch(error){
    //REDERING REGISTER PAGE WITH REGISTER ERRORS
    console.log(error);
    await req.flash('registerErrors', 'Register: Something went wrong! Internal server error!');
    return res.redirect('/register');
  }
}

async logoutUser(req, res){
  try{
    //DESTROY SESSION
    req.session = null;
    return res.redirect('/login');
  }
  catch(error){
    //REDERING LOGIN PAGE WITH LOGOUT ERRORS
    await req.flash('logoutErrors', 'Logout: Something went wrong! Internal server error!');
    return res.redirect('/login');
  }
}

}

module.exports = new Auth();
