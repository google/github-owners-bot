const nock = require('nock')
const owners = require('..')
const { Probot } = require('probot')
const payload = require('./fixtures/opened-4')
const checkRun = require('./fixtures/check-runs')

nock.disableNetConnect();
jest.setTimeout(30000);

describe('dco', () => {
  let probot

  beforeEach(() => {
    probot = new Probot({})
    const app = probot.load(owners)

    // just return a test token
    app.app = () => 'test'
  })

  test('creates a failing check', async () => {

    nock('https://api.github.com')
      .post('/repos/robotland/test/check-runs', (body) => {
        expect(body).toMatchObject(checkRun)
        return true
      })
      .reply(200)

    await probot.receive({ event: 'pull_request', payload })
  })
})
