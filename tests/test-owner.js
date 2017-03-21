/**
 * Copyright 2016 The AMP HTML Authors. All Rights Reserved.
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

import {RepoFile} from '../src/repo-file';
import test from 'ava';
import {
  createOwnersMap,
  createAggregatedOwnersTuple,
  Owner,
} from '../src/owner';

const pathToRepo = '/path/to/repo';

const defaultStruct = [
  new Owner(['person-0'], pathToRepo, 'OWNERS.yaml'),
  new Owner(['person-0', 'build-system-person-0'],
      pathToRepo, 'build-system/OWNERS.yaml'),
  new Owner(['some-extension-owner-0'],
      pathToRepo, 'extensions/0.1/some-extension/OWNERS.yaml'),
  new Owner(['person-1'],
      pathToRepo,
      'extensions/0.1/some-extension-with-only-person-0/OWNERS.yaml'),
];

test('create an Owners Map', t => {
  t.plan(1);
  const ownersMap = createOwnersMap(defaultStruct);
  t.deepEqual(ownersMap, {
    '.': defaultStruct[0],
    './build-system': defaultStruct[1],
    './extensions/0.1/some-extension': defaultStruct[2],
    './extensions/0.1/some-extension-with-only-person-0': defaultStruct[3],
  });
});

test('aggregate RepoFiles who share the same Owner into an ' +
    'OwnerFileTuple', t => {
  t.plan(1);
  const ownersMap = createOwnersMap(defaultStruct);
  const repoFile0 = new RepoFile('README.md', ownersMap);
  const repoFile1 = new RepoFile('some-src-file.js', ownersMap);
  const repoFile2 = new RepoFile('build-system/some-src-file.js', ownersMap);
  const repoFile3 = new RepoFile('build-system/some-src-file-1.js', ownersMap);
  const repoFiles = [repoFile0, repoFile1, repoFile2, repoFile3];
  const aggregatedOwners = createAggregatedOwnersTuple(repoFiles);
  t.deepEqual(aggregatedOwners, [
    {
      owner: defaultStruct[0],
      type: 'dir',
      files: [repoFile0, repoFile1],
    },
    {
      owner: defaultStruct[1],
      type: 'dir',
      files: [repoFile2, repoFile3],
    }
  ]);
});

test('aggregate RepoFiles who share the same usernames list into an ' +
    'OwnerFileTuple for file level owners', t => {
  t.plan(1);
  const ownersMap = createOwnersMap(defaultStruct);
  const repoFile0 = new RepoFile('README.md', ownersMap);
  const repoFile1 = new RepoFile('some-src-file.js', ownersMap);
  const repoFile2 = new RepoFile('build-system/some-src-file.js', ownersMap);
  const repoFile3 = new RepoFile('build-system/some-src-file-1.js', ownersMap);
  const repoFiles = [repoFile0, repoFile1, repoFile2, repoFile3];
  const aggregatedOwners = createAggregatedOwnersTuple(repoFiles);
  t.deepEqual(aggregatedOwners, [
    {
      owner: defaultStruct[0],
      type: 'dir',
      files: [repoFile0, repoFile1],
    },
    {
      owner: defaultStruct[1],
      type: 'dir',
      files: [repoFile2, repoFile3],
    }
  ]);
});
