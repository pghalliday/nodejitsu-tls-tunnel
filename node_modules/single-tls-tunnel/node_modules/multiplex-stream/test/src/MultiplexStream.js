var Checklist = require('checklist'),
    TunnelStream = require('tunnel-stream'),
    expect = require('expect.js'),
    MultiplexStream = require('../../');
    
describe('MultiplexStream', function() {
  it('should provide multiple readable/writable streams over a single carrier stream', function(done) {
    var checklist = new Checklist([
      'downstream1 connected',
      'downstream2 connected',
      'Hello, downstream. This is upstream1',
      'Hello, downstream. This is upstream2',
      'Hello, upstream1',
      'Hello, upstream2',
      'end downstream1',
      'end downstream2',
      'end upstream1',
      'end upstream2'
    ], done);
    var upstreamConnection1;
    var upstreamConnection2;
    var upstreamMultiplex = new MultiplexStream();
    var downstreamMultiplex = new MultiplexStream(function(downstreamConnection) {
      downstreamConnection.setEncoding();
      switch (downstreamConnection.id) {
        case upstreamConnection1.id:
          checklist.check('downstream1 connected');
          downstreamConnection.on('data', function(data) {
            checklist.check(data);
            downstreamConnection.write('Hello, upstream1');
          });
          downstreamConnection.on('end', function(data) {
            checklist.check('end downstream1');
          });
          break;
        case upstreamConnection2.id:
          checklist.check('downstream2 connected');
          downstreamConnection.on('data', function(data) {
            checklist.check(data);
            downstreamConnection.write('Hello, upstream2');
          });
          downstreamConnection.on('end', function(data) {
            checklist.check('end downstream2');
          });
          break;
      }
    });
    
    upstreamMultiplex.pipe(downstreamMultiplex).pipe(upstreamMultiplex);
    
    upstreamConnection1 = upstreamMultiplex.connect(function() {
      upstreamConnection1.setEncoding();
      upstreamConnection1.on('data', function(data) {
        checklist.check(data);
        upstreamConnection1.end();        
      });
      upstreamConnection1.on('end', function(data) {
        checklist.check('end upstream1');        
      });
      upstreamConnection1.write('Hello, downstream. This is upstream1');
    });

    upstreamConnection2 = upstreamMultiplex.connect(function() {
      upstreamConnection2.setEncoding();
      upstreamConnection2.on('data', function(data) {
        checklist.check(data);
        upstreamConnection2.end();        
      });
      upstreamConnection2.on('end', function(data) {
        checklist.check('end upstream2');        
      });
      upstreamConnection2.write('Hello, downstream. This is upstream2');
    });
  });

  it('should behave correctly with intermediate flow control where data events may get split and/or concatenated', function(done) {
    var checklist = new Checklist([
      'Hello, downstream',
      'How are you doing?'
    ], done);

    var tunnel = new TunnelStream({
      messageSize: 5
    });

    var upstreamMultiplex = new MultiplexStream();
    upstreamMultiplex.pipe(tunnel.upstream).pipe(upstreamMultiplex);

    var downstreamMultiplex = new MultiplexStream(function(downstreamConnection) {
      // asynchronously flush the downstream tunnel to make sure the connect event gets there
      process.nextTick(function() {
        tunnel.downstream.flush();
      });

      downstreamConnection.setEncoding();
      downstreamConnection.on('data', function(data) {
        checklist.check(data);
      });
    });
    downstreamMultiplex.pipe(tunnel.downstream).pipe(downstreamMultiplex);

    var upstreamConnection = upstreamMultiplex.connect(function() {
      upstreamConnection.write('Hello, downstream');
      upstreamConnection.write('How are you doing?');
      // asynchronously flush the upstream tunnel to make sure the last data event gets there
      process.nextTick(function() {
        tunnel.upstream.flush();
      });
    });
    // asynchronously flush the upstream tunnel to make sure the connection event gets there
    process.nextTick(function() {
      tunnel.upstream.flush();
    });
  });

  it('should allow the downstream connection to write data first', function(done) {
    var checklist = new Checklist([
      'Go away!',
      'downstreamConnection end',
      'upstreamConnection end'
    ], done);

    var upstreamMultiplex = new MultiplexStream();
    var downstreamMultiplex = new MultiplexStream(function(downstreamConnection) {
      downstreamConnection.on('end', function() {
        checklist.check('downstreamConnection end');
      });
      downstreamConnection.end('Go away!');
    });
    upstreamMultiplex.pipe(downstreamMultiplex).pipe(upstreamMultiplex);

    var upstreamConnection = upstreamMultiplex.connect(function() {
      upstreamConnection.setEncoding();
      upstreamConnection.on('data', function(data) {
        checklist.check(data);
      });
      upstreamConnection.on('end', function() {
        checklist.check('upstreamConnection end');
      });
    });
  });

  it('should allow a stream to be named', function(done) {
    var checklist = new Checklist([
      'anAwesomeID'
    ], done);
    var upstreamMultiplex = new MultiplexStream();
    var downstreamMultiplex = new MultiplexStream(function(downstreamConnection) {
      checklist.check(downstreamConnection.id);
    });
    upstreamMultiplex.pipe(downstreamMultiplex).pipe(upstreamMultiplex);

    var upstreamConnection = upstreamMultiplex.connect({id: 'anAwesomeID'});
  });

  it('should error if the upstream multiplex already has a connection with the requested name', function(done) {
    var upstreamMultiplex = new MultiplexStream();
    var downstreamMultiplex = new MultiplexStream(function(downstreamConnection) {
      expect(downstreamConnection.id).to.equal('anAwesomeID');
      upstreamMultiplex.connect({id: 'anAwesomeID'}, function() {
        expect().fail('Should not have received connect event');
      }).on('error', function(error) {
        expect(error.message).to.equal('Connection already exists');
        done();
      });
    });
    upstreamMultiplex.pipe(downstreamMultiplex).pipe(upstreamMultiplex);

    var upstreamConnection = upstreamMultiplex.connect({id: 'anAwesomeID'});
  });

  it('should timeout if no multiplex responds to connect requests', function(done) {
    var upstreamMultiplex = new MultiplexStream({
      connectTimeout: 500
    });
    var upstreamConnection = upstreamMultiplex.connect().on('error', function(error) {
      expect(error.message).to.equal('Connect request timed out');
      done();
    });
  });

  it('should timeout connect requests if the downstream multiplex already has a connection with the requested name as multicasting to more than one multiplex is not a supported use case', function(done) {
    var upstreamMultiplex = new MultiplexStream();
    var downstreamMultiplex = new MultiplexStream(function(downstreamConnection) {
      expect(downstreamConnection.id).to.equal('anAwesomeID');
      var anotherUpstreamMultiplex = new MultiplexStream({
        connectTimeout: 500
      });
      anotherUpstreamMultiplex.pipe(downstreamMultiplex).pipe(anotherUpstreamMultiplex);
      anotherUpstreamMultiplex.connect({id: 'anAwesomeID'}, function() {
        expect().fail('Should not have received connect event');
      }).on('error', function(error) {
        expect(error.message).to.equal('Connect request timed out');
        done();
      });
    });
    upstreamMultiplex.pipe(downstreamMultiplex).pipe(upstreamMultiplex);

    var upstreamConnection = upstreamMultiplex.connect({id: 'anAwesomeID'});
  });

  it('should end tunnel streams cleanly when the multiplex stream ends', function(done) {
    var checklist = new Checklist([
      'Hello, downstream',
      'Hello, upstream',
      'upstreamConnection end',
      'upstreamMultiplex end',
      'that\'s all',
      'downstreamConnection end',
      'downstreamMultiplex end'
    ], {
      ordered: true
    }, done);

    var upstreamMultiplex = new MultiplexStream().on('end', function() {
      checklist.check('upstreamMultiplex end');
    });

    var downstreamMultiplex = new MultiplexStream(function(downstreamConnection) {
      downstreamConnection.setEncoding();
      downstreamConnection.on('data', function(data) {
        checklist.check(data);
        if (data === 'Hello, downstream') {
          downstreamConnection.write('Hello, upstream');
        }
      });
      downstreamConnection.on('end', function(data) {
        checklist.check('downstreamConnection end');
      });
    }).on('end', function() {
      checklist.check('downstreamMultiplex end');
    });

    upstreamMultiplex.pipe(downstreamMultiplex).pipe(upstreamMultiplex);

    var upstreamConnection = upstreamMultiplex.connect(function() {
      upstreamConnection.setEncoding();
      upstreamConnection.on('data', function(data) {
        checklist.check(data);
        // this might be the important write
        // it should not be lost by ending the
        // multiplex stream and it should arrive
        // before the downstream connection ends
        upstreamConnection.write('that\'s all');
        upstreamMultiplex.end();
      });
      upstreamConnection.on('end', function() {
        checklist.check('upstreamConnection end');
      });
      upstreamConnection.write('Hello, downstream');
    });
  });
});
