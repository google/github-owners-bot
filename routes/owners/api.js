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

import * as bb from 'bluebird';
import * as git from '../../src/git';
import {PullRequest, Label, Sender} from '../../src/github';
import {findOwnersUsernames} from '../../src/owner';
import * as crypto from 'crypto';
import * as express from 'express';
const config = require('../../config');
const GITHUB_REPO_DIR = config.get('GITHUB_REPO_DIR');
const GITHUB_USERNAME = config.get('GITHUB_USERNAME');
const SECRET_TOKEN = config.get('SECRET_TOKEN');

export const router = express.Router();

const prActionTypes: string[] = [
  'opened',
  'reopened',
  'created',
  'synchronize',
  'labeled',
  'unlabeled',
];

function getOwners(pr: PullRequest) : Promise<string[]> {
  return git.pullLatestForRepo(GITHUB_REPO_DIR, 'origin', 'master').then(() => {
    const promises = bb.all([
      pr.getFiles(),
      git.getOwnersFilesForBranch(pr.author, GITHUB_REPO_DIR, 'master'),
    ]);
    return promises.then(function(res) {
      const files = res[0];
      const ownersMap = res[1];
      return findOwnersUsernames(files, ownersMap);
    });
  });
}

function verifySignature(body: string, signature: string): bool {
  try {
    const hash = 'sha1=' + crypto.createHmac('sha1', SECRET_TOKEN)
        .update(body).digest('hex');
    return crypto.timingSafeEqual(new Buffer(hash), new Buffer(signature));
  } catch (e) {
    return false;
  }
}

router.post('/', function(req, res) {
  const signature = req.get('X-Hub-Signature') || '';
  // FIX: since we need to convert back to a string, maybe disable
  // the json body parser and parse it ourselves.
  if (process.env.NODE_ENV === 'production' &&
      (!signature || !verifySignature(JSON.stringify(req.body), signature))) {
    return res.status(500).send('Signature didn\'t match!');
  }

  const body = req.body;
  if (body && body.pull_request) {
    if (prActionTypes.indexOf(body.action) !== -1) {
      const pr = new PullRequest(body.pull_request);
      // Exclude the bot name from any reviews.
      // Temporarily only turn on for @erwinmombay and @dvoytenko
      const authorWhitelist = ['erwinmombay'];
      if (pr.author === GITHUB_USERNAME ||
            authorWhitelist.indexOf(pr.author) === -1) {
        return res.status(200).send('ok');
      }
      return tryPostStatus(res, body, pr).then(() => {
        return res.status(200).send('ok');
      });
    }
  }
  return res.status(200).send('ok');
});

function tryPostStatus(res: *, body: *, pr: PullRequest): Promise<*> {
  return getOwners(pr).then(usernames => {
    if (body.action === 'labeled') {
      const label = new Label(body.label);
      const sender = new Sender(body.sender);
      if (label.name.toLowerCase() === 'approved' &&
          usernames.indexOf(`@${sender.username}`) > -1) {
        return pr.setApprovedStatus();
      }
    } else if (body.action === 'unlabeled') {
      const label = new Label(body.label);
      // If anybody removed the approved label, automatically fail the PR again
      // this is so that we don't get into a weird state were somebody removed
      // the approved label but are still green. I'd rather fail it again.
      if (label.name.toLowerCase() === 'approved') {
        return pr.setFailureStatus();
      }
    } else if (usernames.indexOf(`@${pr.author}`) > -1) {
      return pr.setApprovedStatus();
    }
    return maybePostApproversComment(res, pr, usernames);
  }).catch(() => {
    res.status(500).send('E2: Something went wrong.');
  });
}

function maybePostApproversComment(res: *, pr: PullRequest,
    usernames: string[]): Promise<*>|void {
  // Descending sort. Newest to Oldest comments
  const curApproversList = `/to ${usernames.join(',')}`;
  const body = `Here is a list of approvers\n${curApproversList}`;
  return pr.findLastApproversList().then(approvers => {
    if (approvers.length) {
      // If the bot commented and the last approvers list it posted
      // is not the same as the current one we need to post a new list
      // of approvers.
      if (usernames.length === approvers.length &&
          usernames.every((v, i) => v === approvers[i])) {
        return pr.postIssuesComment(body).then(() => {
          return pr.setFailureStatus();
        });
      }
      // This means the lastApproversList is the same and we don't need to
      // do anything.
      return;
    }
    // This is the first time the bot is posting a list of approvers.
    return pr.postIssuesComment(body).then(() => {
      return pr.setFailureStatus();
    });
  });
}
