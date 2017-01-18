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

const path = require('path');
const nconf = module.exports = require('nconf');

nconf
  // 1. Command-line arguments
  .argv()
  // 2. Environment variables
  .env([
    'CLOUD_BUCKET',
    'DATA_BACKEND',
    'GCLOUD_PROJECT',
    'NODE_ENV',
    'OAUTH2_CLIENT_ID',
    'OAUTH2_CLIENT_SECRET',
    'OAUTH2_CALLBACK',
    'PORT',
    'SECRET',
    'GITHUB_ACCESS_TOKEN',
    'GITHUB_REPO_DIR',
    'GITHUB_BOT_USERNAME',
  ])
  // 3. Config file
  .file({file: path.join(__dirname, 'config.json')})
  // 4. Defaults
  .defaults({
    // Typically you will create a bucket with the same name as your project ID.
    CLOUD_BUCKET: process.env.CLOUD_BUCKET || 'default',

    // dataBackend can be 'datastore', 'cloudsql', or 'mongodb'. Be sure to
    // configure the appropriate settings for each storage engine below.
    // If you are unsure, use datastore as it requires no additional
    // configuration.
    DATA_BACKEND: 'datastore',

    // This is the id of your project in the Google Cloud Developers Console.
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || 'default',

    OAUTH2_CLIENT_ID: process.env.OAUTH2_CLIENT_ID || 'default',
    OAUTH2_CLIENT_SECRET: process.env.OAUTH2_CLIENT_SECRET || 'default',
    OAUTH2_CALLBACK: 'http://localhost:8080/auth/google/callback',

    // Port the HTTP server
    PORT: 8080,

    SECRET: 'keyboardcat',
    SECRET_TOKEN: process.env.SECRET_TOKEN,

    GITHUB_ACCESS_TOKEN: process.env.GITHUB_ACCESS_TOKEN || 'default',
    GITHUB_REPO_DIR: process.env.GITHUB_REPO_DIR || 'default',
    GITHUB_BOT_USERNAME: process.env.GITHUB_BOT_USERNAME || 'default',
  });

// Check for required settings
checkConfig('GCLOUD_PROJECT');
checkConfig('CLOUD_BUCKET');
checkConfig('OAUTH2_CLIENT_ID');
checkConfig('OAUTH2_CLIENT_SECRET');
checkConfig('GITHUB_ACCESS_TOKEN');
checkConfig('GITHUB_REPO_DIR');
checkConfig('GITHUB_USERNAME');


function checkConfig(setting) {
  if (!nconf.get(setting)) {
    throw new Error('You must set the ' + setting + ' environment variable or' +
      ' add it to config.json!');
  }
}
