var expect = require('chai').expect,
    spawn = require('child_process').spawn,
    fs = require('fs'),
    http = require('http'),
    Server = require('single-tls-tunnel').Server,
    Checklist = require('checklist');

var HOST = 'localhost',
    PORT = 8080,
    PRIVATE_PORT = 8081;

describe('test-client', function() {
  it('should connect to server on passed in port and proxy it\'s own test http server', function(done) {
    var checklist = new Checklist([
      'Connected to ' + HOST + ':' + PORT + '\n',
      200,
      'Hello, world!',
      'response ended',
      'server closed',
      'exit'
    ], done);

    var server = new Server({
        key: fs.readFileSync('./keys/server-key.pem'),
        cert: fs.readFileSync('./keys/server-cert.pem'),
        ca: [fs.readFileSync('./keys/client-cert.pem')],
        requireCert: true,
        rejectUnauthorized: true
    });

    server.listen(PORT, function() {
      var childProcess = spawn('node', ['src/test-client.js', HOST, PORT, PRIVATE_PORT], {
        stdio: 'pipe',
        detached: false
      });
      childProcess.stderr.setEncoding('utf8');
      childProcess.stderr.on('data', function(data) {
        // shouldn't get here and checklist will error if we do
        checklist.check(data);
      });
      childProcess.stdout.setEncoding('utf8');
      childProcess.stdout.on('data', function(data) {
        checklist.check(data);
        http.get('http://localhost:' + PORT, function(response) {
          checklist.check(response.statusCode);
          response.setEncoding();
          response.on('data', function(data) {
            checklist.check(data);
          });
          response.on('end', function() {
            checklist.check('response ended');
            childProcess.kill();
          });
        });
      });
      childProcess.on('exit', function() {
        checklist.check('exit');      
        server.close(function() {
          checklist.check('server closed');
        });
      });
    });
  });

  it('should error if fails to connect to passed in port', function(done) {
    var checklist = new Checklist([
      'Connection error: Error: connect ECONNREFUSED\n',
      'exit'
    ], done);
    var childProcess = spawn('node', ['src/test-client.js', HOST, PORT, PRIVATE_PORT], {
      stdio: 'pipe',
      detached: false
    });
    childProcess.stderr.setEncoding('utf8');
    childProcess.stderr.on('data', function(data) {
      // shouldn't get here and checklist will error if we do
      checklist.check(data);
    });
    childProcess.stdout.setEncoding('utf8');
    childProcess.stdout.on('data', function(data) {
      checklist.check(data);
    });
    childProcess.on('exit', function() {
      checklist.check('exit');      
    });
  });
});