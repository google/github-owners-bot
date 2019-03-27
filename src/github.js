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
const sleep = require('sleep-promise');


/**
 * Maps the github json payload to a simpler data structure.
 */
class PullRequest {

  constructor(context, pr) {

    this.name = 'ampproject/owners-check';

    this.nameMatcher = new RegExp('owners bot|owners-check', 'i');

    this.git = new Git(context);
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
    const checkOutputText = this.buildCheckOutput(prInfo);
    const checkRuns = await this.getCheckRun();
    const {hasCheckRun, checkRun} = this.hasCheckRun(checkRuns);
    if (hasCheckRun) {
      return this.updateCheckRun(checkRun, checkOutputText,
          prInfo.approvalsMet);
    }
    return this.createCheckRun(checkOutputText, prInfo.approvalsMet);
  }

  async getMeta() {
    const fileOwners = await Owner.getOwners(this.git, this);
    const reviews = await this.getUniqueReviews();
    this.context.log.debug('[getMeta]', reviews);
    const approvalsMet = this.areAllApprovalsMet(fileOwners, reviews);
    const reviewersWhoApproved = this.getReviewersWhoApproved(reviews);
    return {fileOwners, reviews, approvalsMet, reviewersWhoApproved};
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
    const reviewersWhoApproved = this.getReviewersWhoApproved(reviews);
    return Object.keys(fileOwners).every(path => {
      const fileOwner = fileOwners[path];
      const owner = fileOwner.owner;
      _.intersection(owner.dirOwners, reviewersWhoApproved);
      return _.intersection(owner.dirOwners, reviewersWhoApproved).length > 0;
    });
  }

  getReviewersWhoApproved(reviews) {
    const reviewersWhoApproved = reviews.filter(x => {
      return x.state === 'approved';
    }).map(x => x.username);
    // If you're the author, then you yourself are assumed to approve your own
    // PR.
    reviewersWhoApproved.push(this.author);
    return reviewersWhoApproved;
  }


  async createCheckRun(text, areApprovalsMet) {
    // We need to add a delay on the PR creation and check creation since
    // GitHub might not be ready.
    await sleep(2000);
    const conclusion = areApprovalsMet ? 'success' : 'failure';
    return this.github.checks.create(this.context.repo({
      name: this.name,
      head_branch: this.headRef,
      head_sha: this.headSha,
      status: 'completed',
      conclusion: 'neutral',
      completed_at: new Date(),
      output: {
        title: this.name,
        summary: `The check was a ${conclusion}!`,
        text,
      }
    }));
  }

  async updateCheckRun(checkRun, text, areApprovalsMet) {
    this.context.log.debug('[updateCheckRun]', checkRun);
    const conclusion = areApprovalsMet ? 'success' : 'failure';
    return this.github.checks.update(this.context.repo({
      check_run_id: checkRun.id,
      status: 'completed',
      conclusion: 'neutral',
      name: this.name,
      completed_at: new Date(),
      output: {
        title: this.name,
        summary: `The check was a ${conclusion}!`,
        text,
      }
    }));
  }

  async getCheckRun() {
    const res = await this.github.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: this.headSha,
    });
    this.context.log.debug('[getCheckRun]', res);
    return res.data;
  }

  /**
   * @return {{hasChecRun: boolean, checkRun: !Object|undefined}}
   */
  hasCheckRun(checkRuns) {
    const hasCheckRun = checkRuns.total_count > 0;
    const [checkRun] = checkRuns.check_runs.filter(x => {
      return x.head_sha === this.headSha && this.nameMatcher.test(x.name);
    });
    const tuple = {hasCheckRun: hasCheckRun && !!checkRun, checkRun};
    this.context.log.debug('[hasCheckRun]', tuple);
    return tuple;
  }

  /**
   * @return {string}
   */
  buildCheckOutput(prInfo) {
    let text = Object.values(prInfo.fileOwners)
      .filter(fileOwner => {
        // Omit sections that has a required reviewer who has approved.
        return !_.intersection(prInfo.reviewersWhoApproved,
            fileOwner.owner.dirOwners).length;
      }).map(fileOwner => {
        const fileOwnerHeader = `## possible reviewers: ${fileOwner.owner.dirOwners.join(', ')}`;
        const files = fileOwner.files.map(file => {
          return ` - ${file.path}\n`;
        }).join('');
        return `\n${fileOwnerHeader}\n${files}`;
      }).join('');
    this.context.log.debug('[buildCheckOutput]', text);
    return text;
  }

  static async get(context, owner, repo, number) {
    return await context.github.pullRequests.get(context.repo({
      number,
    }));
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

class Teams {

  constructor(context) {
    this.context = context;
    this.github = context.github;
  }

  async list() {
    return this.github.repos.listTeams(this.context.repo());
  }
}

module.exports = {PullRequest, PullRequestComment, Label, Sender, Review, Teams};
