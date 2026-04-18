import { NextRequest, NextResponse } from 'next/server'
import YTMusic from 'ytmusic-api'

const ytmusic = new YTMusic()
let initialized = false

async function ensureInitialized() {
  if (!initialized) {
    await ytmusic.initialize()
    initialized = true
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  try {
    await ensureInitialized()
    const song = await ytmusic.getSong(videoId)
    
    return NextResponse.json({
      videoId: song.videoId,
      title: song.name,
      artist: song.artist?.name || 'Unknown Artist',
      album: song.album?.name || '',
      duration: song.duration || 0,
      thumbnail: song.thumbnails?.[song.thumbnails.length - 1]?.url || '',
    })
  } catch (error) {
    console.error('Failed to get song:', error)
    return NextResponse.json({ error: 'Failed to get song details' }, { status: 500 })
  }
}
