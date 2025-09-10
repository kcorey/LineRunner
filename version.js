// Version management for cache-busting
// This file is used to track the current version and update cache versions

const VERSION = {
  major: 2,
  minor: 0,
  patch: 5,
  build: 1757513963813 // Timestamp for unique builds
};

// Generate version string
VERSION.string = `${VERSION.major}.${VERSION.minor}.${VERSION.patch}`;
VERSION.full = `${VERSION.string}.${VERSION.build}`;

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VERSION;
} else if (typeof window !== 'undefined') {
  window.APP_VERSION = VERSION;
}

console.log('Line Rehearsal Version:', VERSION.string);
