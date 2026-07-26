const { Readable } = require('stream');
const Deserializer = require('xmlrpc/lib/deserializer');
const serializer = require('xmlrpc/lib/serializer');

/**
 * Parse an XML-RPC method call from a Buffer or string.
 * @param {Buffer|string} body
 * @returns {Promise<{methodName: string, params: any[]}>}
 */
function parseMethodCall(body) {
  return new Promise((resolve, reject) => {
    const stream = Readable.from([body]);
    const deserializer = new Deserializer();
    deserializer.deserializeMethodCall(stream, (err, methodName, params) => {
      if (err) reject(err);
      else resolve({ methodName, params: params || [] });
    });
  });
}

function serializeResponse(value) {
  return serializer.serializeMethodResponse(value);
}

function serializeFault(fault) {
  return serializer.serializeFault(fault);
}

module.exports = { parseMethodCall, serializeResponse, serializeFault };
