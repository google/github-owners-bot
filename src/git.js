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

import {Owner, createOwnersMap} from './owner';
const bb = require('bluebird');
const child_process = require('child_process');
const yaml = require('yamljs');
const path = require('path');
const exec = bb.promisify(child_process.exec);
const fs = bb.promisifyAll(require('fs'));


export class YamlReader {

  read(str: string, pathToRepoDir: string,
      ownerPath: string): Array<Owner> {
    const entries = yaml.parse(str);
    const dirOwners = [];
    const fileOwners = [];
    entries.forEach(x => {
      if (typeof x == 'string') {
        dirOwners.push(x);
      } else if (typeof x == 'object') {
      }
    });
    return [new Owner(dirOwners, pathToRepoDir, ownerPath)];
  }
}
/**
 * Reads the actual OWNER file on the file system and parses it using the
 * passed in `formatReader` and returns an `OwnersMap`.
 */
function ownersParser(formatReader:
    (x: string, y: string, z: string) => Array<Owner>,
    pathToRepoDir: string, ownersPaths: string[]): OwnersMap {
  const promises = ownersPaths.map(ownerPath => {
    const fullPath = path.resolve(pathToRepoDir, ownerPath);
    return fs.readFileAsync(fullPath).then(file => {
      return formatReader(file.toString(), pathToRepoDir, ownerPath);
    });
  });
  return bb.all(promises).then(createOwnersMap);
}

export class Git {

  /**
   * Retrieves all the OWNERS paths inside a repository.
   */
  getOwnersFilesForBranch(author: string, dirPath: string,
      targetBranch: string): OwnersMap {
    // NOTE: for some reason `git ls-tree --full-tree -r HEAD **/OWNERS*
    // doesn't work from here.
    return exec(`cd ${dirPath} && git checkout ${targetBranch} ` +
        '&& git ls-tree --full-tree -r HEAD | ' +
        'cut -f2 | grep OWNERS.yaml$')
        .then(res => {
          // Construct the owners map.
          const ownersPaths = stdoutToArray(res)
            // Remove unneeded string. We only want the file paths.
            .filter(x => !/your branch is up-to-date/i.test(x));
          const reader = new YamlReader();
          return ownersParser(reader.read, dirPath, ownersPaths, author);
        });
  }

  /**
   * cd's into an assumed git directory on the file system and does a hard
   * reset to the remote branch.
   */
  pullLatestForRepo(dirPath: string, remote: string,
      branch: string) : Promise<string[]> {
    return exec(`cd ${dirPath} && git fetch ${remote} ${branch} && ` +
        `git checkout -B ${branch} ${remote}/${branch}`);
  }
}

function stdoutToArray(res: string): string[] {
  return res.split('\n').filter(x => !!x);
}
