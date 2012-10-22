var expect = require('chai').expect,
    Client = require('tls-tunnel').Client,
    spawn = require('child_process').spawn,
    net = require('net'),
    Checklist = require('checklist');

describe('server', function() {
  it('should listen on port 8080', function(done) {
    var checklist = new Checklist([
      'Started\n',
      'connected',
      'end',
      'exit'
    ], done);
    var childProcess = spawn('node', ['src/server.js']);
    childProcess.stderr.setEncoding('utf8');
    childProcess.stderr.on('data', function(data) {
      // shouldn't get here and checklist will error if we do
      checklist.check(data);
    });
    childProcess.stdout.setEncoding('utf8');
    childProcess.stdout.on('data', function(data) {
      checklist.check(data);
      var connection = net.connect({
        port: 8080
      }, function() {
        checklist.check('connected');
        connection.end();
      });
      connection.on('end', function() {
        checklist.check('end');
        childProcess.kill();
      });
    });
    childProcess.on('exit', function() {
      checklist.check('exit');      
    });
  });
});