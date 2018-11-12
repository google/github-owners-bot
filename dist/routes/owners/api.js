"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.index = index;
exports.router = void 0;

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
var bb = require('bluebird');

var _ = require('lodash');

var _require = require('../../src/git'),
    Git = _require.Git;

var _require2 = require('../../src/github'),
    PullRequest = _require2.PullRequest;

var _require3 = require('../../src/owner'),
    findOwners = _require3.findOwners;

var express = require('express');

var config = require('../../config');

var GITHUB_REPO_DIR = config.get('GITHUB_REPO_DIR');
var SECRET_TOKEN = config.get('SECRET_TOKEN'); // Can't import * for crypto, this causes a deprecation warning

var crypto = require('crypto');

var router = express.Router();
exports.router = router;
var git = new Git();
var prActionTypes = ['opened', 'reopened', 'created', 'synchronize'];

function getOwners(pr) {
  return git.pullLatestForRepo(GITHUB_REPO_DIR, 'origin', 'master').then(function () {
    var promises = bb.all([pr.getFiles(), git.getOwnersFilesForBranch(pr.author, GITHUB_REPO_DIR, 'master')]);
    return promises.then(function (res) {
      var files = res[0];
      var ownersMap = res[1];
      var owners = findOwners(files, ownersMap);
      var usernames = Object.keys(owners).map(function (dirPath) {
        return owners[dirPath].owner.dirOwners;
      });
      usernames = _.uniq(_.flatten(usernames));
      console.log(usernames);
      return usernames;
    });
  });
}

function verifySignature(body, signature) {
  try {
    var hash = 'sha1=' + crypto.createHmac('sha1', SECRET_TOKEN).update(body).digest('hex');
    return crypto.timingSafeEqual(new Buffer(hash), new Buffer(signature));
  } catch (e) {
    return false;
  }
}

router.post('/', index);

function index(req, res) {
  var signature = req.get('X-Hub-Signature') || ''; // FIX: since we need to convert back to a string, maybe disable
  // the json body parser and parse it ourselves.

  if (process.env.NODE_ENV === 'production' && (!signature || !verifySignature(JSON.stringify(req.body), signature))) {
    return res.status(500).send('Signature didn\'t match!');
  }

  function ok() {
    return res.status(200).send('ok');
  }

  function isPrAction(body) {
    return body && body.pull_request && prActionTypes.indexOf(body.action) > -1;
  }

  var body = req.body;
  var promise = Promise.resolve();

  if (isPrAction(body)) {
    var pr = new PullRequest(body.pull_request);
    promise = getOwners(pr);
  }

  return promise.then(ok).catch(function () {
    res.status(500).send('Something went wrong!');
  });
}