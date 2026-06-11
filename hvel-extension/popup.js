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
  if (linkCard && hashCard) {
    if (mode === 'with_link') {
      linkCard.classList.add('active');
      hashCard.classList.remove('active');
    } else {
      hashCard.classList.add('active');
      linkCard.classList.remove('active');
    }
  }
}

function saveSettings() {
  chrome.storage.local.set({ hvel_stamp_mode: currentMode }, () => {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }
  });
}

// Bind event listeners programmatically after DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const linkCard = document.getElementById('optionLink');
  const hashCard = document.getElementById('optionHash');
  const saveBtn = document.getElementById('saveBtn');

  if (linkCard) {
    linkCard.addEventListener('click', () => selectMode('with_link'));
  }
  if (hashCard) {
    hashCard.addEventListener('click', () => selectMode('hash_only'));
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', saveSettings);
  }
});
