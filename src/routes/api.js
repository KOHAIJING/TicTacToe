//IMPORT MODULES
const router = require('express').Router();

//IMPORT CONTROLLERS
const authController = AppRoot('/src/controllers/auth');

router.post('/login', (req, res, next) => authController.loginUser(req, res, next));
router.post('/register', (req, res, next) => authController.registerUser(req, res, next));
router.get('/logout', (req, res, next) => authController.logoutUser(req, res, next));

module.exports = router;
