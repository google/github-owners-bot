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

const {RepoFile} = require('./repo-file');
const {Owner} = require('./owner');
const {Git} = require('./git');
const _ = require('lodash');

const git = new Git();

/**
 * Maps the github json payload to a simpler data structure.
 */
class PullRequest {

  constructor(context, pr) {
    this.context = context;
    this.github = context.github;

    this.id = pr.number;
    this.author = pr.user.login;
    this.state = pr.state;

    this.owner = pr.base.repo.owner.login;
    this.repo = pr.base.repo.name;

    // Ref here is the branch name
    this.headRef = pr.head.ref;
    this.headSha = pr.head.sha;

    // Base is usually master
    this.baseRef = pr.base.ref;
    this.baseSha = pr.base.sha;

    this.options = {
      owner: this.owner,
      repo: this.repo,
    };
  }

  async processOpened() {
    const prInfo = await this.getMeta();
    let reviewers = Object.values(prInfo.fileOwners).map(fileOwner => {
      return fileOwner.owner.dirOwners;
    });
    reviewers = _.union(...reviewers);
    const checkRuns = await this.getCheckRun();
    const hasCheckRun = this.hasCheckRun(checkRuns);
    const [checkRun] = checkRuns.check_runs
        .filter(x => x.head_sha === this.headSha);
    if (hasCheckRun) {
      this.updateCheckRun(checkRun, reviewers, prInfo.approvalsMet);
    }
    return this.createCheckRun(reviewers, prInfo.approvalsMet);
  }

  async getMeta() {
    const fileOwners = await Owner.getOwners(git, this);
    const reviews = await this.getUniqueReviews();
    this.context.log.debug('[getMeta]', reviews);
    const approvalsMet = this.areAllApprovalsMet(fileOwners, reviews);
    return {fileOwners, reviews, approvalsMet};
  }

  /**
   * Retrieves the pull request json payload from the github API
   * and pulls out the files that have been changed in any way
   * and returns type RepoFile[].
   * @return {!Promise<!Array<!RepoFile>>}
   */
  async listFiles() {
    const res = await this.github.pullRequests.listFiles({
      number: this.id,
      ...this.options,
    });
    this.context.log.debug('[listFiles]', res.data);
    return res.data.map(item => new RepoFile(item.filename));
  }

  async getUniqueReviews() {
    const reviews = await this.getReviews();
      // This should always pick out the first instance.
    return _.uniqBy(reviews, 'username');
  }

  async getReviews() {
    const res = await this.github.pullRequests.listReviews({
      number: this.id,
      ...this.options,
    });
    this.context.log.debug('[getReviews]', res.data);
    // Sort by latest submitted_at date first since users and state
    // are not unique.
    const reviews = res.data.map(x => new Review(x)).sort((a, b) => {
      return b.submitted_at - a.submitted_at;
    });
    return reviews;
  }

  /**
   * @param {!Array<string>}
   * @return {!Promise}
   */
  async setReviewers(reviewers) {
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

  async createCheckRun(reviewers, areApprovalsMet) {
    return this.github.checks.create(this.context.repo({
      name: 'My app!',
      head_branch: this.headRef,
      head_sha: this.headSha,
      status: 'completed',
      conclusion: areApprovalsMet ? 'success' : 'failure',
      completed_at: new Date(),
      output: {
        title: 'Probot check!',
        summary: 'The check has passed!'
      }
    }))
  }

  async getCheckRun() {
    const res = await this.github.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: this.headRef,
    });
    this.context.log.debug('[getCheckRun]', res);
    return res.data;
  }

  async updateCheckRun(checkRun, reviewers, areApprovalsMet) {
    this.github.checks.update({
      ...this.options,
      check_run_id: checkRun.id,
      status: 'completed',
      conclusion: areApprovalsMet ? 'success' : 'failure',
      completed_at: new Date(),
      output: {
        title: 'Probot check!',
        summary: 'The check has passed!'
      }
    })
  }

  /**
   * @return {boolean}
   */
  async hasCheckRun(checkRuns) {
    this.context.log.debug('[hasCheckRun]', checkRuns);
    return checkRuns.total_count > 0 && checkRuns.check_runs.some(x => {
      return x.head_sha === this.headSha;
    });
  }
}

class PullRequestComment {

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

class Label {

  constructor(json) {
    this.id = json.id;
    this.url = json.url;
    this.name = json.name;
    this.color = json.color;
    this.default = json.default;
  }
}

class Sender {

  constructor(json) {
    this.username = json.login;
  }
}

class Review {

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

module.exports = {PullRequest, PullRequestComment, Label, Sender, Review};
