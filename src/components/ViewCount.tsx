"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ViewCount({ slug }: { slug: string }) {
  const { data } = useSWR(`/api/views/${slug}`, fetcher, {
    refreshInterval: 0,
  });

  return <span>{data?.views ?? "…"}</span>;
}
