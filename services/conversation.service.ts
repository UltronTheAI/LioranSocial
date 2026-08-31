import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Conversation from '@/models/Conversation';
import ConversationMember from '@/models/ConversationMember';
import Message, { IMessage } from '@/models/Message';
import User from '@/models/User';
import { emitSocketEvent } from '@/lib/socket-server';

export interface PopulatedConversation {
  _id: string;
  type: 'dm' | 'group';
  title: string;
  avatar?: string;
  members: Array<{
    _id: string;
    username: string;
    displayName: string;
    avatar?: string;
    role: string;
  }>;
  lastMessage?: {
    _id: string;
    senderId: string;
    type: string;
    text?: string;
    createdAt: Date;
  };
  lastActivityAt: Date;
  unreadCount?: number;
}

export async function findOrCreateDM(
  currentUserId: string,
  targetUserId: string
): Promise<PopulatedConversation> {
  await connectToDatabase();

  if (currentUserId === targetUserId) {
    throw new Error('Cannot create a direct message conversation with yourself.');
  }

  const targetUser = await User.findById(targetUserId).select('username displayName avatar').lean();
  if (!targetUser) {
    throw new Error('Target user not found.');
  }

  const currentUserObjId = new Types.ObjectId(currentUserId);
  const targetUserObjId = new Types.ObjectId(targetUserId);

  // Find conversations where currentUser is a member
  const userMemberships = await ConversationMember.find({ userId: currentUserObjId }).select('conversationId').lean();
  const conversationIds = userMemberships.map((m) => m.conversationId);

  // Check if targetUser is also a member in any of these DM conversations
  const existingSharedMember = await ConversationMember.findOne({
    conversationId: { $in: conversationIds },
    userId: targetUserObjId,
  });

  if (existingSharedMember) {
    const existingConv = await Conversation.findOne({
      _id: existingSharedMember.conversationId,
      type: 'dm',
    }).lean();

    if (existingConv) {
      return getConversationDetails(existingConv._id.toString(), currentUserId);
    }
  }

  // Create new DM conversation
  const newConversation = await Conversation.create({
    type: 'dm',
    lastActivityAt: new Date(),
  });

  // Create 2 member records
  await ConversationMember.create([
    { conversationId: newConversation._id, userId: currentUserObjId, role: 'member' },
    { conversationId: newConversation._id, userId: targetUserObjId, role: 'member' },
  ]);

  return getConversationDetails(newConversation._id.toString(), currentUserId);
}

export async function createGroupConversation(
  creatorId: string,
  title: string,
  memberUserIds: string[],
  avatar?: string
): Promise<PopulatedConversation> {
  await connectToDatabase();

  const uniqueMemberIds = Array.from(new Set(memberUserIds.filter((id) => id !== creatorId)));
  if (uniqueMemberIds.length === 0) {
    throw new Error('At least one other member is required to create a group.');
  }

  const newConversation = await Conversation.create({
    type: 'group',
    title: title.trim(),
    avatar,
    lastActivityAt: new Date(),
  });

  const memberDocs: Array<{
    conversationId: Types.ObjectId;
    userId: Types.ObjectId;
    role: 'admin' | 'member';
  }> = [
    { conversationId: newConversation._id, userId: new Types.ObjectId(creatorId), role: 'admin' },
    ...uniqueMemberIds.map((id) => ({
      conversationId: newConversation._id,
      userId: new Types.ObjectId(id),
      role: 'member' as const,
    })),
  ];

  await ConversationMember.create(memberDocs);

  // Notify members via socket
  uniqueMemberIds.forEach((id) => {
    emitSocketEvent(`user:${id}`, 'conversation:new', {
      conversationId: newConversation._id.toString(),
    });
  });

  return getConversationDetails(newConversation._id.toString(), creatorId);
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

  const isMember = members.some((m) => (m.userId as unknown as { _id: { toString(): string } })._id.toString() === userId);
  if (!isMember) {
    throw new Error('You are not authorized to view this conversation.');
  }

  const formattedMembers = members.map((m) => {
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
  limit: number = 25
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

  const query: Record<string, unknown> = { conversationId: convObjId };
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
    .lean();

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = items.length > 0 ? items[items.length - 1]._id.toString() : null;

  const formattedMessages = items.map((msg) => ({
    _id: msg._id.toString(),
    conversationId: msg.conversationId.toString(),
    sender: msg.senderId,
    type: msg.type,
    text: msg.text,
    media: msg.media,
    sharedPost: msg.sharedPostId,
    sharedReel: msg.sharedReelId,
    story: msg.storyId,
    storyReaction: msg.storyReaction,
    replyTo: msg.replyTo?.toString(),
    createdAt: msg.createdAt,
  }));

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
    replyTo: data.replyTo ? new Types.ObjectId(data.replyTo) : undefined,
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
    .lean();

  const payload = {
    _id: populated!._id.toString(),
    conversationId: populated!.conversationId.toString(),
    sender: populated!.senderId,
    type: populated!.type,
    text: populated!.text,
    media: populated!.media,
    sharedPost: populated!.sharedPostId,
    sharedReel: populated!.sharedReelId,
    story: populated!.storyId,
    storyReaction: populated!.storyReaction,
    replyTo: populated!.replyTo?.toString(),
    createdAt: populated!.createdAt,
  };

  // Broadcast to room: conversation:<conversationId>
  emitSocketEvent(`conversation:${data.conversationId}`, 'message:new', payload);

  return payload;
}
