import { useEffect, useState } from 'react'
import { must, sb } from './config'
import type { CatalogCourse, Category, Course, PubInstructor } from './types'

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    let ok = true
    setLoading(true)
    fn()
      .then((d) => { if (ok) { setData(d); setError(null) } })
      .catch((e) => { if (ok) setError(e?.message || String(e)) })
      .finally(() => { if (ok) setLoading(false) })
    return () => { ok = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n])
  return { data, loading, error, reload: () => setN((x) => x + 1), setData }
}

export async function loadCatalog() {
  const [c, cat, ci, pi] = await Promise.all([
    sb().from('courses').select('*').eq('status', 'published').order('published_at', { ascending: false }),
    sb().from('categories').select('*').order('position'),
    sb().from('course_instructors').select('course_id,instructor_id'),
    sb().from('public_instructors').select('*'),
  ])
  const courses = must<Course[]>(c)
  const categories = must<Category[]>(cat)
  const links = must<{ course_id: string; instructor_id: string }[]>(ci)
  const ins = must<PubInstructor[]>(pi)
  const list: CatalogCourse[] = courses.map((x) => ({
    ...x,
    category: categories.find((k) => k.id === x.category_id),
    instructors: links.filter((l) => l.course_id === x.id).map((l) => ins.find((p) => p.id === l.instructor_id)).filter(Boolean) as PubInstructor[],
  }))
  return { courses: list, categories, instructors: ins }
}
export const useCatalog = () => useAsync(loadCatalog, [])
