class LineRecorderApp {
  constructor() {
    this.db = null;
    this.currentRecording = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.startTime = null;
    this.timerInterval = null;
    this.audioContext = null;
    this.micGainNode = null;
    this.leftChannelGain = null;
    this.merger = null;
    this.destination = null;
    this.microphone = null;
    this.playbackAudioContext = null;
    this.playbackLeftGain = null;
    this.playbackRightGain = null;
    this.untitledCounter = 1;
    this.permissionManager = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.initializeDatabase();
    this.initializePermissionManager();
  }

  initializeElements() {
    // Main elements
    this.fileList = document.getElementById('fileList');
    this.addButton = document.getElementById('addButton');
    this.uploadBtn = document.getElementById('uploadBtn');
    this.uploadInput = document.getElementById('uploadInput');
    
    // Dialog elements
    this.recordingDialog = document.getElementById('recordingDialog');
    this.playbackDialog = document.getElementById('playbackDialog');
    this.closeRecordingBtn = document.getElementById('closeRecordingBtn');
    this.closePlaybackBtn = document.getElementById('closePlaybackBtn');
    
    // Recording elements
    this.micSelect = document.getElementById('micSelect');
    this.startStopBtn = document.getElementById('startStopBtn');
    this.myLineBtn = document.getElementById('myLineBtn');
    this.stateSpan = document.getElementById('state');
    this.elapsedSpan = document.getElementById('elapsed');
    this.sizeSpan = document.getElementById('size');
    
    // Playback elements
    this.playbackTitle = document.getElementById('playbackTitle');
    this.playBtn = document.getElementById('playBtn');
    this.seekBackBtn = document.getElementById('seekBackBtn');
    this.seekForwardBtn = document.getElementById('seekForwardBtn');
    this.downloadBtn = document.getElementById('downloadBtn');
    this.rightLevel = document.getElementById('rightLevel');
    this.player = document.getElementById('player');
  }

  setupEventListeners() {
    // Main interface
    this.addButton.addEventListener('click', () => this.handleAddButtonClick());
    this.uploadBtn.addEventListener('click', () => this.uploadInput.click());
    this.uploadInput.addEventListener('change', (e) => this.handleFileUpload(e));
    
    // Permission status click handler
    const permissionStatus = document.getElementById('permissionStatus');
    if (permissionStatus) {
      permissionStatus.addEventListener('click', () => this.requestPermissions());
    }
    
    // Recording dialog
    this.closeRecordingBtn.addEventListener('click', () => this.closeRecordingDialog());
    this.startStopBtn.addEventListener('click', () => this.toggleRecording());
    
    // My line button - handle both mouse and touch events
    this.myLineBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.startMyLine();
    });
    this.myLineBtn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      this.stopMyLine();
    });
    this.myLineBtn.addEventListener('mouseleave', (e) => {
      e.preventDefault();
      this.stopMyLine();
    });
    
    // Touch events for mobile
    this.myLineBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startMyLine();
    });
    this.myLineBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.stopMyLine();
    });
    this.myLineBtn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.stopMyLine();
    });
    
    this.micSelect.addEventListener('change', () => this.saveMicrophoneSelection());
    
    // Playback dialog
    this.closePlaybackBtn.addEventListener('click', () => this.closePlaybackDialog());
    this.playBtn.addEventListener('click', () => this.togglePlayback());
    this.seekBackBtn.addEventListener('click', () => this.seekBackward());
    this.seekForwardBtn.addEventListener('click', () => this.seekForward());
    this.downloadBtn.addEventListener('click', () => this.downloadRecording());
    // Standard events
    this.rightLevel.addEventListener('input', (e) => {
      console.log('Slider input event fired, value:', e.target.value);
      this.adjustRightLevel(e.target.value);
    });
    
    this.rightLevel.addEventListener('change', (e) => {
      console.log('Slider change event fired, value:', e.target.value);
      this.adjustRightLevel(e.target.value);
    });
    
    // iOS-specific touch events
    this.rightLevel.addEventListener('touchstart', (e) => {
      console.log('Slider touchstart event fired');
      e.preventDefault();
      // Force a test to see if we can detect touch
      this.showVolumeChangeFeedback('TOUCH DETECTED');
    });
    
    this.rightLevel.addEventListener('touchmove', (e) => {
      console.log('Slider touchmove event fired');
      e.preventDefault();
      // Get the touch position and calculate value for VERTICAL slider
      const touch = e.touches[0];
      const rect = this.rightLevel.getBoundingClientRect();
      const y = touch.clientY - rect.top;
      // For vertical slider: 0 at bottom, 100 at top (inverted)
      const percentage = Math.max(0, Math.min(100, ((rect.height - y) / rect.height) * 100));
      const value = Math.round(percentage);
      
      console.log('Touch position calculated value:', value, 'y:', y, 'height:', rect.height);
      this.rightLevel.value = value;
      this.adjustRightLevel(value);
    });
    
    this.rightLevel.addEventListener('touchend', (e) => {
      console.log('Slider touchend event fired, final value:', this.rightLevel.value);
      e.preventDefault();
      this.adjustRightLevel(this.rightLevel.value);
    });
    
    // Also add mousemove for desktop
    this.rightLevel.addEventListener('mousemove', (e) => {
      if (e.buttons === 1) { // Only when mouse is pressed
        console.log('Slider mousemove event fired, value:', e.target.value);
        this.adjustRightLevel(e.target.value);
      }
    });
    
    // Add click event as fallback
    this.rightLevel.addEventListener('click', (e) => {
      console.log('Slider click event fired, value:', e.target.value);
      this.showVolumeChangeFeedback('CLICK DETECTED: ' + e.target.value);
      this.adjustRightLevel(e.target.value);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
    
    // Modal backdrop clicks
    this.recordingDialog.addEventListener('click', (e) => {
      if (e.target === this.recordingDialog) this.closeRecordingDialog();
    });
    this.playbackDialog.addEventListener('click', (e) => {
      if (e.target === this.playbackDialog) this.closePlaybackDialog();
    });
  }

  handleKeydown(e) {
    if (e.key === 'Escape') {
      if (!this.recordingDialog.classList.contains('hidden')) {
        this.closeRecordingDialog();
      } else if (!this.playbackDialog.classList.contains('hidden')) {
        this.closePlaybackDialog();
      }
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LineRecorderDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadFileList();
        this.updateUntitledCounter();
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('recordings')) {
          const store = db.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  initializePermissionManager() {
    this.permissionManager = new PermissionManager();
    this.permissionManager.onPermissionChange = (hasPermission) => {
      this.updatePermissionUI(hasPermission);
    };
  }

  async handleAddButtonClick() {
    // Check if button is disabled due to permissions
    if (this.addButton.disabled) {
      await this.requestPermissions();
      return;
    }
    
    // Normal recording dialog flow
    await this.openRecordingDialog();
  }

  async requestPermissions() {
    const granted = await this.permissionManager.requestMicrophonePermission();
    if (granted) {
      // Permission granted, now open recording dialog
      await this.openRecordingDialog();
    }
  }

  updatePermissionUI(hasPermission) {
    const addButton = this.addButton;
    const uploadBtn = this.uploadBtn;
    const permissionStatus = document.getElementById('permissionStatus');
    const permissionIcon = document.getElementById('permissionIcon');
    const permissionText = document.getElementById('permissionText');
    
    if (hasPermission) {
      addButton.disabled = false;
      addButton.title = 'New Recording';
      addButton.style.opacity = '1';
      uploadBtn.disabled = false;
      uploadBtn.title = 'Upload existing recording';
      
      // Update permission status indicator
      permissionStatus.classList.remove('hidden', 'denied', 'clickable');
      permissionStatus.classList.add('granted');
      permissionIcon.textContent = '✅';
      permissionText.textContent = 'Microphone access granted';
    } else {
      addButton.disabled = false; // Keep enabled so user can click to request permission
      addButton.title = 'Tap to request microphone permission';
      addButton.style.opacity = '1';
      uploadBtn.disabled = false; // Upload doesn't need mic permission
      uploadBtn.title = 'Upload existing recording';
      
      // Update permission status indicator
      permissionStatus.classList.remove('hidden', 'granted');
      permissionStatus.classList.add('denied', 'clickable');
      permissionIcon.textContent = '🎤';
      permissionText.textContent = 'Tap to grant microphone access';
    }
  }

  async loadFileList() {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['recordings'], 'readonly');
    const store = transaction.objectStore('recordings');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const recordings = request.result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      this.renderFileList(recordings);
    };
  }

  updateUntitledCounter() {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['recordings'], 'readonly');
    const store = transaction.objectStore('recordings');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const recordings = request.result;
      let maxNumber = 0;
      
      recordings.forEach(recording => {
        const match = recording.name.match(/^Untitled-(\d+)\.webm$/);
        if (match) {
          const number = parseInt(match[1]);
          if (number > maxNumber) {
            maxNumber = number;
          }
        }
      });
      
      this.untitledCounter = maxNumber + 1;
    };
  }

  renderFileList(recordings) {
    this.fileList.innerHTML = '';
    
    if (recordings.length === 0) {
      this.fileList.innerHTML = '<p style="text-align: center; color: #9ca3af; padding: 2rem;">No recordings yet. Click the + button to create your first recording.</p>';
      return;
    }
    
    recordings.forEach(recording => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.innerHTML = `
        <div class="file-info">
          <div class="file-name" data-id="${recording.id}">${recording.name}</div>
          <div class="file-meta">
            ${this.formatDuration(recording.duration)} • ${this.formatDate(recording.createdAt)}
          </div>
        </div>
        <div class="file-actions">
          <button class="ghost edit-btn" data-id="${recording.id}" title="Rename">✏️</button>
          <button class="ghost delete-btn" data-id="${recording.id}" title="Delete">🗑️</button>
        </div>
      `;
      
      // Add click handler for file item
      fileItem.addEventListener('click', (e) => {
        if (!e.target.closest('.file-actions')) {
          this.openPlaybackDialog(recording);
        }
      });
      
      // Add edit handler
      const editBtn = fileItem.querySelector('.edit-btn');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startEditing(recording.id);
      });
      
      // Add delete handler
      const deleteBtn = fileItem.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteRecording(recording.id);
      });
      
      this.fileList.appendChild(fileItem);
    });
  }

  startEditing(id) {
    const nameElement = document.querySelector(`[data-id="${id}"]`);
    const originalName = nameElement.textContent;
    
    nameElement.contentEditable = true;
    nameElement.classList.add('editing');
    nameElement.focus();
    
    const finishEditing = () => {
      const newName = nameElement.textContent.trim();
      if (newName && newName !== originalName) {
        this.renameRecording(id, newName);
      } else {
        nameElement.textContent = originalName;
      }
      nameElement.contentEditable = false;
      nameElement.classList.remove('editing');
    };
    
    nameElement.addEventListener('blur', finishEditing, { once: true });
    nameElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEditing();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        nameElement.textContent = originalName;
        finishEditing();
      }
    });
  }

  async renameRecording(id, newName) {
    const transaction = this.db.transaction(['recordings'], 'readwrite');
    const store = transaction.objectStore('recordings');
    const request = store.get(id);
    
    request.onsuccess = () => {
      const recording = request.result;
      recording.name = newName;
      store.put(recording);
      this.loadFileList();
    };
  }

  async deleteRecording(id) {
    if (confirm('Are you sure you want to delete this recording?')) {
      const transaction = this.db.transaction(['recordings'], 'readwrite');
      const store = transaction.objectStore('recordings');
      store.delete(id);
      this.loadFileList();
    }
  }

  async openRecordingDialog() {
    // Check microphone permissions first
    const hasPermission = await this.permissionManager.checkMicrophonePermission();
    
    if (!hasPermission) {
      const granted = await this.permissionManager.requestMicrophonePermission();
      if (!granted) {
        return; // User denied permission
      }
    }
    
    this.recordingDialog.classList.remove('hidden');
    this.resetRecordingState();
    this.loadMicrophones();
  }

  closeRecordingDialog() {
    if (this.isRecording) {
      this.stopRecording();
    }
    this.recordingDialog.classList.add('hidden');
  }

  openPlaybackDialog(recording) {
    this.currentRecording = recording;
    this.playbackTitle.textContent = recording.name;
    this.playbackDialog.classList.remove('hidden');
    
    // Load the audio with iOS compatibility
    this.loadAudioForPlayback(recording);
    
    // Reset play button state
    this.playBtn.textContent = '▶️';
    this.playBtn.title = 'Play';
    
    // Restore saved slider position
    const savedLevel = localStorage.getItem('rightChannelLevel');
    if (savedLevel) {
      this.rightLevel.value = savedLevel;
    } else {
      this.rightLevel.value = 100; // Default to full volume
    }
    
    // Initialize the volume indicator
    this.updateVolumeIndicator(this.rightLevel.value);
    
    // Test if slider is working on iOS
    this.testSliderFunctionality();
    
    // Handle audio end
    this.player.onended = () => {
      this.playBtn.textContent = '▶️';
      this.playBtn.title = 'Play';
    };
    
    // Set up playback audio context (will be initialized on first play)
    this.playbackAudioContext = null;
  }

  async loadAudioForPlayback(recording) {
    try {
      // Detect if we're on iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // Create audio blob with proper MIME type
      let audioBlob;
      let mimeType = 'audio/webm; codecs=opus';
      
      if (isIOS) {
        // iOS has limited WebM support, try different MIME types
        mimeType = 'audio/webm';
      }
      
      audioBlob = new Blob([recording.audioData], { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Set up error handling
      this.player.onerror = (e) => {
        console.error('Audio playback error:', e);
        if (isIOS) {
          this.tryIOSAudioFallback(recording);
        } else {
          this.showAudioError();
        }
      };
      
      this.player.onloadstart = () => {
        console.log('Audio loading started');
      };
      
      this.player.oncanplay = () => {
        console.log('Audio can play');
      };
      
      this.player.onloadedmetadata = () => {
        console.log('Audio metadata loaded');
      };
      
      // Load the audio
      this.player.src = audioUrl;
      this.player.load(); // Force load
      
    } catch (error) {
      console.error('Error loading audio:', error);
      this.showAudioError();
    }
  }

  async tryIOSAudioFallback(recording) {
    console.log('Trying iOS audio fallback...');
    
    // Show a message that we're trying a different approach
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'ios-loading';
    loadingDiv.innerHTML = `
      <div class="loading-content">
        <div class="loading-icon">🔄</div>
        <p>Optimizing audio for iOS...</p>
      </div>
    `;
    
    loadingDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #1e293b;
      color: white;
      border-radius: 12px;
      padding: 20px;
      z-index: 10000;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    `;
    
    document.body.appendChild(loadingDiv);
    
    try {
      // Try with different MIME types for iOS
      const mimeTypes = [
        'audio/webm',
        'audio/mp4',
        'audio/mpeg',
        'audio/wav'
      ];
      
      for (const mimeType of mimeTypes) {
        try {
          const audioBlob = new Blob([recording.audioData], { type: mimeType });
          const audioUrl = URL.createObjectURL(audioBlob);
          
          this.player.src = audioUrl;
          this.player.load();
          
          // Wait a bit to see if it loads
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (this.player.readyState >= 2) { // HAVE_CURRENT_DATA
            console.log(`Success with MIME type: ${mimeType}`);
            loadingDiv.remove();
            return;
          }
        } catch (e) {
          console.log(`Failed with MIME type: ${mimeType}`);
        }
      }
      
      // If all MIME types fail, show error
      loadingDiv.remove();
      this.showAudioError();
      
    } catch (error) {
      loadingDiv.remove();
      this.showAudioError();
    }
  }

  showAudioError() {
    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'audio-error';
    errorDiv.innerHTML = `
      <div class="error-content">
        <div class="error-icon">🔊</div>
        <h4>Audio Playback Issue</h4>
        <p>There was a problem loading this recording. This can happen on some mobile devices.</p>
        <div class="error-actions">
          <button id="retryAudio" class="primary">Try Again</button>
          <button id="downloadInstead" class="secondary">Download Instead</button>
        </div>
      </div>
    `;
    
    // Add styles
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #1e293b;
      color: white;
      border-radius: 12px;
      padding: 20px;
      max-width: 300px;
      z-index: 10000;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      .error-content {
        text-align: center;
      }
      .error-icon {
        font-size: 32px;
        margin-bottom: 12px;
      }
      .error-content h4 {
        margin: 0 0 8px 0;
        color: #fbbf24;
      }
      .error-content p {
        margin: 0 0 16px 0;
        font-size: 14px;
        color: #d1d5db;
        line-height: 1.4;
      }
      .error-actions {
        display: flex;
        gap: 8px;
      }
      .error-actions button {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
      }
      .error-actions .primary {
        background: #3b82f6;
        color: white;
      }
      .error-actions .secondary {
        background: #6b7280;
        color: white;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(errorDiv);
    
    // Add event listeners
    document.getElementById('retryAudio').addEventListener('click', () => {
      errorDiv.remove();
      this.loadAudioForPlayback(this.currentRecording);
    });
    
    document.getElementById('downloadInstead').addEventListener('click', () => {
      errorDiv.remove();
      this.downloadRecording();
    });
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 10000);
  }

  closePlaybackDialog() {
    this.player.pause();
    this.player.src = '';
    this.playbackDialog.classList.add('hidden');
    this.currentRecording = null;
    
    // Clean up any custom sliders
    const existingCustomSlider = document.querySelector('.custom-slider');
    if (existingCustomSlider) {
      existingCustomSlider.remove();
    }
    
    // Show the original slider again
    this.rightLevel.style.display = '';
  }

  async setupPlaybackAudioContext() {
    try {
      if (!this.playbackAudioContext) {
        this.playbackAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // iOS requires AudioContext to be resumed after user interaction
      if (this.playbackAudioContext.state === 'suspended') {
        await this.playbackAudioContext.resume();
      }
      
      // Disconnect any existing connections
      if (this.playbackSource) {
        this.playbackSource.disconnect();
      }
      
      const source = this.playbackAudioContext.createMediaElementSource(this.player);
      this.playbackSource = source;
      
      this.playbackLeftGain = this.playbackAudioContext.createGain();
      this.playbackRightGain = this.playbackAudioContext.createGain();
      
      const splitter = this.playbackAudioContext.createChannelSplitter(2);
      const merger = this.playbackAudioContext.createChannelMerger(2);
      
      source.connect(splitter);
      splitter.connect(this.playbackLeftGain, 0);
      splitter.connect(this.playbackRightGain, 1);
      this.playbackLeftGain.connect(merger, 0, 0);
      this.playbackRightGain.connect(merger, 0, 1);
      merger.connect(this.playbackAudioContext.destination);
      
      this.playbackLeftGain.gain.value = 1;
      this.playbackRightGain.gain.value = this.rightLevel.value / 100;
      
      console.log('Web Audio API setup successful');
      this.showVolumeChangeFeedback(`Web Audio API active - Volume: ${this.rightLevel.value}%`);
      
    } catch (error) {
      console.error('Error setting up audio context:', error);
      // Fallback: just use the basic audio element without Web Audio API
      this.playbackAudioContext = null;
      this.playbackLeftGain = null;
      this.playbackRightGain = null;
      
      // Show user a subtle indicator that we're using fallback mode
      this.showFallbackModeIndicator();
    }
  }

  showFallbackModeIndicator() {
    // Add a subtle indicator that we're using fallback volume control
    const existingIndicator = document.querySelector('.fallback-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.className = 'fallback-indicator';
    indicator.innerHTML = `
      <div class="fallback-content">
        <span class="fallback-icon">ℹ️</span>
        <span class="fallback-text">Using simplified volume control</span>
      </div>
    `;
    
    // Add styles
    indicator.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(59, 130, 246, 0.9);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    
    // Add to the playback dialog
    const playbackDialog = document.getElementById('playbackDialog');
    if (playbackDialog) {
      playbackDialog.appendChild(indicator);
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.remove();
        }
      }, 3000);
    }
  }

  adjustRightLevel(value) {
    console.log('adjustRightLevel called with value:', value);
    const rightGain = value / 100;
    
    // Try Web Audio API first
    if (this.playbackRightGain) {
      console.log('Using Web Audio API, setting gain to:', rightGain);
      this.playbackRightGain.gain.value = rightGain;
      this.showVolumeChangeFeedback(`Web Audio: ${value}%`);
    } else {
      console.log('Web Audio API not available, using fallback');
      // Fallback: Use HTML5 audio element volume control
      // This is a simplified approach for iOS when Web Audio API fails
      this.adjustAudioElementVolume(value);
    }
    
    // Save the slider position
    localStorage.setItem('rightChannelLevel', value);
  }

  adjustAudioElementVolume(value) {
    // Fallback volume control for when Web Audio API isn't available
    console.log('adjustAudioElementVolume called with value:', value);
    
    if (this.player) {
      // Convert slider value (0-100) to audio volume (0-1)
      const volume = value / 100;
      console.log('Setting player volume to:', volume);
      
      try {
        // For iOS, we need to be more aggressive about volume control
        // Try setting volume multiple times with different approaches
        
        // Approach 1: Direct volume control
        this.player.volume = volume;
        console.log('Player volume set to:', this.player.volume);
        
        // Approach 2: Force volume change by temporarily muting/unmuting
        if (this.player.volume !== volume) {
          console.log('Volume not set correctly, trying mute approach');
          const wasMuted = this.player.muted;
          this.player.muted = true;
          setTimeout(() => {
            this.player.volume = volume;
            this.player.muted = wasMuted;
            console.log('Volume set after mute/unmute:', this.player.volume);
          }, 10);
        }
        
        // Approach 3: Try setting volume on the audio element directly
        if (this.player.volume !== volume) {
          console.log('Trying direct audio element volume control');
          this.player.volume = Math.max(0.01, volume); // iOS might not allow 0 volume
        }
        
        // Visual feedback for the user
        this.updateVolumeIndicator(value);
        
        // Show feedback with actual volume achieved
        this.showVolumeChangeFeedback(`Volume: ${value}% (Actual: ${Math.round(this.player.volume * 100)}%)`);
        
      } catch (error) {
        console.error('Error setting volume:', error);
        this.showVolumeError();
      }
    } else {
      console.error('Player not available for volume control');
    }
  }

  simulateVolumeWithCSS(value) {
    // Last resort: simulate volume changes with CSS opacity
    // This won't actually change audio volume but gives visual feedback
    console.log('Simulating volume with CSS, value:', value);
    
    const audioElement = this.player;
    if (audioElement) {
      // Use opacity to simulate volume changes
      const opacity = Math.max(0.1, value / 100);
      audioElement.style.opacity = opacity;
      
      // Show a message that this is a visual simulation
      this.showVolumeSimulationNotice();
    }
  }

  showVolumeSimulationNotice() {
    const notice = document.createElement('div');
    notice.className = 'volume-simulation-notice';
    notice.innerHTML = `
      <div style="text-align: center; padding: 8px;">
        <div style="color: #f59e0b; margin-bottom: 4px;">ℹ️</div>
        <div style="font-size: 11px;">Volume control simulated (iOS limitation)</div>
      </div>
    `;
    
    notice.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1e293b;
      color: white;
      border-radius: 6px;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(notice);
    
    // Remove after 4 seconds
    setTimeout(() => {
      if (notice.parentNode) {
        notice.remove();
      }
    }, 4000);
  }

  testSliderFunctionality() {
    // Test if the slider is responsive on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      console.log('Testing slider functionality on iOS...');
      
      // Set a test value and see if it triggers events
      const originalValue = this.rightLevel.value;
      this.rightLevel.value = 50;
      
      // Check if the value actually changed
      setTimeout(() => {
        if (this.rightLevel.value === 50) {
          console.log('Slider value change successful');
          // Restore original value
          this.rightLevel.value = originalValue;
        } else {
          console.log('Slider value change failed, creating custom slider');
          this.createCustomSlider();
        }
      }, 100);
    }
  }

  createCustomSlider() {
    console.log('Creating custom slider for iOS...');
    
    // Check if custom slider already exists
    if (document.querySelector('.custom-slider')) {
      console.log('Custom slider already exists, not creating another');
      return;
    }
    
    // Hide the original slider
    this.rightLevel.style.display = 'none';
    
    // Create a custom VERTICAL slider container (without duplicate icons)
    const customSlider = document.createElement('div');
    customSlider.className = 'custom-slider';
    customSlider.innerHTML = `
      <div class="slider-track">
        <div class="slider-fill"></div>
        <div class="slider-thumb"></div>
      </div>
    `;
    
    // Add styles
    customSlider.style.cssText = `
      width: 40px;
      height: 200px;
      position: relative;
      margin: 10px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      .slider-track {
        width: 8px;
        height: 160px;
        background: #374151;
        border-radius: 4px;
        position: relative;
        margin: 20px 0;
      }
      .slider-fill {
        width: 100%;
        background: #3b82f6;
        border-radius: 4px;
        height: ${this.rightLevel.value}%;
        transition: height 0.1s ease;
        position: absolute;
        bottom: 0;
      }
      .slider-thumb {
        position: absolute;
        left: -8px;
        bottom: ${this.rightLevel.value}%;
        width: 24px;
        height: 24px;
        background: #3b82f6;
        border: 2px solid #1e40af;
        border-radius: 50%;
        cursor: pointer;
        transform: translateY(50%);
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
    `;
    document.head.appendChild(style);
    
    // Insert after the original slider
    this.rightLevel.parentNode.insertBefore(customSlider, this.rightLevel.nextSibling);
    
    // Add touch events to custom slider
    let isDragging = false;
    
    customSlider.addEventListener('touchstart', (e) => {
      isDragging = true;
      this.updateCustomSlider(e, customSlider);
    });
    
    customSlider.addEventListener('touchmove', (e) => {
      if (isDragging) {
        e.preventDefault();
        this.updateCustomSlider(e, customSlider);
      }
    });
    
    customSlider.addEventListener('touchend', () => {
      isDragging = false;
    });
    
    // Also add mouse events for desktop
    customSlider.addEventListener('mousedown', (e) => {
      isDragging = true;
      this.updateCustomSlider(e, customSlider);
    });
    
    customSlider.addEventListener('mousemove', (e) => {
      if (isDragging) {
        this.updateCustomSlider(e, customSlider);
      }
    });
    
    customSlider.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  updateCustomSlider(e, customSlider) {
    const track = customSlider.querySelector('.slider-track');
    const rect = track.getBoundingClientRect();
    
    let y;
    if (e.touches && e.touches[0]) {
      y = e.touches[0].clientY - rect.top;
    } else {
      y = e.clientY - rect.top;
    }
    
    // For vertical slider: 0 at bottom, 100 at top (inverted)
    const percentage = Math.max(0, Math.min(100, ((rect.height - y) / rect.height) * 100));
    const value = Math.round(percentage);
    
    // Update visual elements
    const fill = customSlider.querySelector('.slider-fill');
    const thumb = customSlider.querySelector('.slider-thumb');
    
    fill.style.height = value + '%';
    thumb.style.bottom = value + '%';
    
    // Update the hidden slider value
    this.rightLevel.value = value;
    
    // Trigger volume adjustment
    this.adjustRightLevel(value);
    
    console.log('Custom vertical slider updated to:', value, 'y:', y, 'height:', rect.height);
  }

  showVolumeChangeFeedback(value) {
    // Show a brief visual feedback that volume changed
    const feedback = document.createElement('div');
    feedback.className = 'volume-feedback';
    feedback.textContent = `Volume: ${value}%`;
    
    feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      z-index: 10000;
      pointer-events: none;
    `;
    
    document.body.appendChild(feedback);
    
    // Remove after 1 second
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.remove();
      }
    }, 1000);
  }

  showVolumeError() {
    // Show error if volume control fails
    const error = document.createElement('div');
    error.className = 'volume-error';
    error.innerHTML = `
      <div style="text-align: center; padding: 10px;">
        <div style="color: #ef4444; margin-bottom: 5px;">⚠️</div>
        <div style="font-size: 12px;">Volume control not available on this device</div>
      </div>
    `;
    
    error.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1e293b;
      color: white;
      border-radius: 8px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(error);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (error.parentNode) {
        error.remove();
      }
    }, 3000);
  }

  updateVolumeIndicator(value) {
    // Add visual feedback to show the volume level
    const slider = this.rightLevel;
    if (slider) {
      // Update the slider's visual state
      if (value < 20) {
        slider.style.background = 'linear-gradient(to right, #ef4444 0%, #ef4444 ' + value + '%, #374151 ' + value + '%, #374151 100%)';
      } else if (value < 50) {
        slider.style.background = 'linear-gradient(to right, #f59e0b 0%, #f59e0b ' + value + '%, #374151 ' + value + '%, #374151 100%)';
      } else {
        slider.style.background = 'linear-gradient(to right, #10b981 0%, #10b981 ' + value + '%, #374151 ' + value + '%, #374151 100%)';
      }
    }
  }

  async togglePlayback() {
    if (this.player.paused) {
      try {
        // Set up audio context on first play (iOS requirement)
        if (!this.playbackAudioContext) {
          await this.setupPlaybackAudioContext();
        }
        
        // Try to play the audio
        await this.player.play();
        this.playBtn.textContent = '⏹️';
        this.playBtn.title = 'Stop';
        
        // Test volume control immediately after play starts
        setTimeout(() => {
          console.log('Testing volume control after play...');
          const testVolume = this.rightLevel.value / 100;
          this.player.volume = testVolume;
          console.log('Volume set to:', this.player.volume, 'Expected:', testVolume);
          this.showVolumeChangeFeedback(`Test: Set to ${Math.round(testVolume * 100)}%, Got ${Math.round(this.player.volume * 100)}%`);
        }, 500);
        
      } catch (error) {
        console.error('Playback error:', error);
        
        // Show user-friendly error
        this.showPlaybackError(error);
      }
    } else {
      this.player.pause();
      this.playBtn.textContent = '▶️';
      this.playBtn.title = 'Play';
    }
  }

  showPlaybackError(error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'playback-error';
    errorDiv.innerHTML = `
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <h4>Playback Failed</h4>
        <p>Unable to play this recording. This is common on iOS devices.</p>
        <div class="error-actions">
          <button id="downloadAudio" class="primary">Download Recording</button>
          <button id="closeError" class="secondary">Close</button>
        </div>
      </div>
    `;
    
    // Add styles (reuse from audio error)
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #1e293b;
      color: white;
      border-radius: 12px;
      padding: 20px;
      max-width: 300px;
      z-index: 10000;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    `;
    
    document.body.appendChild(errorDiv);
    
    // Add event listeners
    document.getElementById('downloadAudio').addEventListener('click', () => {
      errorDiv.remove();
      this.downloadRecording();
    });
    
    document.getElementById('closeError').addEventListener('click', () => {
      errorDiv.remove();
    });
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 8000);
  }

  seekBackward() {
    this.player.currentTime = Math.max(0, this.player.currentTime - 15);
  }

  seekForward() {
    this.player.currentTime = Math.min(this.player.duration, this.player.currentTime + 15);
  }

  downloadRecording() {
    if (this.currentRecording) {
      const audioBlob = new Blob([this.currentRecording.audioData], { type: 'audio/webm' });
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.currentRecording.name; // Use the actual filename from the interface
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  saveMicrophoneSelection() {
    const selectedMicId = this.micSelect.value;
    if (selectedMicId) {
      localStorage.setItem('selectedMicrophone', selectedMicId);
    }
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/') && !file.name.toLowerCase().endsWith('.webm')) {
      alert('Please select an audio file (.webm or other audio format)');
      return;
    }

    try {
      // Get file data
      const audioData = await file.arrayBuffer();
      
      // Get duration by creating a temporary audio element
      const duration = await this.getAudioDuration(file);
      
      // Generate a unique filename if one with the same name already exists
      let filename = file.name;
      if (!filename.toLowerCase().endsWith('.webm')) {
        filename = filename.replace(/\.[^/.]+$/, '') + '.webm';
      }
      
      // Check if filename already exists
      if (await this.filenameExists(filename)) {
        const shouldRename = confirm(`A file named "${filename}" already exists. Would you like to rename it automatically?`);
        if (!shouldRename) {
          event.target.value = '';
          return;
        }
        filename = await this.getUniqueFilename(filename);
      }
      
      // Create recording object
      const recording = {
        name: filename,
        audioData: audioData,
        duration: duration,
        createdAt: new Date().toISOString(),
        size: file.size
      };
      
      // Save to IndexedDB
      const transaction = this.db.transaction(['recordings'], 'readwrite');
      const store = transaction.objectStore('recordings');
      store.add(recording);
      
      // Refresh file list
      this.loadFileList();
      
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file. Please try again.');
    }
    
    // Clear the input
    event.target.value = '';
  }

  getAudioDuration(file) {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration || 0);
      });
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        resolve(0); // Default to 0 if we can't get duration
      });
      
      audio.src = url;
    });
  }

  async getUniqueFilename(filename) {
    const baseName = filename.replace(/\.webm$/i, '');
    let counter = 1;
    let uniqueFilename = filename;
    
    while (await this.filenameExists(uniqueFilename)) {
      uniqueFilename = `${baseName}-${counter}.webm`;
      counter++;
    }
    
    return uniqueFilename;
  }

  async filenameExists(filename) {
    const transaction = this.db.transaction(['recordings'], 'readonly');
    const store = transaction.objectStore('recordings');
    const index = store.index('name');
    const request = index.get(filename);
    
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  }

  resetRecordingState() {
    this.stateSpan.textContent = 'idle';
    this.elapsedSpan.textContent = '00:00';
    this.sizeSpan.textContent = '0.0 MB';
    this.startStopBtn.textContent = 'Start';
    this.startStopBtn.classList.remove('secondary');
    this.startStopBtn.classList.add('primary');
    this.myLineBtn.disabled = true;
    this.myLineBtn.classList.remove('active');
    
    // Clear any existing timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.startTime = null;
  }

  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async loadMicrophones() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      this.micSelect.innerHTML = '';
      
      if (audioInputs.length === 0) {
        this.micSelect.innerHTML = '<option value="">No microphones found</option>';
        return;
      }
      
      audioInputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${index + 1}`;
        this.micSelect.appendChild(option);
      });
      
      // Try to restore saved microphone selection
      const savedMicId = localStorage.getItem('selectedMicrophone');
      if (savedMicId && audioInputs.some(device => device.deviceId === savedMicId)) {
        this.micSelect.value = savedMicId;
      } else if (audioInputs.length > 0) {
        // Fallback to first microphone if saved one not found
        this.micSelect.value = audioInputs[0].deviceId;
        localStorage.setItem('selectedMicrophone', audioInputs[0].deviceId);
      }
      
    } catch (error) {
      console.error('Error loading microphones:', error);
      this.micSelect.innerHTML = '<option value="">Error loading microphones</option>';
    }
  }

  async startRecording() {
    try {
      const selectedDeviceId = this.micSelect.value;
      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      };
      
      // If a specific microphone is selected, use it
      if (selectedDeviceId) {
        constraints.audio.deviceId = { exact: selectedDeviceId };
      }
      
      const micStream = await navigator.mediaDevices.getUserMedia(constraints);

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.microphone = this.audioContext.createMediaStreamSource(micStream);
      
      this.micGainNode = this.audioContext.createGain();
      this.micGainNode.gain.value = 1;
      
      this.leftChannelGain = this.audioContext.createGain();
      this.leftChannelGain.gain.value = 1;
      
      this.merger = this.audioContext.createChannelMerger(2);
      this.destination = this.audioContext.createMediaStreamDestination();
      
      this.microphone.connect(this.micGainNode);
      this.micGainNode.connect(this.merger, 0, 1);
      this.micGainNode.connect(this.leftChannelGain);
      this.leftChannelGain.connect(this.merger, 0, 0);
      this.merger.connect(this.destination);
      
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

      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.startTime = Date.now();
      
      this.startStopBtn.textContent = 'Stop';
      this.startStopBtn.classList.remove('primary');
      this.startStopBtn.classList.add('secondary');
      this.myLineBtn.disabled = false;
      this.stateSpan.textContent = 'recording';
      
      this.timerInterval = setInterval(() => this.updateTimer(), 100);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please ensure you have granted microphone permissions.');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
      
      this.startStopBtn.textContent = 'Start';
      this.startStopBtn.classList.remove('secondary');
      this.startStopBtn.classList.add('primary');
      this.myLineBtn.disabled = true;
      this.stateSpan.textContent = 'processing';
    }
  }

  startMyLine() {
    if (this.leftChannelGain && this.isRecording) {
      this.leftChannelGain.gain.value = 0;
      this.myLineBtn.classList.add('active');
    }
  }

  stopMyLine() {
    if (this.leftChannelGain && this.isRecording) {
      this.leftChannelGain.gain.value = 1;
      this.myLineBtn.classList.remove('active');
    }
  }

  async processRecording() {
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    
    // Generate unique filename
    let filename = `Untitled-${this.untitledCounter}.webm`;
    this.untitledCounter++;
    
    // Get duration (approximate)
    const duration = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    
    // Save to IndexedDB
    const recording = {
      name: filename,
      audioData: await audioBlob.arrayBuffer(),
      duration: duration,
      createdAt: new Date().toISOString(),
      size: audioBlob.size
    };
    
    const transaction = this.db.transaction(['recordings'], 'readwrite');
    const store = transaction.objectStore('recordings');
    store.add(recording);
    
    this.stateSpan.textContent = 'saved';
    this.loadFileList();
    
    // Close dialog after a short delay
    setTimeout(() => {
      this.closeRecordingDialog();
    }, 1000);
  }

  updateTimer() {
    if (this.startTime && this.isRecording) {
      const elapsed = Date.now() - this.startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      this.elapsedSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Update size estimate
      const estimatedSize = (elapsed / 1000) * 0.1; // Rough estimate
      this.sizeSpan.textContent = `${estimatedSize.toFixed(1)} MB`;
    }
  }

  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// Permission Manager for handling microphone access
class PermissionManager {
  constructor() {
    this.onPermissionChange = null;
    this.checkPermissionStatus();
  }

  async checkPermissionStatus() {
    if (navigator.permissions) {
      try {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        this.onPermissionChange?.(permission.state === 'granted');
        
        permission.addEventListener('change', () => {
          this.onPermissionChange?.(permission.state === 'granted');
        });
      } catch (error) {
        console.log('Permission API not supported, will check on demand');
      }
    }
  }

  async checkMicrophonePermission() {
    try {
      // Try to get user media to check if permission is granted
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false 
      });
      
      // If we get here, permission is granted
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.log('Microphone permission not granted:', error.name);
      return false;
    }
  }

  async requestMicrophonePermission() {
    return new Promise(async (resolve) => {
      // Show permission request dialog
      const granted = await this.showPermissionDialog();
      
      if (granted) {
        try {
          // Try to get user media
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            video: false 
          });
          
          // Permission granted
          stream.getTracks().forEach(track => track.stop());
          this.onPermissionChange?.(true);
          resolve(true);
        } catch (error) {
          console.error('Failed to get microphone access:', error);
          this.showPermissionDeniedDialog(error);
          resolve(false);
        }
      } else {
        resolve(false);
      }
    });
  }

  async showPermissionDialog() {
    return new Promise((resolve) => {
      // Create permission request modal
      const modal = document.createElement('div');
      modal.className = 'permission-modal';
      modal.innerHTML = `
        <div class="permission-content">
          <div class="permission-icon">🎤</div>
          <h3>Microphone Access Required</h3>
          <p>Line Rehearsal needs access to your microphone to record your lines.</p>
          <div class="permission-steps">
            <div class="step">
              <span class="step-number">1</span>
              <span class="step-text">Tap "Allow" when prompted</span>
            </div>
            <div class="step">
              <span class="step-number">2</span>
              <span class="step-text">If blocked, check your browser settings</span>
            </div>
          </div>
          <div class="permission-actions">
            <button id="requestPermission" class="primary">Grant Permission</button>
            <button id="cancelPermission" class="secondary">Cancel</button>
          </div>
        </div>
      `;

      // Add styles
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
      `;

      const style = document.createElement('style');
      style.textContent = `
        .permission-content {
          background: white;
          border-radius: 16px;
          padding: 24px;
          max-width: 400px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .permission-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .permission-content h3 {
          margin: 0 0 12px 0;
          color: #1e293b;
          font-size: 20px;
        }
        .permission-content p {
          margin: 0 0 20px 0;
          color: #64748b;
          line-height: 1.5;
        }
        .permission-steps {
          text-align: left;
          margin: 20px 0;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
        }
        .step {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .step:last-child {
          margin-bottom: 0;
        }
        .step-number {
          background: #3b82f6;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          margin-right: 12px;
          flex-shrink: 0;
        }
        .step-text {
          color: #475569;
          font-size: 14px;
        }
        .permission-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }
        .permission-actions button {
          flex: 1;
          padding: 12px 16px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .permission-actions .primary {
          background: #3b82f6;
          color: white;
        }
        .permission-actions .primary:hover {
          background: #2563eb;
        }
        .permission-actions .secondary {
          background: #f1f5f9;
          color: #64748b;
        }
        .permission-actions .secondary:hover {
          background: #e2e8f0;
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(modal);

      // Add event listeners
      document.getElementById('requestPermission').addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      document.getElementById('cancelPermission').addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });
    });
  }

  showPermissionDeniedDialog(error) {
    const modal = document.createElement('div');
    modal.className = 'permission-modal';
    
    let errorMessage = 'Microphone access was denied.';
    let instructions = 'Please check your browser settings and try again.';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Microphone access was blocked.';
      instructions = 'Please allow microphone access in your browser settings and refresh the page.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No microphone found.';
      instructions = 'Please connect a microphone and try again.';
    } else if (error.name === 'NotSupportedError') {
      errorMessage = 'Microphone not supported.';
      instructions = 'Your browser or device does not support microphone access.';
    }

    modal.innerHTML = `
      <div class="permission-content">
        <div class="permission-icon">🚫</div>
        <h3>${errorMessage}</h3>
        <p>${instructions}</p>
        <div class="permission-help">
          <h4>How to enable microphone access:</h4>
          <div class="help-steps">
            <div class="help-step">
              <strong>iPhone Safari:</strong> Settings → Safari → Camera & Microphone → Allow
            </div>
            <div class="help-step">
              <strong>Android Chrome:</strong> Tap the lock icon in address bar → Permissions → Microphone → Allow
            </div>
            <div class="help-step">
              <strong>Desktop:</strong> Click the microphone icon in address bar → Allow
            </div>
          </div>
        </div>
        <div class="permission-actions">
          <button id="closePermissionError" class="primary">Got it</button>
        </div>
      </div>
    `;

    // Add styles for error dialog
    const style = document.createElement('style');
    style.textContent = `
      .permission-help {
        text-align: left;
        margin: 20px 0;
        padding: 16px;
        background: #fef2f2;
        border-radius: 8px;
        border-left: 4px solid #ef4444;
      }
      .permission-help h4 {
        margin: 0 0 12px 0;
        color: #dc2626;
        font-size: 14px;
      }
      .help-steps {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .help-step {
        font-size: 13px;
        color: #7f1d1d;
        line-height: 1.4;
      }
      .help-step strong {
        color: #dc2626;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(modal);

    // Add event listener
    document.getElementById('closePermissionError').addEventListener('click', () => {
      modal.remove();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
}

// Service Worker Update Manager
class ServiceWorkerManager {
  constructor() {
    this.registration = null;
    this.updateAvailable = false;
    this.init();
  }

  async init() {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('./sw.js');
        console.log('Service Worker registered successfully');
        
        // Check for updates immediately
        await this.checkForUpdates();
        
        // Listen for service worker updates
        this.registration.addEventListener('updatefound', () => {
          this.handleUpdateFound();
        });
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event);
        });
        
        // Check for updates every 30 seconds when app is active
        setInterval(() => {
          this.checkForUpdates();
        }, 30000);
        
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  async checkForUpdates() {
    if (this.registration) {
      try {
        await this.registration.update();
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    }
  }

  handleUpdateFound() {
    console.log('New service worker version found');
    this.updateAvailable = true;
    this.showUpdateNotification();
  }

  handleServiceWorkerMessage(event) {
    if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
      this.updateAvailable = true;
      this.showUpdateNotification();
    }
  }

  showUpdateNotification() {
    // Create update notification
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
      <div class="update-content">
        <div class="update-icon">🔄</div>
        <div class="update-text">
          <strong>Update Available!</strong>
          <p>A new version of Line Rehearsal is ready.</p>
        </div>
        <div class="update-actions">
          <button id="updateNow" class="primary">Update Now</button>
          <button id="updateLater" class="secondary">Later</button>
        </div>
      </div>
    `;
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1e293b;
      color: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 320px;
      animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .update-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .update-icon {
        font-size: 24px;
        flex-shrink: 0;
      }
      .update-text {
        flex: 1;
      }
      .update-text strong {
        display: block;
        margin-bottom: 4px;
      }
      .update-text p {
        margin: 0;
        font-size: 14px;
        opacity: 0.8;
      }
      .update-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-shrink: 0;
      }
      .update-actions button {
        padding: 6px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .update-actions .primary {
        background: #3b82f6;
        color: white;
      }
      .update-actions .primary:hover {
        background: #2563eb;
      }
      .update-actions .secondary {
        background: transparent;
        color: #94a3b8;
        border: 1px solid #374151;
      }
      .update-actions .secondary:hover {
        background: #374151;
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Add event listeners
    document.getElementById('updateNow').addEventListener('click', () => {
      this.applyUpdate();
      notification.remove();
    });
    
    document.getElementById('updateLater').addEventListener('click', () => {
      notification.remove();
    });
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }

  async applyUpdate() {
    if (this.registration && this.registration.waiting) {
      // Tell the waiting service worker to skip waiting and become active
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload the page to use the new service worker
      window.location.reload();
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LineRecorderApp();
  new ServiceWorkerManager();
});