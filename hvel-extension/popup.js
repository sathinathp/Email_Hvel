let currentMode = 'with_link';

// Load saved setting on popup open
chrome.storage.local.get(['hvel_stamp_mode'], (result) => {
  currentMode = result.hvel_stamp_mode || 'with_link';
  applyModeUI(currentMode);
});

function selectMode(mode) {
  currentMode = mode;
  applyModeUI(mode);
}

function applyModeUI(mode) {
  const linkCard = document.getElementById('optionLink');
  const hashCard = document.getElementById('optionHash');
  if (mode === 'with_link') {
    linkCard.classList.add('active');
    hashCard.classList.remove('active');
  } else {
    hashCard.classList.add('active');
    linkCard.classList.remove('active');
  }
}

function saveSettings() {
  chrome.storage.local.set({ hvel_stamp_mode: currentMode }, () => {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  });
}
