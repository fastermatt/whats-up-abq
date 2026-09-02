import type { ReactNode } from 'react'
import styles from './PublicPageHero.module.css'

interface PublicPageHeroProps {
  eyebrow: string
  title: string
  lede: ReactNode
  meta?: ReactNode
  action?: ReactNode
  tone?: 'paper' | 'dark'
}

/** Editorial page opener shared by the site's public listing routes. */
export function PublicPageHero({
  eyebrow,
  title,
  lede,
  meta,
  action,
  tone = 'paper',
}: PublicPageHeroProps) {
  return (
    <section className={`${styles.hero} ${tone === 'dark' ? styles.dark : ''}`}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lede}>{lede}</p>
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </section>
  )
}
