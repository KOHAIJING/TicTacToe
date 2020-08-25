const env = require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieSession = require("cookie-session");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const dbConnection = require("./database");

const app = express();
app.use(express.urlencoded({ extended: false }));

// SET OUR VIEWS AND VIEW ENGINE
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// APPLY COOKIE SESSION MIDDLEWARE
app.use(cookieSession({
  name: "session",
  keys: ["key1", "key2"],
  maxAge: 3600 * 1000, // 1hr
}));

// DECLARING CUSTOM MIDDLEWARE
const ifNotLoggedin = (req, res, next) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }
  next();
};
const ifLoggedin = (req, res, next) => {
  if (req.session.isLoggedIn) {
    return res.redirect("/home");
  }
  next();
};

// ROOT PAGE - DETERMINE WHETHER DIRECT TO LOGIN PAGE OR HOME PAGE
app.get("/", (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  dbConnection.execute("SELECT `name` FROM `users` WHERE `id`=?", [req.session.userID])
    .then(() => { res.redirect("/home"); });
});

// DIRECT TO REGISTRATION PAGE
app.get("/register", (req, res) => {
  res.render("registration");
});

// DIRECT TO LOGIN PAGE
app.get("/login", (req, res) => {
  res.render("login");
});

// DIRECT TO HOME PAGE
app.get("/home", (req, res) => {
  dbConnection.execute("SELECT `name` FROM `users` WHERE `id`=?", [req.session.userID])
    .then(([rows]) => {
      res.render("home", {
        name: rows[0].name,
      });
    });
});

// REGISTRATION
app.post("/register", ifLoggedin, // post data validation(using express-validator)
  [
    body("user_email", "Invalid email address!").isEmail().custom((value) => dbConnection.execute("SELECT `email` FROM `users` WHERE `email`=?", [value])
      .then(([rows]) => {
        if (rows.length > 0) {
          return Promise.reject("This E-mail already in use!");
        }
        return true;
      })),
    body("user_name", "Username is Empty!").trim().not().isEmpty(),
    body("user_pass", "The password must be of minimum length 6 characters").trim().isLength({ min: 6 }),
    body("user_cpass", "The confirm password must be same with the password").trim()
    .custom((value, { req }) => value === req.body.user_pass),
  ], // end of post data validation
  (req, res, next) => {
    const validation_result = validationResult(req);
    const {
      user_name, user_pass, user_email, user_cpass,
    } = req.body;
    // IF validation_result HAS NO ERROR
    if (validation_result.isEmpty()) {
      // password encryption (using bcryptjs)
      bcrypt.hash(user_pass, 12).then((hash_pass) => {
        // INSERTING USER INTO DATABASE
        dbConnection.execute("INSERT INTO `users`(`name`,`email`,`password`) VALUES(?,?,?)", [user_name, user_email, hash_pass])
          .then((result) => {
            res.send("Your account has been created successfully, Now you can <a href=\"/login\">Login</a>");
            // res.send(`Your account has been created successfully, Now you can <a href="/login">Login</a>`);
          }).catch((err) => {
            // THROW INSERTING USER ERROR'S
            if (err) throw err;
          });
      })
        .catch((err) => {
          // THROW HASING ERROR'S
          if (err) throw err;
        });
    } else {
      // COLLECT ALL THE VALIDATION ERRORS
      const allErrors = validation_result.errors.map((error) => error.msg);
      // REDERING REGISTRATION PAGE WITH VALIDATION ERRORS
      res.render("registration", {
        register_error: allErrors,
        old_data: req.body,
      });
    }
  });

// LOGIN
app.post("/login", ifLoggedin, [
  body("user_email").custom((value) => dbConnection.execute("SELECT `email` FROM `users` WHERE `email`=?", [value])
    .then(([rows]) => {
      if (rows.length == 1) {
        return true;
      }
      return Promise.reject("Invalid Email Address!");
    })),
  body("user_pass", "Password is empty!").trim().not().isEmpty(),
], (req, res) => {
  const validation_result = validationResult(req);
  const { user_pass, user_email } = req.body;
  if (validation_result.isEmpty()) {
    dbConnection.execute("SELECT * FROM `users` WHERE `email`=?", [user_email])
      .then(([rows]) => {
        bcrypt.compare(user_pass, rows[0].password).then((compare_result) => {
          if (compare_result === true) {
            req.session.isLoggedIn = true;
            req.session.userID = rows[0].id;
            res.redirect("/home");
          } else {
            res.render("login", {
              login_errors: ["Invalid Password!"],
            });
          }
        })
          .catch((err) => {
            if (err) throw err;
          });
      }).catch((err) => {
        if (err) throw err;
      });
  } else {
    const allErrors = validation_result.errors.map((error) => error.msg);
    // REDERING LOGIN PAGE WITH LOGIN VALIDATION ERRORS
    res.render("login", {
      login_errors: allErrors,
    });
  }
});

// LOGOUT
app.get("/logout", (req, res) => { // session destroy
  req.session = null;
  res.redirect("/login");
});

// PAGE NOT FOUND
app.use("/login", (req, res) => {
  res.status(404).send("<h1>404 Page Not Found!</h1>");
});

// FOR CMD COMMAND
app.listen(process.env.PORT || 3000, () => console.log("Server is Running..."));
