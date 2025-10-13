import { getPostBySlug, PostData } from '@/lib/posts';
import { notFound } from 'next/navigation';

interface PageProps {
  params: { slug: string };
}

export default async function PostPage({ params }: PageProps) {
  const post: PostData | null = await getPostBySlug(params.slug);

  if (!post) return notFound();
  
  const postDate = new Date(post.date + 'T00:00:00');
  const formattedDate = postDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article className="prose prose-invert max-w-2xl mx-auto text-gray-100 -mt-20 text-[1.05rem] leading-relaxed">
      <h1 className="text-3xl font-semibold mb-2">{post.title}</h1>
      <p className="text-gray-500 text-sm mb-6">{formattedDate}</p>
      <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
    </article>
  );
}

