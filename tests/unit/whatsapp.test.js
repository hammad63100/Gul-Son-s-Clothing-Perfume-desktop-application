const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWhatsAppNumber, buildWhatsAppDesktopUrl } = require('../../src/utils/whatsapp');

test.describe('WhatsApp Desktop link helper', () => {
  test('normalizes Pakistani local, international and 00-prefixed phone numbers', () => {
    assert.equal(normalizeWhatsAppNumber('0300-1234567'), '923001234567');
    assert.equal(normalizeWhatsAppNumber('3001234567'), '923001234567');
    assert.equal(normalizeWhatsAppNumber('+92 300 1234567'), '923001234567');
    assert.equal(normalizeWhatsAppNumber('0092 300 1234567'), '923001234567');
  });

  test('rejects missing, too-short and overly long WhatsApp numbers', () => {
    assert.throws(() => normalizeWhatsAppNumber(''), /valid customer WhatsApp number/);
    assert.throws(() => normalizeWhatsAppNumber('12345'), /valid customer WhatsApp number/);
    assert.throws(() => normalizeWhatsAppNumber('1234567890123456'), /valid customer WhatsApp number/);
  });

  test('builds a Desktop protocol URL and safely encodes the message', () => {
    const url = buildWhatsAppDesktopUrl('0300 1234567', 'Hello & thanks?');
    assert.equal(url, 'whatsapp://send?phone=923001234567&text=Hello%20%26%20thanks%3F');
  });
});
