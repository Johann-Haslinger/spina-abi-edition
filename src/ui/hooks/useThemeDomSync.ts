import { useEffect, useLayoutEffect } from 'react'
import { useThemeStore } from '../../stores/themeStore'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function applyThemeToDom(effectiveTheme: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  const isDark = effectiveTheme === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
  document.body.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = effectiveTheme
}

export function useThemeDomSync() {
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme)
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme)

  useIsoLayoutEffect(() => {
    applyThemeToDom(effectiveTheme)
  }, [effectiveTheme])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const reapplyTheme = () => applyThemeToDom(effectiveTheme)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reapplyTheme()
    }

    window.addEventListener('focus', reapplyTheme)
    window.addEventListener('pageshow', reapplyTheme)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', reapplyTheme)
      window.removeEventListener('pageshow', reapplyTheme)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [effectiveTheme])

  useEffect(() => {
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mql) return

    const onChange = () => setSystemTheme(mql.matches ? 'dark' : 'light')
    onChange()

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    }
    mql.addListener(onChange)
    return () => mql.removeListener(onChange)
  }, [setSystemTheme])
}

