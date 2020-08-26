const env = require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const expressSession = require('express-session');
const MemoryStore = require('memorystore')(expressSession);
const cookieParser = require('cookie-parser');
const connectFlash = require('connect-flash');
const bcrypt = require('bcryptjs');
const { check, body, validationResult } = require('express-validator');
const dbConnection = require('./src/database');

const app = express();
app.use(express.urlencoded({ extended: false }));

// SET OUR VIEWS AND VIEW ENGINE
app.set('views', path.join(__dirname, './src/views'));
app.set('view engine', 'ejs');

// APPLY COOKIE SESSION MIDDLEWARE
app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2'],
  maxAge: 3600 * 1000, // 1hr
}));

// SET FLASH MESSAGE SESSION
app.use(cookieParser('secret'));
app.use(expressSession({
  cookie: { maxAge: 86400000 },
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  secret: 'secret_passcode',
  resave: false,
  saveUninitialized: false
}));
app.use(connectFlash());
app.use((req, res, next) => {
  res.locals.flashMessages = req.flash();
  next();
});

// SET FLASH MESSAGE SESSION
app.use(cookieParser('secret'));
app.use(expressSession({
  cookie: { maxAge: 86400000 },
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  secret: 'secret_passcode',
  resave: false,
  saveUninitialized: false
}));
app.use(connectFlash());
app.use((req, res, next) => {
  res.locals.flashMessages = req.flash();
  next();
});

// DECLARING CUSTOM MIDDLEWARE
const ifNotLoggedin = (req, res, next) => {
  if (!req.session.isLoggedIn) {
    return res.redirect('/login');
  }
  next();
};
const ifLoggedin = (req, res, next) => {
  if (req.session.isLoggedIn) {
    return res.redirect('/home');
  }
  next();
};

// ROOT PAGE - DETERMINE WHETHER DIRECT TO LOGIN PAGE OR HOME PAGE
app.get('/',  ifNotLoggedin, (req, res, next) => {
  //req.session = null;
  //res.render('login');
  dbConnection.execute('SELECT `name` FROM `users` WHERE `id`=?', [req.session.userID])
    .then(() => { res.redirect('/home'); });
});

// DIRECT TO REGISTRATION PAGE
app.get('/register', ifLoggedin, (req, res, next) => {
  res.render('registration');
});

// DIRECT TO LOGIN PAGE
app.get('/login', ifLoggedin, (req, res, next) => {
  res.render('login');
});

// DIRECT TO HOME PAGE
app.get('/home', ifNotLoggedin, (req, res, next) => {
  dbConnection.execute('SELECT `name` FROM `users` WHERE `id`=?', [req.session.userID])
    .then(([rows]) => {
      res.render('home', {
        name: rows[0].name,
      });
    });
});

// REGISTRATION
app.post('/register', ifLoggedin, async (req, res) => {
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
      const [result] = await dbConnection.execute('SELECT `email` FROM `users` WHERE `email`=?', [user_email]);
      if(result.length > 0){
        await req.flash('loginErrors', 'This E-mail already in use!');
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
      const doneInsertData = await dbConnection.execute('INSERT INTO `users`(`name`,`email`,`password`) VALUES(?,?,?)', [user_name, user_email, hash_pass])
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
});

// LOGIN
app.post('/login', ifLoggedin, async (req, res) => {
  try{
    //DATA VALIDATION (USING EXPRESS-VALIDATOR)
    await check('user_email', 'Invalid email address format!').isEmail().run(req);
    await check('user_pass', 'The password must be of minimum length 6 characters!').isLength({ min: 6 }).run(req);
    const validation_result = validationResult(req);
    const {user_email, user_pass} = req.body;
    //IF VALIDATION_RESULT HAS NO ERROR
    if (validation_result.isEmpty()) {
      //CHECK WHETHER EMAIL REGISTERED IS MATCH OR NOT
      const [result] = await dbConnection.execute('SELECT * FROM `users` WHERE `email`=?', [user_email])
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
});

// LOGOUT
app.get('/logout', (req, res) => { // session destroy
  try{
    req.session = null;
    return res.redirect('/login');
  }
  catch(error){
    //REDERING HOME PAGE WITH LOGOUT ERRORS
    return req.flash('logoutErrors', 'Logout: Something went wrong! Internal server error!');
  }
});


// PAGE NOT FOUND
app.use('/login', async (req, res) => {
  return res.status(404).send('<h1>404 Page Not Found!</h1>');
});

// FOR CMD COMMAND
app.listen(process.env.PORT || 3000, () => console.log('Server is Running...'));
