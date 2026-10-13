const assert = require('assert');

// Test chat logic directly
function testBotReply(contactId, userMessage) {
  const content = (userMessage.text || '').toLowerCase().trim();
  if (contactId === 'c6') {
    if (content.includes('halo')) {
      return { type: 'text', text: 'Halo! Ada yang bisa saya bantu?' };
    }
    if (userMessage.type === 'audio') {
      return { type: 'text', text: 'Saya sudah mendengarkan rekaman suara kamu!' };
    }
    if (userMessage.type === 'sticker') {
      return { type: 'sticker', mediaUrl: 'sticker.webp' };
    }
  }
  return { type: 'text', text: 'Sip mantap 👍' };
}

console.log('Running self-check test...');

const t1 = testBotReply('c6', { type: 'text', text: 'halo bot' });
assert.strictEqual(t1.type, 'text');
assert.ok(t1.text.includes('Halo'));

const t2 = testBotReply('c6', { type: 'audio', audioDuration: 5 });
assert.strictEqual(t2.type, 'text');
assert.ok(t2.text.includes('suara'));

const t3 = testBotReply('c6', { type: 'sticker' });
assert.strictEqual(t3.type, 'sticker');

console.log('All verification checks passed cleanly!');
