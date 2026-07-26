const { parseMethodCall, serializeResponse, serializeFault } = require('../lib/xmlrpc');

describe('lib/xmlrpc: parseMethodCall', () => {
  test('parses a simple call with string params', async () => {
    const body = `<?xml version="1.0"?>
<methodCall>
  <methodName>metaWeblog.getCategories</methodName>
  <params>
    <param><value><string>1</string></value></param>
    <param><value><string>alice</string></value></param>
    <param><value><string>secret</string></value></param>
  </params>
</methodCall>`;
    const { methodName, params } = await parseMethodCall(body);
    expect(methodName).toBe('metaWeblog.getCategories');
    expect(params).toEqual(['1', 'alice', 'secret']);
  });

  test('parses a call with an int param', async () => {
    const body = `<?xml version="1.0"?>
<methodCall>
  <methodName>metaWeblog.getRecentPosts</methodName>
  <params>
    <param><value><string>1</string></value></param>
    <param><value><string>alice</string></value></param>
    <param><value><string>secret</string></value></param>
    <param><value><int>5</int></value></param>
  </params>
</methodCall>`;
    const { methodName, params } = await parseMethodCall(body);
    expect(methodName).toBe('metaWeblog.getRecentPosts');
    expect(params).toEqual(['1', 'alice', 'secret', 5]);
  });

  test('parses a call with a struct param (newPost-shaped)', async () => {
    const body = `<?xml version="1.0"?>
<methodCall>
  <methodName>metaWeblog.newPost</methodName>
  <params>
    <param><value><string>1</string></value></param>
    <param><value><string>alice</string></value></param>
    <param><value><string>secret</string></value></param>
    <param><value><struct>
      <member><name>title</name><value><string>Hello</string></value></member>
      <member><name>description</name><value><string>Body</string></value></member>
    </struct></value></param>
    <param><value><boolean>1</boolean></value></param>
  </params>
</methodCall>`;
    const { methodName, params } = await parseMethodCall(body);
    expect(methodName).toBe('metaWeblog.newPost');
    expect(params[3]).toEqual({ title: 'Hello', description: 'Body' });
    expect(params[4]).toBe(true);
  });

  test('rejects malformed XML', async () => {
    await expect(parseMethodCall('<?xml version="1.0"?><methodCall><oops')).rejects.toBeDefined();
  });
});

describe('lib/xmlrpc: serializeResponse', () => {
  test('serializes a string result', () => {
    const xml = serializeResponse('post-abc123');
    expect(xml).toMatch(/^<\?xml/);
    expect(xml).toContain('<methodResponse>');
    expect(xml).toContain('<value><string>post-abc123</string></value>');
  });

  test('serializes an array of structs (getCategories shape)', () => {
    const xml = serializeResponse([
      { categoryName: 'long' },
      { categoryName: 'short' },
      { categoryName: 'photo' },
    ]);
    expect(xml).toContain('<array>');
    expect(xml).toContain('<name>categoryName</name>');
    expect(xml).toContain('<string>long</string>');
    expect(xml).toContain('<string>short</string>');
    expect(xml).toContain('<string>photo</string>');
  });

  test('serializes a boolean true (editPost shape)', () => {
    const xml = serializeResponse(true);
    expect(xml).toContain('<boolean>1</boolean>');
  });
});

describe('lib/xmlrpc: serializeFault', () => {
  test('serializes an auth failure', () => {
    const xml = serializeFault({
      faultCode: 403,
      faultString: 'Authentication failed. Incorrect username or password.',
    });
    expect(xml).toContain('<fault>');
    expect(xml).toContain('<name>faultCode</name>');
    expect(xml).toContain('<int>403</int>');
    expect(xml).toContain('Authentication failed');
  });
});

describe('lib/xmlrpc: round-trip', () => {
  test('serialize(parse) preserves method + params for a struct call', async () => {
    // Build a call, parse it, then re-serialize as a response — proves the
    // types survive the round-trip.
    const originalStruct = { title: 'T', description: 'body', categories: ['long'] };
    const responseXml = serializeResponse(originalStruct);
    // Wrap as a methodCall to reuse the parser
    const callXml = responseXml
      .replace('<methodResponse>', '<methodCall><methodName>x</methodName><params>')
      .replace('</methodResponse>', '</params></methodCall>');
    const parsed = await parseMethodCall(callXml);
    expect(parsed.params[0]).toEqual(originalStruct);
  });
});
