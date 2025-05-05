document.getElementById('cancel-btn').addEventListener('click', () => {
  window.close();
});

document.getElementById('allow-btn').addEventListener('click', () => {
  window.chrome.runtime.sendMessage({ action: 'approve' });
});
