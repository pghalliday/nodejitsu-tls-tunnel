var expect = require('chai').expect,
    spawn = require('child_process').spawn,
    fs = require('fs'),
    http = require('http'),
    Server = require('single-tls-tunnel').Server,
    Checklist = require('checklist');

var HOST = 'localhost',
    PORT = 8080,
    PRIVATE_PORT = 8081,
    EXIT_DELAY = 500; // We need to delay the exit of the test-client script so that we are sure to catch the stderr and stout events before it really exists

describe('test-client', function() {
  it('should connect to server and test the tunnel', function(done) {
    var checklist = new Checklist([
      'stdout',
      'server closed',
      0
    ], done);

    var server = new Server({
        key: fs.readFileSync('./keys/server-key.pem'),
        cert: fs.readFileSync('./keys/server-cert.pem'),
        ca: [fs.readFileSync('./keys/client-cert.pem')],
        requireCert: true,
        rejectUnauthorized: true
    });

    server.listen(PORT, function() {
      var childProcess = spawn('node', ['src/test-client.js', HOST, PORT, PRIVATE_PORT, EXIT_DELAY], {
        stdio: 'pipe',
        detached: false
      });
    
      childProcess.stderr.setEncoding('utf8');
      childProcess.stderr.on('data', function(data) {
        checklist.check(data, new Error('child process output on stderr: ' + data));
      });
      childProcess.stdout.setEncoding('utf8');
      var stdoutChecklist = new Checklist([
        'Listening on ' + PRIVATE_PORT + '\n',
        'Connected to ' + HOST + ':' + PORT + '\n',
        'HTTP tunnelling succeeded\n'
      ], function(error) {
        checklist.check('stdout', error);
      });
      childProcess.stdout.on('data', function(data) {
        stdoutChecklist.check(data);
      });
      childProcess.on('exit', function(code) {
        checklist.check(code);      
        server.close(function() {
          checklist.check('server closed');
        });
      });
    });
  });

  it('should error if it fails to connect to passed in port', function(done) {
    this.timeout(5000);
    var checklist = new Checklist([
      'Listening on ' + PRIVATE_PORT + '\n',
      'Connection error: Error: connect ECONNREFUSED\n',
      1
    ], done);
    var childProcess = spawn('node', ['src/test-client.js', HOST, PORT, PRIVATE_PORT, EXIT_DELAY], {
      stdio: 'pipe',
      detached: false
    });

    childProcess.stderr.setEncoding('utf8');
    childProcess.stderr.on('data', function(data) {
      checklist.check(data);
    });
    childProcess.stdout.setEncoding('utf8');
    childProcess.stdout.on('data', function(data) {
      checklist.check(data);
    });
    childProcess.on('exit', function(code) {
      checklist.check(code);      
    });
  });

  it('should work twice', function(done) {
    this.timeout(5000);
    var checklist = new Checklist([
      'stdout',
      0,
      'stdout',
      'server closed',
      0
    ], done);

    var server = new Server({
        key: fs.readFileSync('./keys/server-key.pem'),
        cert: fs.readFileSync('./keys/server-cert.pem'),
        ca: [fs.readFileSync('./keys/client-cert.pem')],
        requireCert: true,
        rejectUnauthorized: true
    });

    server.listen(PORT, function() {
      var childProcess1 = spawn('node', ['src/test-client.js', HOST, PORT, PRIVATE_PORT, EXIT_DELAY], {
        stdio: 'pipe',
        detached: false
      });
    
      childProcess1.stderr.setEncoding('utf8');
      childProcess1.stderr.on('data', function(data) {
        checklist.check(data, new Error('child process output on stderr: ' + data));
      });
      childProcess1.stdout.setEncoding('utf8');
      var stdoutChecklist = new Checklist([
        'Listening on ' + PRIVATE_PORT + '\n',
        'Connected to ' + HOST + ':' + PORT + '\n',
        'HTTP tunnelling succeeded\n'
      ], function(error) {
        checklist.check('stdout', error);
      });
      childProcess1.stdout.on('data', function(data) {
        stdoutChecklist.check(data);
      });
      childProcess1.on('exit', function(code) {
        checklist.check(code);      
        var childProcess2 = spawn('node', ['src/test-client.js', HOST, PORT, PRIVATE_PORT, EXIT_DELAY], {
          stdio: 'pipe',
          detached: false
        });
      
        childProcess2.stderr.setEncoding('utf8');
        childProcess2.stderr.on('data', function(data) {
          checklist.check(data, new Error('child process output on stderr: ' + data));
        });
        childProcess2.stdout.setEncoding('utf8');
        var stdoutChecklist = new Checklist([
          'Listening on ' + PRIVATE_PORT + '\n',
          'Connected to ' + HOST + ':' + PORT + '\n',
          'HTTP tunnelling succeeded\n'
        ], function(error) {
          checklist.check('stdout', error);
        });
        childProcess2.stdout.on('data', function(data) {
          stdoutChecklist.check(data);
        });
        childProcess2.on('exit', function(code) {
          checklist.check(code);      
          server.close(function() {
            checklist.check('server closed');
          });
        });
      });
    });
  });
});