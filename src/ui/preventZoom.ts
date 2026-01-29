export function installPreventZoomGuards() {
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
    const modifierPressed = isMac ? e.metaKey : e.ctrlKey
    if (!modifierPressed) return

    if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '0') {
      e.preventDefault()
    }
  }

  const onGesture = (e: Event) => {
    e.preventDefault()
  }

  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown, { passive: false })
  window.addEventListener('gesturestart', onGesture, { passive: false } as AddEventListenerOptions)
  window.addEventListener('gesturechange', onGesture, { passive: false } as AddEventListenerOptions)
  window.addEventListener('gestureend', onGesture, { passive: false } as AddEventListenerOptions)

  return () => {
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('gesturestart', onGesture)
    window.removeEventListener('gesturechange', onGesture)
    window.removeEventListener('gestureend', onGesture)
  }
}

