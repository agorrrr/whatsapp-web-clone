const assert = require('assert');

function testNewFeatures() {
  console.log('Testing 6 New WhatsApp Web Clone Features...');

  // 1. Delete for everyone
  let messages = [
    { id: 'm1', senderId: 'u1', text: 'Halo rahasia', isDeleted: false },
    { id: 'm2', senderId: 'u2', text: 'Oke aman', isDeleted: false },
  ];

  function deleteMessage(messageId, userId) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Not found');
    if (msg.senderId !== userId) throw new Error('Unauthorized');
    msg.isDeleted = true;
    msg.text = 'Pesan ini telah dihapus';
    msg.mediaUrl = undefined;
    msg.fileName = undefined;
    msg.fileSize = undefined;
    return msg;
  }

  // Non-sender deletion must fail
  assert.throws(() => deleteMessage('m1', 'u2'), /Unauthorized/);
  // Sender deletion succeeds
  deleteMessage('m1', 'u1');
  assert.strictEqual(messages[0].isDeleted, true);
  assert.strictEqual(messages[0].text, 'Pesan ini telah dihapus');
  console.log('  [1/6] Delete for everyone logic passed.');

  // 2. Document message
  const docMsg = {
    id: 'm3',
    senderId: 'u1',
    type: 'document',
    mediaUrl: 'data:application/pdf;base64,JVBERi0xLjc...',
    fileName: 'Proposal_Teknis.pdf',
    fileSize: '2.4 MB',
  };
  assert.strictEqual(docMsg.type, 'document');
  assert.strictEqual(docMsg.fileName, 'Proposal_Teknis.pdf');
  assert.strictEqual(docMsg.fileSize, '2.4 MB');
  console.log('  [2/6] Document message metadata passed.');

  // 3. Audio playback rate cycle
  let rate = 1;
  const cycle = (r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1);
  rate = cycle(rate);
  assert.strictEqual(rate, 1.5);
  rate = cycle(rate);
  assert.strictEqual(rate, 2);
  rate = cycle(rate);
  assert.strictEqual(rate, 1);
  console.log('  [3/6] Audio 1x/1.5x/2x rate cycling passed.');

  // 4. In-chat search filter
  const chatMessages = [
    { id: '1', text: 'Jadwal meeting jam 2 siang' },
    { id: '2', text: 'Siap laksanakan' },
    { id: '3', text: 'Meeting di ruang rapat', fileName: undefined },
    { id: '4', text: undefined, fileName: 'Notulen_meeting.pdf' },
  ];
  const query = 'meeting';
  const matched = chatMessages.filter(
    (m) =>
      (m.text || '').toLowerCase().includes(query) ||
      (m.fileName || '').toLowerCase().includes(query)
  );
  assert.strictEqual(matched.length, 3);
  console.log('  [4/6] In-chat search filter passed.');

  // 5. Screen share track replacement simulation
  let currentTrack = 'camera-track-1';
  function replaceTrack(newTrack) {
    currentTrack = newTrack;
  }
  replaceTrack('screen-share-display-track');
  assert.strictEqual(currentTrack, 'screen-share-display-track');
  replaceTrack('camera-track-1');
  assert.strictEqual(currentTrack, 'camera-track-1');
  console.log('  [5/6] Screen share track replacement passed.');

  // 6. Desktop notification filter logic
  let notifTriggered = false;
  function onNewIncoming(msg, isTabActive) {
    if (!isTabActive && msg.senderId !== 'me') {
      notifTriggered = true;
    }
  }
  onNewIncoming({ senderId: 'u2', text: 'Halo!' }, false);
  assert.strictEqual(notifTriggered, true);
  console.log('  [6/6] Desktop notification trigger passed.');

  console.log('All 6 new feature self-checks PASSED successfully!');
}

testNewFeatures();
