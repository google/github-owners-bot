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

import {RepoFile} from './repo-file';
const config = require('../config');
import * as bb from 'bluebird';
import * as _ from 'lodash';

const request = bb.promisify(require('request'));
const GITHUB_ACCESS_TOKEN: string = config.get('GITHUB_ACCESS_TOKEN');
const GITHUB_BOT_USERNAME = config.get('GITHUB_BOT_USERNAME');

type Headers = {
  [key: string]: string
}

const headers: Headers = {
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

  id: number;
  author: string;
  state: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  baseSha: string;
  project: string;
  repo: string;
  cloneUrl: string;
  statusesUrl: string;
  reviewCommentsUrl: string;
  commentsUrl: string;
  reviewersUrl: string;

  constructor(json: any) {
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
   * Retrieves the pull request json payload from the github API
   * and pulls out the files that have been changed in any way
   * and returns type RepoFile[].
   */
  getFiles(): Promise<RepoFile[]> {
    return request({
      url: `https://api.github.com/repos/${this.project}/${this.repo}/pulls/` +
          `${this.id}/files`,
      method: 'GET',
      qs,
      headers,
    }).then(function(res: any) {
      const body = JSON.parse(res.body);
      return body.map(item => new RepoFile(item.filename));
    });
  }

  getReviews(): Promise<Review[]> {
    const reviewsHeaders = Object.assign({},
        headers,
        // Need to opt-into reviews API
        {'Accept': 'application/vnd.github.black-cat-preview+json'});
    return request({
      url: `https://api.github.com/repos/${this.project}/${this.repo}/pulls/` +
          `${this.id}/reviews`,
      method: 'GET',
      qs,
      headers: reviewsHeaders,
    }).then(function(res: any) {
      const body = JSON.parse(res.body);
      // Sort by latest submitted_at date first since users and state
      // are not unique.
      const reviews = body.map(x => new Review(x)).sort((a, b) => {
        return b.submitted_at - a.submitted_at;
      });
      return reviews;
    });
  }

  getUniqueReviews() {
    return this.getReviews().then(reviews => {
      // This should always pick out the first instance.
      return _.uniqBy(reviews, 'username');
    });
  }

  getComments(): Promise<PullRequestComment[]> {
    return bb.all([
      this.getCommentByType_('pulls'),
      this.getCommentByType_('issues'),
    ]).then(([issues, pulls]) => {
      return [...issues, ...pulls].map(x => new PullRequestComment(x));
    });
  }

  postIssuesComment(body: string): Promise<*> {
    return request({
      url: `https://api.github.com/repos/${this.project}/${this.repo}/issues/` +
          `${this.id}/comments`,
      json: true,
      method: 'POST',
      headers: this.getPostHeaders_(),
      body: {'body': body},
    });
  }

  getCommentsByAuthor(author: string): Promise<PullRequestComment[]> {
    return this.getComments().then(comments => {
      return comments.filter(x => x.author === author);
    });
  }

  getCommentByType_(type: string) {
    return request({
      url: `https://api.github.com/repos/${this.project}/${this.repo}/` +
          `${type}/${this.id}/comments`,
      method: 'GET', qs, headers,
    }).then(res => JSON.parse(res.body));
  }

  getPostHeaders_() {
    return Object.assign({
      'Authorization': `token ${GITHUB_ACCESS_TOKEN}`,
    }, headers);
  }

  setStatus(body: GitHubStatusPost) {
    return request({
      url: this.statusesUrl,
      json: true,
      method: 'POST',
      headers: this.getPostHeaders_(),
      body,
    });
  }

  setApprovedStatus() {
    return this.setStatus({
      state: 'success',
      target_url: 'https://www.ampproject.org',
      description: 'approved.',
      context: 'ampproject/owners-bot',
    });
  }

  setFailureStatus() {
    // Temporary to make this non blocking
    return this.setApprovedStatus();
    //return this.setStatus({
      //state: 'success',
      //target_url: 'https://www.ampproject.org',
      //description: 'missing approval.',
      //context: 'ampproject/owners-bot',
    //});
  }

  areAllApprovalsMet(fileOwners: FileOwners, reviews: Review[]): boolean {
    const reviewersWhoApproved = reviews.filter(x => {
      return x.state == 'approved';
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

  isBotAuthor() {
    return this.author == GITHUB_BOT_USERNAME;
  }

  getLastApproversList(author: string): Promise<Array<string[]>> {
    return this.getCommentsByAuthor(author).then(comments => {
      comments = comments.slice(0).sort((a, b) => b.updatedAt - a.updatedAt);
      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        // Split by line, then remove empty lines.
        const lines = comment.body.split('\n').filter(x => !!x);
        // Now find the line that has a /to at the beginning.
        const approversList = lines.filter(x => /^\/to /.test(x));
        if (approversList.length) {
          return approversList.map(approvers => {
            return approvers.replace(/^\/to /, '').split(' ')
                .map(x => {
                  if (x.charAt(0) == '@') {
                    return x.slice(1);
                  }
                  return x;
                });
          });
        }
      }
      return [];
    });
  }

  composeBotComment(fileOwners: FileOwners) {
    let comment = 'Hi, ampproject bot here! Here are a list of the owners ' +
        'that can approve your files.\n\nYou may leave an issue comment ' +
        `stating "@${GITHUB_BOT_USERNAME} retry!" to force me to re-evaluate ` +
        'this Pull Request\'s status\n\n';
    Object.keys(fileOwners).sort().forEach(key => {
      const fileOwner = fileOwners[key];
      const owner = fileOwner.owner;
      // Slice from char 2 to remove the ./ prefix normalization
      const files = fileOwner.files.map(x => `- ${x.path.slice(2)}`).join('\n');
      const usernames = '/to ' + owner.dirOwners.join(' ') + '\n';
      comment += usernames + files + '\n\n';
    });
    comment += '\n\nFor any issues please file a bug at ' +
        'https://github.com/google/github-owners-bot/issues';
    return comment;
  }

  static fetch(url) {
    return request({
      url,
      method: 'GET', qs, headers,
    }).then(res => {
      const body = JSON.parse(res.body);
      return new PullRequest(body);
    });
  }
}

export class PullRequestComment {

  id: number;
  type: string;
  author: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  url: string;

  constructor(json: any) {
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

  id: number;
  url: string;
  name: string;
  color: string;
  default: boolean;

  constructor(json: any) {
    this.id = json.id;
    this.url = json.url;
    this.name = json.name;
    this.color = json.color;
    this.default = json.default;
  }
}

export class Sender {

  username: string;

  constructor(json: any) {
    this.username = json.login;
  }
}

export class Review {
  id: number;
  state: 'approved' | 'changes_requested' | 'comment';
  username: string;
  submitted_at: Date;

  constructor(json: any) {
    this.id = json.id;
    this.username = json.user.login;
    this.state = json.state.toLowerCase();
    this.submitted_at = new Date(json.submitted_at);
  }

  isApproved(): boolean {
    return this.state == 'approved';
  }
}
