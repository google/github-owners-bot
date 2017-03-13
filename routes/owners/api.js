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
import * as git from '../../src/git';
import {PullRequest, Review} from '../../src/github';
import {findOwners} from '../../src/owner';
import * as crypto from 'crypto';
import * as express from 'express';
const config = require('../../config');
const GITHUB_BOT_USERNAME = config.get('GITHUB_BOT_USERNAME');
const GITHUB_REPO_DIR = config.get('GITHUB_REPO_DIR');
const SECRET_TOKEN = config.get('SECRET_TOKEN');

export const router = express.Router();

const prActionTypes: string[] = [
  'opened',
  //'reopened',
  //'created',
  //'synchronize',
  //'labeled',
  //'unlabeled',
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

router.post('/', function(req, res) {
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

  const body = req.body;
  if (isPrAction(body) && isReviewAction(body)) {
    const pr = new PullRequest(body.pull_request);

    // Exclude the bot name from any reviews. This is basically a no-op.
    if (pr.isBotAuthor()) {
      return ok();
    }

    // Newly created
    if (pr.action == 'opened') {
      return getOwners(pr).then(fileOwners => {
        return pr.postIssuesComment(pr.composeBotComment(fileOwners));
      });
    }

    let review = null;
    if (isReviewAction(body)) {
      review = new Review(body.review);
      // If the event was a review action and it was not an "approve"
      // fail the state of the PR right away.
      if (!review.isApproved()) {
        return pr.setFailureStatus().then(ok);
      }
    }

    return ok();
    //return tryPostStatusOrComment(res, body, pr).then(ok);
  }
  // No-op
  return ok();
});

function tryPostStatusOrComment(res: *, body: *, pr: PullRequest): Promise<*> {
  function ok() {
    return res.status(200).send('ok');
  }
  return getOwners(pr).then(fileOwners => {
    return pr.getUniqueReviews().then(reviews => {
      const approvalsMet = pr.areAllApprovalsMet(fileOwners, reviews);

      // We need to guarantee that the list of reviewers didn't change due to
      // additional files modified, added etc.
      return pr.getLastApproversList(GITHUB_BOT_USERNAME).then(reviewers => {
        // If there was no reviewers list found (no bot comment for whatever
        // reason) but approvals met.
        if (!reviewers.length && approvalsMet) {
          return pr.setApprovedStatus().then(ok);
        }

        if (approvalsMet) {
          return pr.setApprovedStatus();
        }
      });


    });
  }).catch(() => {
    res.status(500).send('E2: Something went wrong.');
  });
}
