var express = require('express');
var router = express.Router();
var token = require('../app/token');

/*router.use(function (req, res, next) {
    delete req.session.CurrentPage
    req.app.locals.approot = ''
    req.app.locals.staticroot = ''
    req.app.locals.session = req.session
    next()
});*/

router.post('/send', function (req, res, next) {
    if (!token.valid(req, res)) return
    var send = require('../app/send');
    send.trade(req, res);
});

router.get('/gettoken', function (req, res, next) {
    var token = require('../app/token');
    token.get(req, res);
});


module.exports = router;
