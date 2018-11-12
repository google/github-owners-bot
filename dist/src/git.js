"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Git = void 0;

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
var _require = require('./owner'),
    Owner = _require.Owner,
    createOwnersMap = _require.createOwnersMap;

var bb = require('bluebird');

var child_process = require('child_process');

var yaml = require('yamljs');

var path = require('path');

var exec = bb.promisify(child_process.exec);
var fs = bb.promisifyAll(require('fs'));
var matcher = /your branch is up-to-date|your branch is up to date/i;

function yamlReader(str) {
  return yaml.parse(str);
}
/**
 * Reads the actual OWNER file on the file system and parses it using the
 * passed in `formatReader` and returns an `OwnersMap`.
 */


function ownersParser(formatReader, pathToRepoDir, ownersPaths) {
  var promises = ownersPaths.map(function (ownerPath) {
    var fullPath = path.resolve(pathToRepoDir, ownerPath);
    return fs.readFileAsync(fullPath).then(function (file) {
      return new Owner(formatReader(file.toString()), pathToRepoDir, ownerPath);
    });
  });
  return bb.all(promises).then(createOwnersMap);
}

var Git =
/*#__PURE__*/
function () {
  function Git() {
    _classCallCheck(this, Git);
  }

  _createClass(Git, [{
    key: "getOwnersFilesForBranch",

    /**
     * Retrieves all the OWNERS paths inside a repository.
     */
    value: function getOwnersFilesForBranch(author, dirPath, targetBranch) {
      // NOTE: for some reason `git ls-tree --full-tree -r HEAD **/OWNERS*
      // doesn't work from here.
      var cmd = "cd ".concat(dirPath, " && git checkout ").concat(targetBranch, " ") + '&& git ls-tree --full-tree -r HEAD | ' + 'cut -f2 | grep OWNERS.yaml$';
      return exec(cmd).then(function (res) {
        // Construct the owners map.
        var ownersPaths = stdoutToArray(res) // Remove unneeded string. We only want the file paths.
        .filter(function (x) {
          return !matcher.test(x);
        });
        return ownersParser(yamlReader, dirPath, ownersPaths, author);
      });
    }
    /**
     * cd's into an assumed git directory on the file system and does a hard
     * reset to the remote branch.
     */

  }, {
    key: "pullLatestForRepo",
    value: function pullLatestForRepo(dirPath, remote, branch) {
      var cmd = "cd ".concat(dirPath, " && git fetch ").concat(remote, " ").concat(branch, " && ") + "git checkout -B ".concat(branch, " ").concat(remote, "/").concat(branch);
      return exec(cmd);
    }
  }]);

  return Git;
}();

exports.Git = Git;

function stdoutToArray(res) {
  return res.split('\n').filter(function (x) {
    return !!x;
  });
}