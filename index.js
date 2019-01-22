module.exports = app => {
  app.log('what what');
  app.log.info('what what');
  app.on('pull_request.opened', pullRequest)

  async function pullRequest(context) {
    app.log.info('check check');
    app.log.info('hello world');
  }
}
