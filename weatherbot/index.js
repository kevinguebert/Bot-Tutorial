var request   = require('request');
var Botkit    = require('botkit');
var os        = require('os');
var _         = require('underscore');
var weather   = require('weather-js');


var LUIS_API_URL    = "<LUIS_API_URL>";
var FB_PAGE_ID      = "<FB_PAGE_ID>";
var FB_PAGE_TOKEN   = process.env.FB_PAGE_TOKEN || "<FB_PAGE_TOKEN>";
var FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || "<FB_VERIFY_TOKEN>";
if (!FB_PAGE_TOKEN) {
    console.log('Error: Specify page_token in environment');
    process.exit(1);
}
if (!FB_VERIFY_TOKEN) {
    console.log('Error: Specify verify_token in environment');
    process.exit(1);
}

var controller = Botkit.facebookbot({
    access_token: FB_PAGE_TOKEN,
    verify_token: FB_VERIFY_TOKEN
});

var bot = controller.spawn({});

controller.setupWebserver(process.env.port || 8445, function(err, webserver) {
    controller.createWebhookEndpoints(webserver, bot, function() {
        console.log('ONLINE!');
    });
});

// reply to any incoming message
controller.on('message_received', function(bot, message) {
    requestLUIS(bot, message);
});

function requestLUIS(bot, message) {
    request(LUIS_API_URL + "&q=" + message.text, function(error, response, body) {
        if(!error && response.statusCode == 200) {
            var data = JSON.parse(body);
            var intent = data.topScoringIntent.intent;
            switch(intent) {
                case "FindWeather":
                    findWeather(bot, message, data);
                    break;
                case "None":
                    bot.reply(message, "Oops, didn't quite understand you :(");
                    break;
            }
        } else {
            console.log("Error in LUIS Request: " + error);
        }
    });
}
function findWeather(bot, message, data) {
    var entities = data.entities; //from our JSON reponse
    var location = _.findWhere(entities, { type: 'builtin.geography.city' });
    if(!location) {
        console.log("No weather type found");
        bot.reply(message, "Uhoh, I didn't quite get that");
    } else {
        var locationIndex = _.indexOf(entities, location);
        var dateTime = _.findWhere(entities, { type: 'builtin.datetime.date' });
        var state = _.findWhere(entities, { type: 'builtin.geography.us_state'});
        if(dateTime) {
            bot.reply(message, "Okay, I'm going to check the weather in " + location.entity + " for " + dateTime);
        } else {
            bot.reply(message, "Okay, I'm going to check the wather in " + location.entity); 
        }
        requestWeather(bot, message, location, dateTime, state);
    }
}

function requestWeather(bot, message, location, dateTime, state) {
    var loc = location.entity;
    if(state) {
        loc = loc + ", " + state.entity;
    }
    weather.find({search: loc, degreeType: 'F'}, function(err, result) {
        if(err) {
            console.log(err);
        } else {
            var currentWeather = result[0].current;

            var temperature = currentWeather.temperature;
            var weatherText = currentWeather.skytext;
            var day         = currentWeather.day;
            var image       = currentWeather.imageUrl;

            var temp = {};
                temp.title = weatherText;
                temp.image_url = image;
                temp.subtitle = day + ": " + temperature;

            var weatherArray = [];
                weatherArray.push(temp);
                console.log(temp);
            var msg = fbMessageTemplate("generic", "elements", null, weatherArray)
            bot.reply(message, msg);
        }
    });
}

function fbMessageTemplate(template, elementType, text, data) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": template,
            }
        }
    };
    if(elementType == "buttons"){
        messageData.attachment.payload.buttons = data;
        messageData.attachment.payload.text = text;
    } else {
        messageData.attachment.payload.elements = data;
    }
    return messageData;
}