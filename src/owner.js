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
      } else if (entry && entry['file-only']) {
        // TODO(erwin): support file level entries. Finalize spec for it.
      }
    });
  }
}

/**
 * Returns a list of github usernames that can be "approvers" for the set
 * of files. It first tries to find the interection across the files and if
 * there are none it will return the union across usernames.
 */
export function findOwners(files: RepoFile[],
    ownersMap: OwnersMap): FileOwners {
  const fileOwners: FileOwners = Object.create(null);
  files.forEach((file : RepoFile) => {
    const owner = findClosestOwnersFile(file, ownersMap);
    if (!fileOwners[owner.dirname]) {
      fileOwners[owner.dirname] = ({
        owner,
        files: [file],
      } : FileOwner);
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
export function findClosestOwnersFile(file: RepoFile,
    ownersMap: OwnersMap): Owner {
  let dirname = file.dirname;
  let owner = ownersMap[dirname];
  const dirs = dirname.split(path.sep);

  while (!owner && dirs.pop() && dirs.length) {
    dirname = dirs.join(path.sep);
    owner = ownersMap[dirname];
  }
  return owner;
}

export function createOwnersMap(owners: Owner[]): OwnersMap {
  return owners.reduce((ownersMap: OwnersMap, owner: Owner) => {
    if (owner.dirOwners.length) {
      ownersMap[owner.dirname] = owner;
    }
    return ownersMap;
  }, Object.create(null));
}
