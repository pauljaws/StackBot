const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const apiai = require('apiai');
require('dotenv').config();

const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || '';
const PAGE_TOKEN = process.env.FB_PAGE_TOKEN || '';
const DF_ACCESS_TOKEN = process.env.DF_ACCESS_TOKEN || '';
const apiaiApp = apiai(DF_ACCESS_TOKEN);
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Sends response messages via the Send API to FB Messenger
function sendToMessenger(senderPsid, response) {
  // Construct the message body
  const reqBody = {
    recipient: {
      id: senderPsid,
    },
    message: {
      text: response,
    },
  };

  // Send the HTTP request to the Messenger Platform
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_TOKEN },
    method: 'POST',
    json: reqBody,
  }, (err) => {
    if (!err) {
      console.log('Message sent!');
      console.log(reqBody);
    } else {
      console.error(`Unable to send message: ${err}`);
    }
  });
}

// Handles messages events
function handleMessage(senderPsid, receivedMessage) {
  // Check if the message contains text
  if (receivedMessage.text) {
    // Send to Dialogflow for handling
    apiaiApp.textRequest(receivedMessage.text, { sessionId: senderPsid })
      .on('response', (response) => {
        console.log('Response received from DialogFlow');
        console.log(response);
        sendToMessenger(senderPsid, response.result.fulfillment.speech);
      })
      .on('error', (error) => {
        console.error(error);
      })
      .end();
  } else if (receivedMessage.attachments) {
    const response = {
      text: 'Sorry, I\'m not smart enough to respond to attachments yet.',
    };
    // Sends the response message
    sendToMessenger(senderPsid, response);
  }
}

// Hit the StackShare API to look up tools for a given type
function findTool(toolType) {
  return new Promise((resolve, reject) => {
    if (toolType === 'message queue') {
      resolve({ name: 'RabbitMQ' });
    } else {
      reject(new Error('I couldn\'t find that tool, sorry.'));
    }
  });
}

// Handles messaging_postbacks events
// function handlePostback(senderPsid, receivedPostback) {
//
// }

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {
  // Parse the query params
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Receive messages from FB Messenger
app.post('/webhook', (req, res) => {
  const { body } = req;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {
    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach((entry) => {
      // Gets the message. entry.messaging is an array, but
      // will only ever contain one message, so we get index 0
      const webhookEvent = entry.messaging[0];
      console.log(webhookEvent);
      // Get the sender PSID
      const senderPsid = webhookEvent.sender.id;
      console.log(`Sender PSID: ${senderPsid}`);
      // Check event type and pass to appropriate handler
      if (webhookEvent.message) {
        handleMessage(senderPsid, webhookEvent.message);
      }
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Fulfillment webhook for Dialogflow
app.post('/dialogflow', (req, res) => {
  if (req.body.result.action === 'find-tool') {
    const toolType = req.body.result.parameters['tool-type'];
    // call StackShare API
    findTool(toolType)
      .then((toolResult) => {
        console.log(toolResult);
        const message = `The most popular ${toolType} on StackShare is ${toolResult}`;
        // send the result back to Dialogflow
        return res.json({
          speech: message,
          displayText: message,
        });
      }, (error) => {
        console.error(error);
        // send the error back to Dialogflow
        return res.json({
          speech: error.message,
          displayText: error.message,
        });
      });
  }
});

const server = app.listen(process.env.PORT || 5000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});
