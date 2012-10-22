var fs = require('fs'),
    Client = require('tls-tunnel').Client;
    
var client = Client({
  tunnel: {
    host: 'pghalliday.jit.su',
    port: 8080,
    key: fs.readFileSync('./keys/client-key.pem'),
    cert: fs.readFileSync('./keys/client-cert.pem'),
    ca: [fs.readFileSync('./keys/server-cert.pem')]
  },
  target: {
    host: 'localhost',
    port: 8000,
  }
});
client.connect(function(error, connectionString) {
  console.log('Connect to:  pghalliday.jit.su:' + connectionString);
});