import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;
  const key = `pageviews:${slug}`;
  const views = (await redis.get<number>(key)) || 0;
  return NextResponse.json({ views });
}

export async function POST(_: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;
  const key = `pageviews:${slug}`;
  const views = await redis.incr(key);
  return NextResponse.json({ views });
}
