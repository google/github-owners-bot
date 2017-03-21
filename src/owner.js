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

import * as path from 'path';
import {RepoFile} from './repo-file';

/**
 * @fileoverview Contains classes and functions in relation to "OWNER" files
 * and theyre evaluation.
 */

/**
 * Represents an OWNER file found in the repo.
 */
export class Owner {

  path: string;
  dirname: string;
  fullpath: string;
  score: number;
  dirOwners: string[];
  fileOwners: Object;

  constructor(config: any, pathToRepoDir: string, filePath: string) {
    // We want it have the leading ./ to evaluate `.` later on
    this.path = /^\./.test(filePath) ? filePath : `.${path.sep}${filePath}`;
    this.dirname = path.dirname(this.path);
    this.fullpath = path.join(pathToRepoDir, this.path);
    this.score = (this.dirname.match(/\//g) || []).length;

    this.dirOwners = [];
    this.fileOwners = Object.create(null);
    this.parseConfig_(config);
  }

  parseConfig_(config: any) {
    config.forEach(entry => {
      if (typeof entry === 'string') {
        this.dirOwners.push(entry);
      } else if (typeof entry === 'object') {
        const username = Object.keys(entry)[0];
        const files = entry[username];
        files.forEach(filepath => {
          const path = `${this.dirname}/${filepath}`;
          const fileOwners = this.fileOwners[path];
          if (!fileOwners) {
            this.fileOwners[path] = [username];
          } else if (fileOwners.indexOf(username) == -1) {
            fileOwners.push(username);
          }
        });
      }
    });
    this.dirOwners.sort();
  }
}

export function createOwnersMap(owners: Owner[]): OwnersMap {
  return owners.reduce((ownersMap: OwnersMap, owner: Owner) => {
    if (owner.dirOwners.length) {
      ownersMap[owner.dirname] = owner;
    }
    return ownersMap;
  }, Object.create(null));
}

export function createAggregatedOwnersTuple(
    repoFiles: RepoFile[]): OwnerTuples {
  const aggregatedOwners = Object.create(null);

  repoFiles.forEach(repoFile => {
    const id = repoFile.findRepoFileOwner().id;
    if (!aggregatedOwners[id]) {
      aggregatedOwners[id] = {
        owner: repoFile.dirOwner,
        files: [repoFile],
      };
    } else {
      aggregatedOwners[id].files.push(repoFile);
    }
  });
  return Object.keys(aggregatedOwners).sort().map(key => {
    return aggregatedOwners[key];
  });;
}
