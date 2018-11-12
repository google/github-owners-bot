"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.app = void 0;

var path = _interopRequireWildcard(require("path"));

var bodyParser = _interopRequireWildcard(require("body-parser"));

var _logging = _interopRequireDefault(require("./src/logging"));

var _api = require("./routes/owners/api");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

/**
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* @flow */
var config = require('./config');

var express = require('express');

var session = require('express-session'); // Activate Google Cloud Trace and Debug when in production


if (process.env.NODE_ENV === 'production') {
  require('@google/cloud-trace').start();

  require('@google/cloud-debug');
}

var app = express();
exports.app = app;
app.disable('etag');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('trust proxy', true); // Add the request logger before anything else so that it can
// accurately log requests.

app.use(_logging.default.requestLogger);
app.use(bodyParser.json()); // Configure the session and session storage.

var sessionConfig = {
  resave: false,
  saveUninitialized: false,
  secret: config.get('SECRET'),
  signed: true
};
app.use(session(sessionConfig));
app.get('/', function (req, res) {
  res.render('index.jade');
});
app.use('/api/get-owners', _api.router); // Our application will need to respond to health checks when running on
// Compute Engine with Managed Instance Groups.

app.get('/_ah/health', function (req, res) {
  res.status(200).send('ok');
}); // Add the error logger after all middleware and routes so that
// it can log errors from the whole application. Any custom error
// handlers should go after this.

app.use(_logging.default.errorLogger); // Basic 404 handler

app.use(function (req, res) {
  res.status(404).send('Not Found');
}); // Basic error handler

app.use(function (err, req, res) {
  // If our routes specified a specific response, then send that. Otherwise,
  // send a generic message so as not to leak anything.
  res.status(500).send(err.response || 'Something broke!');
});

if (module === require.main) {
  // Start the server
  var server = app.listen(config.get('PORT'), function () {
    var port = server.address().port;
    console.log('App listening on port %s', port);
  });
}