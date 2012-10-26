var fs = require('fs'),
    http = require('http'),
    Client = require('single-tls-tunnel').Client;

var host = process.argv[2] || 'pghalliday.jit.su',
    port = process.argv[3] || 80,
    privatePort = process.argv[4] || 8080;

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
  client.on('end', function() {
    console.log('Connection ended');
    server.close();
  });
  client.on('error', function(error) {
    console.log('Connection error: ' + error);
    server.close();
  });
  client.connect(function() {
    console.log('Connected to ' + host + ':' + port);
  });
});
