const Trade = require('../app/model/trade');

exports.trade = (req, res) => {
    console.log(req.body);
    delete req.body.direction
    console.log(req.body);

    //var Trade = mongoose.model('Trade', TradeSchema);


    var t = new Trade(req.body)
    t.save(function (err) {
        if (err) res.status(403).json({ status: "Err", error: err })
        else res.status(200).json({ status: "OK" })
    });
}