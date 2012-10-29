var util = require('util'),
    uuid = require('node-uuid'),
    EventEmitter = require('events').EventEmitter,
    Stream = require('stream');

var END_EVENT = 0,
    DATA_EVENT = 1;

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
          self.emit('event', event);
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
          self.emit('event', event);
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
  
  self.write = function(data, encoding) {
    var buffer = Buffer.isBuffer(data) ? data : new Buffer(data, encoding);
    streamMultiplexStream.emit('data', encodeEvent({
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
    streamMultiplexStream.emit('data', encodeEvent({
      tunnelId: id,
      type: END_EVENT
    }));
    streamMultiplexStream.delete(id);
    self.emit('end');
  };
}
util.inherits(Tunnel, Stream);

function MultiplexStream(callback) {
  var self = this,
      decoder = new Decoder(),
      tunnels = {};
  
  self.readable = true;
  self.writable = true;

  if (callback) {
    self.on('connection', callback);
  }

  function registerTunnel(id, tunnel) {
    tunnels[id] = tunnel;
    tunnel.on('end', function() {
      delete tunnels[id];
    });
  }

  decoder.on('event', function(event) {
    var tunnel = tunnels[event.tunnelId];
    if (event.type === END_EVENT) {
      if (tunnel) {
        delete tunnels[event.tunnelId];
        tunnel.emit('end');
      }
    } else if (event.type === DATA_EVENT) {
      if (!tunnel) {
        tunnel = new Tunnel(event.tunnelId, self);
        registerTunnel(event.tunnelId, tunnel);
        self.emit('connection', tunnel);
      }
      if (tunnel.encoding) {
        event.buffer = event.buffer.toString(tunnel.encoding);
      }
      tunnel.emit('data', event.buffer);
    }
  });

  self.createStream = function(callback){
    var id = uuid.v1();
    var tunnel = new Tunnel(id, self);
    registerTunnel(id, tunnel);
    return tunnel;
  };

  self.delete = function(id) {
    delete tunnels[id];
  };

  self.write = function(buffer) {
    decoder.decode(buffer);
  };
  
  self.end = function() {
    Object.keys(tunnels).forEach(function(id) {
      tunnels[id].emit('end');
      delete tunnels[id];
    });
    self.emit('end');
  };
}
util.inherits(MultiplexStream, Stream);

module.exports = MultiplexStream;