const TTS_REST_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize'

export async function synthesizeSpeech(word: string): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_TTS_API_KEY is not set')

  const response = await fetch(`${TTS_REST_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: word },
      voice: { languageCode: 'en-US', name: 'en-US-Standard-C' },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`TTS API error ${response.status}: ${err}`)
  }

  const json = await response.json() as { audioContent?: string }
  if (!json.audioContent) throw new Error('No audio content returned')
  return Buffer.from(json.audioContent, 'base64')
}
