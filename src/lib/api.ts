import axios from 'axios'
import { ParseRequest, ParseResponse, VideoInfo, ApiError } from '@/types/video'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/backend'

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

export class VideoAPI {
  /**
   * Parse YouTube video URL
   */
  static async parseVideo(request: ParseRequest): Promise<VideoInfo> {
    try {
      const response = await api.post<ParseResponse>('/parse', request)
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || '解析失败')
      }
      
      return response.data.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiError
        throw new Error(apiError?.message || error.message || '网络请求失败')
      }
      throw error
    }
  }

  /**
   * Get video info by ID (from cache)
   */
  static async getVideoInfo(videoId: string): Promise<VideoInfo> {
    try {
      const response = await api.get<ParseResponse>(`/video/${videoId}`)
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || '获取视频信息失败')
      }
      
      return response.data.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiError
        throw new Error(apiError?.message || error.message || '网络请求失败')
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
   * Get supported formats for a video
   */
  static async getFormats(videoId: string): Promise<any[]> {
    try {
      const response = await api.get(`/formats/${videoId}`)
      return response.data.formats || []
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiError
        throw new Error(apiError?.message || error.message || '获取格式信息失败')
      }
      throw error
    }
  }
}

export default api
