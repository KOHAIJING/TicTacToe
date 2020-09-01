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
    await check('userEmail', 'Invalid email address format!').isEmail().run(req);
    await check('userPass', 'The password must be of minimum length 6 characters!').isLength({ min: 6 }).run(req);
    const validResult = validationResult(req);
    const {userEmail, userPass} = req.body;
    //IF VALIDRESULT HAS NO ERROR
    if (validResult.isEmpty()) {
      //CHECK WHETHER EMAIL REGISTERED IS MATCH OR NOT
      const [result] = await mysql.execute(query.searchUser, [userEmail]);
      if(result.length <= 0){
        await req.flash('loginErrors', 'Invalid Email Address!');
        return res.redirect('/login');
      }
      //CHECK WHETHER PASSWORD REGISTERED IS MATCH OR NOT
      const bool = await bcrypt.compare(userPass, result[0].password);
      if(!bool){
        await req.flash('loginErrors', 'Invalid Password!');
        return res.redirect('/login');
      }
      //SET LOGIN SESSION AND REDERING HOME PAGE
      req.session.isLoggedIn = true;
      req.session.name = result[0].name;
      //req.session.save();
      return res.redirect('/home');
    }
    else{
      //REDERING LOGIN PAGE WITH LOGIN VALIDATION ERRORS
      const allErrors = validResult.errors.map((error) => error.msg);
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
    await check('userEmail', 'Invalid email address format!').isEmail().run(req);
    await check('userName', 'Name is Empty!').trim().not().isEmpty().run(req);
    await check('userPass', 'The password must be of minimum length 6 characters!').isLength({ min: 6 }).run(req);
    await check('userCPass', 'The confirm password must be same with the password!').trim()
    .custom((value, { req }) => value === req.body.userPass).run(req);
    const validResult = validationResult(req);
    const {userName, userPass, userEmail, userCPass} = req.body;
    //IF VALIDRESULT HAS NO ERROR
    if (validResult.isEmpty()) {
      //CHECK WHETHER EMAIL HAS BEEN REGISTERED
      const [result] = await mysql.execute(query.searchUser, [userEmail]);
      if(result.length > 0){
        await req.flash('registerErrors', 'This E-mail already in use!');
        await req.flash('oldName', userName);
        await req.flash('oldEmail', userEmail);
        return res.redirect('/register');
      }
      //PASSWORD ENCRYPTION
      const hashPass = await new Promise((resolve, reject) => {
          bcrypt.hash(userPass, 12, function(err, hash) {
            if (err) reject(err)
            resolve(hash)
          });
        });
      //INSERTING USER INTO DATABASE
      const doneInsertData = await mysql.execute(query.insertUser, [userName, userEmail, hashPass]);
      if(doneInsertData){
        await req.flash('success', `${userName}'s account created successfully!`);
        return res.redirect('/login');
      }
    }
    else{
      //REDERING REGISTER PAGE WITH REGISTER VALIDATION ERRORS
      const allErrors = validResult.errors.map((error) => error.msg);
      await req.flash('registerErrors',allErrors);
      await req.flash('oldName', userName);
      await req.flash('oldEmail', userEmail);
      return res.redirect('/register');
    }
  }
  catch(error){
    //REDERING REGISTER PAGE WITH REGISTER ERRORS
    console.log(error);
    await req.flash('registerErrors', 'Register: Something went wrong! Internal server error!');
    await req.flash('oldName', userName);
    await req.flash('oldEmail', userEmail);
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
