"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Review = exports.Sender = exports.Label = exports.PullRequestComment = exports.PullRequest = void 0;

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

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
var _require = require('./repo-file'),
    RepoFile = _require.RepoFile;

var config = require('../config');

var bb = require('bluebird');

var _ = require('lodash');

var request = bb.promisify(require('request'));
var GITHUB_ACCESS_TOKEN = config.get('GITHUB_ACCESS_TOKEN');
var GITHUB_BOT_USERNAME = config.get('GITHUB_BOT_USERNAME');
var headers = {
  'User-Agent': 'get-owners',
  'Accept': 'application/vnd.github.v3+json'
};
var qs = {
  access_token: GITHUB_ACCESS_TOKEN
};
/**
 * Maps the github json payload to a simpler data structure.
 */

var PullRequest =
/*#__PURE__*/
function () {
  function PullRequest(json) {
    _classCallCheck(this, PullRequest);

    this.id = json.number;
    this.author = json.user.login;
    this.state = json.state; // Ref here is the branch name

    this.headRef = json.head.ref;
    this.headSha = json.head.sha;
    this.baseRef = json.base.ref;
    this.baseSha = json.base.sha;
    this.project = json.base.repo.owner.login;
    this.repo = json.base.repo.name;
    this.cloneUrl = json.base.repo.clone_url;
    this.statusesUrl = json.statuses_url; // Comments on code pulls/${id}/comments

    this.reviewCommentsUrl = json.review_comments_url; // Comments on Pull Request issues/${id}/comments

    this.commentsUrl = json.comments_url;
    this.reviewersUrl = "".concat(json.url, "/reviews");
  }
  /**
   * Retrieves the pull request json payload from the github API
   * and pulls out the files that have been changed in any way
   * and returns type RepoFile[].
   */


  _createClass(PullRequest, [{
    key: "getFiles",
    value: function getFiles() {
      return request({
        url: "https://api.github.com/repos/".concat(this.project, "/").concat(this.repo, "/pulls/") + "".concat(this.id, "/files"),
        method: 'GET',
        qs: qs,
        headers: headers
      }).then(function (res) {
        var body = JSON.parse(res.body);
        return body.map(function (item) {
          return new RepoFile(item.filename);
        });
      });
    }
  }, {
    key: "getReviews",
    value: function getReviews() {
      var reviewsHeaders = Object.assign({}, headers, // Need to opt-into reviews API
      {
        'Accept': 'application/vnd.github.black-cat-preview+json'
      });
      return request({
        url: "https://api.github.com/repos/".concat(this.project, "/").concat(this.repo, "/pulls/") + "".concat(this.id, "/reviews"),
        method: 'GET',
        qs: qs,
        headers: reviewsHeaders
      }).then(function (res) {
        var body = JSON.parse(res.body); // Sort by latest submitted_at date first since users and state
        // are not unique.

        var reviews = body.map(function (x) {
          return new Review(x);
        }).sort(function (a, b) {
          return b.submitted_at - a.submitted_at;
        });
        return reviews;
      });
    }
  }, {
    key: "getUniqueReviews",
    value: function getUniqueReviews() {
      return this.getReviews().then(function (reviews) {
        // This should always pick out the first instance.
        return _.uniqBy(reviews, 'username');
      });
    }
  }, {
    key: "getComments",
    value: function getComments() {
      return bb.all([this.getCommentByType_('pulls'), this.getCommentByType_('issues')]).then(function (_ref) {
        var _ref2 = _slicedToArray(_ref, 2),
            issues = _ref2[0],
            pulls = _ref2[1];

        return _toConsumableArray(issues).concat(_toConsumableArray(pulls)).map(function (x) {
          return new PullRequestComment(x);
        });
      });
    }
  }, {
    key: "getCommentsByAuthor",
    value: function getCommentsByAuthor(author) {
      return this.getComments().then(function (comments) {
        return comments.filter(function (x) {
          return x.author === author;
        });
      });
    }
  }, {
    key: "getCommentByType_",
    value: function getCommentByType_(type) {
      return request({
        url: "https://api.github.com/repos/".concat(this.project, "/").concat(this.repo, "/") + "".concat(type, "/").concat(this.id, "/comments"),
        method: 'GET',
        qs: qs,
        headers: headers
      }).then(function (res) {
        return JSON.parse(res.body);
      });
    }
  }, {
    key: "getPostHeaders_",
    value: function getPostHeaders_() {
      return Object.assign({
        'Authorization': "token ".concat(GITHUB_ACCESS_TOKEN)
      }, headers);
    }
  }, {
    key: "isBotAuthor",
    value: function isBotAuthor() {
      return this.author == GITHUB_BOT_USERNAME;
    }
  }, {
    key: "setReviewers",
    value: function setReviewers() {}
  }], [{
    key: "fetch",
    value: function fetch(url) {
      return request({
        url: url,
        method: 'GET',
        qs: qs,
        headers: headers
      }).then(function (res) {
        var body = JSON.parse(res.body);
        return new PullRequest(body);
      });
    }
  }]);

  return PullRequest;
}();

exports.PullRequest = PullRequest;

var PullRequestComment = function PullRequestComment(json) {
  _classCallCheck(this, PullRequestComment);

  this.id = json.id;
  this.type = 'pull_request_review_id' in json ? 'pulls' : 'issues';
  this.author = json.user.login;
  this.body = json.body;
  this.createdAt = new Date(json.created_at);
  this.updatedAt = new Date(json.updated_at);
  this.url = json.url;
};

exports.PullRequestComment = PullRequestComment;

var Label = function Label(json) {
  _classCallCheck(this, Label);

  this.id = json.id;
  this.url = json.url;
  this.name = json.name;
  this.color = json.color;
  this.default = json.default;
};

exports.Label = Label;

var Sender = function Sender(json) {
  _classCallCheck(this, Sender);

  this.username = json.login;
};

exports.Sender = Sender;

var Review =
/*#__PURE__*/
function () {
  function Review(json) {
    _classCallCheck(this, Review);

    this.id = json.id;
    this.username = json.user.login;
    this.state = json.state.toLowerCase();
    this.submitted_at = new Date(json.submitted_at);
  }

  _createClass(Review, [{
    key: "isApproved",
    value: function isApproved() {
      return this.state == 'approved';
    }
  }]);

  return Review;
}();

exports.Review = Review;