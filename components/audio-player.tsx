"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Search,
  Shuffle,
  Repeat,
  Repeat1,
  Sun,
  Moon,
  Loader2,
  Music2,
  X,
  ListMusic,
  Mic2,
  MoreVertical,
  Info,
  Heart,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Song {
  videoId: string
  title: string
  artist: string
  album: string
  duration: number
  thumbnail: string
}

interface LyricLine {
  time: number
  text: string
}

interface LyricsData {
  syncedLyrics: LyricLine[] | null
  plainLyrics: string | null
}

export function AudioPlayer() {
  const [isDark, setIsDark] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [queue, setQueue] = useState<Song[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off")
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [showLyrics, setShowLyrics] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [showAboutDialog, setShowAboutDialog] = useState(false)
  const [showCreditsDialog, setShowCreditsDialog] = useState(false)
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set())
  const [searchFocused, setSearchFocused] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const currentSong = queue[currentIndex]

  // Toggle dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  }, [isDark])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounced auto-search while typing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/music/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await response.json()
        setSearchResults(data.results || [])
      } catch (error) {
        console.error("Search failed:", error)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  // Add song to queue and play
  const addToQueueAndPlay = async (song: Song) => {
    const existingIndex = queue.findIndex((s) => s.videoId === song.videoId)
    if (existingIndex >= 0) {
      setCurrentIndex(existingIndex)
    } else {
      setQueue((prev) => [...prev, song])
      setCurrentIndex(queue.length)
    }
    setSearchResults([])
    setSearchQuery("")
    setIsSearchExpanded(false)
    setSearchFocused(false)
  }

  // Load audio stream when song changes
  useEffect(() => {
    if (!currentSong) return

    const loadStream = async () => {
      setIsLoading(true)
      setAudioUrl(null)
      setLoadError(null)

      try {
        const response = await fetch(`/api/music/stream/${currentSong.videoId}`)
        const data = await response.json()

        if (data.error) {
          setLoadError(data.error)
          return
        }

        if (data.audioUrl) {
          setAudioUrl(data.audioUrl)
        } else {
          setLoadError("No audio stream available")
        }
      } catch (error) {
        console.error("Failed to load stream:", error)
        setLoadError("Network error. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    loadStream()
  }, [currentSong?.videoId])

  // Load lyrics when song changes
  useEffect(() => {
    if (!currentSong) return

    const loadLyrics = async () => {
      setLyrics(null)
      setCurrentLyricIndex(-1)

      try {
        const params = new URLSearchParams({
          track: currentSong.title,
          artist: currentSong.artist,
          ...(currentSong.album && { album: currentSong.album }),
          ...(currentSong.duration && { duration: String(currentSong.duration) }),
        })

        const response = await fetch(`/api/lyrics?${params}`)
        const data = await response.json()

        if (data.syncedLyrics || data.plainLyrics) {
          setLyrics({
            syncedLyrics: data.syncedLyrics,
            plainLyrics: data.plainLyrics,
          })
        }
      } catch (error) {
        console.error("Failed to load lyrics:", error)
      }
    }

    loadLyrics()
  }, [currentSong?.videoId])

  // Auto-play when audio URL is ready
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.load()
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true)
        })
        .catch((err) => {
          console.error("Playback error:", err)
          setLoadError("Playback failed. Try another song.")
        })
    }
  }, [audioUrl])

  // Update current lyric based on time
  useEffect(() => {
    if (!lyrics?.syncedLyrics) return

    const lyric = lyrics.syncedLyrics.findLast((l) => l.time <= currentTime)
    const index = lyric ? lyrics.syncedLyrics.indexOf(lyric) : -1

    if (index !== currentLyricIndex) {
      setCurrentLyricIndex(index)

      // Auto-scroll to current lyric
      if (lyricsContainerRef.current && index >= 0) {
        const lyricElements = lyricsContainerRef.current.querySelectorAll(".lyric-line")
        lyricElements[index]?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  }, [currentTime, lyrics, currentLyricIndex])

  // Audio event handlers
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleEnded = () => {
    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play()
      }
    } else {
      playNext()
    }
  }

  // Playback controls
  const togglePlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, audioUrl])

  const playNext = useCallback(() => {
    if (queue.length === 0) return

    let nextIndex: number
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length)
    } else {
      nextIndex = (currentIndex + 1) % queue.length
    }

    if (nextIndex === 0 && repeatMode === "off" && !shuffle) {
      setIsPlaying(false)
      return
    }

    setCurrentIndex(nextIndex)
  }, [queue.length, currentIndex, shuffle, repeatMode])

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return

    if (currentTime > 3) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
      }
      return
    }

    const prevIndex = (currentIndex - 1 + queue.length) % queue.length
    setCurrentIndex(prevIndex)
  }, [queue.length, currentIndex, currentTime])

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? volume / 100 : 0
    }
  }

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index))
    if (index < currentIndex) {
      setCurrentIndex((prev) => prev - 1)
    } else if (index === currentIndex && queue.length > 1) {
      if (index === queue.length - 1) {
        setCurrentIndex((prev) => prev - 1)
      }
    }
  }

  const toggleLike = (videoId: string) => {
    setLikedSongs((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) {
        next.delete(videoId)
      } else {
        next.add(videoId)
      }
      return next
    })
  }

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2

  const showSearchDropdown = searchFocused && (searchResults.length > 0 || isSearching)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background transition-colors duration-500">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => setLoadError("Audio playback error. Try another song.")}
      />

      {/* Header - Google style - fixed height */}
      <header className="elevation-1 z-30 flex h-16 flex-shrink-0 items-center justify-between px-4 transition-all duration-300 md:px-6">
        <div className="flex items-center gap-3">
          <div className="m3-transition flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--google-red)] transition-transform hover:scale-110 hover:rotate-3">
            <Music2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-normal text-muted-foreground">Google</span>
            <span className="text-xl font-medium">Music</span>
          </div>
        </div>

        {/* Search bar - Google style */}
        <div ref={searchContainerRef} className="relative mx-4 max-w-2xl flex-1">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for songs, artists, or albums"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              className={cn(
                "h-12 w-full rounded-full border-0 bg-muted pl-12 pr-12 text-base shadow-none transition-all duration-300",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:shadow-lg focus-visible:bg-card",
                searchFocused && "bg-card shadow-lg ring-2 ring-primary"
              )}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearchQuery("")
                  setSearchResults([])
                }}
                className="absolute right-3 h-8 w-8 rounded-full transition-all duration-200 hover:scale-110 hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Search Results Dropdown - Fixed click issue */}
          {showSearchDropdown && (
            <div 
              className={cn(
                "elevation-3 dropdown-in absolute left-0 right-0 top-full z-50 mt-2 flex flex-col overflow-hidden rounded-2xl border bg-card",
                isSearchExpanded ? "max-h-[70vh]" : "max-h-[400px]"
              )}
            >
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2">
                  {isSearching && searchResults.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-3 text-muted-foreground">Searching...</span>
                    </div>
                  ) : (
                    searchResults.slice(0, isSearchExpanded ? undefined : 6).map((song, index) => (
                      <button
                        key={song.videoId}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          addToQueueAndPlay(song)
                        }}
                        className="song-card flex w-full items-center gap-4 rounded-xl p-3 text-left"
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                          <img
                            src={song.thumbnail || "/placeholder.svg"}
                            alt={song.title}
                            className="h-full w-full object-cover transition-transform duration-300 hover:scale-110"
                          />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="truncate font-medium">{song.title}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {song.artist} {song.album && `• ${song.album}`}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-sm text-muted-foreground">{formatTime(song.duration)}</span>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
              
              {/* Show all button - outside ScrollArea to fix click issue */}
              {searchResults.length > 6 && (
                <div className="flex-shrink-0 border-t bg-card p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsSearchExpanded(!isSearchExpanded)
                    }}
                    className="m3-transition w-full justify-center gap-2 rounded-lg hover:bg-primary/10"
                  >
                    {isSearchExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Show all {searchResults.length} results
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDark(!isDark)}
            className="m3-transition h-10 w-10 rounded-full hover:scale-110 hover:rotate-12"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="m3-transition h-10 w-10 rounded-full hover:scale-110">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dropdown-in w-48 rounded-xl">
              <DropdownMenuItem onClick={() => setShowAboutDialog(true)} className="m3-transition cursor-pointer gap-3 rounded-lg">
                <Info className="h-4 w-4" />
                About
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowCreditsDialog(true)} className="m3-transition cursor-pointer gap-3 rounded-lg">
                <Heart className="h-4 w-4" />
                Credits
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content - with proper spacing */}
      <div className="flex flex-1 overflow-hidden">
        {/* Player Area - fixed layout with proper spacing */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 md:px-8">
            {currentSong ? (
              <div className="m3-fade-in flex w-full max-w-md flex-col items-center">
                {/* Album Art */}
                <div className="relative mb-6">
                  <div
                    className={cn(
                      "elevation-3 m3-transition h-48 w-48 overflow-hidden rounded-3xl sm:h-64 sm:w-64 md:h-72 md:w-72",
                      isPlaying && "album-float"
                    )}
                  >
                    <img
                      src={currentSong.thumbnail || "/placeholder.svg"}
                      alt={currentSong.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {isLoading && (
                    <div className="m3-fade-in absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-black/70 backdrop-blur-sm">
                      <Loader2 className="h-12 w-12 animate-spin text-white" />
                      <span className="text-sm text-white/80">Loading stream...</span>
                    </div>
                  )}
                  {loadError && !isLoading && (
                    <div className="m3-fade-in absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-black/70 p-4 text-center backdrop-blur-sm">
                      <span className="text-sm text-white/90">{loadError}</span>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => {
                          setLoadError(null)
                          setIsLoading(true)
                          fetch(`/api/music/stream/${currentSong.videoId}`)
                            .then(r => r.json())
                            .then(data => {
                              if (data.audioUrl) setAudioUrl(data.audioUrl)
                              else setLoadError(data.error || "Failed to load")
                            })
                            .catch(() => setLoadError("Network error"))
                            .finally(() => setIsLoading(false))
                        }}
                        className="m3-transition hover:scale-105"
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                  {isPlaying && !isLoading && !loadError && (
                    <div className="playing-glow absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 backdrop-blur-sm">
                      <span className="eq-bar-1 h-3 w-0.5 rounded-full bg-white" />
                      <span className="eq-bar-2 h-3 w-0.5 rounded-full bg-white" />
                      <span className="eq-bar-3 h-3 w-0.5 rounded-full bg-white" />
                      <span className="eq-bar-4 h-3 w-0.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>

                {/* Song Info */}
                <div className="mb-4 flex w-full items-center gap-3">
                  <div className="flex-1 overflow-hidden text-center">
                    <h2 className="mb-1 truncate text-xl font-medium sm:text-2xl">{currentSong.title}</h2>
                    <p className="truncate text-base text-muted-foreground">{currentSong.artist}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleLike(currentSong.videoId)}
                    className={cn(
                      "m3-transition h-10 w-10 rounded-full hover:scale-125",
                      likedSongs.has(currentSong.videoId) && "text-[var(--google-red)]"
                    )}
                  >
                    <Heart className={cn("h-5 w-5 transition-transform", likedSongs.has(currentSong.videoId) && "fill-current scale-110")} />
                  </Button>
                </div>

                {/* Progress Bar */}
                <div className="mb-4 w-full">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSeek}
                    className="mb-2 [&_[data-slot=range]]:bg-primary [&_[data-slot=thumb]]:m3-transition [&_[data-slot=thumb]]:h-4 [&_[data-slot=thumb]]:w-4 [&_[data-slot=thumb]]:border-2 [&_[data-slot=thumb]]:hover:scale-150 [&_[data-slot=track]]:h-1.5"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="mb-4 flex items-center gap-2 sm:gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShuffle(!shuffle)}
                    className={cn(
                      "m3-transition h-10 w-10 rounded-full hover:scale-110",
                      shuffle && "bg-primary/10 text-primary"
                    )}
                  >
                    <Shuffle className="h-5 w-5" />
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={playPrevious} 
                    className="m3-transition h-12 w-12 rounded-full hover:scale-110"
                  >
                    <SkipBack className="h-6 w-6 fill-current" />
                  </Button>

                  <Button
                    onClick={togglePlay}
                    disabled={isLoading || !audioUrl}
                    className={cn(
                      "m3-transition h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 sm:h-16 sm:w-16",
                      isPlaying && "fab-pulse"
                    )}
                    style={{ transform: "scale(1)", transition: "transform 0.2s" }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
                    onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin sm:h-7 sm:w-7" />
                    ) : isPlaying ? (
                      <Pause className="h-6 w-6 fill-current sm:h-7 sm:w-7" />
                    ) : (
                      <Play className="h-6 w-6 fill-current pl-1 sm:h-7 sm:w-7" />
                    )}
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={playNext} 
                    className="m3-transition h-12 w-12 rounded-full hover:scale-110"
                  >
                    <SkipForward className="h-6 w-6 fill-current" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")}
                    className={cn(
                      "m3-transition h-10 w-10 rounded-full hover:scale-110",
                      repeatMode !== "off" && "bg-primary/10 text-primary"
                    )}
                  >
                    {repeatMode === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                  </Button>
                </div>

                {/* Volume Control - Fixed positioning */}
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="m3-transition flex flex-1 items-center gap-3 rounded-full bg-muted px-4 py-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={toggleMute} 
                      className="m3-transition h-8 w-8 flex-shrink-0 rounded-full p-0 hover:scale-110"
                    >
                      <VolumeIcon className="h-4 w-4" />
                    </Button>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      max={100}
                      step={1}
                      onValueChange={handleVolumeChange}
                      className="flex-1 [&_[data-slot=range]]:bg-foreground [&_[data-slot=thumb]]:h-3 [&_[data-slot=thumb]]:w-3 [&_[data-slot=track]]:h-1"
                    />
                    <span className="w-8 flex-shrink-0 text-right text-xs text-muted-foreground">{isMuted ? 0 : volume}%</span>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowLyrics(!showLyrics)}
                    className={cn(
                      "m3-transition h-10 w-10 flex-shrink-0 rounded-full hover:scale-110 lg:hidden",
                      showLyrics && "bg-primary/10 text-primary"
                    )}
                  >
                    <Mic2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="m3-bounce-in flex flex-col items-center px-4 text-center">
                <div className="m3-pulse mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-muted">
                  <Music2 className="h-16 w-16 text-muted-foreground" />
                </div>
                <h2 className="mb-2 text-2xl font-medium">Start listening</h2>
                <p className="max-w-sm text-muted-foreground">
                  Search for your favorite songs, artists, or albums to begin
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Queue & Lyrics */}
        <div className="hidden w-80 flex-col border-l bg-card lg:flex xl:w-96">
          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setShowLyrics(false)}
              className={cn(
                "m3-transition flex flex-1 items-center justify-center gap-2 border-b-2 py-3.5 text-sm font-medium",
                !showLyrics
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ListMusic className="h-4 w-4" />
              Up next ({queue.length})
            </button>
            <button
              onClick={() => setShowLyrics(true)}
              className={cn(
                "m3-transition flex flex-1 items-center justify-center gap-2 border-b-2 py-3.5 text-sm font-medium",
                showLyrics
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Mic2 className="h-4 w-4" />
              Lyrics
            </button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            {showLyrics ? (
              <div ref={lyricsContainerRef} className="p-6">
                {lyrics?.syncedLyrics ? (
                  <div className="space-y-4">
                    {lyrics.syncedLyrics.map((line, index) => (
                      <p
                        key={index}
                        className={cn(
                          "lyric-line m3-transition cursor-pointer rounded-lg px-3 py-2 text-lg leading-relaxed",
                          index === currentLyricIndex
                            ? "scale-[1.02] bg-primary/15 font-medium text-primary"
                            : index < currentLyricIndex
                              ? "text-muted-foreground/50"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.currentTime = line.time
                          }
                        }}
                      >
                        {line.text}
                      </p>
                    ))}
                  </div>
                ) : lyrics?.plainLyrics ? (
                  <p className="m3-fade-in whitespace-pre-wrap leading-relaxed text-muted-foreground">
                    {lyrics.plainLyrics}
                  </p>
                ) : currentSong ? (
                  <div className="m3-fade-in flex flex-col items-center justify-center py-16 text-center">
                    <Mic2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
                    <p className="font-medium">No lyrics available</p>
                    <p className="mt-1 text-sm text-muted-foreground">Lyrics not found for this song</p>
                  </div>
                ) : (
                  <div className="m3-fade-in flex flex-col items-center justify-center py-16 text-center">
                    <Mic2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
                    <p className="text-muted-foreground">Play a song to see lyrics</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2">
                {queue.length > 0 ? (
                  queue.map((song, index) => (
                    <div
                      key={`${song.videoId}-${index}`}
                      className={cn(
                        "song-card group flex items-center gap-3 rounded-xl p-2.5",
                        index === currentIndex ? "bg-primary/10" : ""
                      )}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <button 
                        onClick={() => setCurrentIndex(index)} 
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                          <img
                            src={song.thumbnail || "/placeholder.svg"}
                            alt={song.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                          {index === currentIndex && isPlaying && (
                            <div className="playing-glow absolute inset-0 flex items-center justify-center gap-0.5 bg-black/60">
                              <span className="eq-bar-1 h-3 w-0.5 rounded-full bg-white" />
                              <span className="eq-bar-2 h-3 w-0.5 rounded-full bg-white" />
                              <span className="eq-bar-3 h-3 w-0.5 rounded-full bg-white" />
                              <span className="eq-bar-4 h-3 w-0.5 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p
                            className={cn(
                              "truncate text-sm font-medium",
                              index === currentIndex && "text-primary"
                            )}
                          >
                            {song.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
                        </div>
                      </button>
                      <span className="text-xs text-muted-foreground">{formatTime(song.duration)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromQueue(index)}
                        className="m3-transition h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="m3-fade-in flex flex-col items-center justify-center py-16 text-center">
                    <ListMusic className="mb-4 h-12 w-12 text-muted-foreground/40" />
                    <p className="font-medium">Your queue is empty</p>
                    <p className="mt-1 text-sm text-muted-foreground">Search and add songs to play</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Mobile Bottom Player - Fixed positioning */}
      {currentSong && (
        <div className="elevation-2 m3-slide-up flex flex-shrink-0 items-center gap-3 border-t bg-card p-3 lg:hidden">
          <img
            src={currentSong.thumbnail || "/placeholder.svg"}
            alt={currentSong.title}
            className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
          />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{currentSong.title}</p>
            <p className="truncate text-xs text-muted-foreground">{currentSong.artist}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlay}
            disabled={isLoading || !audioUrl}
            className="m3-transition h-10 w-10 flex-shrink-0 rounded-full hover:scale-110"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current pl-0.5" />
            )}
          </Button>
        </div>
      )}

      {/* About Dialog */}
      <Dialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <DialogContent className="m3-scale-in rounded-3xl sm:max-w-md">
          <DialogHeader>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--google-red)]">
                <Music2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">Google Music</DialogTitle>
                <DialogDescription>Version 1.0.0</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              A modern audio player inspired by Material Design 3 Expressive, featuring YouTube Music search, 
              synchronized lyrics, and beautiful animations.
            </p>
            <p>
              Built with Next.js, Tailwind CSS, and shadcn/ui components.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs">Powered by</span>
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">YouTube Music API</span>
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">LRCLIB</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credits Dialog */}
      <Dialog open={showCreditsDialog} onOpenChange={setShowCreditsDialog}>
        <DialogContent className="m3-scale-in rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-[var(--google-red)]" />
              Credits
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-muted p-4 transition-transform hover:scale-[1.02]">
              <h4 className="mb-2 font-medium">Inspired By</h4>
              <a 
                href="https://github.com/koiverse/ArchiveTune" 
                target="_blank" 
                rel="noopener noreferrer"
                className="m3-transition flex items-center gap-2 text-sm text-primary hover:underline"
              >
                ArchiveTune by koiverse
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="mt-1 text-xs text-muted-foreground">
                Material 3 Expressive YouTube Music client for Android
              </p>
            </div>
            
            <div className="rounded-xl bg-muted p-4 transition-transform hover:scale-[1.02]">
              <h4 className="mb-2 font-medium">APIs & Services</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--google-blue)]" />
                  ytmusic-api - YouTube Music search
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--google-green)]" />
                  LRCLIB - Synchronized lyrics
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--google-yellow)]" />
                  Piped API - Audio streaming
                </li>
              </ul>
            </div>

            <div className="rounded-xl bg-muted p-4 transition-transform hover:scale-[1.02]">
              <h4 className="mb-2 font-medium">Design</h4>
              <p className="text-sm text-muted-foreground">
                Material Design 3 Expressive by Google
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
