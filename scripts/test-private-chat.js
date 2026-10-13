const assert = require('assert');

// In-memory test of private routing logic
const users = [];
const messages = [];

function register(name, username, identifier, pin) {
  const cleanUser = username.trim().toLowerCase().replace(/^@/, '');
  if (users.find(u => u.username === cleanUser)) {
    throw new Error('Username already exists');
  }
  const user = { id: `usr_${Date.now()}_${Math.random()}`, name, username: cleanUser, identifier, pin };
  users.push(user);
  return user;
}

function sendMessage(senderId, recipientId, text) {
  const chatId = [senderId, recipientId].sort().join('__');
  const msg = {
    id: `m_${Date.now()}_${Math.random()}`,
    chatId,
    senderId,
    recipientId,
    text,
    timestamp: '12:00',
    status: 'delivered'
  };
  messages.push(msg);
  return msg;
}

function getMessagesForUser(userId) {
  return messages.filter(m => m.senderId === userId || m.recipientId === userId);
}

function getMessagesBetween(userA, userB) {
  const chatId = [userA, userB].sort().join('__');
  return messages.filter(m => m.chatId === chatId);
}

console.log('Testing Private Chat System...');

// 1. Register 3 distinct users
const userA = register('Reza Maulana', 'reza', '08123456789', '1234');
const userB = register('Siti Rahma', 'siti', 'siti@gmail.com', '1234');
const userC = register('Budi Santoso', 'budi', 'budi@gmail.com', '1234');

assert.strictEqual(userA.username, 'reza');
assert.strictEqual(userB.username, 'siti');
assert.strictEqual(userC.username, 'budi');

// Check duplicate username rejected
assert.throws(() => register('Another Reza', 'reza', 'other@mail.com', '1234'), /Username already exists/);

// 2. User A sends a private message to User B
const privateMsg = sendMessage(userA.id, userB.id, 'Halo Siti, ini pesan rahasia hanya untukmu!');

// 3. User B receives the message
const userBMessages = getMessagesForUser(userB.id);
assert.strictEqual(userBMessages.length, 1);
assert.strictEqual(userBMessages[0].text, 'Halo Siti, ini pesan rahasia hanya untukmu!');

// 4. User C MUST NOT receive User A's private message
const userCMessages = getMessagesForUser(userC.id);
assert.strictEqual(userCMessages.length, 0, 'User C must have 0 messages (strict 1-on-1 isolation)');

// 5. Query chat between A and B
const chatAB = getMessagesBetween(userA.id, userB.id);
assert.strictEqual(chatAB.length, 1);

// Query chat between B and C
const chatBC = getMessagesBetween(userB.id, userC.id);
assert.strictEqual(chatBC.length, 0);

console.log('All private chat isolation checks PASSED successfully!');
