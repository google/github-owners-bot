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

const _ = require('lodash');
const logging = require('../../src/logging').default;
const {Git} = require('../../src/git');
const {Owner} = require('../../src/owner');
const {PullRequest} = require('../../src/github');
const express = require('express');
const config = require('../../config');
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

  // If its anything else besides "development" make sure to verify the
  // signature.
  if (process.env.NODE_ENV !== 'development') {
    if (!signature || !verifySignature(JSON.stringify(req.body), signature)) {
      return res.status(500).send('Signature didn\'t match!');
    }
  }

  function ok() {
    return res.status(200).send('ok');
  }

  function isPrAction(body) {
    return body && body.pull_request && prActionTypes.indexOf(body.action) > -1;
  }

  function isReviewAction(body) {
    return body && body.review && body.pull_request &&
        body.action == 'submitted';
  }

  const body = req.body;
  let promise = Promise.resolve();
  // Monitor for pr actions (opened, reopened, created, synchronized) and
  // a review action.
  if (isPrAction(body) || isReviewAction(body)) {
    const pr = new PullRequest(body.pull_request);
    promise = processPullRequest(body, pr, body.action);
  }

  return promise.then(ok).catch(e => {
    // Only allow debug logging of errors here if we're in development.
    if (process.env.NODE_ENV === 'development') {
      logging.debug(e.stack);
    }
    res.status(500).send('Something went wrong!');
  });
}

function processPullRequest(body, pr, actionType) {
  return getPullRequestInfo(pr).then(prInfo => {
    logging.debug('prInfo', prInfo);
    let reviewers = Object.keys(prInfo.fileOwners).map(ownerKey => {
      return prInfo.fileOwners[ownerKey].owner.dirOwners;
    });
    reviewers = _.union(...reviewers);
    logging.debug(reviewers);
    let promise = pr.setApprovedStatus(reviewers, prInfo.approvalsMet);

    // Temporarily only do it for opened types
    if (actionType === 'opened') {
      promise = promise.then(() => {
        return pr.setReviewers(reviewers)
      });
    }
    return promise;
  });
}

/**
 * @param {!PullRequest}
 * @return {{
 *   pr:!PullRequest,
 *   fileOwners:!Object<string>,
 *   reviews:!Array<Review>,
 *   approvalsMet:boolean
 * }}
 */
function getPullRequestInfo(pr) {
  return Owner.getOwners(git, pr).then(fileOwners => {
    return pr.getUniqueReviews().then(reviews => {
      logging.debug('reviews', reviews);
      const approvalsMet = pr.areAllApprovalsMet(fileOwners, reviews);
      return {pr, fileOwners, reviews, approvalsMet};
    });
  });
}
