import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal Web Speech API typings (not in lib.dom for every TS version).
interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike { readonly isFinal: boolean; readonly length: number; [index: number]: SpeechRecognitionAlternativeLike }
interface SpeechRecognitionEventLike extends Event { readonly resultIndex: number; readonly results: { readonly length: number; [index: number]: SpeechRecognitionResultLike } }
interface SpeechRecognitionErrorEventLike extends Event { readonly error: string }
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const candidate = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null
}

const errorMessages: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser settings to dictate.',
  'service-not-allowed': 'Speech recognition is not allowed in this browser.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs a network connection.',
}

/**
 * Wraps the browser Web Speech API for dictation. Continuous with interim results; each final transcript
 * is passed to `onFinal`. `supported` is false when the browser has no SpeechRecognition.
 */
export function useSpeechDictation(onFinal: (text: string) => void, lang?: string) {
  const [supported] = useState(() => getRecognitionConstructor() !== null)
  const [listening, setListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onFinalRef = useRef(onFinal)
  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])

  const stop = useCallback(() => { recognitionRef.current?.stop() }, [])

  const start = useCallback(() => {
    const Recognition = getRecognitionConstructor()
    if (!Recognition || recognitionRef.current) return
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
    recognition.onresult = (event) => {
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) { if (transcript.trim()) onFinalRef.current(transcript.trim()) }
        else interim += transcript
      }
      setInterimText(interim)
    }
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      setError(errorMessages[event.error] ?? 'Voice dictation stopped because of an error.')
    }
    recognition.onend = () => { recognitionRef.current = null; setListening(false); setInterimText('') }
    recognitionRef.current = recognition
    setError(null)
    try { recognition.start(); setListening(true) }
    catch { recognitionRef.current = null; setError('Voice dictation could not start.') }
  }, [lang])

  useEffect(() => () => { recognitionRef.current?.abort() }, [])

  return { supported, listening, interimText, start, stop, error }
}
