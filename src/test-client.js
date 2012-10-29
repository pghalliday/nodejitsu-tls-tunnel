var fs = require('fs'),
    http = require('http'),
    Client = require('single-tls-tunnel').Client;

var host = process.argv[2] || 'pghalliday.jit.su',
    port = process.argv[3] || 80,
    privatePort = process.argv[4] || 8080,
    exitDelay = process.argv[5] || 0;

var server = http.createServer(function(request, response) {
  response.end('Hello, world!');
});

var client = new Client({
  host: host,
  port: port,
  key: fs.readFileSync('./keys/client-key.pem'),
  cert: fs.readFileSync('./keys/client-cert.pem'),
  ca: [fs.readFileSync('./keys/server-cert.pem')],
  rejectUnauthorized: true
}, {
  port: privatePort
});

server.listen(privatePort, function() {
  console.log('Listening on ' + privatePort);
  client.on('error', function(error) {
    console.error('Connection error: ' + error);
    setTimeout(function() {
      process.exit(1);
    }, exitDelay);
  });
  client.connect(function() {
    console.log('Connected to ' + host + ':' + port);
    http.get('http://' + host + ':' + port, function(response) {
      response.setEncoding();
      response.on('data', function(data) {
        if (data === 'Hello, world!') {
          console.log('HTTP tunnelling succeeded');
          setTimeout(function() {
            process.exit(0);
          }, exitDelay);
        } else {
          console.error('HTTP tunnelling received incorrect data: ' + data);
          setTimeout(function() {
            process.exit(2);
          }, exitDelay);
        }
      });
      response.on('error', function(error) {
        console.error('HTTP tunnelling error: ' + error);
        setTimeout(function() {
          process.exit(3);
        }, exitDelay);
      });
    });
  });
});
