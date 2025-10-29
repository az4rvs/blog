export const dynamic = "force-dynamic";

import Link from 'next/link';
import { getAllPosts, PostData } from '@/lib/posts';
import { Redis } from "@upstash/redis";
import ViewCount from "@/components/ViewCount";

export default async function Home() {
  const posts: PostData[] = await getAllPosts();

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const postsWithViews = await Promise.all(
    posts.map(async (post) => {
      const views = (await redis.get<number>(`pageviews:${post.slug}`)) || 0;
      return { ...post, views };
    })
  );

  return (
    <main>
      <div className="post-header border-b border-gray-800 pb-2 mb-2">
        <div className="lowercase text-gray-500 text-[0.9rem] tracking-wide">date</div>
        <div className="lowercase text-gray-500 text-[0.9rem] tracking-wide">title</div>
        <div className="lowercase text-gray-500 text-[0.9rem] tracking-wide text-right">views</div>
      </div>

      <div className="post-list divide-y divide-gray-800">
        {postsWithViews.map((post) => (
          <div
            key={post.slug}
            className="post-item py-2 hover:border-gray-700 transition-colors"
          >
            <div className="post-date text-gray-400 text-sm">{new Date(post.date).getFullYear()}</div>
            <div className="post-title home-title">
              <Link href={`/${post.slug}`} className="hover:text-purple-400 transition-colors">
                {post.title}
              </Link>
            </div>
            <div className="post-views text-gray-500 text-sm text-right">
              <ViewCount slug={post.slug} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}