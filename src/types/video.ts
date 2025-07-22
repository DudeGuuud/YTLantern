export interface VideoInfo {
  id: string
  title: string
  description?: string
  thumbnail: string
  duration: number
  uploader: string
  upload_date: string
  view_count?: number
  like_count?: number
  formats: VideoFormat[]
  url: string
  original_url: string
}

export interface VideoFormat {
  format_id: string
  url: string
  ext: string
  quality: string
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
  data?: VideoInfo
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

export type VideoQuality = '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | 'best'

export interface QualityOption {
  value: VideoQuality
  label: string
  description: string
}
