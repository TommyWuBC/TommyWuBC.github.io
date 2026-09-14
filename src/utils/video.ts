// ---------------------------------------------------------------------------
// VIDEO EMBED RESOLUTION
// ---------------------------------------------------------------------------
// Turns a plain URL (YouTube, Vimeo, direct video file, or generic embed
// link) into something a project page can render. Add a link in
// src/data/profile.ts under a project's `video.url` field and it will
// automatically render as the right kind of embed — no template changes
// needed.
// ---------------------------------------------------------------------------

export interface VideoEmbed {
  kind: 'youtube' | 'vimeo' | 'file' | 'iframe';
  src: string;
}

export function resolveVideoEmbed(url: string): VideoEmbed | null {
  if (!url) return null;

  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/
  );
  if (youtubeMatch) {
    return { kind: 'youtube', src: `https://www.youtube.com/embed/${youtubeMatch[1]}` };
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  if (/\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(url)) {
    return { kind: 'file', src: url };
  }

  return { kind: 'iframe', src: url };
}
