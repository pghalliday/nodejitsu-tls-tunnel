var spawn = require('child_process').spawn;

var child = spawn('ECHO', ['Hello']);
child.stdout.setEncoding('utf8');
child.stdout.on('data', function(data) {
  console.log('** ' + data);
});
child.on('exit', function() {
  console.log('exit');
})
