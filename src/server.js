var Server = require('single-tls-tunnel').Server,
    fs = require('fs');

var port = process.argv[2] || 8080;

var server = new Server({
    key: fs.readFileSync('./keys/server-key.pem'),
    cert: fs.readFileSync('./keys/server-cert.pem'),
    ca: [fs.readFileSync('./keys/client-cert.pem')],
    requireCert: true,
    rejectUnauthorized: true
});
server.listen(port, function() {
  console.log('Started');
});