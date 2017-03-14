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
import * as _ from 'lodash';
import {Git} from '../../src/git';
import {PullRequest} from '../../src/github';
import {findOwners} from '../../src/owner';
import * as express from 'express';
const config = require('../../config');
const GITHUB_BOT_USERNAME = config.get('GITHUB_BOT_USERNAME');
const GITHUB_REPO_DIR = config.get('GITHUB_REPO_DIR');
const SECRET_TOKEN = config.get('SECRET_TOKEN');

// Can't import * for crypto, this causes a deprecation warning
const crypto = require('crypto');

export const router = express.Router();

const git = new Git();

const prActionTypes: string[] = [
  'opened',
  'reopened',
  'created',
  'synchronize',
];

function getOwners(pr: PullRequest) : Promise<FileOwners> {
  return git.pullLatestForRepo(GITHUB_REPO_DIR, 'origin', 'master').then(() => {
    const promises = bb.all([
      pr.getFiles(),
      git.getOwnersFilesForBranch(pr.author, GITHUB_REPO_DIR, 'master'),
    ]);
    return promises.then(function(res) {
      const files = res[0];
      const ownersMap = res[1];
      return findOwners(files, ownersMap);
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

router.post('/', index);

export function index(req: Object, res: Object) {
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

  function isReviewAction() {
    return body && body.review && body.pull_request &&
        body.action == 'submitted';
  }

  function isPrAction(body) {
    return body && body.pull_request && prActionTypes.indexOf(body.action) > -1;
  }

  function isRetryCommand(body) {
    return body && body.issue && body.comment && body.action == 'created' &&
        body.comment.body.trim().toLowerCase() ==
            `@${GITHUB_BOT_USERNAME} retry!`;
  }

  const body = req.body;
  if (isPrAction(body) || isReviewAction(body) || isRetryCommand(body)) {
    const pr = new PullRequest(body.pull_request);

    // Exclude the bot name from any reviews. This is basically a no-op.
    if (pr.isBotAuthor()) {
      return ok();
    }

    // Newly created
    if (body.action == 'opened') {
      return getOwners(pr).then(fileOwners => {
        return pr.getUniqueReviews().then(reviews => {
          const approvalsMet = pr.areAllApprovalsMet(fileOwners, reviews);
          if (approvalsMet) {
            return pr.setApprovedStatus().then(ok);
          }
          return pr.postIssuesComment(pr.composeBotComment(fileOwners))
              .then(() => {
                return pr.setFailureStatus().then(ok);
              });
        });
      });
    }

    return tryPostStatusOrComment(res, body, pr).then(ok);
  }
  // No-op
  return ok();
}

function tryPostStatusOrComment(res: *, body: *, pr: PullRequest): Promise<*> {
  return getOwners(pr).then(fileOwners => {
    return pr.getUniqueReviews().then(reviews => {
      const approvalsMet = pr.areAllApprovalsMet(fileOwners, reviews);

      if (approvalsMet) {
        return pr.setApprovedStatus();
      }

      // If all approvals are still not met, do we need to submit a new post?
      return pr.getLastApproversList(GITHUB_BOT_USERNAME).then(reviewers => {

        const allFileOwnersUsernames = Object.keys(fileOwners).sort()
            .map(key => {
              const fileOwner = fileOwners[key];
              const owner = fileOwner.owner;
              return owner.dirOwners;
            });

        // The list of the previous comment is not equal to the list
        // that we currently see generated from the getting all owners.
        if (!_.isEqual(reviewers, allFileOwnersUsernames)) {
          return pr.postIssuesComment(pr.composeBotComment(fileOwners))
              .then(() => {
                return pr.setFailureStatus();
              });
        }
        return pr.setFailureStatus();
      });


    });
  }).catch(() => {
    res.status(500).send('E2: Something went wrong.');
  });
}
