// If a hosted event photo fails to load, drop it and show the text-only card. Never a stock photo.
document.addEventListener('error', event => {
  const img = event.target
  if (!(img instanceof HTMLImageElement)) return
  const card = img.closest('.card')
  if (card) card.classList.add('np')
  if (card || img.closest('.detail')) img.remove()
}, true)
