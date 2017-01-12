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
import {PullRequest, PullRequestComment} from '../../src/github';
import {findOwnersUsernames} from '../../src/owner';
import * as crypto from 'crypto';
import * as express from 'express';
const config = require('../../config');
const GITHUB_REPO_DIR = config.get('GITHUB_REPO_DIR');
const GITHUB_USERNAME = config.get('GITHUB_USERNAME');
const SECRET_TOKEN = config.get('SECRET_TOKEN');

export const router = express.Router();

const prActionTypes: string[] = ['opened', 'created', 'synchronize'];

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
      // Temporarily only turn on for @erwinmombay
      if (pr.author === GITHUB_USERNAME || pr.author !== 'erwinmombay') {
        return res.status(200).send('ok');
      }
      return getOwners(pr).then(usernames => {
        if (usernames.indexOf(`@${pr.author}`) !== -1) {
          return pr.setStatus({
            state: 'success',
            target_url: 'ampproject.org',
            description: 'proper approval.',
            context: 'ampproject/owners-bot',
          }).then(() => {
            res.status(200).send('ok.');
          });
        }
        return pr.getCommentsByAuthor(GITHUB_USERNAME).then(comments => {
          return maybePostReviewerComment(res, pr, usernames, comments);
        });
      }).catch(() => {
        res.status(500).send('E2: Something went wrong.');
      });
    }
  }
});

function maybePostReviewerComment(res: *, pr: PullRequest, usernames: string[],
    comments: PullRequestComment[]): Promise<*>|void {
  // Descending sort. Newest to Oldest comments
  const curReviewersList = `/to ${usernames.join(',')}`;
  const body = `${curReviewersList}`;
  if (comments[0]) {
    const lastPost = comments[0].body.split('\n').filter(x => !!x);
    const lastReviewersList = lastPost.filter(x => /\/to/.test(x))[0];
    // If the bot commented and the last reviewers list it posted
    // is not the same as the current one we need to post a new list
    // of reviewers.
    if (lastReviewersList !== curReviewersList) {
      return pr.postIssuesComment(body).then(() => {
        return pr.setStatus({
          state: 'failure',
          target_url: 'ampproject.org',
          description: 'missing approval.',
          context: 'ampproject/owners-bot',
        }).then(() => {
          res.status(200).send('ok');
        });
      });
    }
    // No need to post a comment as the list of reviewers is the same.
    res.status(200).send('ok. noop.');
    return;
  }

  // This is the first time the bot is posting a list of reviewers.
  return pr.postIssuesComment(body).then(() => {
    return pr.setStatus({
      state: 'failure',
      target_url: 'ampproject.org',
      description: 'missing approval.',
      context: 'ampproject/owners-bot',
    }).then(() => {
      res.status(200).send('ok');
    });
  });
}
