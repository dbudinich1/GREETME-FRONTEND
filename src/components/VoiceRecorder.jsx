// components/VoiceRecorder.jsx
// Voice recording component using MediaRecorder API

import React, { useState, useRef, useEffect } from 'react';

export const VoiceRecorder = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioURL, setAudioURL] = useState(null);
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const script = `Hello! This is me speaking. I'm creating a personalized voice for my automated greetings. 
I want my friends and family to hear my voice when they receive special messages from me. 
Technology is amazing, and I'm excited to use it to stay connected with the people I care about.`;

  useEffect(() => {
    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        
        if (onRecordingComplete) {
          onRecordingComplete(blob);
        }

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Unable to access microphone. Please check your browser permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    setAudioURL(null);
    setRecordingTime(0);
    chunksRef.current = [];
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Script to read */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Read this script
        </h3>
        <p className="text-gray-700 leading-relaxed italic">
          "{script}"
        </p>
        <p className="text-sm text-gray-600 mt-4">
          📝 Reading time: 30-45 seconds. Speak clearly and naturally.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Recording controls */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 text-center">
        {/* Recording indicator */}
        {isRecording && (
          <div className="mb-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-lg font-medium text-gray-900">
                {isPaused ? 'Paused' : 'Recording...'}
              </span>
            </div>
            <div className="text-4xl font-bold text-gray-900 tabular-nums">
              {formatTime(recordingTime)}
            </div>
          </div>
        )}

        {/* Microphone icon */}
        {!isRecording && !audioURL && (
          <div className="mb-6">
            <div className={`w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-xl ${
              isRecording ? 'animate-pulse' : ''
            }`}>
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex justify-center gap-4">
          {!isRecording && !audioURL && (
            <button
              onClick={startRecording}
              className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-105"
            >
              Start Recording
            </button>
          )}

          {isRecording && !isPaused && (
            <>
              <button
                onClick={pauseRecording}
                className="px-6 py-3 bg-yellow-500 text-white rounded-xl font-semibold shadow-lg hover:bg-yellow-600 transition-all"
              >
                Pause
              </button>
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-red-500 text-white rounded-xl font-semibold shadow-lg hover:bg-red-600 transition-all"
              >
                Stop
              </button>
            </>
          )}

          {isRecording && isPaused && (
            <>
              <button
                onClick={resumeRecording}
                className="px-6 py-3 bg-green-500 text-white rounded-xl font-semibold shadow-lg hover:bg-green-600 transition-all"
              >
                Resume
              </button>
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-red-500 text-white rounded-xl font-semibold shadow-lg hover:bg-red-600 transition-all"
              >
                Stop
              </button>
            </>
          )}
        </div>

        {/* Playback */}
        {audioURL && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-center gap-3 text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Recording complete!</span>
            </div>
            
            <audio
              src={audioURL}
              controls
              className="w-full max-w-md mx-auto"
            />

            <div className="flex justify-center gap-4">
              <button
                onClick={resetRecording}
                className="px-6 py-2 text-gray-700 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-all"
              >
                Record Again
              </button>
              <button
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                Save & Upload
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Recording Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Find a quiet space with minimal background noise</li>
          <li>• Speak clearly and at a natural pace</li>
          <li>• Aim for 30-60 seconds of recording</li>
          <li>• Your voice will be used to create personalized greetings</li>
        </ul>
      </div>
    </div>
  );
};
