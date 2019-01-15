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

const logging = require('./logging').default;
const {RepoFile} = require('./repo-file');
const config = require('../config');
const bb = require('bluebird');
const _ = require('lodash');

const request = bb.promisify(require('request'));
const GITHUB_ACCESS_TOKEN = config.get('GITHUB_ACCESS_TOKEN');

const headers = {
  'User-Agent': 'get-owners',
  'Accept': 'application/vnd.github.v3+json',
};
const qs = {
  access_token: GITHUB_ACCESS_TOKEN,
};

/**
 * Maps the github json payload to a simpler data structure.
 */
export class PullRequest {

  constructor(json) {
    this.id = json.number;
    this.author = json.user.login;
    this.state = json.state;

    // Ref here is the branch name
    this.headRef = json.head.ref;
    this.headSha = json.head.sha;

    this.baseRef = json.base.ref;
    this.baseSha = json.base.sha;

    this.project = json.base.repo.owner.login;
    this.repo = json.base.repo.name;
    this.cloneUrl = json.base.repo.clone_url;

    this.statusesUrl = json.statuses_url;
    // Comments on code pulls/${id}/comments
    this.reviewCommentsUrl = json.review_comments_url;
    // Comments on Pull Request issues/${id}/comments
    this.commentsUrl = json.comments_url;

    this.reviewersUrl = `${json.url}/reviews`;
  }

  /**
   * Helper function to make it easier to stub/spy on requests
   */
  request_(config) {
    return request(config);
  }

  onError_(e) {
    logging.error(e.message);
  }

  /**
   * Retrieves the pull request json payload from the github API
   * and pulls out the files that have been changed in any way
   * and returns type RepoFile[].
   * @return {!Promise<!Array<!RepoFile>>}
   */
  getFiles() {
    return this.request_({
      url: `https://api.github.com/repos/${this.project}/${this.repo}/pulls/` +
          `${this.id}/files`,
      method: 'GET',
      qs,
      headers,
    }).then(function(res) {
      const body = JSON.parse(res.body);
      return body.map(item => new RepoFile(item.filename));
    }).catch(this.onError_);
  }

  /**
   * @param {!Array<string>}
   * @return {!Promise}
   */
  setReviewers(reviewers) {
    const reviewsHeaders = Object.assign({},
          this.getPostHeaders_(),
          // Need to opt-into reviews API
          {'Accept': 'application/vnd.github.symmetra-preview+json'});

    const url = `https://api.github.com/repos/${this.project}/${this.repo}` +
        `/pulls/${this.id}/requested_reviewers`;
    return this.request_({
      url,
      method: 'POST',
      qs,
      headers: reviewsHeaders,
      body: JSON.stringify({reviewers}),
    }).catch(this.onError_);
  }

  setStatus(body) {
    return request({
      url: this.statusesUrl,
      json: true,
      method: 'POST',
      headers: this.getPostHeaders_(),
      body,
    });
  }

  setApprovedStatus(reviewers, approvalsMet) {
    reviewers = reviewers.join(', ');
    return this.setStatus({
      state: 'success',
      target_url: 'https://www.ampproject.org',
      description: `approvals met: ${approvalsMet}. ${reviewers}`,
      context: 'ampproject/owners-bot',
    }).then(r => {
      console.log(r.body);
    });
  }

  setFailureStatus(reviewers, approvalsMet) {
    reviewers = reviewers.join(', ');
    return this.setStatus({
      state: 'failure',
      target_url: 'https://www.ampproject.org',
      description: `approvals met: ${approvalsMet}. ${reviewers}`,
      context: 'ampproject/owners-bot',
    });
  }

  setCheckRun(reviewers, approvalsMet) {
    const headers = Object.assign({},
        this.getPostHeaders_(),
        // Need to opt-into check run API
        {'Accept': 'application/vnd.github.antiope-preview+json'});
    const url = `https://api.github.com/repos/${this.project}/${this.repo}/` +
        'check-runs';
    return this.request_({
      url,
      method: 'POST',
      headers,
      json: true,
      body: JSON.stringify({
        name: 'owners approvals',
        head_sha: this.headSha,
        output: {
          title: 'Required Owners for each file',
          summary: 'this is a test'
        }
      })
    });
  }

  updateCheckRun() {
    const headers = Object.assign({},
        this.getPostHeaders_(),
        // Need to opt-into check run API
        {'Accept': 'application/vnd.github.antiope-preview+json'});
    const url = `https://api.github.com/repos/${this.project}/${this.repo}/` +
        'check-runs';
    return this.request_({
      url,
      method: 'PATCH',
      json: true,
      headers,
      body: JSON.stringify({
        name: 'owners approvals',
        head_sha: this.headSha,
        status: 'completed',
        output: {
          title: 'Required Owners for each file',
          summary: 'this is a test'
        }
      })
    });
  }

  getCheckRun() {
    const headers = Object.assign({},
        // Need to opt-into check run API
        {'Accept': 'application/vnd.github.antiope-preview+json'},
        defaultHeaders);

    return this.request_({
      headers,
      json: true,
      url: `https://api.github.com/repos/${this.project}/${this.repo}/commits/${this.headSha}/check-runs`
    });
  }

  /**
   * @return {!Promise<!Array<!Review>>}
   */
  getReviews() {
    const reviewsHeaders = Object.assign({},
        headers,
        // Need to opt-into reviews API
        {'Accept': 'application/vnd.github.black-cat-preview+json'});
    return this.request_({
      url: `https://api.github.com/repos/${this.project}/${this.repo}/pulls/` +
          `${this.id}/reviews`,
      method: 'GET',
      qs,
      headers: reviewsHeaders,
    }).then(function(res) {
      const body = JSON.parse(res.body);
      // Sort by latest submitted_at date first since users and state
      // are not unique.
      const reviews = body.map(x => new Review(x)).sort((a, b) => {
        return b.submitted_at - a.submitted_at;
      });
      return reviews;
    }).catch(this.onError_);
  }

  /**
   * @return {!Promise<!Array<!Review>>}
   */
  getUniqueReviews() {
    return this.getReviews().then(reviews => {
      // This should always pick out the first instance.
      return _.uniqBy(reviews, 'username');
    }).catch(this.onError_);
  }

  /**
   * @return {!Object<string>}
   */
  getPostHeaders_() {
    return Object.assign({
      'Authorization': `token ${GITHUB_ACCESS_TOKEN}`,
    }, headers);
  }

  areAllApprovalsMet(fileOwners, reviews) {
    const reviewersWhoApproved = reviews.filter(x => {
      return x.state === 'approved';
    }).map(x => x.username);
    // If you're the author, then you yourself are assume to approve your own
    // PR.
    reviewersWhoApproved.push(this.author);

    return Object.keys(fileOwners).every(path => {
      const fileOwner = fileOwners[path];
      const owner = fileOwner.owner;
      _.intersection(owner.dirOwners, reviewersWhoApproved);
      return _.intersection(owner.dirOwners, reviewersWhoApproved).length > 0;
    });
  }

  static fetch(url) {
    return request({
      url,
      method: 'GET', qs, headers,
    }).then(res => {
      const body = JSON.parse(res.body);
      return new PullRequest(body);
    }).catch(e => {
      logging.error(e.message);
    });
  }
}

export class PullRequestComment {

  constructor(json) {
    this.id = json.id;
    this.type = 'pull_request_review_id' in json ? 'pulls' : 'issues';
    this.author = json.user.login;
    this.body = json.body;
    this.createdAt = new Date(json.created_at);
    this.updatedAt = new Date(json.updated_at);
    this.url = json.url;
  }
}

export class Label {

  constructor(json) {
    this.id = json.id;
    this.url = json.url;
    this.name = json.name;
    this.color = json.color;
    this.default = json.default;
  }
}

export class Sender {

  constructor(json) {
    this.username = json.login;
  }
}

export class Review {

  constructor(json) {
    this.id = json.id;
    this.username = json.user.login;
    this.state = json.state.toLowerCase();
    this.submitted_at = new Date(json.submitted_at);
  }

  isApproved() {
    return this.state == 'approved';
  }
}
