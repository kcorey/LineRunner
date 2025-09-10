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
    
    this.initializeElements();
    this.setupEventListeners();
    this.initializeDatabase();
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
    this.addButton.addEventListener('click', () => this.openRecordingDialog());
    this.uploadBtn.addEventListener('click', () => this.uploadInput.click());
    this.uploadInput.addEventListener('change', (e) => this.handleFileUpload(e));
    
    // Recording dialog
    this.closeRecordingBtn.addEventListener('click', () => this.closeRecordingDialog());
    this.startStopBtn.addEventListener('click', () => this.toggleRecording());
    this.myLineBtn.addEventListener('mousedown', () => this.startMyLine());
    this.myLineBtn.addEventListener('mouseup', () => this.stopMyLine());
    this.myLineBtn.addEventListener('mouseleave', () => this.stopMyLine());
    this.micSelect.addEventListener('change', () => this.saveMicrophoneSelection());
    
    // Playback dialog
    this.closePlaybackBtn.addEventListener('click', () => this.closePlaybackDialog());
    this.playBtn.addEventListener('click', () => this.togglePlayback());
    this.seekBackBtn.addEventListener('click', () => this.seekBackward());
    this.seekForwardBtn.addEventListener('click', () => this.seekForward());
    this.downloadBtn.addEventListener('click', () => this.downloadRecording());
    this.rightLevel.addEventListener('input', (e) => this.adjustRightLevel(e.target.value));
    
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

  openRecordingDialog() {
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
    
    // Load the audio
    const audioBlob = new Blob([recording.audioData], { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(audioBlob);
    this.player.src = audioUrl;
    
    // Reset play button state
    this.playBtn.textContent = '▶️';
    this.playBtn.title = 'Play';
    
    // Restore saved slider position
    const savedLevel = localStorage.getItem('rightChannelLevel');
    if (savedLevel) {
      this.rightLevel.value = savedLevel;
    }
    
    // Handle audio end
    this.player.onended = () => {
      this.playBtn.textContent = '▶️';
      this.playBtn.title = 'Play';
    };
    
    // Set up playback audio context
    this.setupPlaybackAudioContext();
  }

  closePlaybackDialog() {
    this.player.pause();
    this.player.src = '';
    this.playbackDialog.classList.add('hidden');
    this.currentRecording = null;
  }

  setupPlaybackAudioContext() {
    if (!this.playbackAudioContext) {
      this.playbackAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const source = this.playbackAudioContext.createMediaElementSource(this.player);
    
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
    this.adjustRightLevel(this.rightLevel.value);
  }

  adjustRightLevel(value) {
    const rightGain = value / 100;
    if (this.playbackRightGain) {
      this.playbackRightGain.gain.value = rightGain;
    }
    // Save the slider position
    localStorage.setItem('rightChannelLevel', value);
  }

  togglePlayback() {
    if (this.player.paused) {
      this.player.play();
      this.playBtn.textContent = '⏹️';
      this.playBtn.title = 'Stop';
    } else {
      this.player.pause();
      this.playBtn.textContent = '▶️';
      this.playBtn.title = 'Play';
    }
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