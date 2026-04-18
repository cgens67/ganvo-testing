import { NextRequest, NextResponse } from 'next/server'

interface LRCLIBResponse {
  id: number
  trackName: string
  artistName: string
  albumName: string
  duration: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

export interface LyricLine {
  time: number
  text: string
}

function parseSyncedLyrics(syncedLyrics: string): LyricLine[] {
  const lines: LyricLine[] = []
  const regex = /\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.*)$/gm
  let match

  while ((match = regex.exec(syncedLyrics)) !== null) {
    const minutes = parseInt(match[1], 10)
    const seconds = parseInt(match[2], 10)
    const hundredths = parseInt(match[3], 10)
    const text = match[4].trim()

    if (text) {
      const time = minutes * 60 + seconds + hundredths / 100
      lines.push({ time, text })
    }
  }

  return lines.sort((a, b) => a.time - b.time)
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const trackName = searchParams.get('track')
  const artistName = searchParams.get('artist')
  const albumName = searchParams.get('album')
  const duration = searchParams.get('duration')

  if (!trackName || !artistName) {
    return NextResponse.json({ error: 'Track name and artist name are required' }, { status: 400 })
  }

  try {
    // Try exact match first
    const exactParams = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
      ...(albumName && { album_name: albumName }),
      ...(duration && { duration: duration }),
    })

    let response = await fetch(`https://lrclib.net/api/get?${exactParams}`, {
      headers: {
        'User-Agent': 'v0AudioPlayer/1.0 (https://v0.dev)',
      },
    })

    let data: LRCLIBResponse | null = null

    if (response.ok) {
      data = await response.json()
    } else {
      // Fallback to search
      const searchResponse = await fetch(
        `https://lrclib.net/api/search?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`,
        {
          headers: {
            'User-Agent': 'v0AudioPlayer/1.0 (https://v0.dev)',
          },
        }
      )

      if (searchResponse.ok) {
        const searchResults: LRCLIBResponse[] = await searchResponse.json()
        if (searchResults.length > 0) {
          data = searchResults[0]
        }
      }
    }

    if (!data) {
      return NextResponse.json({ error: 'No lyrics found', lyrics: null, syncedLyrics: null })
    }

    const syncedLines = data.syncedLyrics ? parseSyncedLyrics(data.syncedLyrics) : null

    return NextResponse.json({
      trackName: data.trackName,
      artistName: data.artistName,
      albumName: data.albumName,
      duration: data.duration,
      instrumental: data.instrumental,
      plainLyrics: data.plainLyrics,
      syncedLyrics: syncedLines,
    })
  } catch (error) {
    console.error('LRCLIB error:', error)
    return NextResponse.json({ error: 'Failed to fetch lyrics' }, { status: 500 })
  }
}
