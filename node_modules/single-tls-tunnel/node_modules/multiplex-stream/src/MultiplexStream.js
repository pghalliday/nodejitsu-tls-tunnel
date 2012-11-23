var util = require('util'),
    uuid = require('node-uuid'),
    EventEmitter = require('events').EventEmitter,
    Stream = require('stream');

var END_EVENT = 0,
    DATA_EVENT = 1,
    CONNECTION_EVENT = 2,
    CONNECT_EVENT = 3;

var DEFAULT_CONNECT_TIMEOUT = 3000;

// force all events to be asynchronous
function emitEvent(emitter, event, data) {    
  process.nextTick(function() {
    emitter.emit(event, data);
  });
}

function encodeEvent(event) {
  var tunnelIdBuffer = new Buffer(event.tunnelId, 'utf8');
  var tunnelIdLength = tunnelIdBuffer.length;
  var length = 2 + tunnelIdLength + (event.type === DATA_EVENT ? event.buffer.length + 4 : 0);
  var encodedBuffer = new Buffer(length);
  encodedBuffer.writeUInt8(tunnelIdLength, 0);
  tunnelIdBuffer.copy(encodedBuffer, 1);
  encodedBuffer.writeUInt8(event.type, tunnelIdLength + 1);
  if (event.type === DATA_EVENT) {
    var eventBufferLength = event.buffer.length;
    encodedBuffer.writeUInt32BE(eventBufferLength, tunnelIdLength + 2);
    event.buffer.copy(encodedBuffer, tunnelIdLength + 6);
  }
  return encodedBuffer;
}

function Decoder() {
  var READING_ID_LENGTH = 0,
      READING_ID = 1,
      READING_EVENT_TYPE = 2,
      READING_DATA_LENGTH = 3,
      READING_DATA = 4;

  var self = this,
      event = {},
      state = READING_ID_LENGTH,
      idLength = 0,
      dataLength = 0,
      dataLengthBytes = 0,
      dataOffset = 0;

  function decodeFromOffset(buffer, offset) {
    var remainder = buffer.length - offset;
    switch (state) {
      case READING_ID_LENGTH:
        idLength = buffer.readUInt8(offset);
        event.tunnelId = '';
        state = READING_ID;
        offset++;
        break;
      case READING_ID:
        if (remainder < idLength) {
          event.tunnelId += buffer.toString('utf8', offset, offset + remainder);
          idLength -= remainder;
          offset += remainder;
        } else {
          event.tunnelId += buffer.toString('utf8', offset, offset + idLength);
          state = READING_EVENT_TYPE;
          offset += idLength;
        }
        break;
      case READING_EVENT_TYPE:
        event.type = buffer.readUInt8(offset);
        if (event.type === DATA_EVENT) {
          dataLength = 0;
          dataLengthBytes = 0;
          state = READING_DATA_LENGTH;
        } else {
          idLength = 0;
          state = READING_ID_LENGTH;
          emitEvent(self, 'event', event);
          // start a new event as the last one will be used asynchronously
          event = {};
        }
        offset++;
        break;
      case READING_DATA_LENGTH:
        dataLength *= 256;
        dataLength += buffer.readUInt8(offset);
        dataLengthBytes++;
        if (dataLengthBytes === 4) {
          event.buffer = new Buffer(dataLength);
          dataOffset = 0;
          state = READING_DATA;
        }
        offset++;
        break;
      case READING_DATA:
        if (remainder < dataLength) {
          buffer.copy(event.buffer, dataOffset, offset);
          dataLength -= remainder;
          dataOffset += remainder;
          offset += remainder;
        } else {
          buffer.copy(event.buffer, dataOffset, offset, offset + dataLength);
          idLength = 0;
          state = READING_ID_LENGTH;
          emitEvent(self, 'event', event);
          // start a new event as the last one will be used asynchronously
          event = {};
          offset += dataLength;
        }
        break;
    }
    return offset;
  }

  self.decode = function(buffer) {
    var offset = 0;
    while (offset < buffer.length) {
      offset = decodeFromOffset(buffer, offset);      
    }
  };
}
util.inherits(Decoder, EventEmitter);

function Tunnel(id, streamMultiplexStream) {
  var self = this;
  
  self.readable = true;
  self.writable = true;

  self.id = id;
  
  self.write = function(data, encoding) {
    var buffer = Buffer.isBuffer(data) ? data : new Buffer(data, encoding);
    emitEvent(streamMultiplexStream, 'data', encodeEvent({
      tunnelId: id,
      type: DATA_EVENT,
      buffer: buffer
    }));
  };
  
  self.setEncoding = function(encoding) {
    self.encoding = encoding ? encoding : 'utf8';
  };
  
  self.end = function(data, encoding) {
    if (data) {
      self.write(data, encoding);
    }
    emitEvent(streamMultiplexStream, 'data', encodeEvent({
      tunnelId: id,
      type: END_EVENT
    }));
    streamMultiplexStream.delete(id);
    emitEvent(self, 'end');
  };
}
util.inherits(Tunnel, Stream);

function MultiplexStream(multiplexOptions, callback) {
  var self = this,
      decoder = new Decoder(),
      tunnels = {};
  
  self.readable = true;
  self.writable = true;

  if (typeof multiplexOptions === 'function') {
    callback = multiplexOptions;
    multiplexOptions = null;
  }

  multiplexOptions = multiplexOptions || {};

  if (callback) {
    self.on('connection', callback);
  }

  function registerTunnel(tunnel) {
    tunnels[tunnel.id] = tunnel;
    tunnel.on('end', function() {
      delete tunnels[tunnel.id];
    });
  }

  decoder.on('event', function(event) {
    var tunnel = tunnels[event.tunnelId];
    if (event.type === END_EVENT) {
      if (tunnel) {
        delete tunnels[event.tunnelId];
        emitEvent(tunnel, 'end');
      }
    } else if (event.type === DATA_EVENT) {
      if (tunnel) {
        if (tunnel.encoding) {
          event.buffer = event.buffer.toString(tunnel.encoding);
        }
        emitEvent(tunnel, 'data', event.buffer);
      }
    } else if (event.type === CONNECTION_EVENT) {
      // ignore connection events if the tunnel already exists - this is not supported!
      if (!tunnel) {
        tunnel = new Tunnel(event.tunnelId, self);
        registerTunnel(tunnel);

        emitEvent(self, 'data', encodeEvent({
          tunnelId: tunnel.id,
          type: CONNECT_EVENT
        }));

        emitEvent(self, 'connection', tunnel);
      }
    } else if (event.type === CONNECT_EVENT) {
      if (tunnel) {
        clearTimeout(tunnel.connectTimeout);
        emitEvent(tunnel, 'connect');
      }
    }
  });

  self.connect = function(connectOptions, connectListener){
    if (typeof connectOptions === 'function') {
      connectListener = connectOptions;
      connectOptions = null;      
    }
    connectOptions = connectOptions || {};
    var id = connectOptions.id || uuid.v1();

    var tunnel = new Tunnel(id, self);
    if (connectListener) {
      tunnel.on('connect', connectListener);
    }

    if (tunnels[id]) {
      emitEvent(tunnel, 'error', new Error('Connection already exists'));      
    } else {
      tunnel.connectTimeout = setTimeout(function() {
        delete tunnels[id];
        emitEvent(tunnel, 'error', new Error('Connect request timed out'));      
      }, multiplexOptions.connectTimeout || DEFAULT_CONNECT_TIMEOUT);
      registerTunnel(tunnel);
      emitEvent(self, 'data', encodeEvent({
        tunnelId: id,
        type: CONNECTION_EVENT
      }));      
    }

    return tunnel;
  };

  self.delete = function(id) {
    delete tunnels[id];
  };

  self.write = function(buffer) {
    decoder.decode(buffer);
  };
  
  self.end = function() {
    // defer this to the next tick to ensure
    // that all events happen in the right order
    process.nextTick(function() {
      Object.keys(tunnels).forEach(function(id) {
        emitEvent(tunnels[id], 'end');
        delete tunnels[id];
      });
      emitEvent(self, 'end');
    });
  };
}
util.inherits(MultiplexStream, Stream);

module.exports = MultiplexStream;
