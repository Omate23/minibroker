#!/usr/bin/env node

var WebSocketClient = require('websocket').client;
var api = new WebSocketClient()
var market = new WebSocketClient()

var request = require('request');
var fs = require('fs');

const EventEmitter = require('events').EventEmitter;
const TradovateEvents = new EventEmitter;
exports.Events = TradovateEvents;

var settings = JSON.parse(fs.readFileSync('./data/settings.json', 'utf8'));
//settings.symbol = "NQU8";
//console.log(settings);

var alreadySubscribed = [];
var token
var apiConnection, marketConnection
var reqs = []
var authenticationAPI = false, authenticationMarket = false;  // auth in progress
var mid = 0; // serial message id for Tradovate API
var debug = false


request.post({
        url: 'https://demo-api-d.tradovate.com/v1/auth/accesstokenrequest',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ name: settings.login, password: settings.password })
    },
    function (error, response, body) {
        if (debug && body) console.log(body)
        if (!error && response.statusCode == 200) {
            token = JSON.parse(body)
            authenticationAPI = true
            api.connect('wss://demo-api-d.tradovate.com/v1/websocket');
        }
    }
);

api.on('connectFailed', function(error) {
    console.log('Connect API Error: ' + error.toString());
});
market.on('connectFailed', function(error) {
    console.log('Connect Market Error: ' + error.toString());
});

api.on('connect', function(connection) {
    apiConnection = connection
    console.log('WebSocket API Client Connected');
    connection.on('error', function(error) {
        console.log("API Connection Error: " + error.toString());
    });
    connection.on('close', function(message) {
        //console.log(': '+message);
        console.log('API Connection Closed');
    });
    connection.on('message', function(message) {
        //console.log(message);
        if (message.type === 'utf8') {
            //console.log("API Received: '" + message.utf8Data + "'")
            if (message.utf8Data.substr(0,1) == 'a')    {
                var got = JSON.parse(message.utf8Data.substr(1))    // chop beginning 'a'
                if (authenticationAPI) {
                    if (got[0].i == 1 && got[0].s == 200) {
                        console.log('API Connection Authorized');
                        authenticationAPI = false
                        Post(connection, 'user/syncrequest', { "users": settings.user });
                        authenticationMarket = true
                        market.connect('wss://md-api-d.tradovate.com/v1/websocket');
                        return true
                    } else {
                        console.log('Connection Authorization Error');
                        return false
                    }
                } else if (got[0].s == 200) {
                    Got(got)
                    return true
                } else if (got[0].e == 'props') {     // Event
                    GotEvent(got)
                    return true
                } else {
                    console.log('Not OK!');
                    console.log("Received: '" + message.utf8Data + "'")
                    return false
                }
            }
            else if (message.utf8Data == 'h') Heartbeat(connection)
            else if (message.utf8Data == 'o') Authorize(connection)
            else if (message.utf8Data == 'c') Closed()
            else if (debug) console.log('Unknown frame: ' + message.utf8Data);
        } else {
            console.log('Something non-UTF-8...: ' + message);
        }
    });
});

market.on('connect', function(connection) {
    marketConnection = connection
    console.log('WebSocket Market Client Connected');
    connection.on('error', function(error) {
        console.log("Market Connection Error: " + error.toString());
    });
    connection.on('close', function() {
        console.log('Market Connection Closed');
    });
    connection.on('message', function(message) {
        //console.log(message);
        if (message.type === 'utf8') {
            //console.log("Market Received: '" + message.utf8Data + "'")
            if (message.utf8Data.substr(0,1) == 'a')    {
                var got = JSON.parse(message.utf8Data.substr(1))    // chop beginning 'a'
                if (authenticationMarket) {
                    if (got[0].i == 3 && got[0].s == 200) {
                        console.log('Market Connection Authorized');
                        authenticationMarket = false
                        TradovateEvents.emit('connected')
                        return true
                    } else {
                        console.log('Connection Authorization Error');
                        return false
                    }
                } else if (got[0].s == 200) {
                    Got(got)
                    return true
                } else if (got[0].e == 'md') {     // Market data
                    GotMD(got)
                    return true
                } else if (got[0].e == 'chart') {     // Market data
                    GotChart(got)
                    return true
                } else {
                    console.log('Not OK MD!');
                    console.log("Received: '" + message.utf8Data + "'")
                    return false
                }
            }
            else if (message.utf8Data == 'h') Heartbeat(connection)
            else if (message.utf8Data == 'o') Authorize(connection)
            else if (message.utf8Data == 'c') Closed()
            else { if (debug) console.log('Unknown frame: ' + message.utf8Data);  }
        }
        else { console.log('Something non-UTF-8...: ' + message); }
    });
});

exports.Subscribe = (type, symbol) => {
    if (alreadySubscribed[type+symbol]) return
    alreadySubscribed[type+symbol] = 1
    console.log('Subscribing ' + type + ' for ' + symbol);

    if (type == 'quote') Get(marketConnection, 'md/subscribeQuote', { "symbol": symbol })
    if (type == 'DOM') Get(marketConnection, 'md/subscribeDOM', { "symbol": symbol })
    if (type == 'histogram') Get(marketConnection, 'md/subscribeHistogram', { "symbol": symbol })
    if (type == 'chart') Get(marketConnection, 'md/getChart', {
        "symbol": symbol,
        "chartDescription": {
            "underlyingType":"MinuteBar", // Available values: Tick, DailyBar, MinuteBar, Custom, DOM
            "elementSize":15,
            "elementSizeUnit":"UnderlyingUnits", // Available values: Volume, Range, UnderlyingUnits, Renko, MomentumRange, PointAndFigure, OFARange
            "withHistogram": false
        },
        "timeRange": {
            // All fields in "timeRange" are optional, but at least anyone is required
            //"closestTimestamp":"2018-08-10T10:00Z",
            //"closestTickId":123,
            //"asFarAsTimestamp":"2018-08-15T18:00Z",
            "asMuchAsElements":50
        },
    })
}

function GotMD(got)   {
    if (debug) console.log(got[0].d);
    got.forEach(function (e,k) {
        if (e.d.doms)   {
            TradovateEvents.emit('domchange', e.d.doms)
        }
        else if (e.d.quotes)   {
            TradovateEvents.emit('pricechange', e.d.quotes[0])
        }
        else if (e.d.histograms)   {
            TradovateEvents.emit('histogramchange', e.d.histograms[0])
        }
    })
}

function GotChart(got)   {
    if (debug) console.log(got[0].d);
    return;
    got.forEach(function (e,k) {
        if (e.d.doms)   {
            TradovateEvents.emit('domchange', e.d.doms)
        }
        else if (e.d.quotes)   {
            TradovateEvents.emit('pricechange', e.d.quotes[0])
        }
        else if (e.d.histograms)   {
            TradovateEvents.emit('histogramchange', e.d.histograms[0])
        }
    })
}

function GotEvent(got)   {
    //console.log(got[0].d)
    if (debug) console.log(got[0].d);
    got.forEach(function (e,k) {
        if (e.d.entityType == 'fill' && e.d.eventType == 'Created')   {
            TradovateEvents.emit('fill', e.d.entity)
        }
        else if (e.d.entityType == 'position' && e.d.eventType == 'Updated')   {
            //console.log('=' + e.d.entity.netPos);
            TradovateEvents.emit('positionchange', e.d.entity)
        }
        else if (e.d.entityType == 'command' && e.d.eventType == 'Created' && e.d.entity.commandStatus == 'RiskRejected')   {
            console.log('RiskRejected');
            TradovateEvents.emit('riskrejected', e.d.entity)
        }
    })
}


function Got(got)   {
    //console.log(got)
    if (debug) console.log(got);
    var r = reqs[got[0].i]
    if (debug) console.log(r);
    if (r.url == 'order/placeorder')   {
        if (!got[0].d.orderId) console.log(got[0].d);
        else TradovateEvents.emit('order', got[0].d)
    }
    else if (r.url == 'user/syncrequest')   {
        synced = got[0].d
        console.log('User Synced');
        //Object.keys(got[0].d).forEach(function (v,k) { console.log(v); })
        //Write('synced', synced)
    }
}

function Get(conn, url, queryarr, store)  {
    if (conn.connected) {
        ++mid
        //var query = (queryarr.length) ? ArrayToQueryString(queryarr) : ''
        var query = ObjectToQueryString(queryarr)
        var frame = [url, mid, query, ''].join("\n")
        conn.sendUTF(frame);
        reqs[mid] = []
        reqs[mid].url = url
        reqs[mid].query = queryarr
        reqs[mid].store = store
        if (debug) console.log(frame);
    } //else setTimeout(Msg(url, url, query, body), 50);
}

function Post(conn, url, bodyarr, store)  {
    if (conn.connected) {
        ++mid
        var body = JSON.stringify(bodyarr)
        var frame = [url, mid, '', body].join("\n")
        conn.sendUTF(frame);
        reqs[mid] = []
        reqs[mid].url = url
        reqs[mid].query = bodyarr
        reqs[mid].store = store
        //if (url.match('place') ||debug) console.log(frame);
    } //else setTimeout(Msg(url, url, query, body), 50);
}

function Authorize(conn)    {
    if (conn.connected) {
        ++mid
        var frame = ['authorize', mid, '', token.accessToken].join("\n")
        conn.sendUTF(frame);
        if (debug) console.log(frame);
    } //else
}

function Heartbeat(conn)    {
    //console.log('[]');
    conn.sendUTF('[]');
}

exports.Place = function(trade)   {
    if (trade.action === 1) trade.action = 'Buy';
    else if (trade.action === 2) trade.action = 'Sell';

    var expt = new Date();
    //expt.setSeconds(expt.getSeconds() + 60*60);
    expt.setSeconds(expt.getSeconds() + 15);

    var data = {
        "orderType": "Market",
        "timeInForce": "GTD",
        "expireTime": expt.toISOString(),
    }
    //console.log(Object.assign(trade, data));
    Post(apiConnection, 'order/placeorder', Object.assign(trade, data))
}

function ObjectToQueryString(o) {
    if (!o) return null;
    var qs = Object.keys(o).map(function(k) {
        return k + '=' + o[k]
    }).join('&');
    return qs
}
