import { TextToSpeechClient } from '@google-cloud/text-to-speech'

let _client: TextToSpeechClient | null = null

function getClient() {
  if (!_client) {
    _client = new TextToSpeechClient({
      apiKey: process.env.GOOGLE_TTS_API_KEY,
    })
  }
  return _client
}

export function buildTtsRequest(word: string) {
  return {
    input: { text: word },
    voice: { languageCode: 'en-US', name: 'en-US-Standard-C' },
    audioConfig: { audioEncoding: 'MP3' as const },
  }
}

export async function synthesizeSpeech(word: string): Promise<Buffer> {
  const client = getClient()
  const [response] = await client.synthesizeSpeech(buildTtsRequest(word))
  if (!response.audioContent) throw new Error('No audio content returned')
  return Buffer.from(response.audioContent as Uint8Array)
}
