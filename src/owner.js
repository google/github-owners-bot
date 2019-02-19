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

const path = require('path');

/**
 * @fileoverview Contains classes and functions in relation to "OWNER" files
 * and theyre evaluation.
 */

/**
 * Represents an OWNER file found in the repo.
 */
class Owner {

  constructor(config, pathToRepoDir, filePath) {
    // We want it have the leading ./ to evaluate `.` later on
    this.path = /^\./.test(filePath) ? filePath : `.${path.sep}${filePath}`;
    this.dirname = path.dirname(this.path);
    this.fullpath = path.join(pathToRepoDir, this.path);
    this.score = (this.dirname.match(/\//g) || []).length;

    this.dirOwners = [];
    this.fileOwners = Object.create(null);
    this.parseConfig_(config);
  }

  /**
   * @param {!Object} config
   */
  parseConfig_(config) {
    config.forEach(entry => {
      if (typeof entry === 'string') {
        this.dirOwners.push(entry);
      }
    });
    this.dirOwners.sort();
  }

  /**
   * @param {!Git} git
   * @param {!PullRequest} pr
   */
  static async getOwners(git, pr) {
    // Update the local target repository of the latest from master
    git.pullLatestForRepo(process.env.GITHUB_REPO_DIR, 'origin', 'master');
    const promises = Promise.all([
      pr.listFiles(),
      git.getOwnersFilesForBranch(pr.author, process.env.GITHUB_REPO_DIR,
          'master'),
    ]);
    const res = await promises;
    const [files, ownersMap] = res;
    const owners = findOwners(files, ownersMap);
    pr.context.log.debug('[getOwners]', owners);
    return owners;
  }
}

/**
 * Returns a list of github usernames that can be "approvers" for the set
 * of files. It first tries to find the interection across the files and if
 * there are none it will return the union across usernames.
 */
function findOwners(files, ownersMap) {
  const fileOwners = Object.create(null);
  files.forEach(file => {
    const owner = findClosestOwnersFile(file, ownersMap);
    if (!fileOwners[owner.dirname]) {
      fileOwners[owner.dirname] = {
        owner,
        files: [file],
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
  let dirname = file.dirname;
  let owner = ownersMap[dirname];
  const dirs = dirname.split(path.sep);

  while (!owner && dirs.pop() && dirs.length) {
    dirname = dirs.join(path.sep);
    owner = ownersMap[dirname];
  }
  return owner;
}

function createOwnersMap(owners) {
  return owners.reduce((ownersMap, owner) => {
    // Handles empty OWNERS.yaml files.
    if (!owner) {
      return ownersMap;
    }
    if (owner.dirOwners.length) {
      ownersMap[owner.dirname] = owner;
    }
    return ownersMap;
  }, Object.create(null));
}

module.exports = {Owner, findOwners, findClosestOwnersFile, createOwnersMap};
