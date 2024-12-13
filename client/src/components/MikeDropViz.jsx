import React, { useState, useEffect, useCallback, useRef } from 'react';
import { processAudioData } from '../utils/audioParse';

const MikeDropViz = () => {
  // Initialize vertices in a circular pattern
  const [vertices, setVertices] = useState(
    Array.from({ length: 24 }, (_, i) => ({
      x: 400 + Math.cos(i * Math.PI / 12) * 200,
      y: 300 + Math.sin(i * Math.PI / 12) * 200,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      phase: Math.random() * Math.PI * 2,
      hue: i * 15,
      amplitude: 1 + Math.random(),
      frequency: 0.5 + Math.random() * 0.5
    }))
  );
  
  // Animation state
  const [animationState, setAnimationState] = useState({
    isPlaying: false,
    frame: 0
  });
  
  // Base parameters (user-controlled)
  const [parameters, setParameters] = useState({
    flowSpeed: 1,
    colorSpeed: 0.5,
    waveIntensity: 0.7,
    patternSize: 1
  });

  // Audio modulation state (affected by sound input)
  const [audioModulation, setAudioModulation] = useState({
    speedMod: 1,
    intensityMod: 1,
    sizeMod: 1
  });

  // Audio system refs and state
  const audioContextRef = useRef(null);
  const analyzerRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [audioMetrics, setAudioMetrics] = useState(null);

  // Initialize audio system
  const setupAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyzerRef.current = audioContextRef.current.createAnalyser();
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyzerRef.current);
      
      analyzerRef.current.fftSize = 512;
      setIsListening(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  // Process audio data in real-time
  const processAudio = useCallback(() => {
    if (!analyzerRef.current || !isListening) return;

    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(dataArray);
    
    const processedData = processAudioData(dataArray);
    setAudioMetrics(processedData);
    
    // Update modulation values instead of parameters directly
    setAudioModulation({
      speedMod: 1 + (processedData.visualParams.speed - 1) * 0.3, // Reduce effect on speed
      intensityMod: 1 + (processedData.visualParams.intensity - 1) * 0.5, // Reduce effect on intensity
      sizeMod: 1 + (processedData.visualParams.patternSize - 1) * 0.3 // Reduce effect on size
    });
  }, [isListening]);

  // Update vertex positions and properties
  const updateVertices = useCallback(() => {
    const { isPlaying, frame } = animationState;
    const { flowSpeed, colorSpeed, waveIntensity, patternSize } = parameters;
    const { speedMod, intensityMod, sizeMod } = audioModulation;

    setVertices(prev => prev.map((vertex, i) => {
      let { x, y, phase, hue, amplitude, frequency } = vertex;
      
      // Apply audio modulation to parameters
      const effectiveSpeed = flowSpeed * speedMod;
      const effectiveIntensity = waveIntensity * intensityMod;
      const effectiveSize = patternSize * sizeMod;
      
      const time = frame * 0.02 * effectiveSpeed;
      const waveTime = frame * 0.01;
      
      // Calculate base circular motion
      const centerX = 400 + Math.cos(time * 0.2 + i * Math.PI / 12) * (200 * effectiveSize);
      const centerY = 300 + Math.sin(time * 0.2 + i * Math.PI / 12) * (200 * effectiveSize);
      
      // Add flowing motion
      const flowX = Math.sin(time * frequency + phase) * 100 * amplitude;
      const flowY = Math.cos(time * 1.3 * frequency + phase) * 100 * amplitude;
      
      // Add wave effect when active
      const waveX = isPlaying ? Math.sin(waveTime + y * 0.02) * 50 * effectiveIntensity : 0;
      const waveY = isPlaying ? Math.cos(waveTime + x * 0.02) * 50 * effectiveIntensity : 0;
      
      // Combine all motion components
      x = centerX + flowX + waveX;
      y = centerY + flowY + waveY;
      
      // Update color and phase
      hue = (hue + colorSpeed) % 360;
      phase += 0.02 * effectiveSpeed;
      
      return { ...vertex, x, y, phase, hue };
    }));
    
    setAnimationState(prev => ({
      ...prev,
      frame: prev.frame + 1
    }));
  }, [animationState, parameters, audioModulation]);

  // Audio processing loop
  useEffect(() => {
    let animationFrame;
    
    const updateAudio = () => {
      processAudio();
      animationFrame = requestAnimationFrame(updateAudio);
    };

    if (isListening) {
      updateAudio();
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isListening, processAudio]);

  // Animation loop
  useEffect(() => {
    const animationFrame = requestAnimationFrame(updateVertices);
    return () => cancelAnimationFrame(animationFrame);
  }, [updateVertices]);

  // Toggle audio processing
  const toggleAudio = async () => {
    if (!isListening) {
      await setupAudio();
    } else {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsListening(false);
      // Reset audio modulation when stopping
      setAudioModulation({
        speedMod: 1,
        intensityMod: 1,
        sizeMod: 1
      });
    }
  };

  // Edge style calculation
  const getEdgeStyle = (v1, v2) => {
    const dist = Math.hypot(v1.x - v2.x, v1.y - v2.y);
    const opacity = Math.max(0, Math.min(1, 1 - (dist / 300)));
    return opacity > 0.1 ? {
      stroke: `hsla(${(v1.hue + v2.hue) / 2}, 100%, 50%, ${opacity})`,
      strokeWidth: Math.max(1, 4 * opacity)
    } : null;
  };

  return (
    <div className="mikedrop-container">
      {/* Visualization Area */}
      <div className="mikedrop-visualization">
        <svg className="mikedrop-canvas">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Render edges */}
          {vertices.map((v1, i) => 
            vertices.map((v2, j) => {
              if (i < j) {
                const edgeStyle = getEdgeStyle(v1, v2);
                if (edgeStyle) {
                  return (
                    <line
                      key={`${i}-${j}`}
                      x1={v1.x}
                      y1={v1.y}
                      x2={v2.x}
                      y2={v2.y}
                      {...edgeStyle}
                      filter="url(#glow)"
                    />
                  );
                }
              }
              return null;
            })
          )}
          
          {/* Render vertices */}
          {vertices.map((vertex, i) => (
            <circle
              key={i}
              cx={vertex.x}
              cy={vertex.y}
              r={4}
              fill={`hsla(${vertex.hue}, 100%, 50%, 0.8)`}
              filter="url(#glow)"
            />
          ))}
        </svg>
      </div>

      {/* Control Panel */}
      <div className="mikedrop-controls">
        <div className="mikedrop-control-section">
          <h3 className="mikedrop-control-header">Animation Controls</h3>
          <button
            className={`mikedrop-button ${animationState.isPlaying ? 'active' : ''}`}
            onClick={() => setAnimationState(prev => ({
              ...prev,
              isPlaying: !prev.isPlaying
            }))}
          >
            {animationState.isPlaying ? 'Pause Effect' : 'Start Effect'}
          </button>
        </div>

        <div className="mikedrop-control-section">
          <h3 className="mikedrop-control-header">Audio Input</h3>
          <button
            className={`mikedrop-button ${isListening ? 'active' : ''}`}
            onClick={toggleAudio}
          >
            {isListening ? 'Stop Audio Input' : 'Start Audio Input'}
          </button>
          
          {audioMetrics && (
            <div className="mikedrop-metrics">
              <p>Beat Detected: {audioMetrics.metrics.beatDetected ? 'Yes' : 'No'}</p>
              <p>Amplitude: {(audioMetrics.metrics.amplitude * 100).toFixed(1)}%</p>
              <p>Modulation: {(audioModulation.intensityMod).toFixed(2)}x</p>
            </div>
          )}
        </div>

        <div className="mikedrop-control-section">
          <h3 className="mikedrop-control-header">Pattern Parameters</h3>
          
          <label className="mikedrop-control-label">
            Flow Speed: {parameters.flowSpeed.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={parameters.flowSpeed}
            onChange={(e) => setParameters(prev => ({
              ...prev,
              flowSpeed: parseFloat(e.target.value)
            }))}
            className="mikedrop-slider"
          />

          <label className="mikedrop-control-label">
            Color Speed: {parameters.colorSpeed.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={parameters.colorSpeed}
            onChange={(e) => setParameters(prev => ({
              ...prev,
              colorSpeed: parseFloat(e.target.value)
            }))}
            className="mikedrop-slider"
          />

          <label className="mikedrop-control-label">
            Wave Intensity: {parameters.waveIntensity.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.1"
            value={parameters.waveIntensity}
            onChange={(e) => setParameters(prev => ({
              ...prev,
              waveIntensity: parseFloat(e.target.value)
            }))}
            className="mikedrop-slider"
          />

          <label className="mikedrop-control-label">
            Pattern Size: {parameters.patternSize.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={parameters.patternSize}
            onChange={(e) => setParameters(prev => ({
              ...prev,
              patternSize: parseFloat(e.target.value)
            }))}
            className="mikedrop-slider"
          />
        </div>
      </div>
    </div>
  );
};

export default MikeDropViz;