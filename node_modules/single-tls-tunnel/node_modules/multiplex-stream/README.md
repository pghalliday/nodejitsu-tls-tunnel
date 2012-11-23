multiplex-stream
================

Multiplex multiple streams through a single stream

## Features

- should provide multiple readable/writable streams over a single carrier stream
- should behave correctly with intermediate flow control where data events may get split and/or concatenated
- should allow the downstream connection to write data first
- should allow a stream to be named
- should error if the upstream multiplex already has a connection with the requested name
- should timeout if no multiplex responds to connect requests
- should timeout connect requests if the downstream multiplex already has a connection with the requested name as multicasting to more than one multiplex is not a supported use case
- should end tunnel streams cleanly when the multiplex stream ends

## Installation

```
npm install stream-multiplex
```

## API

```javascript
var MultiplexStream = require('multiplex-stream');

// create downstream multiplex that listens for connections
var downstreamMultiplex = new MultiplexStream(function(downstreamConnection) {
  // a multiplexed stream has connected from upstream.
  // The assigned id will be accessible as downstreamConnection.id
  downstreamConnection.setEncoding();
  downstreamConnection.on('data', function(data) {
    // received data, send reply upstream
    downstreamConnection.write('Hello, upstream');
  });
  downstreamConnection.on('end', function(data) {
    // downstream connection has ended
  });
});

// create upstream multiplex that will be used to initiate connections
var upstreamMultiplex = new MultiplexStream({
  // The connectTimeout optionally specifies how long to
  // wait in milliseconds for the downstream multiplex to
  // accept to connections. It defaults to 3000 milliseconds
  connectTimeout: 5000
});

// pipe from one multiplex to the other (there could
// be other carrier streams in between, for instance a net socket)
upstreamMultiplex.pipe(downstreamMultiplex).pipe(upstreamMultiplex);

// create a new upstream multiplexed stream
var upstreamConnection = upstreamMultiplex.connect({
  // optionally specify an id for the stream. By default
  // a v1 UUID will be assigned as the id for anonymous streams
  id: 'MyStream'
}, function() {
  upstreamConnection.setEncoding();
  upstreamConnection.on('data', function(data) {
    // received reply, end the connection
    upstreamConnection.end();        
  });
  upstreamConnection.on('end', function(data) {
    // upstream connection has ended
  });
  // send some data downstream
  upstreamConnection.write('Hello, downstream');
}).on('error', function(error) {
  // timeouts and other errors resulting from connect requests
});
```

## Roadmap

- Nothing at this time

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using ``./grunt.sh`` or ``.\grunt.bat``.

## License
Copyright (c) 2012 Peter Halliday  
Licensed under the MIT license.