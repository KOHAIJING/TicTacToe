//IMPORT MODULES
const env = require('dotenv').config();
const http = require('http');
const express = require('express');
const cookieSession = require('cookie-session');
const expressSession = require('express-session');
const MemoryStore = require('memorystore')(expressSession);
const cookieParser = require('cookie-parser');
const connectFlash = require('connect-flash');
const socketIo = require('socket.io');

//IMPORT GLOBAL MODULES
global.AppRoot = require('app-root-path').require;

//MODULE CONFIGURATION
const app = express();
app.use(express.urlencoded({ extended: false }));

//SESSION CONFIGURATION
app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2'],
  maxAge: 3600 * 1000, // 1hr
}));
app.use(cookieParser('secret'));

//FLASH MESSAGES CONFIGURATION
app.use(expressSession({
  cookie: { secure: process.env.APP_ENV === 'production', maxAge: 3600000 },
  store: new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  }),
  secret: 'secret_passcode',
  resave: false,
  saveUninitialized: false,
}));
app.use(connectFlash());
app.use((req, res, next) => {
  res.locals.flashMessages = req.flash();
  next();
});

//ROUTE DIRECTORY CONFIGURATION
app.use('/', AppRoot('/src/routes/index'));
app.use('/api', AppRoot('/src/routes/api'));

//SOCKET CONFIGURATION
const server = http.createServer(app); //EXISTING HTTP SERVER
const socket = socketIo(server); //ATTACH SOCKETIO TO EXISTING HTTP SERVER
const socketJs = AppRoot('/src/libraries/socket'); //IMPORT SOCKET CLASS
const socketJsObj = new socketJs(socket); //CREATE NEW SOCKET OBJECT WITH SOCKETIO

//VIEW CONFIGURATION
app.set('views', './src/views');
app.set('view engine', 'ejs');

//GLOBAL CATCHER
process.on('uncaughtException',(error) => {
  console.log(`Caught exception: ${error.message}`);
})

//FOR CMD COMMAND
server.listen(process.env.PORT||3000, () => console.log(`Server started at port ${process.env.PORT}`));
