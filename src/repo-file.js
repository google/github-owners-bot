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
import {Owner} from './owner';
import * as path from 'path';

/**
 * Represents the File that has been changed from the repository.
 * This is hydrated from the github pull request api.
 */
export class RepoFile {

  path: string;
  dirname: string;
  ownersMap: OwnersMap;
  dirOwner: ?Owner;
  repoFileOwner: RepoFileOwner;
  fileOwners: ?string[];

  constructor(filePath: string, ownersMap: OwnersMap) {
    // We want it have the leading ./ to evaluate `.` later on
    this.path = /^\./.test(filePath) ? filePath : `.${path.sep}${filePath}`;
    this.dirname = path.dirname(this.path);
    this.ownersMap = ownersMap;
    this.dirOwner = null;
    this.fileOwners = null;

    const maybeOwner = this._findOwnerFile();
    if (maybeOwner instanceof Owner) {
      this.dirOwner = maybeOwner;
      this.repoFileOwner = {
        id: this.dirOwner.dirname,
        type: 'dir',
        usernames: this.dirOwner.dirOwners,
      };
    } else {
      this.fileOwners = maybeOwner;
      this.repoFileOwner = {
        id: null,
        type: 'file',
        usernames: this.fileOwners,
      };
    }
  }

  _findOwnerFile(): Owner | string[] {
    let ownerCandidate = null;
    const fileOwners = new Set([]);
    const dirs = this.dirname.split(path.sep);

    while (dirs.length) {
      const dirname = dirs.join(path.sep);
      const curOwner = this.ownersMap[dirname];
      if (curOwner) {
        const curOwnerFileOwners = curOwner.getFileLevelOwners(this);
        if (curOwnerFileOwners) {
          curOwnerFileOwners.forEach(x => fileOwners.add(x));
        }
      }
      if (!ownerCandidate) {
        ownerCandidate = curOwner;
      }
      dirs.pop();
    }
    if (fileOwners.size > 0) {
      return Array.from(fileOwners).sort();
    }
    return ownerCandidate;
  }

  findRepoFileOwner(): RepoFileOwner {
    return this.repoFileOwner;
  }
}
