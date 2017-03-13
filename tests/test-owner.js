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
import {findOwners, createOwnersMap, Owner} from '../src/owner';


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

test('find single top level owner for top level file', t => {
  t.plan(3);
  const ownerFiles = findOwners([new RepoFile('README.md')],
      getOwnersMap());
  const numOfOwnerFiles = Object.keys(ownerFiles).length;
  t.is(numOfOwnerFiles, 1, 'number of found owner files should be 1');
  const ownerTuple = ownerFiles['.'];
  t.deepEqual(ownerTuple.owner, defaultStruct[0]);
  t.is(ownerTuple.files[0].path, './README.md');
});

test('find top level owner for deep file with no dir owner', t => {
  t.plan(3);
  const ownerFiles = findOwners([
    new RepoFile('extensions/0.1/some-other-extension/some-other-extension.js'),
  ], getOwnersMap());
  const numOfOwnerFiles = Object.keys(ownerFiles).length;
  t.is(numOfOwnerFiles, 1, 'number of found owner files should be 1');

  const ownerTuple = ownerFiles['.'];
  t.deepEqual(ownerTuple.owner, defaultStruct[0]);
  t.is(ownerTuple.files[0].path,
      './extensions/0.1/some-other-extension/some-other-extension.js');
});

test('find owner for deep level dir', t => {
  t.plan(3);
  var ownerFiles = findOwners([
    new RepoFile('extensions/0.1/some-extension/some-extension.js'),
  ], getOwnersMap());
  const numOfOwnerFiles = Object.keys(ownerFiles).length;
  t.is(numOfOwnerFiles, 1, 'number of found owner files should be 1');
  const someExtensionOwnerTuple = ownerFiles['./extensions/0.1/some-extension'];
  t.deepEqual(someExtensionOwnerTuple.owner, defaultStruct[2]);
  t.is(someExtensionOwnerTuple.files[0].path,
      './extensions/0.1/some-extension/some-extension.js');
});

test('find owners for deep level dir owner and top level file', t => {
  t.plan(6);
  var ownerFiles = findOwners([
    new RepoFile('README.md'),
    new RepoFile('extensions/0.1/some-extension/some-extension.js'),
    new RepoFile('extensions/0.1/some-extension/some-helper-for-extension.js'),
  ], getOwnersMap());
  const numOfOwnerFiles = Object.keys(ownerFiles).length;
  t.is(numOfOwnerFiles, 2, 'number of found owner files should be 2');
  const ownerTuple = ownerFiles['.'];
  t.deepEqual(ownerTuple.owner, defaultStruct[0]);
  t.is(ownerTuple.files[0].path, './README.md');

  const someExtensionOwnerTuple = ownerFiles['./extensions/0.1/some-extension'];
  t.deepEqual(someExtensionOwnerTuple.owner, defaultStruct[2]);
  t.is(someExtensionOwnerTuple.files[0].path,
      './extensions/0.1/some-extension/some-extension.js');
  t.is(someExtensionOwnerTuple.files[1].path,
      './extensions/0.1/some-extension/some-helper-for-extension.js');
});
