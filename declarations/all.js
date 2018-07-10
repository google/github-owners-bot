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

declare var require: {
  main: Object
}

declare module "crypto" {
  declare function timingSafeEqual(a: Buffer, b: Buffer): bool;
  declare function createHmac(a: string, b: string): crypto$Hash;
}

type OwnersMap = {
  [key: string]: Owner
}

type GitHubStatusPost = {
  state: 'success' | 'error' | 'failure',
  target_url: string,
  description: string,
  context: string
}

type PullRequestInfo = {
  pr: PullRequest,
  repoFiles:RepoFile[],
  reviews: Review[],
  approvalsMet: boolean,
  ownerTuples: OwnerTuples
}

type RepoFileOwner = {
  id: string,
  type: 'file' | 'dir',
  usernames: string[]
}

type OwnerTuple = {
  type: 'file' | 'dir',
  owner: Owner | string[],
  files: RepoFile[]
}

type OwnerTuples = OwnerTuple[];
