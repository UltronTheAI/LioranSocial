import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Conversation from '@/models/Conversation';
import ConversationMember from '@/models/ConversationMember';
import Message, { IMessage } from '@/models/Message';
import '@/models/User';
import '@/models/Post';
import '@/models/Reel';
import '@/models/Story';
import { emitSocketEvent } from '@/lib/socket-server';

export interface PopulatedMember {
  _id: string;
  username: string;
  displayName: string;
  avatar?: string;
  role: 'member' | 'admin';
}

export interface PopulatedConversation {
  _id: string;
  type: 'dm' | 'group';
  title: string;
  avatar?: string;
  members: PopulatedMember[];
  lastMessage?: {
    _id: string;
    senderId: string;
    type: string;
    text?: string;
    createdAt: Date;
  };
  lastActivityAt: Date;
}

export async function findOrCreateDM(
  initiatorId: string,
  recipientUserId: string
): Promise<PopulatedConversation> {
  await connectToDatabase();

  if (initiatorId === recipientUserId) {
    throw new Error('Cannot create a conversation with yourself.');
  }

  const userA = new Types.ObjectId(initiatorId);
  const userB = new Types.ObjectId(recipientUserId);

  // Check if DM conversation already exists between these 2 users
  const existingMembersA = await ConversationMember.find({ userId: userA }).select('conversationId');
  const convIdsA = existingMembersA.map((m) => m.conversationId);

  const sharedMemberships = await ConversationMember.find({
    conversationId: { $in: convIdsA },
    userId: userB,
  }).select('conversationId');

  for (const shared of sharedMemberships) {
    const conv = await Conversation.findOne({ _id: shared.conversationId, type: 'dm' });
    if (conv) {
      return getConversationDetails(conv._id.toString(), initiatorId);
    }
  }

  // Create new DM conversation
  const newConv = await Conversation.create({
    type: 'dm',
    lastActivityAt: new Date(),
  });

  await ConversationMember.insertMany([
    { conversationId: newConv._id, userId: userA, role: 'admin' },
    { conversationId: newConv._id, userId: userB, role: 'member' },
  ]);

  return getConversationDetails(newConv._id.toString(), initiatorId);
}

export async function createDirectConversation(
  initiatorId: string,
  recipientUserId: string
): Promise<PopulatedConversation> {
  return findOrCreateDM(initiatorId, recipientUserId);
}

export async function createGroupConversation(
  creatorId: string,
  title: string,
  memberIds: string[],
  avatar?: string
): Promise<PopulatedConversation> {
  await connectToDatabase();

  const userCreator = new Types.ObjectId(creatorId);
  const uniqueMemberIds = Array.from(new Set(memberIds.filter((id) => id !== creatorId))).map(
    (id) => new Types.ObjectId(id)
  );

  if (uniqueMemberIds.length === 0) {
    throw new Error('A group chat must have at least one additional member.');
  }

  const newConv = await Conversation.create({
    type: 'group',
    title: title.trim(),
    avatar,
    lastActivityAt: new Date(),
  });

  const memberDocs: Array<{ conversationId: Types.ObjectId; userId: Types.ObjectId; role: 'admin' | 'member' }> = [
    { conversationId: newConv._id, userId: userCreator, role: 'admin' },
    ...uniqueMemberIds.map((mId) => ({
      conversationId: newConv._id,
      userId: mId,
      role: 'member' as const,
    })),
  ];

  await ConversationMember.insertMany(memberDocs);

  return getConversationDetails(newConv._id.toString(), creatorId);
}

export async function getUserConversations(userId: string): Promise<PopulatedConversation[]> {
  await connectToDatabase();

  const userObjId = new Types.ObjectId(userId);
  const memberships = await ConversationMember.find({ userId: userObjId }).select('conversationId').lean();
  const conversationIds = memberships.map((m) => m.conversationId);

  const conversations = await Conversation.find({ _id: { $in: conversationIds } })
    .sort({ lastActivityAt: -1 })
    .populate('lastMessageId')
    .lean();

  const allMembers = await ConversationMember.find({
    conversationId: { $in: conversationIds },
  })
    .populate('userId', 'username displayName avatar emailVerified')
    .lean();

  const memberMap = new Map<string, typeof allMembers>();
  allMembers.forEach((m) => {
    const convId = m.conversationId.toString();
    if (!memberMap.has(convId)) {
      memberMap.set(convId, []);
    }
    memberMap.get(convId)!.push(m);
  });

  return conversations.map((conv) => {
    const convIdStr = conv._id.toString();
    const members = memberMap.get(convIdStr) || [];
    const formattedMembers = members
      .filter((m) => m.userId)
      .map((m) => {
        const u = m.userId as unknown as {
          _id: { toString(): string };
          username: string;
          displayName: string;
          avatar?: string;
        };
        return {
          _id: u._id.toString(),
          username: u.username,
          displayName: u.displayName,
          avatar: u.avatar || '',
          role: m.role,
        };
      });

    // For DMs, title and avatar come from the other participant
    let title = conv.title || 'Direct Message';
    let avatar = conv.avatar;

    if (conv.type === 'dm') {
      const otherUser = formattedMembers.find((m) => m._id !== userId);
      if (otherUser) {
        title = otherUser.displayName || otherUser.username;
        avatar = otherUser.avatar;
      }
    }

    const lastMsg = conv.lastMessageId as unknown as IMessage | undefined;

    return {
      _id: convIdStr,
      type: conv.type,
      title,
      avatar,
      members: formattedMembers,
      lastMessage: lastMsg
        ? {
            _id: (lastMsg as unknown as { _id: { toString(): string } })._id.toString(),
            senderId: (lastMsg.senderId as unknown as { toString(): string }).toString(),
            type: lastMsg.type,
            text: lastMsg.text,
            createdAt: (lastMsg as unknown as { createdAt: Date }).createdAt,
          }
        : undefined,
      lastActivityAt: conv.lastActivityAt,
    };
  });
}

export async function getConversationDetails(
  conversationId: string,
  userId: string
): Promise<PopulatedConversation> {
  await connectToDatabase();

  const conv = await Conversation.findById(conversationId).populate('lastMessageId').lean();
  if (!conv) {
    throw new Error('Conversation not found.');
  }

  const members = await ConversationMember.find({ conversationId: conv._id })
    .populate('userId', 'username displayName avatar emailVerified')
    .lean();

  const formattedMembers: PopulatedMember[] = members
    .filter((m) => m.userId)
    .map((m) => {
      const u = m.userId as unknown as {
        _id: { toString(): string };
        username: string;
        displayName: string;
        avatar?: string;
      };
      return {
        _id: u._id.toString(),
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar || '',
        role: m.role,
      };
    });

  let title = conv.title || 'Direct Message';
  let avatar = conv.avatar;

  if (conv.type === 'dm') {
    const otherUser = formattedMembers.find((m) => m._id !== userId);
    if (otherUser) {
      title = otherUser.displayName || otherUser.username;
      avatar = otherUser.avatar;
    }
  }

  const lastMsg = conv.lastMessageId as unknown as IMessage | undefined;

  return {
    _id: conv._id.toString(),
    type: conv.type,
    title,
    avatar,
    members: formattedMembers,
    lastMessage: lastMsg
      ? {
          _id: (lastMsg as unknown as { _id: { toString(): string } })._id.toString(),
          senderId: (lastMsg.senderId as unknown as { toString(): string }).toString(),
          type: lastMsg.type,
          text: lastMsg.text,
          createdAt: (lastMsg as unknown as { createdAt: Date }).createdAt,
        }
      : undefined,
    lastActivityAt: conv.lastActivityAt,
  };
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  cursor?: string,
  limit: number = 35
) {
  await connectToDatabase();

  const convObjId = new Types.ObjectId(conversationId);
  const userObjId = new Types.ObjectId(userId);

  // Authorize membership
  const member = await ConversationMember.findOne({
    conversationId: convObjId,
    userId: userObjId,
  });

  if (!member) {
    throw new Error('Unauthorized to view conversation messages.');
  }

  const query: Record<string, unknown> = {
    conversationId: convObjId,
    deletedFor: { $ne: userObjId },
  };

  if (cursor && Types.ObjectId.isValid(cursor)) {
    query._id = { $lt: new Types.ObjectId(cursor) };
  }

  const messages = await Message.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('senderId', 'username displayName avatar emailVerified')
    .populate({
      path: 'sharedPostId',
      populate: { path: 'authorId', select: 'username displayName avatar' },
    })
    .populate({
      path: 'sharedReelId',
      populate: { path: 'authorId', select: 'username displayName avatar' },
    })
    .populate({
      path: 'storyId',
      populate: { path: 'authorId', select: 'username displayName avatar' },
    })
    .populate({
      path: 'replyTo',
      select: 'text type senderId media',
      populate: { path: 'senderId', select: 'username displayName avatar' },
    })
    .populate('reactions.userId', 'username displayName')
    .lean();

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = items.length > 0 ? items[items.length - 1]._id.toString() : null;

  const formattedMessages = items.map((msg) => {
    const senderDoc = msg.senderId as unknown as {
      _id?: { toString: () => string };
      username?: string;
      displayName?: string;
      avatar?: string;
      emailVerified?: boolean;
    } | null;

    const senderObj = senderDoc && typeof senderDoc === 'object' && '_id' in senderDoc
      ? {
          _id: senderDoc._id ? senderDoc._id.toString() : (senderDoc as unknown as { toString: () => string }).toString(),
          username: senderDoc.username || 'user',
          displayName: senderDoc.displayName || 'User',
          avatar: senderDoc.avatar || '',
          emailVerified: Boolean(senderDoc.emailVerified),
        }
      : {
          _id: msg.senderId ? (msg.senderId as unknown as { toString: () => string }).toString() : '',
          username: 'user',
          displayName: 'User',
          avatar: '',
          emailVerified: false,
        };

    return {
      _id: msg._id.toString(),
      conversationId: msg.conversationId.toString(),
      sender: senderObj,
      type: msg.type,
      text: msg.deletedAt ? 'This message was deleted' : msg.text,
      media: msg.deletedAt ? undefined : msg.media,
      sharedPost: msg.deletedAt ? undefined : msg.sharedPostId,
      sharedReel: msg.deletedAt ? undefined : msg.sharedReelId,
      story: msg.deletedAt ? undefined : msg.storyId,
      storyReaction: msg.deletedAt ? undefined : msg.storyReaction,
      replyTo: msg.replyTo
        ? {
            _id: (msg.replyTo as unknown as { _id: { toString(): string } })._id.toString(),
            type: (msg.replyTo as unknown as { type: string }).type,
            text: (msg.replyTo as unknown as { text?: string }).text,
            sender: (msg.replyTo as unknown as { senderId?: { username: string; displayName: string } }).senderId,
          }
        : undefined,
      reactions: (msg.reactions || []).map((r) => ({
        userId: (r.userId as unknown as { _id?: { toString(): string }; toString?: () => string })?._id?.toString() || r.userId?.toString(),
        username: (r.userId as unknown as { username?: string })?.username || '',
        emoji: r.emoji,
      })),
      readBy: (msg.readBy || []).map((r) => ({
        userId: r.userId ? r.userId.toString() : '',
        readAt: r.readAt,
      })),
      isEdited: Boolean(msg.editedAt),
      isDeleted: Boolean(msg.deletedAt),
      createdAt: msg.createdAt,
      editedAt: msg.editedAt,
    };
  });

  return {
    messages: formattedMessages.reverse(), // Reverse so earliest is first
    nextCursor: hasMore ? nextCursor : null,
    hasMore,
  };
}

export async function persistAndBroadcastMessage(data: {
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'post' | 'reel' | 'story_reply';
  text?: string;
  media?: { url: string; secureUrl: string; publicId?: string; width?: number; height?: number };
  sharedPostId?: string;
  sharedReelId?: string;
  storyId?: string;
  storyReaction?: string;
  replyTo?: string;
}) {
  await connectToDatabase();

  const convObjId = new Types.ObjectId(data.conversationId);
  const senderObjId = new Types.ObjectId(data.senderId);

  // Authorize membership
  const member = await ConversationMember.findOne({
    conversationId: convObjId,
    userId: senderObjId,
  });

  if (!member) {
    throw new Error('Unauthorized to post message to this conversation.');
  }

  // Persist message
  const newMessage = await Message.create({
    conversationId: convObjId,
    senderId: senderObjId,
    type: data.type,
    text: data.text,
    media: data.media,
    sharedPostId: data.sharedPostId ? new Types.ObjectId(data.sharedPostId) : undefined,
    sharedReelId: data.sharedReelId ? new Types.ObjectId(data.sharedReelId) : undefined,
    storyId: data.storyId ? new Types.ObjectId(data.storyId) : undefined,
    storyReaction: data.storyReaction,
    replyTo: data.replyTo && Types.ObjectId.isValid(data.replyTo) ? new Types.ObjectId(data.replyTo) : undefined,
    reactions: [],
    deletedFor: [],
    readBy: [{ userId: senderObjId, readAt: new Date() }],
  });

  // Update conversation lastActivityAt and lastMessageId
  await Conversation.findByIdAndUpdate(convObjId, {
    lastMessageId: newMessage._id,
    lastActivityAt: new Date(),
  });

  // Populate message for broadcast
  const populated = await Message.findById(newMessage._id)
    .populate('senderId', 'username displayName avatar emailVerified')
    .populate({
      path: 'sharedPostId',
      populate: { path: 'authorId', select: 'username displayName avatar' },
    })
    .populate({
      path: 'sharedReelId',
      populate: { path: 'authorId', select: 'username displayName avatar' },
    })
    .populate({
      path: 'storyId',
      populate: { path: 'authorId', select: 'username displayName avatar' },
    })
    .populate({
      path: 'replyTo',
      select: 'text type senderId media',
      populate: { path: 'senderId', select: 'username displayName avatar' },
    })
    .lean();

  const senderDoc = populated!.senderId as unknown as {
    _id?: { toString: () => string };
    username?: string;
    displayName?: string;
    avatar?: string;
    emailVerified?: boolean;
  } | null;

  const senderObj = senderDoc && typeof senderDoc === 'object' && '_id' in senderDoc
    ? {
        _id: senderDoc._id ? senderDoc._id.toString() : data.senderId,
        username: senderDoc.username || 'user',
        displayName: senderDoc.displayName || 'User',
        avatar: senderDoc.avatar || '',
        emailVerified: Boolean(senderDoc.emailVerified),
      }
    : {
        _id: data.senderId,
        username: 'user',
        displayName: 'User',
        avatar: '',
        emailVerified: false,
      };

  const payload = {
    _id: populated!._id.toString(),
    conversationId: populated!.conversationId.toString(),
    sender: senderObj,
    type: populated!.type,
    text: populated!.text,
    media: populated!.media,
    sharedPost: populated!.sharedPostId,
    sharedReel: populated!.sharedReelId,
    story: populated!.storyId,
    storyReaction: populated!.storyReaction,
    replyTo: populated!.replyTo
      ? {
          _id: (populated!.replyTo as unknown as { _id: { toString(): string } })._id.toString(),
          type: (populated!.replyTo as unknown as { type: string }).type,
          text: (populated!.replyTo as unknown as { text?: string }).text,
          sender: (populated!.replyTo as unknown as { senderId?: { username: string; displayName: string } }).senderId,
        }
      : undefined,
    reactions: [],
    readBy: (populated!.readBy || []).map((r) => ({
      userId: r.userId ? r.userId.toString() : '',
      readAt: r.readAt,
    })),
    isEdited: false,
    isDeleted: false,
    createdAt: populated!.createdAt,
  };

  // Broadcast to room: conversation:<conversationId>
  emitSocketEvent(`conversation:${data.conversationId}`, 'message:new', payload);

  // Also broadcast to each other member's private user room for live global notifications
  ConversationMember.find({ conversationId: convObjId })
    .select('userId')
    .lean()
    .then((members) => {
      members.forEach((m) => {
        const memberIdStr = m.userId.toString();
        if (memberIdStr !== data.senderId) {
          emitSocketEvent(`user:${memberIdStr}`, 'message:new', payload);
        }
      });
    })
    .catch((err) => console.error('Failed to notify conversation members:', err));

  return payload;
}

export async function reactToMessage({
  conversationId,
  messageId,
  userId,
  emoji,
}: {
  conversationId: string;
  messageId: string;
  userId: string;
  emoji: string;
}) {
  await connectToDatabase();

  const msg = await Message.findById(messageId);
  if (!msg || msg.conversationId.toString() !== conversationId) {
    throw new Error('Message not found.');
  }

  const userObjId = new Types.ObjectId(userId);
  const existingIndex = msg.reactions.findIndex(
    (r) => r.userId.toString() === userObjId.toString()
  );

  if (existingIndex > -1) {
    if (msg.reactions[existingIndex].emoji === emoji) {
      // Toggle off if same emoji
      msg.reactions.splice(existingIndex, 1);
    } else {
      // Update to new emoji
      msg.reactions[existingIndex].emoji = emoji;
    }
  } else {
    // Add new reaction
    msg.reactions.push({
      userId: userObjId,
      emoji,
      createdAt: new Date(),
    });
  }

  await msg.save();

  const populated = await Message.findById(messageId)
    .populate('reactions.userId', 'username displayName')
    .lean();

  const reactions = (populated?.reactions || []).map((r) => ({
    userId: (r.userId as unknown as { _id?: { toString(): string }; toString?: () => string })?._id?.toString() || r.userId?.toString(),
    username: (r.userId as unknown as { username?: string })?.username || '',
    emoji: r.emoji,
  }));

  const payload = {
    conversationId,
    messageId,
    reactions,
  };

  emitSocketEvent(`conversation:${conversationId}`, 'message:react', payload);
  return payload;
}

export async function editMessage({
  conversationId,
  messageId,
  userId,
  text,
}: {
  conversationId: string;
  messageId: string;
  userId: string;
  text: string;
}) {
  await connectToDatabase();

  const msg = await Message.findById(messageId);
  if (!msg || msg.conversationId.toString() !== conversationId) {
    throw new Error('Message not found.');
  }

  if (msg.senderId.toString() !== userId) {
    throw new Error('You can only edit your own messages.');
  }

  if (msg.deletedAt) {
    throw new Error('Cannot edit a deleted message.');
  }

  // 15-minute edit window
  const diffMs = Date.now() - new Date(msg.createdAt).getTime();
  if (diffMs > 15 * 60 * 1000) {
    throw new Error('Messages can only be edited within 15 minutes of sending.');
  }

  msg.text = text.trim();
  msg.editedAt = new Date();
  await msg.save();

  const payload = {
    conversationId,
    messageId,
    text: msg.text,
    editedAt: msg.editedAt,
  };

  emitSocketEvent(`conversation:${conversationId}`, 'message:edit', payload);
  return payload;
}

export async function deleteMessageForMe({
  conversationId,
  messageId,
  userId,
}: {
  conversationId: string;
  messageId: string;
  userId: string;
}) {
  await connectToDatabase();

  const msg = await Message.findById(messageId);
  if (!msg || msg.conversationId.toString() !== conversationId) {
    throw new Error('Message not found.');
  }

  const userObjId = new Types.ObjectId(userId);
  await Message.findByIdAndUpdate(messageId, {
    $addToSet: { deletedFor: userObjId },
  });

  const payload = {
    conversationId,
    messageId,
  };

  emitSocketEvent(`user:${userId}`, 'message:delete_for_me', payload);
  return payload;
}

export async function deleteMessage({
  conversationId,
  messageId,
  userId,
}: {
  conversationId: string;
  messageId: string;
  userId: string;
}) {
  await connectToDatabase();

  const msg = await Message.findById(messageId);
  if (!msg || msg.conversationId.toString() !== conversationId) {
    throw new Error('Message not found.');
  }

  if (msg.senderId.toString() !== userId) {
    throw new Error('You can only delete your own messages for everyone.');
  }

  msg.deletedAt = new Date();
  msg.text = 'This message was deleted';
  msg.media = undefined;
  msg.sharedPostId = undefined;
  msg.sharedReelId = undefined;
  msg.storyId = undefined;
  msg.reactions = [];
  await msg.save();

  const payload = {
    conversationId,
    messageId,
    deletedAt: msg.deletedAt,
  };

  emitSocketEvent(`conversation:${conversationId}`, 'message:delete', payload);
  return payload;
}

export async function deleteConversation(conversationId: string, userId: string) {
  await connectToDatabase();

  const convObjId = new Types.ObjectId(conversationId);
  const userObjId = new Types.ObjectId(userId);

  // Remove membership for this user
  await ConversationMember.deleteOne({
    conversationId: convObjId,
    userId: userObjId,
  });

  // Hide all current messages for this user
  await Message.updateMany(
    { conversationId: convObjId },
    { $addToSet: { deletedFor: userObjId } }
  );

  // Check if any other members exist in conversation
  const remainingMembers = await ConversationMember.countDocuments({ conversationId: convObjId });
  if (remainingMembers === 0) {
    await Message.deleteMany({ conversationId: convObjId });
    await Conversation.deleteOne({ _id: convObjId });
  }

  emitSocketEvent(`user:${userId}`, 'conversation:delete', { conversationId });
  return { success: true, conversationId };
}

export async function bulkDeleteConversations(conversationIds: string[], userId: string) {
  await connectToDatabase();

  const userObjId = new Types.ObjectId(userId);
  const validIds = conversationIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));

  if (validIds.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  // Remove memberships
  await ConversationMember.deleteMany({
    conversationId: { $in: validIds },
    userId: userObjId,
  });

  // Hide messages for this user
  await Message.updateMany(
    { conversationId: { $in: validIds } },
    { $addToSet: { deletedFor: userObjId } }
  );

  // Check which conversations have 0 members left
  for (const convId of validIds) {
    const remaining = await ConversationMember.countDocuments({ conversationId: convId });
    if (remaining === 0) {
      await Message.deleteMany({ conversationId: convId });
      await Conversation.deleteOne({ _id: convId });
    }
    emitSocketEvent(`user:${userId}`, 'conversation:delete', { conversationId: convId.toString() });
  }

  return { success: true, deletedCount: validIds.length };
}

export async function markConversationRead({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}) {
  await connectToDatabase();

  const convObjId = new Types.ObjectId(conversationId);
  const userObjId = new Types.ObjectId(userId);

  const now = new Date();

  // Add reader to readBy array for messages where user hasn't read yet
  await Message.updateMany(
    {
      conversationId: convObjId,
      'readBy.userId': { $ne: userObjId },
    },
    {
      $push: { readBy: { userId: userObjId, readAt: now } },
    }
  );

  emitSocketEvent(`conversation:${conversationId}`, 'message:read', {
    conversationId,
    userId,
    readAt: now.toISOString(),
  });

  return { success: true };
}
