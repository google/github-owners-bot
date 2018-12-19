import test from 'ava';
import * as sinon from 'sinon';
import {PullRequest, Review} from '../src/github';
const request = require('supertest');
const config = require('../config');
const fs = require('fs');

import {app} from '../app';

const GITHUB_BOT_USERNAME = config.get('GITHUB_BOT_USERNAME');

// Figure out how to get this to work on travis since we need to have
// the target repo
if (!process.env.TRAVIS) {

const reviewSubmittedFailedPayload = JSON.parse(
    fs.readFileSync(
    __dirname + '/fixtures/review_submitted_failure.json'));

let req, res, sandbox;
test.beforeEach(() => {
  sandbox = sinon.sandbox.create();
});

test.afterEach(() => {
  sandbox.restore();
});

// Note: Need to run these tests serially because of the shared "PullRequest"
// stubbing state. If we don't since ava runs everything conccurently the
// `afterEach` might not have ran yet when the next test does run.

test.serial('on an opened pull request, it should set initial reviewers', t => {
  t.plan(2);
  const openedPayload = JSON.parse(
      fs.readFileSync(
      __dirname + '/fixtures/opened-2.json'));
  const setReviewersStub = sandbox.stub(PullRequest.prototype, 'setReviewers')
      .returns(Promise.resolve());

  return request(app).post('/api/get-owners')
      .set('Content-Type', 'application/json')
      .send(openedPayload)
      .then(() => {
        t.is(setReviewersStub.callCount, 1, 'Should call setReviewers');
        t.deepEqual(setReviewersStub.getCall(0).args[0],
          ['ampprojectbot', 'erwinmombay'],
          'Should be called both erwinmombay and ampprojectbot'
        )
      });
});

test.serial('on a sync pull request, it should not set reviewers', t => {
  t.plan(1);
  const openedPayload = JSON.parse(
      fs.readFileSync(
      __dirname + '/fixtures/sync.json'));
  const setReviewersStub = sandbox.stub(PullRequest.prototype, 'setReviewers')
      .returns(Promise.resolve());

  return request(app).post('/api/get-owners')
      .set('Content-Type', 'application/json')
      .send(openedPayload)
      .then(() => {
        t.is(setReviewersStub.callCount, 0, 'Should not call setReviewers');
      });
});

} else {

  test('to appease ava', t => {
    t.plan(1);
    t.is(1, 1);
  });
}
