class LineRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.startTime = null;
    this.timerInterval = null;
    this.audioContext = null;
    this.gainNode = null;
    this.microphone = null;
    this.destination = null;
    
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.startStopBtn = document.getElementById('startStopBtn');
    this.myLineBtn = document.getElementById('myLineBtn');
    this.playBtn = document.getElementById('playBtn');
    this.downloadBtn = document.getElementById('downloadBtn');
    this.rightLevel = document.getElementById('rightLevel');
    this.player = document.getElementById('player');
    this.stateSpan = document.getElementById('state');
    this.elapsedSpan = document.getElementById('elapsed');
    this.sizeSpan = document.getElementById('size');
    
    // Audio source elements
    this.audioFile = document.getElementById('audioFile');
    this.audioInfo = document.getElementById('audioInfo');
    this.fileName = document.getElementById('fileName');
    this.playAudioBtn = document.getElementById('playAudioBtn');
    this.stopAudioBtn = document.getElementById('stopAudioBtn');
    this.sourceAudio = document.getElementById('sourceAudio');
    this.testBtn = document.getElementById('testBtn');
  }

  setupEventListeners() {
    this.startStopBtn.addEventListener('click', () => this.toggleRecording());
    this.myLineBtn.addEventListener('mousedown', () => this.startMyLine());
    this.myLineBtn.addEventListener('mouseup', () => this.stopMyLine());
    this.myLineBtn.addEventListener('mouseleave', () => this.stopMyLine());
    this.playBtn.addEventListener('click', () => this.playRecording());
    this.downloadBtn.addEventListener('click', () => this.downloadRecording());
    this.rightLevel.addEventListener('input', (e) => this.adjustRightLevel(e.target.value));
    
    // Audio source event listeners
    this.audioFile.addEventListener('change', (e) => this.loadAudioFile(e));
    this.playAudioBtn.addEventListener('click', () => this.playSourceAudio());
    this.stopAudioBtn.addEventListener('click', () => this.stopSourceAudio());
    this.testBtn.addEventListener('click', () => this.testAudio());
  }

  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    try {
      // Request microphone access
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });

      // Try to get system audio (this may not work in all browsers/contexts)
      let systemStream = null;
      try {
        // This is a simplified approach - in a real app you'd need more sophisticated audio routing
        // For now, we'll create a silent track for the left channel
        systemStream = new MediaStream();
        console.log('Note: System audio capture is limited in web browsers. You may need to play audio through the same tab.');
      } catch (systemError) {
        console.warn('System audio capture not available:', systemError);
      }

      // Create audio context for dual-channel processing
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(micStream);
      
      // Create gain nodes for microphone routing
      this.micGainNode = this.audioContext.createGain();
      this.micGainNode.gain.value = 1; // Always record microphone
      
      // Create gain node for left channel control
      this.leftChannelGain = this.audioContext.createGain();
      this.leftChannelGain.gain.value = 1; // Start with left channel on
      
      // Create a merger to combine channels
      this.merger = this.audioContext.createChannelMerger(2);
      
      // Create a destination for recording
      this.destination = this.audioContext.createMediaStreamDestination();
      
      // Connect microphone to both channels
      this.microphone.connect(this.micGainNode);
      this.micGainNode.connect(this.merger, 0, 1); // Connect to right channel
      this.micGainNode.connect(this.leftChannelGain);
      this.leftChannelGain.connect(this.merger, 0, 0); // Connect to left channel
      
      // Note: Source audio functionality removed - microphone goes to both channels by default
      console.log('Microphone connected to both left and right channels');
      
      // Connect merger to destination
      this.merger.connect(this.destination);
      
      // Create MediaRecorder with the destination stream
      this.mediaRecorder = new MediaRecorder(this.destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
      this.startTime = Date.now();
      
      // Update UI
      this.startStopBtn.textContent = 'Stop';
      this.startStopBtn.classList.remove('primary');
      this.startStopBtn.classList.add('secondary');
      this.myLineBtn.disabled = false;
      this.stateSpan.textContent = 'recording';
      
      // Start timer
      this.timerInterval = setInterval(() => this.updateTimer(), 100);
      
      console.log('Recording started successfully');
      console.log('Audio context state:', this.audioContext.state);
      console.log('Source audio loaded:', this.sourceAudio.src ? 'Yes' : 'No');
      console.log('Source audio playing:', !this.sourceAudio.paused);
      console.log('Note: To record other actors\' lines, play the audio in the same browser tab.');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please ensure you have granted microphone permissions and are using HTTPS or localhost.');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      // Stop timer
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      
      // Clean up audio context
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
      
      // Update UI
      this.startStopBtn.textContent = 'Start';
      this.startStopBtn.classList.remove('secondary');
      this.startStopBtn.classList.add('primary');
      this.myLineBtn.disabled = true;
      this.stateSpan.textContent = 'processing';
      
      console.log('Recording stopped');
    }
  }

  startMyLine() {
    if (this.leftChannelGain && this.isRecording) {
      this.leftChannelGain.gain.value = 0; // Mute left channel (only right channel gets audio)
      this.myLineBtn.classList.add('active');
      console.log('My line recording started - left channel muted, right channel only');
    }
  }

  stopMyLine() {
    if (this.leftChannelGain && this.isRecording) {
      this.leftChannelGain.gain.value = 1; // Unmute left channel (both channels get audio)
      this.myLineBtn.classList.remove('active');
      console.log('My line recording stopped - both channels active');
    }
  }

  processRecording() {
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    this.recordedAudio = audioBlob;
    
    // Update UI
    this.stateSpan.textContent = 'ready';
    this.playBtn.disabled = false;
    this.downloadBtn.disabled = false;
    this.sizeSpan.textContent = `${(audioBlob.size / 1024 / 1024).toFixed(1)} MB`;
    
    console.log('Recording processed, size:', audioBlob.size);
    console.log('Audio chunks collected:', this.audioChunks.length);
    console.log('Source audio was playing during recording:', this.sourceAudio.src ? 'Yes' : 'No');
    
    // Create a test URL to verify the recording
    const testUrl = URL.createObjectURL(audioBlob);
    console.log('Test recording URL created:', testUrl);
  }

  playRecording() {
    if (this.recordedAudio) {
      const audioUrl = URL.createObjectURL(this.recordedAudio);
      this.player.src = audioUrl;
      this.player.classList.remove('hidden');
      
      // Create audio context for playback with balance control
      if (!this.playbackAudioContext) {
        this.playbackAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Create source from audio element
      const source = this.playbackAudioContext.createMediaElementSource(this.player);
      
      // Create gain nodes for left and right channels
      this.playbackLeftGain = this.playbackAudioContext.createGain();
      this.playbackRightGain = this.playbackAudioContext.createGain();
      
      // Create splitter to separate channels
      const splitter = this.playbackAudioContext.createChannelSplitter(2);
      
      // Create merger to recombine channels
      const merger = this.playbackAudioContext.createChannelMerger(2);
      
      // Connect audio source to splitter
      source.connect(splitter);
      
      // Connect left channel through gain control
      splitter.connect(this.playbackLeftGain, 0);
      this.playbackLeftGain.connect(merger, 0, 0);
      
      // Connect right channel through gain control
      splitter.connect(this.playbackRightGain, 1);
      this.playbackRightGain.connect(merger, 0, 1);
      
      // Connect to speakers
      merger.connect(this.playbackAudioContext.destination);
      
      // Set initial volumes
      this.playbackLeftGain.gain.value = 1; // Left channel always at full volume
      this.adjustRightLevel(this.rightLevel.value); // Right channel follows slider
      
      // Add event listeners to debug playback
      this.player.onloadstart = () => console.log('Audio loading started');
      this.player.oncanplay = () => console.log('Audio can play');
      this.player.onplay = () => console.log('Audio playback started');
      this.player.onerror = (e) => console.error('Audio playback error:', e);
      
      this.player.play().catch(error => {
        console.error('Playback failed:', error);
        alert('Playback failed: ' + error.message);
      });
    }
  }

  downloadRecording() {
    if (this.recordedAudio) {
      const url = URL.createObjectURL(this.recordedAudio);
      const a = document.createElement('a');
      a.href = url;
      a.download = `line-rehearsal-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  adjustRightLevel(value) {
    // Right channel volume control: 0 = silent, 100 = full volume
    const rightGain = value / 100; // 0 to 1
    
    // Apply volume to right channel only
    if (this.playbackRightGain) {
      this.playbackRightGain.gain.value = rightGain;
    }
    
    console.log('Right channel volume:', rightGain);
  }

  loadAudioFile(event) {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      this.sourceAudio.src = url;
      this.fileName.textContent = file.name;
      this.audioInfo.classList.remove('hidden');
      console.log('Audio file loaded:', file.name);
    }
  }

  playSourceAudio() {
    if (this.sourceAudio.src) {
      this.sourceAudio.play();
      console.log('Source audio started');
    }
  }

  stopSourceAudio() {
    if (this.sourceAudio.src) {
      this.sourceAudio.pause();
      this.sourceAudio.currentTime = 0;
      console.log('Source audio stopped');
    }
  }

  testAudio() {
    console.log('=== AUDIO TEST ===');
    console.log('Source audio src:', this.sourceAudio.src);
    console.log('Source audio paused:', this.sourceAudio.paused);
    console.log('Source audio duration:', this.sourceAudio.duration);
    console.log('Source audio currentTime:', this.sourceAudio.currentTime);
    
    if (this.audioContext) {
      console.log('Audio context state:', this.audioContext.state);
      console.log('Audio context sample rate:', this.audioContext.sampleRate);
    }
    
    if (this.recordedAudio) {
      console.log('Recorded audio size:', this.recordedAudio.size);
      console.log('Recorded audio type:', this.recordedAudio.type);
    }
    
    // Test if we can play the source audio directly
    if (this.sourceAudio.src) {
      console.log('Testing direct source audio playback...');
      this.sourceAudio.play().then(() => {
        console.log('Source audio plays successfully');
      }).catch(error => {
        console.error('Source audio playback failed:', error);
      });
    }
  }

  updateTimer() {
    if (this.startTime) {
      const elapsed = Date.now() - this.startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      this.elapsedSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LineRecorder();
});