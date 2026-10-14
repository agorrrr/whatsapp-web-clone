export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read';

export type MessageType = 'text' | 'image' | 'audio' | 'sticker' | 'document';

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
  timestamp: string;
  status: MessageStatus;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
    type: MessageType;
  };
  reaction?: string;
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
    status?: MessageStatus;
  };
}

export type Contact = ContactItem;
export type UserProfile = UserAccount;
