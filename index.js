const express = require('express');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const request = require('request');
const slugify = require('slugify');
require('dotenv').config();

const {
  SS_ACCESS_TOKEN, MONGODB_URI,
} = process.env;
const app = express();
const genericError = new Error('Sorry I couldn\'t find that.');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Sort StackShare API function results by popularity
function sortByPopularity(toolTypes) {
  const sortedToolTypes = toolTypes.sort((a, b) => (
    b.popularity - a.popularity
  ));

  return sortedToolTypes;
}

// Find the StackShare "function" id for the given tooltype string
function findToolTypeId(toolType) {
  const toolTypeSlug = slugify(toolType);

  return new Promise((resolve, reject) => {
    mongodb.MongoClient.connect(MONGODB_URI, (err, client) => {
      if (!err) {
        const db = client.db('heroku_lzls7pcp');
        db.collection('functions').findOne(
          { slug: toolTypeSlug },
          (error, doc) => {
            if (!error) {
              if (doc !== null) {
                console.log('Found tool type.');
                console.log(doc);
                resolve(doc.id);
              }
              reject(genericError);
            } else {
              console.error(error);
              reject(genericError);
            }
          },
        );
      } else {
        console.error(err);
        reject(genericError);
      }
    });
  });
}

// Hit the StackShare API to look up tools for a given type
function lookupToolType(toolType) {
  return new Promise((resolve, reject) => {
    findToolTypeId(toolType)
      .then((toolTypeId) => {
        request.get(
          `https://api.stackshare.io/v1/tools/lookup?function_id=${toolTypeId}&access_token=${SS_ACCESS_TOKEN}`,
          (err, res, body) => {
            if (!err && res.statusCode === 200) {
              // Only sorting first page. If there are many results, we are not
              // returning the proper result.
              console.log('Got functions from StackShare API.');
              const json = JSON.parse(body);
              const sorted = sortByPopularity(json);
              // just return the top result
              resolve(sorted[0]);
            } else {
              console.error(err);
              reject(genericError);
            }
          },
        );
      })
      .catch((error) => {
        reject(error);
      });
  });
}

// Transform StackShare API response into a human readable message
function formatToolTypeMsg(data) {
  return `The most popular ${data.function.name} tool on StackShare is ${data.name}.\n
          ${data.company_stack_count} companies are using it in their stack.\n
          Here's what people are saying about it: "${data.reasons[0].one_liner}"`;
}

// Fulfillment webhook for Dialogflow
app.post('/dialogflow', (req, res) => {
  console.log('Got request from DialogFlow');
  console.log(req.body.result);
  if (req.body.result.action === 'find-tool') {
    const toolType = req.body.result.parameters['tool-type'];
    // call StackShare API
    return lookupToolType(toolType)
      .then((toolResult) => {
        console.log('Tool result');
        console.log(toolResult);
        const message = formatToolTypeMsg(toolResult);
        // send the result back to Dialogflow
        return res.json({
          speech: message,
          displayText: message,
        });
      })
      .catch((error) => {
        console.error(error);
        // send the error back to Dialogflow
        return res.json({
          speech: error.message,
          displayText: error.message,
        });
      });
  }
  // not sure why this is being called for anything other than find-tool action
  console.log('Request for action other than find-tool');
  console.log(req.body.result);
  return res.json({
    speech: req.body.result.fulfillment.speech,
    displayText: req.body.result.fulfillment.speech,
  });
});

const server = app.listen(process.env.PORT || 5000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});
