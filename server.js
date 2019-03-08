const Express = require("express");
const BodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require("mongodb").ObjectID;
const mongoose = require('mongoose');

const settings = require('./app/settings');
const appRoutes = require('./routes/app');

const DATABASE_NAME = "broker";
const CONNECTION_URL = "mongodb+srv://omate:mudha@cluster0-a3mvw.azure.mongodb.net/"+DATABASE_NAME+"?retryWrites=true";

var database, collection;

var app = Express();

app.use(BodyParser.json());
app.use(BodyParser.urlencoded({ extended: true }));

app.use('/', appRoutes);


// catch 404 and forward to error handler
app.use(function (req, res, next) {
    return res.status('404');
});

var listener = app.listen(8880, () => {
    mongoose.connect(CONNECTION_URL, {useNewUrlParser: true});
    mongoose.Promise = global.Promise;
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'Connection error:'));
    db.once('open', function() {
        console.log("Connected to `" + DATABASE_NAME + "`!");
    });

    /*MongoClient.connect(CONNECTION_URL, { useNewUrlParser: true }, (error, client) => {
        if (error) { throw error; }
        database = client.db(DATABASE_NAME);
        collection = database.collection("trade");
        console.log("Connected to `" + DATABASE_NAME + "`!");
    });*/

    console.log('Listening on port ' + listener.address().port);
});

var request = require('request');
var tradovate = require('./tradovate1');

tradovate.Events.on('connected', () => {
    console.log('Tradovate connected');
    tradovate.Subscribe('quote', 'NQH9');
})

tradovate.Events.on('pricechange', function (data) {
    //console.log(data);
    Bid = data.entries.Bid.price
    Offer = data.entries.Offer.price
    console.log('b/o', Bid, Offer);
})

module.exports = app;