'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Play, 
  Loader2, 
  AlertCircle,
  Link as LinkIcon,
  Download
} from 'lucide-react'
import { useVideoStore } from '@/store/video-store'
import { VideoAPI } from '@/lib/api'
import { isValidVideoUrl } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { QualitySelector } from './quality-selector'
import { VideoQuality } from '@/types/video'

export function VideoParser() {
  const [url, setUrl] = useState('')
  const [selectedQuality, setSelectedQuality] = useState<VideoQuality>('720p')
  const { setCurrentVideo, setLoading, setError, isLoading } = useVideoStore()
  const { toast } = useToast()

  const handleParse = async () => {
    if (!url.trim()) {
      toast({
        title: "请输入视频链接",
        description: "请粘贴YouTube或Bilibili视频链接",
        variant: "destructive",
      })
      return
    }

    if (!isValidVideoUrl(url)) {
      toast({
        title: "无效的视频链接",
        description: "请确保输入的是有效的YouTube或Bilibili视频链接",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await VideoAPI.parseVideo(url.trim())
      if (response.success && response.result) {
        const videoInfo = response.result
        setCurrentVideo(videoInfo)
        toast({
          title: "解析成功",
          description: `已成功解析视频: ${videoInfo.title}`,
        })
      } else {
        throw new Error(response.error || '解析失败')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '解析失败'
      setError(errorMessage)
      toast({
        title: "解析失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleParse()
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && isValidVideoUrl(text)) {
        setUrl(text)
        toast({
          title: "链接已粘贴",
          description: "检测到有效的视频链接",
        })
      }
    } catch (error) {
      // Clipboard API might not be available
      console.warn('Clipboard API not available')
    }
  }

  return (
    <div className="space-y-6">
      {/* URL Input Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Input
              type="url"
              placeholder="粘贴YouTube或Bilibili视频链接"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
              className="pr-10"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePaste}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
              disabled={isLoading}
            >
              <LinkIcon className="w-4 h-4" />
            </Button>
          </div>
          
          <Button
            onClick={handleParse}
            disabled={isLoading || !url.trim()}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                解析中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                解析视频
              </>
            )}
          </Button>
        </div>

        {/* Quality Selector */}
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-muted-foreground">
            视频质量:
          </span>
          <QualitySelector
            value={selectedQuality}
            onChange={setSelectedQuality}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Quick Examples */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-medium">使用说明:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 支持YouTube链接和短链接 (youtu.be)</li>
                <li>• 支持Bilibili视频链接 (bilibili.com/video/)</li>
                <li>• 支持播放列表中的单个视频</li>
                <li>• 建议选择720p或以下质量以获得更好的播放体验</li>
                <li>• 解析可能需要10-30秒，请耐心等待</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
