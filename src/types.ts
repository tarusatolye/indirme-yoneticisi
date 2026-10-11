export type DownloadKind = "file" | "video";

export type DownloadState =
  | "queued"
  | "probing"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type FileCategory =
  | "image"
  | "music"
  | "video"
  | "apps"
  | "document"
  | "compressed"
  | "other";

export interface SegmentInfo {
  index: number;
  start: number;
  end: number;
  received: number;
  active: boolean;
}

export interface DownloadItem {
  id: string;
  url: string;
  fileName: string;
  savePath: string;
  kind: DownloadKind;
  category: FileCategory;
  state: DownloadState;
  totalBytes: number;
  receivedBytes: number;
  supportsRanges: boolean;
  segments: SegmentInfo[];
  speed: number;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
  referrer?: string;
  cookies?: string;
  userAgent?: string;
}

export interface AppSettings {
  download_dir: string;
  segment_count: number;
  max_concurrent: number;
  port: number;
  ytdlp_path: string;
  language: "tr" | "en";
  autoCloseDetail?: boolean;
}

export interface AddDownloadPayload {
  url: string;
  fileName?: string;
  savePath?: string;
  referrer?: string;
  userAgent?: string;
  cookies?: string;
  isVideo?: boolean;
}
