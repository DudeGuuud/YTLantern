'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { VideoParser } from '@/components/video/video-parser'
import { VideoPlayer } from '@/components/video/video-player'
import { HistoryPanel } from '@/components/history/history-panel'
import { useVideoStore } from '@/store/video-store'
import { Card } from '@/components/ui/card'

export default function HomePage() {
  const { currentVideo, isLoading } = useVideoStore()
  const [showHistory, setShowHistory] = useState(false)

  return (
    <div className="min-h-screen">
      <Header onToggleHistory={() => setShowHistory(!showHistory)} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4 animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              YTLantern
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              只需粘贴链接，即可开始观看。
            </p>
          </div>

          {/* Video Parser */}
          <Card className="p-6 glass-effect">
            <VideoParser />
          </Card>

          {/* Video Player */}
          {currentVideo && (
            <Card className="p-6 animate-fade-in">
              <VideoPlayer video={currentVideo} />
            </Card>
          )}

          {/* Loading State */}
          {isLoading && (
            <Card className="p-8 text-center animate-fade-in">
              <div className="space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground">正在解析视频，请稍候...</p>
              </div>
            </Card>
          )}

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">极速解析</h3>
              <p className="text-sm text-muted-foreground">采用最新的解析技术，快速获取视频直链</p>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">稳定可靠</h3>
              <p className="text-sm text-muted-foreground">多节点部署，确保服务稳定性和可用性</p>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">隐私保护</h3>
              <p className="text-sm text-muted-foreground">不记录用户数据，保护您的隐私安全</p>
            </Card>
          </div>
        </div>
      </main>

      {/* History Panel */}
      {showHistory && (
        <HistoryPanel onClose={() => setShowHistory(false)} />
      )}
    </div>
  )
}
