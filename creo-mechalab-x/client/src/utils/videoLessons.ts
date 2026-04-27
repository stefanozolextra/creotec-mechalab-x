export type SupportedVideoLesson =
  | {
      kind: "youtube";
      sourceUrl: string;
      embedUrl: string;
      providerLabel: "YouTube";
    }
  | {
      kind: "vimeo";
      sourceUrl: string;
      embedUrl: string;
      providerLabel: "Vimeo";
    }
  | {
      kind: "google-drive";
      sourceUrl: string;
      embedUrl: string;
      providerLabel: "Google Drive";
    }
  | {
      kind: "direct";
      sourceUrl: string;
      mimeType: "video/mp4" | "video/webm";
      providerLabel: "Direct Video";
    };

const normalizeHost = (value: string): string => value.trim().toLowerCase().replace(/^www\./, "");
const GOOGLE_DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const extractYouTubeVideoId = (parsedUrl: URL): string | null => {
  const hostname = normalizeHost(parsedUrl.hostname);
  const pathSegments = parsedUrl.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (hostname === "youtu.be") {
    return pathSegments[0] || null;
  }

  if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "youtube-nocookie.com") {
    const queryId = parsedUrl.searchParams.get("v");
    if (queryId) return queryId;

    if (pathSegments[0] === "embed" || pathSegments[0] === "shorts" || pathSegments[0] === "live") {
      return pathSegments[1] || null;
    }
  }

  return null;
};

const extractVimeoVideoId = (parsedUrl: URL): string | null => {
  const hostname = normalizeHost(parsedUrl.hostname);
  if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") return null;

  const pathSegments = parsedUrl.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (let index = pathSegments.length - 1; index >= 0; index -= 1) {
    if (/^\d+$/.test(pathSegments[index])) {
      return pathSegments[index];
    }
  }

  return null;
};

const extractGoogleDriveFileId = (parsedUrl: URL): string | null => {
  const hostname = normalizeHost(parsedUrl.hostname);
  if (hostname !== "drive.google.com") return null;

  const pathSegments = parsedUrl.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (
    pathSegments.length !== 4 ||
    pathSegments[0] !== "file" ||
    pathSegments[1] !== "d" ||
    (pathSegments[3] !== "preview" && pathSegments[3] !== "view")
  ) {
    return null;
  }

  const fileId = pathSegments[2] || "";
  return GOOGLE_DRIVE_FILE_ID_PATTERN.test(fileId) ? fileId : null;
};

export const resolveSupportedVideoLesson = (value: string): SupportedVideoLesson | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "https:") return null;

  const youTubeVideoId = extractYouTubeVideoId(parsedUrl);
  if (youTubeVideoId) {
    return {
      kind: "youtube",
      sourceUrl: parsedUrl.toString(),
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(youTubeVideoId)}`,
      providerLabel: "YouTube",
    };
  }

  const vimeoVideoId = extractVimeoVideoId(parsedUrl);
  if (vimeoVideoId) {
    return {
      kind: "vimeo",
      sourceUrl: parsedUrl.toString(),
      embedUrl: `https://player.vimeo.com/video/${encodeURIComponent(vimeoVideoId)}`,
      providerLabel: "Vimeo",
    };
  }

  const googleDriveFileId = extractGoogleDriveFileId(parsedUrl);
  if (googleDriveFileId) {
    const embedUrl = `https://drive.google.com/file/d/${encodeURIComponent(googleDriveFileId)}/preview`;
    return {
      kind: "google-drive",
      sourceUrl: embedUrl,
      embedUrl,
      providerLabel: "Google Drive",
    };
  }

  const pathname = parsedUrl.pathname.toLowerCase();
  if (pathname.endsWith(".mp4")) {
    return {
      kind: "direct",
      sourceUrl: parsedUrl.toString(),
      mimeType: "video/mp4",
      providerLabel: "Direct Video",
    };
  }

  if (pathname.endsWith(".webm")) {
    return {
      kind: "direct",
      sourceUrl: parsedUrl.toString(),
      mimeType: "video/webm",
      providerLabel: "Direct Video",
    };
  }

  return null;
};
