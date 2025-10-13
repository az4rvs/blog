import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';


export interface PostData {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  views: number;
  contentHtml: string;
}

const postsDirectory = path.join(process.cwd(), 'content/posts');

export async function getAllPosts(): Promise<PostData[]> {
  const fileNames = fs.readdirSync(postsDirectory).filter(f => f.endsWith('.md'));

  const posts = await Promise.all(
    fileNames.map(async (fileName) => {
      const slug = fileName.replace(/\.md$/, '');
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');
      const { data, content } = matter(fileContents);

      const processedContent = await remark().use(html).process(content);
      const contentHtml = processedContent.toString();

      return {
        slug,
        title: data.title || 'Sin título',
        date: data.date || '',
        tags: data.tags || [],
        views: data.views || 0,
        contentHtml,
      } as PostData;
    })
  );

  posts.sort((a, b) => (a.date < b.date ? 1 : -1));

  return posts;
}

export async function getPostBySlug(slug: string): Promise<PostData | null> {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  if (!fs.existsSync(fullPath)) return null;

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);

  const processedContent = await remark().use(html).process(content);
  const contentHtml = processedContent.toString();

  return {
    slug,
    title: data.title || 'Sin título',
    date: data.date || '',
    tags: data.tags || [],
    views: data.views || 0,
    contentHtml,
  };
}