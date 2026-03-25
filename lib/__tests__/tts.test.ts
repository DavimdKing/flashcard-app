import { buildTtsRequest } from '../tts'

describe('buildTtsRequest', () => {
  it('builds a valid TTS synthesis request', () => {
    const req = buildTtsRequest('Elephant')
    expect(req.input.text).toBe('Elephant')
    expect(req.voice.languageCode).toBe('en-US')
    expect(req.audioConfig.audioEncoding).toBe('MP3')
  })
})
