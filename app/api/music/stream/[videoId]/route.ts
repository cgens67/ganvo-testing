import { NextRequest, NextResponse } from 'next/server'

// Updated working Piped API instances from official documentation
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.privacy.com.de',
  'https://pipedapi.reallyaweso.me',
  'https://pipedapi.drgns.space',
  'https://pipedapi.owo.si',
  'https://piped-api.codespace.cz',
  'https://api.piped.private.coffee',
]

async function tryPipedStream(videoId: string, instance: string): Promise<{ audioUrl: string; duration: number; instance: string } | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(`${instance}/streams/${videoId}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    // Get audio streams and sort by bitrate (highest quality first)
    const audioStreams = (data.audioStreams || [])
      .filter((stream: { url?: string; mimeType?: string }) => stream.url && stream.mimeType?.includes('audio'))
      .sort((a: { bitrate?: number }, b: { bitrate?: number }) => (b.bitrate || 0) - (a.bitrate || 0))

    if (audioStreams.length > 0) {
      return {
        audioUrl: audioStreams[0].url,
        duration: data.duration || 0,
        instance,
      }
    }
    
    return null
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
  }

  // Try all Piped instances in parallel for faster response
  const results = await Promise.allSettled(
    PIPED_INSTANCES.map(instance => tryPipedStream(videoId, instance))
  )

  // Find the first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return NextResponse.json(result.value)
    }
  }

  // If parallel failed, try sequentially with longer timeout
  for (const instance of PIPED_INSTANCES) {
    const result = await tryPipedStream(videoId, instance)
    if (result) {
      return NextResponse.json(result)
    }
  }

  return NextResponse.json(
    { error: 'Could not find audio stream. This song may be region-restricted or unavailable.' },
    { status: 404 }
  )
}
