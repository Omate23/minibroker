const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/*
    "token":"rdcaqMCNaY5j6Far",
    "symbol":"ES",
    "lots":"1"
*/


var TradeSchema = new Schema({
    "token": { type: String, required: true, max: 16 },
    "symbol": { type: String, required: true },
    "lots": { type: Number, required: true },
    "created": { type:Date, default: Date.now }
});

module.exports = mongoose.model('Trade', TradeSchema);