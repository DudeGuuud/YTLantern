'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  History, 
  Settings, 
  Moon, 
  Sun, 
  Github,
  Menu,
  X
} from 'lucide-react'
import { useTheme } from 'next-themes'

interface HeaderProps {
  onToggleHistory: () => void
}

export function Header({ onToggleHistory }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">YT</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              YTLantern
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleHistory}
              className="flex items-center space-x-2"
            >
              <History className="w-4 h-4" />
              <span>历史记录</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <a
                href="https://github.com/DudeGuuud/ytlantern"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-4 h-4" />
              </a>
            </Button>
          </nav>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t py-4 animate-slide-in">
            <nav className="flex flex-col space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onToggleHistory()
                  setMobileMenuOpen(false)
                }}
                className="justify-start"
              >
                <History className="w-4 h-4 mr-2" />
                历史记录
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTheme(theme === 'dark' ? 'light' : 'dark')
                  setMobileMenuOpen(false)
                }}
                className="justify-start"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 mr-2" />
                    浅色模式
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 mr-2" />
                    深色模式
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                asChild
                className="justify-start"
              >
                <a
                  href="https://github.com/DudeGuuud/ytlantern"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Github className="w-4 h-4 mr-2" />
                  GitHub
                </a>
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
