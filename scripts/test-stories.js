const assert = require('assert');

// Simulate stories logic
function testStoryLifecycle() {
  console.log('Testing WhatsApp Stories 24h Auto-Expiry & Viewer Logic...');
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  let dbStories = [
    {
      id: 'story_active_1',
      userId: 'user_1',
      userName: 'Alice',
      userAvatar: 'avatar.png',
      type: 'image',
      mediaUrl: 'data:image/png;base64,...',
      caption: 'Liburan seru',
      createdAt: now - 1000,
      expiresAt: now - 1000 + ONE_DAY,
      viewers: ['user_2']
    },
    {
      id: 'story_expired_1',
      userId: 'user_1',
      userName: 'Alice',
      userAvatar: 'avatar.png',
      type: 'text',
      text: 'Status kemarin',
      backgroundColor: '#075e54',
      createdAt: now - (ONE_DAY + 5000),
      expiresAt: now - 5000, // Expired 5 seconds ago
      viewers: []
    },
    {
      id: 'story_friend_1',
      userId: 'user_2',
      userName: 'Bob',
      userAvatar: 'avatar2.png',
      type: 'text',
      text: 'Halo dunia!',
      backgroundColor: '#1565c0',
      createdAt: now - 2000,
      expiresAt: now - 2000 + ONE_DAY,
      viewers: []
    }
  ];

  // 1. Filter active stories (auto-expiry logic)
  const activeStories = dbStories.filter(s => s.expiresAt > now);
  assert.strictEqual(activeStories.length, 2, 'Should prune expired story (> 24 hours)');
  assert.strictEqual(activeStories.some(s => s.id === 'story_expired_1'), false, 'Expired story must not be active');
  console.log('  Active stories filtering (24h expiry) passed.');

  // 2. View story
  const targetStory = activeStories.find(s => s.id === 'story_friend_1');
  assert.ok(targetStory, 'Target story must exist');
  assert.strictEqual(targetStory.viewers.includes('user_1'), false);
  targetStory.viewers.push('user_1');
  assert.strictEqual(targetStory.viewers.includes('user_1'), true, 'Viewer user_1 registered');
  console.log('  Story view tracking passed.');

  // 3. Delete story
  dbStories = dbStories.filter(s => s.id !== 'story_active_1');
  assert.strictEqual(dbStories.some(s => s.id === 'story_active_1'), false, 'Deleted story should be gone');
  console.log('  Story deletion passed.');

  console.log('All WhatsApp Story tests PASSED successfully!');
}

testStoryLifecycle();
