"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RepoFile = void 0;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
var path = require('path');
/**
 * Represents the File that has been changed from the repository.
 * This is hydrated from the github pull request api.
 */


var RepoFile = function RepoFile(filePath) {
  _classCallCheck(this, RepoFile);

  // We want it have the leading ./ to evaluate `.` later on
  this.path = /^\./.test(filePath) ? filePath : ".".concat(path.sep).concat(filePath);
  this.dirname = path.dirname(this.path);
};

exports.RepoFile = RepoFile;