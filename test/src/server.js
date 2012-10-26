var expect = require('chai').expect,
    spawn = require('child_process').spawn,
    fs = require('fs'),
    http = require('http'),
    Client = require('single-tls-tunnel').Client,
    Checklist = require('checklist');

var PORT = 8080,
    PRIVATE_PORT = 8081;

describe('server', function() {
  it('should tunnel through the passed in port to a client', function(done) {
    var checklist = new Checklist([
      'Started\n',
      'connected',
      200,
      'Hello, world!',
      'end',
      'exit'
    ], done);
    var childProcess = spawn('node', ['src/server.js', PORT], {
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
      var client = new Client({
        port: PORT,
        key: fs.readFileSync('./keys/client-key.pem'),
        cert: fs.readFileSync('./keys/client-cert.pem'),
        ca: [fs.readFileSync('./keys/server-cert.pem')],
        rejectUnauthorized: true
      }, {
        port: PRIVATE_PORT
      });
      client.on('end', function() {
        checklist.check('end');
        childProcess.kill();
      });
      client.connect(function() {
        checklist.check('connected');
        var server = http.createServer(function(request, response) {
          response.end('Hello, world!');
        });
        server.listen(PRIVATE_PORT, function() {
          http.get('http://localhost:' + PRIVATE_PORT, function(response) {
            checklist.check(response.statusCode);
            response.setEncoding();
            response.on('data', function(data) {
              checklist.check(data);
            });
            response.on('end', function() {
              server.close(function() {
                client.end();
              });
            });
          });
        });
      });
    });
    childProcess.on('exit', function() {
      checklist.check('exit');      
    });
  });
});