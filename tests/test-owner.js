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
import {findOwnersUsernames, createOwnersMap, Owner} from '../src/owner';


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

function getOwnersMap() {
  return createOwnersMap(defaultStruct);
}

test('find top level owner for top level file', t => {
  t.plan(1);
  var owners = findOwnersUsernames([new RepoFile('README.md')],
      getOwnersMap());
  t.deepEqual(owners, ['@person-0']);
});

test('find top level owner for deep file with no dir owner', t => {
  t.plan(1);
  var owners = findOwnersUsernames([
    new RepoFile('extensions/0.1/some-other-extension/some-other-extension.js'),
  ], getOwnersMap());
  t.deepEqual(owners, ['@person-0']);
});

test('find union of owners for deep level dir owner and top level file', t => {
  t.plan(1);
  var owners = findOwnersUsernames([
    new RepoFile('README.md'),
    new RepoFile('extensions/0.1/some-extension/some-extension.js'),
  ], getOwnersMap());
  t.deepEqual(owners, ['@person-0', '@some-extension-owner-0']);
});

test('find union of owners for deep level dir with only that deep level being touched', t => {
  t.plan(1);
  var owners = findOwnersUsernames([
    new RepoFile('extensions/0.1/some-extension/some-extension.js'),
  ], getOwnersMap());
  t.deepEqual(owners, ['@person-0', '@some-extension-owner-0']);
});

test('find intersection for dir', t => {
  t.plan(1);
  var owners = findOwnersUsernames([
    new RepoFile('README.md'),
    new RepoFile('build-system/some-dir/some-file.java'),
  ], getOwnersMap());
  t.deepEqual(owners, ['@person-0']);
});
