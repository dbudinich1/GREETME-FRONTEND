// src/components/VoiceRecorder.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Upload } from 'lucide-react';
import { validateAudioFile } from '../utils/helpers';
import { getErrorMessage } from '../utils/errorMessages';
import Alert from './Alert';

export default function VoiceRecorder({ onUpload, existingVoice }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);
  const timerRef = useRef(null);
  const mimeTypeRef = useRef('audio/webm');

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Detect supported MIME type (Chrome → webm, Safari → mp4)
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
          mimeType = 'audio/mpeg';
        }
      }
      mimeTypeRef.current = mimeType;

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      setError(null);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      setError('Could not access microphone. Please grant permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const playAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    const ext = mimeTypeRef.current === 'audio/mp4' ? 'mp4' : mimeTypeRef.current === 'audio/mpeg' ? 'mp3' : 'webm';
    const file = new File([audioBlob], `voice-recording.${ext}`, { type: mimeTypeRef.current });
    const validation = validateAudioFile(file);

    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('voice', file);
      await onUpload(formData);
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Recording Script */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Read this script clearly:</h4>
        <p className="text-sm text-blue-800 italic">
          "Hello! This is my voice for Greet-Me. I'm recording this sample so my greetings can sound natural and personal. 
          I hope this helps create wonderful messages for my friends and family. Thank you for using Greet-Me!"
        </p>
      </div>

      {/* Recording Interface */}
      <div className="border border-gray-200 rounded-lg p-6">
        {!audioBlob ? (
          <div className="text-center">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="w-24 h-24 mx-auto rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-all"
              >
                <Mic size={40} />
              </button>
            ) : (
              <div>
                <button
                  onClick={stopRecording}
                  className="w-24 h-24 mx-auto rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg animate-pulse"
                >
                  <Square size={40} />
                </button>
                <p className="mt-4 text-2xl font-bold text-red-500">
                  {formatTime(recordingTime)}
                </p>
                <p className="text-sm text-gray-600">Recording...</p>
              </div>
            )}
            {!isRecording && (
              <p className="mt-4 text-sm text-gray-600">
                Click the microphone to start recording
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Audio Player */}
            <audio
              ref={audioPlayerRef}
              src={audioUrl}
              onEnded={handleAudioEnded}
              className="hidden"
            />

            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={isPlaying ? pauseAudio : playAudio}
                className="w-16 h-16 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              <div className="flex-1">
                <div className="bg-gray-200 h-2 rounded-full">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '0%' }} />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Duration: {formatTime(recordingTime)}
                </p>
              </div>
            </div>

            <div className="flex justify-center space-x-3">
              <button
                onClick={resetRecording}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                Re-record
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center"
              >
                <Upload size={18} className="mr-2" />
                {uploading ? 'Uploading...' : 'Upload Voice'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Existing Voice Status */}
      {existingVoice && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            ✓ Voice configured. Record a new sample to update.
          </p>
        </div>
      )}
    </div>
  );
}
