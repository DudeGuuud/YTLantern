'use client'

import { VideoQuality, QualityOption } from '@/types/video'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface QualitySelectorProps {
  value: VideoQuality
  onChange: (quality: VideoQuality) => void
  disabled?: boolean
}

const qualityOptions: QualityOption[] = [
  {
    value: '144p',
    label: '144p',
    description: '最低质量，节省流量'
  },
  {
    value: '240p',
    label: '240p',
    description: '低质量'
  },
  {
    value: '360p',
    label: '360p',
    description: '标清流畅'
  },
  {
    value: '480p',
    label: '480p',
    description: '标清'
  },
  {
    value: '720p',
    label: '720p HD',
    description: '高清 (推荐)'
  },
  {
    value: '1080p',
    label: '1080p Full HD',
    description: '全高清'
  },
  {
    value: '1440p',
    label: '1440p 2K',
    description: '2K超高清'
  },
  {
    value: '2160p',
    label: '2160p 4K',
    description: '4K超高清'
  },
  {
    value: 'best',
    label: '最佳质量',
    description: '自动选择最佳质量'
  }
]

export function QualitySelector({ value, onChange, disabled }: QualitySelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(newValue) => onChange(newValue as VideoQuality)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="选择质量" />
      </SelectTrigger>
      <SelectContent>
        {qualityOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
