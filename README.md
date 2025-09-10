# 🎭 Line Rehearsal

A Progressive Web App (PWA) designed to help actors record and practice their lines for plays. The app features dual-channel recording that allows you to record your lines while hearing other actors' lines, with precise control over the audio mix during playback.

## Features

### 🎙️ Dual-Channel Recording
- **Left Channel**: Records your voice when you're NOT holding "My line" button
- **Right Channel**: Records your voice when you ARE holding "My line" button
- **Smart Routing**: Hold the "My line" button only when it's your turn to speak

### 📱 Progressive Web App
- **Installable**: Can be installed on desktop and mobile devices
- **Offline Capable**: Works without internet connection after installation
- **Responsive Design**: Optimized for both desktop and mobile use

### 🎵 Advanced Playback Controls
- **Volume Mixing**: Adjust right channel volume with vertical slider
- **Seek Controls**: Jump forward/backward 15 seconds with dedicated buttons
- **Persistent Settings**: Your volume preferences are remembered between sessions

### 📁 File Management
- **Local Storage**: All recordings stored locally using IndexedDB
- **File Organization**: View recordings with duration and creation date
- **Import/Export**: Upload existing recordings or download your files
- **Smart Naming**: Automatic filename generation with collision prevention

## Getting Started

### Installation
1. Open the app in a modern web browser (Chrome, Firefox, Safari, Edge)
2. For best experience, serve over HTTPS or use localhost
3. Install as PWA: Look for the install prompt or use browser menu

### First Recording
1. Click the **+** button to start a new recording
2. Select your preferred microphone from the dropdown
3. Click **Start** to begin recording
4. Hold **My line** when it's your turn to speak
5. Release **My line** when other actors are speaking
6. Click **Stop** to finish and save the recording

## How to Use

### Recording Your Lines
1. **Open Recording Dialog**: Click the blue **+** button
2. **Select Microphone**: Choose your preferred input device (selection is remembered)
3. **Start Recording**: Click **Start** button
4. **Record Your Lines**: 
   - Hold **My line** button when it's your turn to speak
   - Release it when other actors are speaking
   - The button turns red when recording your voice
5. **Stop Recording**: Click **Stop** to save (auto-saves as "Untitled-X.webm")

### Playing Back Recordings
1. **Open Playback**: Click any recording in the file list
2. **Control Playback**: Use ⏪ ▶️ ⏩ buttons for seek and play/stop
3. **Adjust Mix**: Use the vertical slider on the right to control right channel volume
   - **Top (🔊)**: Full volume on your recorded lines
   - **Bottom (🔇)**: Mute your recorded lines
4. **Download**: Click **Download** to save the file to your device

### Managing Files
- **Rename**: Click the ✏️ icon to edit filenames inline
- **Delete**: Click the 🗑️ icon to remove recordings (with confirmation)
- **Upload**: Click the 📤 button to import existing audio files
- **View Details**: See duration and creation date for each recording

## Technical Details

### Audio Format
- **Recording Format**: WebM with Opus codec
- **Channels**: Stereo (left/right channel separation)
- **Quality**: Optimized for voice recording

### Browser Compatibility
- **Chrome/Edge**: Full support including microphone selection
- **Firefox**: Full support
- **Safari**: Full support (may require HTTPS for microphone access)

### Storage
- **Local Database**: Uses IndexedDB for reliable local storage
- **No Server Required**: All data stays on your device
- **Export Capability**: Download recordings as standard WebM files

## Keyboard Shortcuts
- **Escape**: Close any open dialog
- **Enter**: Confirm filename when editing
- **Escape**: Cancel filename editing

## Tips for Best Results

### Recording Tips
1. **Use a Good Microphone**: Select your best available microphone
2. **Hold Steadily**: Keep the "My line" button pressed for your entire line
3. **Practice Timing**: Get familiar with when to hold/release the button
4. **Test First**: Do a short test recording to check levels

### Playback Tips
1. **Adjust Mix**: Use the slider to find the perfect balance
2. **Seek Efficiently**: Use the 15-second jump buttons for quick navigation
3. **Save Preferences**: Your volume settings are automatically remembered

### File Management Tips
1. **Rename Files**: Give recordings descriptive names for easy identification
2. **Regular Cleanup**: Delete old recordings you no longer need
3. **Backup Important**: Download important recordings to your device

## Troubleshooting

### Microphone Issues
- **No Sound**: Check microphone permissions in browser settings
- **Wrong Microphone**: Use the dropdown to select the correct device
- **Poor Quality**: Try a different microphone or adjust system audio settings

### Recording Issues
- **No Recording**: Ensure you've granted microphone permissions
- **Missing Audio**: Check that you're holding "My line" during your lines
- **File Not Saving**: Check browser storage permissions

### Playback Issues
- **No Sound**: Check system volume and browser audio settings
- **Slider Not Working**: Try refreshing the page and reopening the dialog
- **Download Fails**: Check browser download permissions

## Version History
- **v2.0**: Complete redesign with file management, upload/download, and improved UI
- **v1.0**: Initial release with basic dual-channel recording

## Browser Requirements
- **Modern Browser**: Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
- **Microphone Access**: Required for recording functionality
- **Local Storage**: Required for saving recordings
- **Web Audio API**: Required for advanced audio processing

---

**Note**: This app works best when served over HTTPS or accessed via localhost. For production use, ensure proper SSL certificates are in place for microphone access to work reliably across all browsers.
