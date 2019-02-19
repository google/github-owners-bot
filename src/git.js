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

const {Owner, createOwnersMap} = require('./owner');
const child_process = require('child_process');
const yaml = require('yamljs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs').promises;

const matcher = /your branch is up-to-date|your branch is up to date/i;

function yamlReader(str) {
  return yaml.parse(str);
}

class Git {

  constructor(context) {
    this.context = context;
  }

  /**
   * Reads the actual OWNER file on the file system and parses it using the
   * passed in `formatReader` and returns an `OwnersMap`.
   */
  async ownersParser(formatReader, pathToRepoDir, ownersPaths) {
    const promises = ownersPaths.map(ownerPath => {
      const fullPath = path.resolve(pathToRepoDir, ownerPath);
      return fs.readFile(fullPath).then(file => {
        const config = formatReader(file.toString());
        if (!config) {
          const str = `No config found for ${fullPath}`;
          this.context.log.error(str);
          // This handles OWNERS.yaml files that are empty.
          return null;
        }
        return new Owner(config, pathToRepoDir, ownerPath);
      });
    });
    return Promise.all(promises).then(createOwnersMap);
  }

  /**
   * Retrieves all the OWNERS paths inside a repository.
   * @return {!Promise<!OwnersMap>}
   */
  async getOwnersFilesForBranch(author, dirPath, targetBranch) {
    // NOTE: for some reason `git ls-tree --full-tree -r HEAD **/OWNERS*
    // doesn't work from here.
    const cmd = `cd ${dirPath} && git checkout ${targetBranch} ` +
        '&& git ls-tree --full-tree -r HEAD | ' +
        'cut -f2 | grep OWNERS.yaml$';
    const {stdout, stderr} = await exec(cmd);
    if (stderr) {
      // TODO: Usually stderr here might occur when branch is already master.
      this.context.log.warn(['getOwnersFilesForBranch'], stderr);
    }
    this.context.log.debug('[getOwnersFilesForBranch]', stdout);
    // Construct the owners map.
    const ownersPaths = stdoutToArray(stdout)
      // Remove unneeded string. We only want the file paths.
      .filter(x => !(matcher.test(x)));
    return this.ownersParser(yamlReader, dirPath, ownersPaths, author);
  }

  /**
   * cd's into an assumed git directory on the file system and does a hard
   * reset to the remote branch.
   */
  pullLatestForRepo(dirPath, remote, branch) {
    const cmd = `cd ${dirPath} && git fetch ${remote} ${branch} && ` +
        `git checkout -B ${branch} ${remote}/${branch}`;
    return exec(cmd);
  }
}

function stdoutToArray(res) {
  return res.split('\n').filter(x => !!x);
}

module.exports = {Git};
