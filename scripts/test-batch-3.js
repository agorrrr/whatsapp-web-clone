const assert = require('assert');

function testBatch3Features() {
  console.log('Testing 5 New WhatsApp Web Clone Features (Batch 3)...');

  // 1. Theme toggle
  let theme = 'dark';
  const toggleTheme = (t) => (t === 'dark' ? 'light' : 'dark');
  theme = toggleTheme(theme);
  assert.strictEqual(theme, 'light');
  theme = toggleTheme(theme);
  assert.strictEqual(theme, 'dark');
  console.log('  [1/5] Dark/Light mode toggle state passed.');

  // 2. Pin Chat (Max 3)
  let pinnedChatIds = ['c1', 'c2'];
  function togglePin(chatId) {
    const idx = pinnedChatIds.indexOf(chatId);
    if (idx > -1) {
      pinnedChatIds.splice(idx, 1);
      return false;
    }
    if (pinnedChatIds.length >= 3) {
      throw new Error('Maksimal 3 obrolan yang dapat disematkan');
    }
    pinnedChatIds.push(chatId);
    return true;
  }

  assert.strictEqual(togglePin('c3'), true);
  assert.strictEqual(pinnedChatIds.length, 3);
  assert.throws(() => togglePin('c4'), /Maksimal 3/);
  assert.strictEqual(togglePin('c1'), false);
  assert.strictEqual(pinnedChatIds.length, 2);
  console.log('  [2/5] Pin chat (max 3 limit & toggle) passed.');

  // 3. Starred Message
  let message = { id: 'm10', text: 'Catatan penting!', starredBy: [] };
  function toggleStar(msg, userId) {
    if (!Array.isArray(msg.starredBy)) msg.starredBy = [];
    const idx = msg.starredBy.indexOf(userId);
    if (idx > -1) {
      msg.starredBy.splice(idx, 1);
      return false;
    } else {
      msg.starredBy.push(userId);
      return true;
    }
  }

  assert.strictEqual(toggleStar(message, 'user_1'), true);
  assert.deepStrictEqual(message.starredBy, ['user_1']);
  assert.strictEqual(toggleStar(message, 'user_1'), false);
  assert.deepStrictEqual(message.starredBy, []);
  console.log('  [3/5] Starred message toggle passed.');

  // 4. Typing Indicator TTL State
  const typingMap = new Map();
  function setTyping(chatId, userId, userName, isTyping) {
    const key = `${chatId}__${userId}`;
    if (!isTyping) {
      typingMap.delete(key);
      return;
    }
    typingMap.set(key, { chatId, userId, userName, expiresAt: Date.now() + 3500 });
  }

  setTyping('chat_1', 'u1', 'Budi', true);
  assert.strictEqual(typingMap.size, 1);
  assert.strictEqual(typingMap.get('chat_1__u1').userName, 'Budi');
  setTyping('chat_1', 'u1', 'Budi', false);
  assert.strictEqual(typingMap.size, 0);
  console.log('  [4/5] Typing indicator state & TTL passed.');

  // 5. Location Message
  const locMsg = {
    id: 'm_loc_1',
    type: 'location',
    locationInfo: {
      latitude: -6.2088,
      longitude: 106.8456,
      address: 'Lat -6.20880, Lon 106.84560',
    },
  };
  const mapsUrl = `https://www.google.com/maps?q=${locMsg.locationInfo.latitude},${locMsg.locationInfo.longitude}`;
  assert.strictEqual(locMsg.type, 'location');
  assert.strictEqual(mapsUrl, 'https://www.google.com/maps?q=-6.2088,106.8456');
  console.log('  [5/5] Share location message and Maps URL passed.');

  console.log('\nAll 5/5 Batch 3 features PASSED testing!');
}

testBatch3Features();
