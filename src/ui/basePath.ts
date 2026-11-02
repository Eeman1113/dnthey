/**
 * GitHub Pages serves a project repo from /<repo>, so every absolute asset URL
 * needs that prefix. next/image applies basePath automatically, but a raw
 * <img> or <source> does not, and static export rules out the image optimizer.
 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const asset = (path: string) => `${BASE}${path}`;
