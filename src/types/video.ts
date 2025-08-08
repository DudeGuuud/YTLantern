export interface VideoInfo {
  website: string
  v: string
  p?: string
  title: string
  description?: string
  thumbnail: string
  duration: number
  uploader: string
  upload_date: string
  view_count?: number
  best: {
    audio: VideoFormat
    video: VideoFormat
  }
  available: {
    audios: VideoFormat[]
    videos: VideoFormat[]
    subs: string[]
  }
  // Computed properties for compatibility
  id: string
  formats: VideoFormat[]
  url: string
  original_url: string
}

export interface VideoFormat {
  id: string
  format: string
  scale?: string
  frame?: number
  rate: string
  info: string
  size: string
  // Legacy compatibility
  format_id?: string
  url?: string
  ext?: string
  quality?: string
  filesize?: number
  fps?: number
  vcodec?: string
  acodec?: string
  resolution?: string
  format_note?: string
}

export interface ParseRequest {
  url: string
  quality?: 'best' | 'worst' | 'bestvideo' | 'bestaudio'
  format?: string
}

export interface ParseResponse {
  success: boolean
  result?: VideoInfo
  error?: string
  message?: string
}

export interface HistoryItem {
  id: string
  video: VideoInfo
  parsed_at: string
  access_count: number
  last_accessed: string
}

export interface ApiError {
  error: string
  message: string
  status_code: number
}

export type VideoQuality = '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p' | 'best'

export interface QualityOption {
  value: VideoQuality
  label: string
  description: string
}
