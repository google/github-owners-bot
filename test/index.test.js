const nock = require('nock')
const owners = require('..')
const {Probot} = require('probot')
const payload = require('./fixtures/opened-4')
const authorIsOwnerPayload = require('./fixtures/opened.author-is-owner')
const filesPayload = require('./fixtures/files.35');
const files36Payload = require('./fixtures/files.36');
const reviewsPayload = require('./fixtures/reviews.35');
const checkRunsPayload = require('./fixtures/check-runs.get.35');
const emptyCheckRunsPayload = require('./fixtures/check-runs.get.35.empty');
const checkRunsCreate = require('./fixtures/check-runs')
const Git = jest.genMockFromModule('../src/git').Git;
const Owner = require('../src/owner').Owner;
const sinon = require('sinon');

nock.disableNetConnect();
jest.setTimeout(30000);

describe('owners bot', () => {
  let probot;

  beforeEach(() => {
    probot = new Probot({})
    const app = probot.load(owners);

    // just return a test token
    app.app = () => 'test';
  })

  afterEach(() => {
  });

  describe('create check run', () => {

    test('with failure check when there are 0 reviews on a pull request', async () => {

      nock('https://api.github.com')
        .post('/app/installations/588033/access_tokens')
        .reply(200, {token: 'test'});

      // We need the list of files on a pull request to evaluate the required
      // reviewers.
      nock('https://api.github.com')
        .get('/repos/erwinmombay/github-owners-bot-test-repo/pulls/35/files')
        .reply(200, filesPayload);

      // We need the reviews to check if a pull request has been approved or
      // not.
      nock('https://api.github.com')
        .get('/repos/erwinmombay/github-owners-bot-test-repo/pulls/35/reviews')
        .reply(200, reviewsPayload);

      nock('https://api.github.com')
        .get('/repos/erwinmombay/github-owners-bot-test-repo/commits/ampprojectbot-patch-3/check-runs')
        .reply(200, emptyCheckRunsPayload);

      // Test that a check-run is created
      nock('https://api.github.com')
        .post('/repos/erwinmombay/github-owners-bot-test-repo/check-runs', body => {
          expect(body).toMatchObject({
            name: 'AMP Owners bot',
            head_branch: payload.pull_request.head.ref,
            head_sha: payload.pull_request.head.sha,
            status: 'completed',
            conclusion: 'failure',
            output: {
              title: 'AMP Owners bot check',
              summary: 'The check was a failure!',
              text: '# erwinmombay   - ./dir2/dir1/dir1/file.txt    ',
            }
          });
          return true;
        }).reply(200);

      await probot.receive({event: 'pull_request', payload});
    });

    test('with passing check when author themselves are owners', async () => {

      nock('https://api.github.com')
        .post('/app/installations/588033/access_tokens')
        .reply(200, {token: 'test'});

      // We need the list of files on a pull request to evaluate the required
      // reviewers.
      nock('https://api.github.com')
        .get('/repos/erwinmombay/github-owners-bot-test-repo/pulls/36/files')
        .reply(200, files36Payload);

      // We need the reviews to check if a pull request has been approved or
      // not.
      nock('https://api.github.com')
        .get('/repos/erwinmombay/github-owners-bot-test-repo/pulls/36/reviews')
        .reply(200, reviewsPayload);

      nock('https://api.github.com')
        .get('/repos/erwinmombay/github-owners-bot-test-repo/commits/erwinmombay-patch-4/check-runs')
        .reply(200, emptyCheckRunsPayload);

      //// Test that a check-run is created
      nock('https://api.github.com')
        .post('/repos/erwinmombay/github-owners-bot-test-repo/check-runs', body => {
          expect(body).toMatchObject({
            name: 'AMP Owners bot',
            head_branch: authorIsOwnerPayload.pull_request.head.ref,
            head_sha: authorIsOwnerPayload.pull_request.head.sha,
            status: 'completed',
            conclusion: 'success',
            output: {
              title: 'AMP Owners bot check',
              summary: 'The check was a success!',
              text: '# erwinmombay   - ./dir2/new-file.txt    ',
            }
          });
          return true;
        }).reply(200);

      await probot.receive({event: 'pull_request', payload: authorIsOwnerPayload});
    });
  });

  describe('update check run', () => {

    test('with failure check when there are 0 reviews on a pull request', async () => {

      nock('https://api.github.com')
        .post('/app/installations/588033/access_tokens')
        .reply(200, {token: 'test'});

      // We need the list of files on a pull request to evaluate the required
      // reviewers.
      nock('https://api.github.com')
        .get('/repos/erwinmombay/github-owners-bot-test-repo/pulls/35/files')
        .reply(200, filesPayload);

      // We need the reviews to check if a pull request has been approved or
      // not.
      nock('https://api.github.com')
        .get('/repos/erwinmombay/github-owners-bot-test-repo/pulls/35/reviews')
        .reply(200, reviewsPayload);

      nock('https://api.github.com')
        .get('/repos/erwinmombay/github-owners-bot-test-repo/commits/ampprojectbot-patch-3/check-runs')
        .reply(200, checkRunsPayload);

      // Test that a check-run is created
      nock('https://api.github.com')
        .patch('/repos/erwinmombay/github-owners-bot-test-repo/check-runs/53472313', body => {
          expect(body).toMatchObject({
            name: 'AMP Owners bot',
            head_branch: payload.pull_request.head.ref,
            check_run_id: checkRunsPayload.check_runs[0].id,
            conclusion: 'failure',
            output: {
              title: 'AMP Owners bot check',
              summary: 'The check was a failure!',
              text: '# erwinmombay   - ./dir2/dir1/dir1/file.txt    ',
            }
          });
          return true;
        }).reply(200)

      await probot.receive({event: 'pull_request', payload});
    });
  });

});