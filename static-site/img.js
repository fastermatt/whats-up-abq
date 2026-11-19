// If a hosted event photo fails to load, swap in the neutral placeholder. Never a stock photo.
document.addEventListener('error', event => {
  const img = event.target
  if (!(img instanceof HTMLImageElement) || img.dataset.fallback || !img.closest('.card, .detail')) return
  img.dataset.fallback = '1'
  img.classList.add('ph')
  img.src = '/assets/map.webp'
}, true)
