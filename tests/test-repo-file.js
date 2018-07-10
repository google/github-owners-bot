/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
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
import {Owner, createOwnersMap} from '../src/owner';
import test from 'ava';

const pathToRepo = '/path/to/repo';

const defaultStruct = [
  new Owner([
    'person-0',
    {
      'file-level-owner-0': [
        'file-with-file-level-owner.js',
      ],
    },
    {
      'file-level-owner-2': [
        'build-system/some-file-in-build-system.js',
      ],
    },
    {
      'file-level-owner-3': [
        'build-system/some-other-file-in-build-system.js',
      ]
    }
  ], pathToRepo, 'OWNERS.yaml'),
  new Owner(['person-0', 'build-system-person-0', {
    'file-level-owner-1': [
      'some-file-in-build-system.js',
    ]
  }], pathToRepo, 'build-system/OWNERS.yaml'),
  new Owner(['some-extension-owner-0'],
      pathToRepo, 'extensions/0.1/some-extension/OWNERS.yaml'),
  new Owner(['person-1'],
      pathToRepo,
      'extensions/0.1/some-extension-with-only-person-0/OWNERS.yaml'),
];

const ownersMap = createOwnersMap(defaultStruct);

test('find top level owner for top level file', t => {
  t.plan(2);
  const repoFile = new RepoFile('README.md', ownersMap);
  const ownerFile = repoFile.findRepoFileOwner();
  t.deepEqual(ownerFile.id, defaultStruct[0].dirname);
  t.deepEqual(ownerFile.usernames, defaultStruct[0].dirOwners);
});

test('find top level owner for deep file with no dir owner', t => {
  t.plan(2);
  const repoFile = new RepoFile(
      'extensions/0.1/some-other-extension/some-other-extension.js', ownersMap);
  const ownerFile = repoFile.findRepoFileOwner();
  t.deepEqual(ownerFile.id, defaultStruct[0].dirname);
  t.deepEqual(ownerFile.usernames, defaultStruct[0].dirOwners);
});

test('find owner for deep level dir', t => {
  t.plan(2);
  const repoFile = new RepoFile(
      'extensions/0.1/some-extension/some-extension.js', ownersMap);
  const ownerFile = repoFile.findRepoFileOwner();
  t.deepEqual(ownerFile.id, defaultStruct[2].dirname);
  t.deepEqual(ownerFile.usernames, defaultStruct[2].dirOwners);
});

test('find file level owner', t => {
  t.plan(1);
  const repoFile = new RepoFile('file-with-file-level-owner.js', ownersMap);
  const ownerFile = repoFile.findRepoFileOwner();
  t.deepEqual(ownerFile.usernames, ['file-level-owner-0']);
});

test('find top file level owner in a deeper file', t => {
  t.plan(1);
  const repoFile = new RepoFile(
      'build-system/some-other-file-in-build-system.js', ownersMap);
  const ownerFile = repoFile.findRepoFileOwner();
  t.deepEqual(ownerFile.usernames, ['file-level-owner-3']);
});

test('find accumulation of file level owners', t => {
  t.plan(1);
  const repoFile = new RepoFile('build-system/some-file-in-build-system.js',
      ownersMap);
  const ownerFile = repoFile.findRepoFileOwner();
  t.deepEqual(ownerFile.usernames,
      ['file-level-owner-1', 'file-level-owner-2']);
});
