const test = require('node:test')
const assert = require('node:assert/strict')
const {
  getImageDimensions,
  isImageDimensionsWithinLimits
} = require('../dist/api/uploads/uploads.utils.js')

function png(width, height) {
  const bytes = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes)
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12, 'ascii')
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

function gif(width, height) {
  const bytes = Buffer.alloc(10)
  bytes.write('GIF89a', 0, 'ascii')
  bytes.writeUInt16LE(width, 6)
  bytes.writeUInt16LE(height, 8)
  return bytes
}

function webpVp8x(width, height) {
  const bytes = Buffer.alloc(30)
  bytes.write('RIFF', 0, 'ascii')
  bytes.write('WEBP', 8, 'ascii')
  bytes.write('VP8X', 12, 'ascii')
  bytes.writeUInt32LE(10, 16)
  bytes.writeUIntLE(width - 1, 24, 3)
  bytes.writeUIntLE(height - 1, 27, 3)
  return bytes
}

function webpVp8(width, height) {
  const bytes = Buffer.alloc(30)
  bytes.write('RIFF', 0, 'ascii')
  bytes.write('WEBP', 8, 'ascii')
  bytes.write('VP8 ', 12, 'ascii')
  bytes.writeUInt32LE(10, 16)
  bytes.set([0x9d, 0x01, 0x2a], 23)
  bytes.writeUInt16LE(width, 26)
  bytes.writeUInt16LE(height, 28)
  return bytes
}

function webpVp8l(width, height) {
  const bytes = Buffer.alloc(25)
  bytes.write('RIFF', 0, 'ascii')
  bytes.write('WEBP', 8, 'ascii')
  bytes.write('VP8L', 12, 'ascii')
  bytes.writeUInt32LE(5, 16)
  bytes[20] = 0x2f
  const encodedWidth = width - 1
  const encodedHeight = height - 1
  bytes[21] = encodedWidth & 0xff
  bytes[22] = ((encodedWidth >> 8) & 0x3f) | ((encodedHeight & 0x03) << 6)
  bytes[23] = (encodedHeight >> 2) & 0xff
  bytes[24] = (encodedHeight >> 10) & 0x0f
  return bytes
}

function jpeg(width, height) {
  const payload = Buffer.from([
    8,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    3,
    1, 0x11, 0,
    2, 0x11, 0,
    3, 0x11, 0
  ])
  const segment = Buffer.alloc(4 + payload.length)
  segment[0] = 0xff
  segment[1] = 0xc0
  segment.writeUInt16BE(payload.length + 2, 2)
  payload.copy(segment, 4)
  return Buffer.concat([Buffer.from([0xff, 0xd8]), segment])
}

function box(type, payload) {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(payload.length + 8, 0)
  header.write(type, 4, 'ascii')
  return Buffer.concat([header, payload])
}

function avif(width, height) {
  const ftyp = box('ftyp', Buffer.from('avif\\0\\0\\0\\0avif', 'binary'))
  const ispePayload = Buffer.alloc(12)
  ispePayload.writeUInt32BE(width, 4)
  ispePayload.writeUInt32BE(height, 8)
  const properties = box('iprp', box('ipco', box('ispe', ispePayload)))
  const meta = box('meta', Buffer.concat([Buffer.alloc(4), properties]))
  return Buffer.concat([ftyp, meta])
}

test('reads dimensions from JPEG, PNG, GIF, WebP and AVIF headers', () => {
  const cases = [
    [jpeg(640, 480), 'image/jpeg'],
    [png(640, 480), 'image/png'],
    [gif(640, 480), 'image/gif'],
    [webpVp8x(640, 480), 'image/webp'],
    [webpVp8(640, 480), 'image/webp'],
    [webpVp8l(640, 480), 'image/webp'],
    [avif(640, 480), 'image/avif']
  ]

  for (const [bytes, contentType] of cases) {
    assert.deepEqual(getImageDimensions(bytes, contentType), {
      width: 640,
      height: 480
    }, contentType + ' dimensions')
  }
})

test('accepts the maximum configured image pixel budget', () => {
  assert.equal(isImageDimensionsWithinLimits({ width: 8192, height: 2048 }), true)
})

test('rejects images exceeding a side limit or total pixel budget', () => {
  assert.equal(isImageDimensionsWithinLimits({ width: 8193, height: 1 }), false)
  assert.equal(isImageDimensionsWithinLimits({ width: 8192, height: 2049 }), false)
  assert.equal(isImageDimensionsWithinLimits({ width: 0, height: 1 }), false)
})

test('returns no dimensions for truncated or malformed image headers', () => {
  assert.equal(getImageDimensions(png(1, 1).subarray(0, 23), 'image/png'), null)
  assert.equal(getImageDimensions(Buffer.from([0xff, 0xd8, 0xff, 0xc0]), 'image/jpeg'), null)
  assert.equal(getImageDimensions(gif(1, 1).subarray(0, 9), 'image/gif'), null)
  assert.equal(getImageDimensions(webpVp8x(1, 1).subarray(0, 29), 'image/webp'), null)
  assert.equal(getImageDimensions(Buffer.from('not-an-avif'), 'image/avif'), null)
})
