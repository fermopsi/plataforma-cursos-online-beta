export type Role = 'admin' | 'instructor' | 'student'
export type Level = 'basico' | 'intermedio' | 'avanzado'
export type CourseStatus = 'draft' | 'published' | 'archived'
export type EnrollmentStatus = 'pending' | 'active' | 'revoked'
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'cancelled' | 'refunded'
export type PaymentMethod = 'cash' | 'transfer' | 'qr'
export type ResourceKind = 'pdf' | 'presentation' | 'image' | 'file' | 'link' | 'text'

export interface Profile {
  id: string; email: string; full_name: string; phone: string | null; avatar_url: string | null
  bio: string | null; specialty: string | null; role: Role; active: boolean; created_at: string
}
export interface Category { id: string; name: string; slug: string; icon: string; position: number }
export interface Course {
  id: string; slug: string; title: string; short_description: string; description: string
  category_id: string | null; level: Level; duration_label: string; price: number; currency: string
  cover_url: string | null; objectives: string[]; requirements: string[]; audience: string
  status: CourseStatus; featured: boolean; created_at: string; published_at: string | null
}
export interface Module { id: string; course_id: string; title: string; description: string; position: number; published: boolean }
export interface Lesson {
  id: string; module_id: string; course_id: string; title: string; description: string; youtube_id: string | null
  content: string; duration_min: number; position: number; required: boolean; published: boolean
}
export interface Resource {
  id: string; lesson_id: string; course_id: string; name: string; kind: ResourceKind
  url: string | null; storage_path: string | null; description: string
}
export interface Enrollment {
  id: string; student_id: string; course_id: string; status: EnrollmentStatus; enrolled_at: string
  completed_at: string | null; last_lesson_id: string | null; last_activity_at: string | null
}
export interface Payment {
  id: string; enrollment_id: string | null; student_id: string; course_id: string; amount: number; currency: string
  method: PaymentMethod; status: PaymentStatus; reference: string | null; notes: string | null
  receipt_path: string | null; paid_at: string; created_at: string
}
export interface Certificate { id: string; enrollment_id: string; student_id: string; course_id: string; code: string; issued_at: string; revoked: boolean }
export interface Notification { id: string; user_id: string; title: string; body: string; kind: string; read: boolean; created_at: string }
export interface PubInstructor { id: string; full_name: string; avatar_url: string | null; bio: string | null; specialty: string | null }
export interface CatalogCourse extends Course { category?: Category; instructors: PubInstructor[] }

export interface Settings {
  academy_name: string; tagline: string; description: string; hero_title: string; hero_subtitle: string
  brand_color: string; logo_url: string | null; whatsapp: string; contact_email: string
  instagram: string | null; facebook: string | null
  cert_signer_name: string; cert_signer_title: string; cert_text: string; enroll_cta_label: string
}
export const DEFAULT_SETTINGS: Settings = {
  academy_name: 'Aula Norte', tagline: 'Formación práctica para el mundo digital',
  description: 'Somos una academia online enfocada en formación práctica.',
  hero_title: 'Aprende nuevas habilidades. Transforma tu futuro.',
  hero_subtitle: 'Formación práctica en negocios digitales, marketing, tecnología e inteligencia artificial.',
  brand_color: '#308CA2', logo_url: null, whatsapp: '59170000000', contact_email: '', instagram: null, facebook: null,
  cert_signer_name: 'Dirección Académica', cert_signer_title: 'Aula Norte',
  cert_text: 'ha completado satisfactoriamente el curso', enroll_cta_label: 'Inscribirme por WhatsApp',
}
