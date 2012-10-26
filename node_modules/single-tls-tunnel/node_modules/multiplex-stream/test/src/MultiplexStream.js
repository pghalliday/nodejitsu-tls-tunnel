var expect = require('chai').expect,
    Checklist = require('checklist'),
    Sink = require('pipette').Sink,
    Dropper = require('pipette').Dropper,
    MultiplexStream = require('../../');
    
describe('MultiplexStream', function() {
  it('should provide multiple readable/writable streams over a single carrier stream', function(done) {
    var checklist = new Checklist([
      'downstream connected',
      'downstream connected',
      'Hello, downstream. This is upstream1',
      'Hello, downstream. This is upstream2',
      'Hello, upstream1',
      'Hello, upstream2',
      'end downstream',
      'end downstream',
      'end upstream1',
      'end upstream2'
    ], done);
    var upstreamMultiplex = new MultiplexStream();
    var downstreamMultiplex = new MultiplexStream(function(downstreamConnection) {
      checklist.check('downstream connected');
      downstreamConnection.setEncoding();
      downstreamConnection.on('data', function(data) {
        checklist.check(data);
        if (data === 'Hello, downstream. This is upstream1') {
          downstreamConnection.write('Hello, upstream1');
        } else if (data === 'Hello, downstream. This is upstream2') {
          downstreamConnection.write('Hello, upstream2');
        }
      });
      downstreamConnection.on('end', function(data) {
        checklist.check('end downstream');
      });
    });
    
    upstreamMultiplex.pipe(downstreamMultiplex);
    downstreamMultiplex.pipe(upstreamMultiplex);
    
    var upstreamConnection1 = upstreamMultiplex.createStream();
    upstreamConnection1.setEncoding();
    upstreamConnection1.on('data', function(data) {
      checklist.check(data);
      upstreamConnection1.end();        
    });
    upstreamConnection1.on('end', function(data) {
      checklist.check('end upstream1');        
    });

    var upstreamConnection2 = upstreamMultiplex.createStream();
    upstreamConnection2.setEncoding();
    upstreamConnection2.on('data', function(data) {
      checklist.check(data);
      upstreamConnection2.end();        
    });
    upstreamConnection2.on('end', function(data) {
      checklist.check('end upstream2');        
    });

    upstreamConnection1.write('Hello, downstream. This is upstream1');
    upstreamConnection2.write('Hello, downstream. This is upstream2');
  });

  it('should behave correctly with intermediate flow control where data events may get merged', function(done) {
    var checklist = new Checklist([
      'Hello, downstream',
      'How are you doing?'
    ], done);
    var upstreamMultiplex = new MultiplexStream();
    var downstreamMultiplex = new MultiplexStream(function(downstreamConnection) {
      downstreamConnection.setEncoding();
      downstreamConnection.on('data', function(data) {
        checklist.check(data);
      });
    });

    // The Sink buffers all the data events and then emits a single data
    // event with all the data glued together
    var downstreamSink = new Sink(upstreamMultiplex);
    downstreamSink.pipe(downstreamMultiplex);

    var upstreamConnection = upstreamMultiplex.createStream();
    upstreamConnection.write('Hello, downstream');
    upstreamConnection.write('How are you doing?');
    upstreamMultiplex.end();
  });

  it('should behave correctly with intermediate flow control where data events may get split', function(done) {
    var checklist = new Checklist([
      'Hello, downstream',
      'How are you doing?'
    ], done);
    var upstreamMultiplex = new MultiplexStream();
    var downstreamMultiplex = new MultiplexStream(function(downstreamConnection) {
      downstreamConnection.setEncoding();
      downstreamConnection.on('data', function(data) {
        checklist.check(data);
      });
    });

    // The Dropper splits each data event into lots of single byte data events
    var downstreamDropper = new Dropper(upstreamMultiplex);
    downstreamDropper.pipe(downstreamMultiplex);

    var upstreamConnection = upstreamMultiplex.createStream();
    upstreamConnection.write('Hello, downstream');
    upstreamConnection.write('How are you doing?');
    upstreamMultiplex.end();
  });
});
