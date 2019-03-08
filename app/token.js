const randtoken = require('rand-token')

exports.valid = (req, res) => {
    if (req.body.token.length == 16) return true
    else return false
}

exports.get = (req, res) => {
    // Generate a 16 character alpha-numeric token:
    var token = randtoken.generate(16);
    res.json({ "token": token })
}
