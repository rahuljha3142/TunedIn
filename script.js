document.addEventListener('DOMContentLoaded', () => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  const API_BASE_URL = isLocal 
    ? 'http://localhost:5000' 
    : 'https://tunedin-b.onrender.com'; 

  // --- DOM ELEMENTS ---
  const songListContainer = document.getElementById('songList');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playPauseIcon = document.getElementById('playPauseIcon');
  const progressBar = document.getElementById('progressBar');
  const currentTimeEl = document.getElementById('currentTime');
  const durationEl = document.getElementById('duration');
  const volumeBar = document.getElementById('volumeBar');
  const volumeIcon = document.getElementById('volumeIcon');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');

  // --- PLAYER STATE ---
  let globalAudio = new Audio();
  let songQueue = [];
  let originalSongs = [];
  let currentSongIndex = 0;
  let currentSongId = null;

  // --- DARK MODE ---
  document.getElementById('darkModeToggle').addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
  });

  // --- DATA FETCHING ---
  async function fetchSongs() {
    try {
      // Use the API_BASE_URL to fetch from the correct server
      const response = await fetch(`${API_BASE_URL}/api/songs`);
      const songs = await response.json();
      songQueue = songs;
      originalSongs = songs;

      songListContainer.innerHTML = ''; // Clear container
      songs.forEach((song, index) => {
        const songElement = createSongBar(song, index);
        songListContainer.appendChild(songElement);
      });
    } catch (err) {
      console.error('Failed to fetch songs:', err);
    }
  }

  // --- UI GENERATION ---
  function createSongBar(song, index) {
    const { file_id, thumb_id, title, performer, duration } = song;
  
    const songBar = document.createElement('div');
    songBar.className = 'song-container';
    songBar.dataset.id = file_id;
  
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
    // Thumbnail source points to our backend proxy
    songBar.innerHTML = `
      <img class="song-cover" src="${API_BASE_URL}/telegram/thumbnail/${thumb_id}" alt="cover">
      <div class="song-details">
        <div class="text-info">
          <h3 class="name">${title || 'Unknown Title'}</h3>
          <p class="artist">${performer || 'Unknown Artist'}</p>
        </div>
        <span class="time">${formattedDuration}</span>
      </div>
    `;
  
    songBar.addEventListener('click', () => {
      playSongAtIndex(index);
    });
  
    return songBar;
  }

  // --- PLAYBACK LOGIC ---
  function playSongAtIndex(index) {
    if (index < 0 || index >= songQueue.length) return;
    currentSongIndex = index;
    const song = songQueue[index];
    updateMusicPlayer(song);
    highlightCurrentSong();
  }

  function updateMusicPlayer(song) {
    const { title, performer, thumb_id, file_id, duration } = song;
    currentSongId = file_id;

    document.getElementById('songTitle').textContent = title || 'Unknown Title';
    document.getElementById('songArtist').textContent = performer || 'Unknown Artist';
    
    // Update visual assets via Proxy
    document.getElementById('coverImage').src = `${API_BASE_URL}/telegram/thumbnail/${thumb_id}`;
    document.getElementById('coverImage').classList.add('playing');
    document.getElementById('equalizer').classList.add('playing');

    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    durationEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Set audio source via Proxy
    globalAudio.src = `${API_BASE_URL}/telegram/audio/${file_id}`;
    globalAudio.play();
    playPauseIcon.src = 'pause.png';
    playPauseIcon.alt = 'Pause';
  }

  function playNextSong() {
    currentSongIndex = (currentSongIndex + 1) % songQueue.length;
    playSongAtIndex(currentSongIndex);
  }

  function playPrevSong() {
    currentSongIndex = (currentSongIndex - 1 + songQueue.length) % songQueue.length;
    playSongAtIndex(currentSongIndex);
  }

  function highlightCurrentSong() {
    const allSongElements = document.querySelectorAll('.song-container');
    allSongElements.forEach(el => el.classList.remove('active'));
  
    const currentElement = Array.from(allSongElements).find(el => el.dataset.id === currentSongId);
    if (currentElement) {
      currentElement.classList.add('active');
      scrollToCurrentSong();
    }
  }

  function scrollToCurrentSong() {
    const currentElement = document.querySelector(`.song-container[data-id="${currentSongId}"]`);
    if (currentElement) currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // --- EVENT LISTENERS ---
  playPauseBtn.addEventListener('click', () => {
    if (globalAudio.paused) {
      globalAudio.play();
      playPauseIcon.src = 'pause.png';
      document.getElementById('coverImage').classList.add('playing');
      document.getElementById('equalizer').classList.add('playing');
    } else {
      globalAudio.pause();
      playPauseIcon.src = 'play.png';
      document.getElementById('coverImage').classList.remove('playing');
      document.getElementById('equalizer').classList.remove('playing');
    }
  });

  nextBtn.addEventListener('click', playNextSong);
  prevBtn.addEventListener('click', playPrevSong);
  globalAudio.addEventListener('ended', playNextSong);

  globalAudio.addEventListener('timeupdate', () => {
    const current = globalAudio.currentTime;
    const total = globalAudio.duration;
    progressBar.value = (current / total) * 100 || 0;

    const min = Math.floor(current / 60);
    const sec = Math.floor(current % 60);
    currentTimeEl.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
  });

  progressBar.addEventListener('input', () => {
    if (globalAudio.duration) {
      globalAudio.currentTime = (progressBar.value / 100) * globalAudio.duration;
    }
  });

  volumeBar.addEventListener('input', () => {
    globalAudio.volume = volumeBar.value;
    globalAudio.muted = volumeBar.value == 0;
    volumeIcon.src = volumeBar.value == 0 ? 'volume-off.png' : 'volume-on.png';
  });

  volumeIcon.addEventListener('click', () => {
    globalAudio.muted = !globalAudio.muted;
    volumeIcon.src = globalAudio.muted ? 'volume-off.png' : 'volume-on.png';
  });

  // --- SEARCH ---
  document.getElementById('searchBar').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filteredSongs = originalSongs.filter(song =>
      song.title && song.title.toLowerCase().includes(query)
    );
  
    songQueue = filteredSongs;
    songListContainer.innerHTML = '';
  
    filteredSongs.forEach((song, index) => {
      const songElement = createSongBar(song, index);
      songListContainer.appendChild(songElement);
    });
    highlightCurrentSong();
  });

  // --- SHORTCUTS ---
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      playPauseBtn.click();
    } else if (e.code === 'ArrowRight') {
      nextBtn.click();
    } else if (e.code === 'ArrowLeft') {
      prevBtn.click();
    }
  });

  // Initial Fetch
  fetchSongs();
});