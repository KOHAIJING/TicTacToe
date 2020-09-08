//IMPORT MODULES
const router = require('express').Router();

// Import MIDDLEWARES
//const middleware = AppRoot('/src/middlewares/index');
//If write like above, it used as middleware.ifLoggedin, middleware.ifNotLoggedin
const { ifLoggedin, ifNotLoggedin } = AppRoot('/src/middlewares/index');

//IMPORT CONTROLLERS
const authController = AppRoot('/src/controllers/auth');
const homeController = AppRoot('/src/controllers/home');

//BEFORE LOGIN
router.get('/', (req, res) => res.redirect('/login'));
router.get('/login', ifLoggedin, (req, res, next) => authController.login(req, res, next));
router.get('/register', ifLoggedin, (req, res, next) => authController.register(req, res, next));

//AFTER LOGIN
router.use(ifNotLoggedin);
router.get('/menu', (req, res, next) => homeController.menu(req, res, next));
router.get('/gameWithPlayer', (req, res, next) => homeController.gameWithPlayer(req, res, next));
router.get('/gameWithAI', (req, res, next) => homeController.gameWithAI(req, res, next));
router.get('/scoreboard', (req, res, next) => homeController.scoreboard(req, res, next));

module.exports = router;
