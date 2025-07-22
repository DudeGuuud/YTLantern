'use client'

import { useState } from 'react'
import { useVideoStore } from '@/store/video-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  X, 
  Search, 
  Trash2, 
  Play,
  Clock,
  Eye,
  Calendar
} from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import { HistoryItem } from '@/types/video'

interface HistoryPanelProps {
  onClose: () => void
}

export function HistoryPanel({ onClose }: HistoryPanelProps) {
  const { 
    history, 
    setCurrentVideo, 
    removeFromHistory, 
    clearHistory,
    updateAccessCount 
  } = useVideoStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [showConfirmClear, setShowConfirmClear] = useState(false)

  // Filter history based on search query
  const filteredHistory = history.filter(item =>
    item.video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.video.uploader.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handlePlayVideo = (item: HistoryItem) => {
    setCurrentVideo(item.video)
    updateAccessCount(item.id)
    onClose()
  }

  const handleRemoveItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeFromHistory(id)
  }

  const handleClearHistory = () => {
    if (showConfirmClear) {
      clearHistory()
      setShowConfirmClear(false)
    } else {
      setShowConfirmClear(true)
      setTimeout(() => setShowConfirmClear(false), 3000)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return '今天'
    if (diffDays === 2) return '昨天'
    if (diffDays <= 7) return `${diffDays} 天前`
    
    return date.toLocaleDateString('zh-CN')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>观看历史</span>
              <span className="text-sm text-muted-foreground">
                ({history.length} 个视频)
              </span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索视频标题或作者..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Button
              variant={showConfirmClear ? "destructive" : "outline"}
              size="sm"
              onClick={handleClearHistory}
              disabled={history.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {showConfirmClear ? "确认清空" : "清空历史"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "没有找到匹配的视频" : "暂无观看历史"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handlePlayVideo(item)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      <div className="relative flex-shrink-0">
                        <img
                          src={item.video.thumbnail}
                          alt={item.video.title}
                          className="w-32 h-20 object-cover rounded-md"
                        />
                        <div className="absolute inset-0 bg-black/20 rounded-md flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Play className="w-8 h-8 text-white" />
                        </div>
                        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                          {formatDuration(item.video.duration)}
                        </div>
                      </div>

                      {/* Video Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium line-clamp-2 mb-2">
                          {item.video.title}
                        </h3>
                        
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-2">
                          <span>{item.video.uploader}</span>
                          
                          {item.video.view_count && (
                            <div className="flex items-center space-x-1">
                              <Eye className="w-3 h-3" />
                              <span>{item.video.view_count.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(item.last_accessed)}</span>
                            </div>
                            <span>观看 {item.access_count} 次</span>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleRemoveItem(item.id, e)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
