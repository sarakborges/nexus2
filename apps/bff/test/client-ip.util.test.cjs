const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { getClientIp } = require('../dist/client-ip.util.js')

test('prefers Vercel trusted forwarding metadata over generic forwarded headers', () => {
  assert.equal(getClientIp({
    headers: {
      'x-vercel-forwarded-for': '203.0.113.10, 10.0.0.1',
      'x-forwarded-for': '198.51.100.20'
    },
    ip: '192.0.2.1'
  }), '203.0.113.10')
})

test('uses the first address from the forwarded chain when Vercel metadata is absent', () => {
  assert.equal(getClientIp({
    headers: { 'x-forwarded-for': '198.51.100.20, 10.0.0.2' },
    ip: '192.0.2.1'
  }), '198.51.100.20')
})


test('uses the self-hosted forwarded address when Vercel metadata is explicitly empty', () => {
  assert.equal(getClientIp({
    headers: {
      'x-vercel-forwarded-for': '',
      'x-forwarded-for': '203.0.113.10, 10.0.0.2'
    },
    ip: '192.0.2.1',
    socket: { remoteAddress: '172.18.0.2' }
  }), '203.0.113.10')
})

test('does not trust generic forwarded headers when non-empty Vercel metadata is invalid', () => {
  assert.equal(getClientIp({
    headers: {
      'x-vercel-forwarded-for': 'not-an-ip',
      'x-forwarded-for': '203.0.113.10'
    },
    ip: '192.0.2.1',
    socket: { remoteAddress: '172.18.0.2' }
  }), '192.0.2.1')
})

test('falls back to the socket address and normalizes invalid input to the shared unknown bucket', () => {
  assert.equal(getClientIp({
    headers: { 'x-forwarded-for': 'not-an-ip' },
    ip: undefined,
    socket: { remoteAddress: '2001:db8::10' }
  }), '2001:db8::10')
  assert.equal(getClientIp({
    headers: { 'x-forwarded-for': 'not-an-ip' },
    ip: undefined,
    socket: { remoteAddress: 'also-not-an-ip' }
  }), 'unknown')
})


test('self-hosted proxy overwrites untrusted forwarded-IP headers', () => {
  const nginx = readFileSync(
    join(__dirname, '../../front/nginx.conf'),
    'utf8'
  )

  assert.ok(nginx.includes('proxy_set_header X-Forwarded-For $remote_addr;'))
  assert.ok(nginx.includes('proxy_set_header X-Vercel-Forwarded-For ""'))
  assert.equal(nginx.includes('proxy_add_x_forwarded_for'), false)
})
