const test = require('node:test')
const assert = require('node:assert/strict')
const { getRichTextPlainText, sanitizeRichText } = require('../dist/api/domain/rich-text-sanitizer.js')

test('keeps rich text formatting and safe HTTP images', () => {
  const clean = sanitizeRichText(
    '<p class="external" style="color:#123;font-weight:bold;text-align:center">' +
      '<strong>Hello</strong> <a href="https://example.com" title="Example">world</a>' +
      '<img src="https://images.example.test/avatar.png" alt="Avatar" onerror="alert(1)">' +
    '</p>'
  )

  assert.match(clean, /<strong>Hello<\/strong>/)
  assert.match(clean, /href="https:\/\/example\.com"/)
  assert.match(clean, /<img[^>]+src="https:\/\/images\.example\.test\/avatar\.png"/)
  assert.match(clean, /alt="Avatar"/)
  assert.match(clean, /style="[^"]*color:#123/)
  assert.match(clean, /font-weight:bold/)
  assert.match(clean, /text-align:center/)
  assert.doesNotMatch(clean, /class=|onerror=/i)
})

test('strips active content, embedded documents, and style or script blocks', () => {
  const clean = sanitizeRichText(
    '<p>Visible text</p>' +
      '<script>alert(1)</script>' +
      '<style>.external { display:none }</style>' +
      '<iframe src="https://evil.example">embedded fallback</iframe>' +
      '<object>object fallback</object>'
  )

  assert.match(clean, /Visible text/)
  assert.doesNotMatch(clean, /alert\(1\)|external|embedded fallback|object fallback/i)
  assert.doesNotMatch(clean, /<script|<style|<iframe|<object/i)
})

test('allows safe inline styles but removes layout, positioning, and class attributes', () => {
  const clean = sanitizeRichText(
    '<p class="layout" id="target" ' +
      'style="color:#123;background-color:rgb(1, 2, 3);font-size:18px;' +
      'position:fixed;display:none;visibility:hidden;z-index:9999;opacity:0;' +
      'width:100vw;margin:999px;background-image:url(https://evil.example/a.png)">' +
      'Text</p>'
  )

  assert.match(clean, /color:#123/)
  assert.match(clean, /background-color:rgb\(1, 2, 3\)/)
  assert.match(clean, /font-size:18px/)
  assert.doesNotMatch(clean, /class=|id=|position|display|visibility|z-index|opacity|width:|margin:|background-image|url\(/i)
})

test('rejects unsafe link and image schemes', () => {
  const clean = sanitizeRichText(
    '<a href="javascript:alert(1)" onclick="run()">unsafe link</a>' +
      '<img src="javascript:alert(1)" onerror="run()" alt="unsafe image">'
  )

  assert.doesNotMatch(clean, /href="javascript:|src="javascript:|onclick=|onerror=/i)
  assert.match(clean, /unsafe link/)
})

test('extracts text for backend character-limit validation', () => {
  assert.equal(getRichTextPlainText('<p>Hello&nbsp;<strong>Nexus</strong></p>'), 'Hello Nexus')
})

test('preserves internal Nexus upload references in image src attributes', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000'
  const reference = '/api/uploads/' + id + '/content'
  const clean = sanitizeRichText('<p><img src="' + reference + '" alt="Uploaded"></p>')

  assert.ok(clean.includes('src="' + reference + '"'))
  assert.match(clean, /alt="Uploaded"/)
})
