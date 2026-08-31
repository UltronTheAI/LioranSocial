import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Post from '@/models/Post';
import Reel from '@/models/Reel';
import Follow from '@/models/Follow';
import { SafeUser } from '@/types/user';

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export interface SearchUserResult extends SafeUser {
  isFollowing?: boolean;
}

export interface SearchResult {
  users: SearchUserResult[];
  posts: unknown[];
  reels: unknown[];
}

export async function searchContent(
  query: string,
  type: 'top' | 'users' | 'posts' | 'reels' = 'top',
  currentUserId?: string,
  limit: number = 20
): Promise<SearchResult> {
  await connectToDatabase();

  const trimmed = query.trim();
  if (!trimmed) {
    return { users: [], posts: [], reels: [] };
  }

  const safePattern = new RegExp(escapeRegex(trimmed), 'i');
  let users: SearchUserResult[] = [];
  let posts: unknown[] = [];
  let reels: unknown[] = [];

  // 1. Search Users if type is 'top' or 'users'
  if (type === 'top' || type === 'users') {
    const userLimit = type === 'top' ? Math.min(limit, 5) : limit;
    const foundUsers = await User.find({
      $or: [
        { username: safePattern },
        { displayName: safePattern },
      ],
    })
      .select('-passwordHash')
      .limit(userLimit)
      .lean();

    // Check if current user is following found users
    let viewerFollowingIds = new Set<string>();
    if (currentUserId) {
      const viewerFollows = await Follow.find({
        followerId: currentUserId,
      }).select('followingId').lean();
      viewerFollowingIds = new Set(viewerFollows.map((f) => f.followingId.toString()));
    }

    users = foundUsers.map((u) => {
      const idStr = u._id.toString();
      return {
        ...u,
        _id: idStr,
        isFollowing: viewerFollowingIds.has(idStr),
      } as SearchUserResult;
    });
  }

  // 2. Search Posts if type is 'top' or 'posts'
  if (type === 'top' || type === 'posts') {
    const postLimit = type === 'top' ? Math.min(limit, 10) : limit;
    const foundPosts = await Post.find({
      caption: safePattern,
    })
      .sort({ createdAt: -1 })
      .limit(postLimit)
      .populate('authorId', 'username displayName avatar emailVerified')
      .lean();

    posts = foundPosts.map((p) => ({
      ...p,
      _id: p._id.toString(),
      author: p.authorId,
      authorId: undefined,
    }));
  }

  // 3. Search Reels if type is 'top' or 'reels'
  if (type === 'top' || type === 'reels') {
    const reelLimit = type === 'top' ? Math.min(limit, 10) : limit;
    const foundReels = await Reel.find({
      caption: safePattern,
    })
      .sort({ createdAt: -1 })
      .limit(reelLimit)
      .populate('authorId', 'username displayName avatar emailVerified')
      .lean();

    reels = foundReels.map((r) => ({
      ...r,
      _id: r._id.toString(),
      author: r.authorId,
      authorId: undefined,
    }));
  }

  return {
    users,
    posts,
    reels,
  };
}
