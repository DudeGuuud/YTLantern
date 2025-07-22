import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { VideoInfo, HistoryItem, VideoQuality } from '@/types/video'

interface VideoState {
  // Current video state
  currentVideo: VideoInfo | null
  isLoading: boolean
  error: string | null
  
  // History
  history: HistoryItem[]
  
  // Settings
  defaultQuality: VideoQuality
  autoPlay: boolean
  
  // Actions
  setCurrentVideo: (video: VideoInfo | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  addToHistory: (video: VideoInfo) => void
  removeFromHistory: (id: string) => void
  clearHistory: () => void
  updateAccessCount: (id: string) => void
  setDefaultQuality: (quality: VideoQuality) => void
  setAutoPlay: (autoPlay: boolean) => void
}

export const useVideoStore = create<VideoState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentVideo: null,
      isLoading: false,
      error: null,
      history: [],
      defaultQuality: '720p',
      autoPlay: false,

      // Actions
      setCurrentVideo: (video) => {
        set({ currentVideo: video, error: null })
        if (video) {
          get().addToHistory(video)
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error, isLoading: false }),

      addToHistory: (video) => {
        const { history } = get()
        const existingIndex = history.findIndex(item => item.video.id === video.id)
        
        if (existingIndex >= 0) {
          // Update existing item
          const updatedHistory = [...history]
          updatedHistory[existingIndex] = {
            ...updatedHistory[existingIndex],
            last_accessed: new Date().toISOString(),
            access_count: updatedHistory[existingIndex].access_count + 1
          }
          set({ history: updatedHistory })
        } else {
          // Add new item
          const newItem: HistoryItem = {
            id: `${video.id}-${Date.now()}`,
            video,
            parsed_at: new Date().toISOString(),
            access_count: 1,
            last_accessed: new Date().toISOString()
          }
          set({ history: [newItem, ...history.slice(0, 49)] }) // Keep only 50 items
        }
      },

      removeFromHistory: (id) => {
        const { history } = get()
        set({ history: history.filter(item => item.id !== id) })
      },

      clearHistory: () => set({ history: [] }),

      updateAccessCount: (id) => {
        const { history } = get()
        const updatedHistory = history.map(item =>
          item.id === id
            ? {
                ...item,
                access_count: item.access_count + 1,
                last_accessed: new Date().toISOString()
              }
            : item
        )
        set({ history: updatedHistory })
      },

      setDefaultQuality: (quality) => set({ defaultQuality: quality }),

      setAutoPlay: (autoPlay) => set({ autoPlay }),
    }),
    {
      name: 'ytlantern-storage',
      partialize: (state) => ({
        history: state.history,
        defaultQuality: state.defaultQuality,
        autoPlay: state.autoPlay,
      }),
    }
  )
)
