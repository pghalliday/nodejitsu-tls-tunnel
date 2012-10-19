var Server = require('tls-tunnel').Server,
    fs = require('fs');

var server = new Server({
    port: 8080,
    key: fs.readFileSync('./keys/server-key.pem'),
    cert: fs.readFileSync('./keys/server-cert.pem'),
    ca: [fs.readFileSync('./keys/client-cert.pem')],
    forwardedPorts: {
      start: 8081,
      count: 10
    }
});
server.start(function() {
  console.log('Started');
});