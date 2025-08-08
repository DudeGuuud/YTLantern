import axios from 'axios'
import { VideoInfo, ParseResponse } from '@/types/video'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add any auth headers or other request modifications here
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 429) {
      throw new Error('请求过于频繁，请稍后再试')
    }
    if (error.response?.status >= 500) {
      throw new Error('服务器错误，请稍后再试')
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('请求超时，请检查网络连接')
    }
    return Promise.reject(error)
  }
)

export interface ParseVideoResponse {
  success: boolean
  result?: {
    website: string
    v: string
    p?: string
    title: string
    thumbnail: string
    duration?: number
    uploader: string
    view_count?: number
    upload_date?: string
    description?: string
    best: {
      audio: any
      video: any
    }
    available: {
      audios: any[]
      videos: any[]
      subs: string[]
    }
  }
  error?: string
}

export interface DownloadVideoRequest {
  website?: string
  v: string
  p?: string
  format: string
  recode?: string
  subs?: string
  merge?: boolean
}

export interface DownloadVideoResponse {
  success: boolean
  result?: {
    v: string
    downloading: boolean
    downloadSucceed: boolean
    dest: string
    metadata: string
  }
  error?: string
}

export interface SubtitleRequest {
  website?: string
  id: string
  p?: string
  locale: string
  ext: string
  type: 'auto' | 'native'
}

export interface SubtitleResponse {
  success: boolean
  title?: string
  filename?: string
  text?: string
  error?: string
}

export class VideoAPI {
  /**
   * Parse YouTube video URL
   */
  static async parseVideo(url: string): Promise<ParseResponse> {
    try {
      const response = await api.get('/parse', { params: { url } })
      const data = response.data

      if (data.success && data.result) {
        // Transform backend response to match frontend expectations
        const result = data.result
        const transformedResult: VideoInfo = {
          ...result,
          id: result.v,
          url: url,
          original_url: url,
          formats: [...result.available.videos, ...result.available.audios].map(format => ({
            ...format,
            format_id: format.id,
            ext: format.format,
            quality: format.info,
            resolution: format.scale,
            format_note: format.info,
            // Generate download URL for this format
            url: `http://localhost:8080/files/${result.v}${result.p ? `/p${result.p}` : ''}/${format.id}/${result.v}.${format.format}`
          }))
        }

        return {
          success: true,
          result: transformedResult
        }
      }

      return data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || error.message || '网络请求失败')
      }
      throw error
    }
  }

  /**
   * Download video
   */
  static async downloadVideo(request: DownloadVideoRequest): Promise<DownloadVideoResponse> {
    try {
      const response = await api.get('/download', { params: request })
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || error.message || '下载请求失败')
      }
      throw error
    }
  }

  /**
   * Download subtitle
   */
  static async downloadSubtitle(request: SubtitleRequest): Promise<SubtitleResponse> {
    try {
      const response = await api.post('/subtitle', request)
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || error.message || '字幕下载失败')
      }
      throw error
    }
  }

  /**
   * Get server health status
   */
  static async getHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await api.get('/health')
      return response.data
    } catch (error) {
      throw new Error('服务器连接失败')
    }
  }

  /**
   * Get proxy URL for thumbnails
   */
  static getProxyUrl(url: string): string {
    return `${API_BASE_URL}/proxy?url=${encodeURIComponent(url)}`
  }
}

export default api
