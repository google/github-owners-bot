"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findOwners = findOwners;
exports.findClosestOwnersFile = findClosestOwnersFile;
exports.createOwnersMap = createOwnersMap;
exports.Owner = void 0;

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
var path = require('path');
/**
 * @fileoverview Contains classes and functions in relation to "OWNER" files
 * and theyre evaluation.
 */

/**
 * Represents an OWNER file found in the repo.
 */


var Owner =
/*#__PURE__*/
function () {
  function Owner(config, pathToRepoDir, filePath) {
    _classCallCheck(this, Owner);

    // We want it have the leading ./ to evaluate `.` later on
    this.path = /^\./.test(filePath) ? filePath : ".".concat(path.sep).concat(filePath);
    this.dirname = path.dirname(this.path);
    this.fullpath = path.join(pathToRepoDir, this.path);
    this.score = (this.dirname.match(/\//g) || []).length;
    this.dirOwners = [];
    this.fileOwners = Object.create(null);
    this.parseConfig_(config);
  }

  _createClass(Owner, [{
    key: "parseConfig_",
    value: function parseConfig_(config) {
      var _this = this;

      config.forEach(function (entry) {
        if (typeof entry === 'string') {
          _this.dirOwners.push(entry);
        } else if (entry && entry['file-only']) {// TODO(erwin): support file level entries. Finalize spec for it.
        }
      });
      this.dirOwners.sort();
    }
  }]);

  return Owner;
}();
/**
 * Returns a list of github usernames that can be "approvers" for the set
 * of files. It first tries to find the interection across the files and if
 * there are none it will return the union across usernames.
 */


exports.Owner = Owner;

function findOwners(files, ownersMap) {
  var fileOwners = Object.create(null);
  files.forEach(function (file) {
    var owner = findClosestOwnersFile(file, ownersMap);

    if (!fileOwners[owner.dirname]) {
      fileOwners[owner.dirname] = {
        owner: owner,
        files: [file]
      };
    } else {
      fileOwners[owner.dirname].files.push(file);
    }
  });
  return fileOwners;
}
/**
 * Using the `ownersMap` key which is the path to the actual OWNER file
 * in the repo, we simulate a folder traversal by splitting the path and
 * finding the closest OWNER file for a RepoFile.
 */


function findClosestOwnersFile(file, ownersMap) {
  var dirname = file.dirname;
  var owner = ownersMap[dirname];
  var dirs = dirname.split(path.sep);

  while (!owner && dirs.pop() && dirs.length) {
    dirname = dirs.join(path.sep);
    owner = ownersMap[dirname];
  }

  return owner;
}

function createOwnersMap(owners) {
  return owners.reduce(function (ownersMap, owner) {
    if (owner.dirOwners.length) {
      ownersMap[owner.dirname] = owner;
    }

    return ownersMap;
  }, Object.create(null));
}