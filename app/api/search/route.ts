import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { searchContent } from '@/services/search.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const typeParam = searchParams.get('type') || 'top';
    const type = ['top', 'users', 'posts'].includes(typeParam)
      ? (typeParam as 'top' | 'users' | 'posts')
      : 'top';

    const currentUser = await getCurrentUser();
    const results = await searchContent(query, type, currentUser?._id?.toString());

    return NextResponse.json({
      query,
      type,
      ...results,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search.' },
      { status: 500 }
    );
  }
}

