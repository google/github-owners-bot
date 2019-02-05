const nock = require('nock')
const owners = require('..')
const {Probot} = require('probot')
const payload = require('./fixtures/opened-4')
const filesPayload = require('./fixtures/files.35');
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

    const stub = sinon.stub(Git.prototype, 'getOwnersFilesForBranch')
      .returns(['erwinmombay', 'donttrustthisbot'].join('\n'));

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
            name: 'My app!',
            head_branch: payload.pull_request.head.ref,
            head_sha: payload.pull_request.head.sha,
            status: 'completed',
            conclusion: 'failure',
            output: {
              title: 'Probot check!',
              summary: 'The check has passed!',
            }
          });
          return true;
        }).reply(200);

      await probot.receive({event: 'pull_request', payload});
      stub.restore();
    });

    test.skip('with passing check when author themselves are owners', async () => {

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
          console.log(body);
          expect(body).toMatchObject({
            name: 'My app!',
            head_branch: payload.pull_request.head.ref,
            head_sha: payload.pull_request.head.sha,
            status: 'completed',
            conclusion: 'success',
            output: {
              title: 'Probot check!',
              summary: 'The check has passed!',
            }
          });
          return true;
        }).reply(200);

      await probot.receive({event: 'pull_request', payload});
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
            name: 'My app!',
            head_branch: payload.pull_request.head.ref,
            check_run_id: checkRunsPayload.check_runs[0].id,
            conclusion: 'failure',
            output: {
              title: 'Probot check!',
              summary: 'The check has passed!',
            }
          });
          return true;
        }).reply(200)

      await probot.receive({event: 'pull_request', payload});
    });
  });

});
