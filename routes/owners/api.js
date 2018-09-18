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

const bb = require('bluebird');
const _ = require('lodash');
const {Git} = require('../../src/git');
const {PullRequest} = require('../../src/github');
const {findOwners} = require('../../src/owner');
const express = require('express');
const config = require('../../config');
const GITHUB_REPO_DIR = config.get('GITHUB_REPO_DIR');
const SECRET_TOKEN = config.get('SECRET_TOKEN');

// Can't import * for crypto, this causes a deprecation warning
const crypto = require('crypto');

export const router = express.Router();

const git = new Git();

const prActionTypes = [
  'opened',
  'reopened',
  'created',
  'synchronize',
];

function getOwners(pr) {
  return git.pullLatestForRepo(GITHUB_REPO_DIR, 'origin', 'master').then(() => {
    const promises = bb.all([
      pr.getFiles(),
      git.getOwnersFilesForBranch(pr.author, GITHUB_REPO_DIR, 'master'),
    ]);
    return promises.then(function(res) {
      const files = res[0];
      const ownersMap = res[1];
      const owners = findOwners(files, ownersMap);
      let usernames = Object.keys(owners).map(dirPath => {
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
    const hash = 'sha1=' + crypto.createHmac('sha1', SECRET_TOKEN)
        .update(body).digest('hex');
    return crypto.timingSafeEqual(new Buffer(hash), new Buffer(signature));
  } catch (e) {
    return false;
  }
}

router.post('/', index);

export function index(req, res) {
  const signature = req.get('X-Hub-Signature') || '';
  // FIX: since we need to convert back to a string, maybe disable
  // the json body parser and parse it ourselves.
  if (process.env.NODE_ENV === 'production' &&
      (!signature || !verifySignature(JSON.stringify(req.body), signature))) {
    return res.status(500).send('Signature didn\'t match!');
  }

  function ok() {
    return res.status(200).send('ok');
  }

  function isPrAction(body) {
    return body && body.pull_request && prActionTypes.indexOf(body.action) > -1;
  }

  const body = req.body;
  let promise = Promise.resolve();
  if (isPrAction(body)) {
    const pr = new PullRequest(body.pull_request);
    promise = getOwners(pr);
  }

  return promise.then(ok).catch(() => {
    res.status(500).send('Something went wrong!');
  });
}
