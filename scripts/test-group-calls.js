const assert = require('assert');

// In-memory model of group call manager logic to verify full cycle
const activeCalls = new Map();

function startGroupCall({ callerId, callerName, callerAvatar, groupId, groupName, groupMembers, type }) {
  const callId = `call_${Date.now()}_test`;
  const session = {
    id: callId,
    callerId,
    callerName,
    callerAvatar,
    receiverId: groupId,
    receiverName: groupName,
    receiverAvatar: 'https://avatar.test/group.jpg',
    isGroup: true,
    groupId,
    groupMembers: [...groupMembers],
    invitedUsers: [],
    participants: [
      {
        id: callerId,
        name: callerName,
        avatar: callerAvatar,
        joinedAt: Date.now(),
      },
    ],
    meshSignals: {},
    type,
    status: 'ringing',
    updatedAt: Date.now(),
  };
  activeCalls.set(callId, session);
  return session;
}

function getActiveCallForUser(userId) {
  let found = null;
  activeCalls.forEach((call) => {
    if (!found) {
      const isDirect = call.callerId === userId || call.receiverId === userId;
      const isGroupMember = Boolean(
        call.isGroup && (call.groupMembers?.includes(userId) || call.invitedUsers?.includes(userId))
      );
      if ((isDirect || isGroupMember) && (call.status === 'ringing' || call.status === 'connected')) {
        found = call;
      }
    }
  });
  return found;
}

function joinGroupCall(callId, user) {
  const call = activeCalls.get(callId);
  if (!call) throw new Error('Call not found');
  call.status = 'connected';
  if (!call.startedAt) call.startedAt = Date.now();
  if (!call.participants.some((p) => p.id === user.id)) {
    call.participants.push({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      joinedAt: Date.now(),
    });
  }
  call.updatedAt = Date.now();
  return call;
}

function inviteParticipant(callId, targetUserId) {
  const call = activeCalls.get(callId);
  if (!call) throw new Error('Call not found');
  if (!call.groupMembers.includes(targetUserId)) {
    call.groupMembers.push(targetUserId);
  }
  if (!call.invitedUsers.includes(targetUserId)) {
    call.invitedUsers.push(targetUserId);
  }
  call.updatedAt = Date.now();
  return call;
}

function setMeshSignal(callId, signal) {
  const call = activeCalls.get(callId);
  if (!call) throw new Error('Call not found');
  const key = `${signal.fromUserId}_${signal.toUserId}_${signal.type}`;
  call.meshSignals[key] = {
    ...signal,
    updatedAt: Date.now(),
  };
  call.updatedAt = Date.now();
  return call;
}

function endGroupCall(callId, userId) {
  const call = activeCalls.get(callId);
  if (!call) return null;
  // If more than 2 members remain, only remove user
  if (call.participants && call.participants.length > 2) {
    call.participants = call.participants.filter((p) => p.id !== userId);
    call.updatedAt = Date.now();
    return call;
  }
  call.status = 'ended';
  call.updatedAt = Date.now();
  return call;
}

console.log('Testing WebRTC Group Call & Manual Invite logic...');

// 1. User A starts video call in Group "Tim AI"
const members = ['usr_A', 'usr_B', 'usr_C'];
const call = startGroupCall({
  callerId: 'usr_A',
  callerName: 'Reza Maulana',
  callerAvatar: 'https://avatar.test/reza.jpg',
  groupId: 'grp_tim_ai',
  groupName: 'Tim AI',
  groupMembers: members,
  type: 'video',
});

assert.strictEqual(call.isGroup, true);
assert.strictEqual(call.status, 'ringing');
assert.strictEqual(call.participants.length, 1);
assert.strictEqual(call.participants[0].id, 'usr_A');

// 2. Both User B and User C receive incoming group call
const callForB = getActiveCallForUser('usr_B');
const callForC = getActiveCallForUser('usr_C');
assert.ok(callForB, 'User B must see active group call');
assert.ok(callForC, 'User C must see active group call');
assert.strictEqual(callForB.id, call.id);

// 3. User B joins the call
joinGroupCall(call.id, { id: 'usr_B', name: 'Siti Rahma', avatar: 'https://avatar.test/siti.jpg' });
assert.strictEqual(call.status, 'connected');
assert.strictEqual(call.participants.length, 2);

// 4. User C did not pick up yet. User A re-calls / invites User C manually
inviteParticipant(call.id, 'usr_C');
assert.ok(call.invitedUsers.includes('usr_C'), 'User C must be in invitedUsers for re-ringing');

// Non-group member User D is also invited manually into call
inviteParticipant(call.id, 'usr_D');
assert.ok(call.groupMembers.includes('usr_D'));
const callForD = getActiveCallForUser('usr_D');
assert.ok(callForD, 'User D must now receive active call after manual invite');

// 5. User C and D join the call
joinGroupCall(call.id, { id: 'usr_C', name: 'Budi Santoso', avatar: 'https://avatar.test/budi.jpg' });
joinGroupCall(call.id, { id: 'usr_D', name: 'Dewi Lestari', avatar: 'https://avatar.test/dewi.jpg' });
assert.strictEqual(call.participants.length, 4);

// 6. Test Mesh signaling: User B sends offer to User C, C answers
setMeshSignal(call.id, {
  fromUserId: 'usr_B',
  toUserId: 'usr_C',
  type: 'offer',
  sdp: 'v=0\r\no=usr_B_offer...',
});
assert.ok(call.meshSignals['usr_B_usr_C_offer']);
assert.strictEqual(call.meshSignals['usr_B_usr_C_offer'].sdp, 'v=0\r\no=usr_B_offer...');

setMeshSignal(call.id, {
  fromUserId: 'usr_C',
  toUserId: 'usr_B',
  type: 'answer',
  sdp: 'v=0\r\no=usr_C_answer...',
});
assert.ok(call.meshSignals['usr_C_usr_B_answer']);

// 7. User B leaves: 3 members remain, call stays active
endGroupCall(call.id, 'usr_B');
assert.strictEqual(call.status, 'connected');
assert.strictEqual(call.participants.length, 3);
assert.ok(!call.participants.some((p) => p.id === 'usr_B'));

// 8. Call terminates when remaining members leave
endGroupCall(call.id, 'usr_C');
endGroupCall(call.id, 'usr_D');
assert.strictEqual(call.status, 'ended');

console.log('All WebRTC Group Call & Manual Invite tests PASSED successfully!');
