// src/utils/audioParse.js

/**
 * Processes raw audio data into waveform data suitable for visualization
 */
export const processAudioData = (audioData) => {
  // Convert Uint8Array to standard array and normalize values to 0-1 range
  const normalizedData = Array.from(audioData).map(val => val / 255);
  
  // Calculate key metrics from the audio data
  const metrics = {
    // Average amplitude across all frequencies
    amplitude: normalizedData.reduce((sum, val) => sum + val, 0) / normalizedData.length,
    
    // Find peak frequencies
    peaks: findPeaks(normalizedData),
    
    // Calculate energy in different frequency bands
    lowFreq: averageRange(normalizedData, 0, 10),
    midFreq: averageRange(normalizedData, 11, 100),
    highFreq: averageRange(normalizedData, 101, 255),
    
    // Get rhythm information
    beatDetected: detectBeat(normalizedData),
  };

  return {
    waveform: normalizedData,
    metrics,
    // Generate parameters suitable for the visualization
    visualParams: {
      // Base intensity from overall amplitude
      intensity: Math.pow(metrics.amplitude * 2, 1.5),
      
      // Wave speed influenced by beat detection
      speed: metrics.beatDetected ? 1.5 : 1.0,
      
      // Color intensity from high frequencies
      colorIntensity: metrics.highFreq * 1.5,
      
      // Pattern size modulated by low frequencies
      patternSize: 1 + (metrics.lowFreq * 0.5),
      
      // Additional wave complexity from mid frequencies
      complexity: 1 + (metrics.midFreq * 2)
    }
  };
};

// Helper functions
const findPeaks = (data) => {
  const peaks = [];
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > 0.5) {
      peaks.push({ index: i, value: data[i] });
    }
  }
  return peaks;
};

const averageRange = (data, start, end) => {
  const range = data.slice(start, end + 1);
  return range.reduce((sum, val) => sum + val, 0) / range.length;
};

// Simple beat detection
let lastBeatTime = 0;
let beatHistory = [];

const detectBeat = (data) => {
  const now = Date.now();
  const minBeatInterval = 250; // Minimum 250ms between beats
  
  // Calculate current energy in the low frequency range
  const currentEnergy = averageRange(data, 0, 10);
  
  // Keep a rolling average of energy
  beatHistory.push(currentEnergy);
  if (beatHistory.length > 8) beatHistory.shift();
  
  const averageEnergy = beatHistory.reduce((sum, val) => sum + val, 0) / beatHistory.length;
  
  // Check if we have a beat
  if (currentEnergy > averageEnergy * 1.5 && now - lastBeatTime > minBeatInterval) {
    lastBeatTime = now;
    return true;
  }
  
  return false;
};