export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read';

export type MessageType = 'text' | 'image' | 'audio' | 'sticker' | 'document' | 'call';

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'connected' | 'ended' | 'rejected' | 'busy';

export interface CallParticipant {
  id: string;
  name: string;
  avatar: string;
  joinedAt: number;
  isMuted?: boolean;
  isVideoDisabled?: boolean;
}

export interface MeshSignal {
  fromUserId: string;
  toUserId: string;
  type: 'offer' | 'answer';
  sdp: string;
  updatedAt: number;
}

export interface CallSession {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string;
  isGroup?: boolean;
  groupId?: string;
  groupMembers?: string[];
  invitedUsers?: string[];
  participants?: CallParticipant[];
  meshSignals?: Record<string, MeshSignal>;
  type: CallType;
  status: CallStatus;
  startedAt?: number;
  duration?: number;
  sdpOffer?: string;
  sdpAnswer?: string;
  callerIce?: any[];
  receiverIce?: any[];
  updatedAt: number;
}

export interface UserAccount {
  id: string; // unique user id e.g. usr_123456
  username?: string; // unique username e.g. 'reza99'
  name: string; // display name e.g. 'Reza Maulana'
  identifier?: string; // email or phone number e.g. 'reza@gmail.com' or '08123456789'
  identifierType?: 'email' | 'phone';
  phone?: string;
  pin?: string; // simple password / security PIN
  avatar: string;
  about: string;
  isOnline?: boolean;
  lastSeen?: string;
  createdAt?: string;
  friends?: string[]; // array of friend user IDs
}

export interface Message {
  id: string;
  chatId: string; // [userA, userB].sort().join('__')
  senderId: string;
  recipientId?: string;
  senderName?: string;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  audioDuration?: number;
  callInfo?: {
    type: CallType;
    status: 'missed' | 'completed' | 'declined';
    duration?: number;
  };
  timestamp: string;
  status: MessageStatus;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
    type: MessageType;
  };
  reaction?: string;
  sentToRealWa?: boolean;
}

export interface ContactItem {
  id: string; // contact's user id
  username?: string;
  name: string;
  identifier?: string;
  phone?: string;
  avatar: string;
  about?: string;
  isOnline: boolean;
  lastSeen?: string;
  isGroup?: boolean;
  participantsCount?: number;
  unreadCount: number;
  pinned?: boolean;
  isTyping?: boolean;
  lastMessage?: {
    text: string;
    timestamp: string;
    type: MessageType;
    senderId: string;
    senderName?: string;
    status?: MessageStatus;
  };
}

export type Contact = ContactItem;
export type UserProfile = UserAccount;

export interface GroupMember {
  id: string;
  name: string;
  username?: string;
  avatar: string;
  about?: string;
  isAdmin: boolean;
  isOnline?: boolean;
}

export interface GroupChat {
  id: string; // grp_xxx
  name: string;
  description?: string;
  avatar: string;
  createdBy: string;
  admins: string[]; // user IDs
  members: string[]; // user IDs
  createdAt: string;
  updatedAt?: string;
}
