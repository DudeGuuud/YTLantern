'use client'

import { useState, useRef, useEffect } from 'react'
import { VideoInfo } from '@/types/video'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Download,
  ExternalLink,
  Clock,
  Eye,
  ThumbsUp,
  User
} from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface VideoPlayerProps {
  video: VideoInfo
}

export function VideoPlayer({ video }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { toast } = useToast()

  // Get the best video format
  const getBestFormat = () => {
    if (!video.formats || video.formats.length === 0) {
      return video.url || ''
    }

    // Prefer mp4 format with good quality
    const mp4Formats = video.formats.filter(f => f.ext === 'mp4')
    if (mp4Formats.length > 0) {
      return mp4Formats[0].url || ''
    }

    return video.formats[0].url || ''
  }

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
    }
  }

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen()
      }
    }
  }

  const handleDownload = () => {
    const format = getBestFormat()
    const link = document.createElement('a')
    link.href = format
    link.download = `${video.title}.mp4`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast({
      title: "下载开始",
      description: "视频下载已开始，请检查浏览器下载文件夹",
    })
  }

  const copyVideoUrl = () => {
    navigator.clipboard.writeText(getBestFormat())
    toast({
      title: "链接已复制",
      description: "视频直链已复制到剪贴板",
    })
  }

  const handleFormatDownload = async (formatId: string, merge: boolean = false) => {
    try {
      const downloadUrl = `http://localhost:8080/api/download?website=${video.website}&v=${video.v}${video.p ? `&p=${video.p}` : ''}&format=${formatId}${merge ? '&merge=true' : ''}`

      const response = await fetch(downloadUrl)
      const result = await response.json()

      if (result.success && result.result?.downloadSucceed) {
        // Open download link
        window.open(`http://localhost:8080/${result.result.dest}`, '_blank')
        toast({
          title: "下载开始",
          description: "文件下载已开始",
        })
      } else {
        throw new Error(result.error || '下载失败')
      }
    } catch (error) {
      toast({
        title: "下载失败",
        description: error instanceof Error ? error.message : '下载请求失败',
        variant: "destructive",
      })
    }
  }

  const handleMergedDownload = async (videoFormatId: string) => {
    if (video.available.audios.length === 0) {
      toast({
        title: "无法合并",
        description: "没有可用的音频格式进行合并",
        variant: "destructive",
      })
      return
    }

    // Use the best audio format for merging
    const bestAudio = video.best.audio || video.available.audios[0]
    const mergedFormat = `${videoFormatId}x${bestAudio.id}`

    await handleFormatDownload(mergedFormat, true)
  }

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.addEventListener('timeupdate', handleTimeUpdate)
      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      
      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate)
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      }
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Video Info Header */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold leading-tight">{video.title}</h2>
        
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <User className="w-4 h-4" />
            <span>{video.uploader}</span>
          </div>
          
          {video.view_count && (
            <div className="flex items-center space-x-1">
              <Eye className="w-4 h-4" />
              <span>{video.view_count.toLocaleString()} 次观看</span>
            </div>
          )}
          

          
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>{formatDuration(video.duration)}</span>
          </div>
        </div>
      </div>

      {/* Video Player */}
      <Card className="overflow-hidden">
        <div className="relative bg-black">
          <video
            ref={videoRef}
            className="w-full aspect-video"
            poster={video.thumbnail}
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src={getBestFormat()} type="video/mp4" />
            您的浏览器不支持视频播放。
          </video>
          
          {/* Custom Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            {/* Progress Bar */}
            <div className="mb-3">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-white/80 mt-1">
                <span>{formatDuration(Math.floor(currentTime))}</span>
                <span>{formatDuration(Math.floor(duration))}</span>
              </div>
            </div>
            
            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayPause}
                  className="text-white hover:bg-white/20"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMute}
                  className="text-white hover:bg-white/20"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </Button>
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFullscreen}
                className="text-white hover:bg-white/20"
              >
                <Maximize className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Download Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">下载选项</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Formats */}
          <div>
            <h4 className="font-medium mb-2">视频格式</h4>
            <div className="grid gap-2">
              {video.available.videos.map((format) => (
                <div key={format.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="font-medium">{format.info}</div>
                    <div className="text-sm text-muted-foreground">
                      {format.scale} • {format.size} MB • {format.format}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleFormatDownload(format.id, false)}
                      className="flex items-center space-x-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>下载</span>
                    </Button>
                    {video.available.audios.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMergedDownload(format.id)}
                        className="flex items-center space-x-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>合并下载</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audio Formats */}
          {video.available.audios.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">音频格式</h4>
              <div className="grid gap-2">
                {video.available.audios.map((format) => (
                  <div key={format.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex-1">
                      <div className="font-medium">{format.info}</div>
                      <div className="text-sm text-muted-foreground">
                        {format.rate}kbps • {format.size} MB • {format.format}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleFormatDownload(format.id, false)}
                      className="flex items-center space-x-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>下载</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button onClick={handleDownload} className="flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>下载最佳质量</span>
            </Button>

            <Button variant="outline" onClick={copyVideoUrl}>
              <ExternalLink className="w-4 h-4 mr-2" />
              复制直链
            </Button>

            <Button variant="outline" asChild>
              <a href={video.original_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                原视频
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Video Description */}
      {video.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">视频描述</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
              {video.description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
