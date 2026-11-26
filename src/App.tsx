import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { getSb } from './lib/config'
import { AdminLayout, BareLayout, PublicLayout, RequireAuth } from './components/Layout'
import { Loading } from './components/ui'

import Home from './pages/public/Home'
import Catalog from './pages/public/Catalog'
import CourseDetail from './pages/public/CourseDetail'
import { About, Contact, Verify } from './pages/public/Info'
import { Forgot, Login, Register, Reset } from './pages/public/AuthPages'
import Install from './pages/setup/Install'
import StudentDashboard from './pages/student/Dashboard'
import Classroom from './pages/student/Classroom'
import { StudentCertificates, StudentProfile } from './pages/student/Account'
import InstructorDashboard from './pages/instructor/Dashboard'
import AdminDashboard from './pages/admin/Dashboard'
import { AdminCourses } from './pages/admin/Courses'
import CourseEditor from './pages/admin/CourseEditor'
import { AdminStudents, StudentDetail } from './pages/admin/Students'
import { AdminInstructors, AdminCategories } from './pages/admin/People'
import AdminPayments from './pages/admin/Payments'
import AdminReports from './pages/admin/Reports'
import AdminSettings from './pages/admin/Settings'

type Status = 'checking' | 'ok' | 'needs-install'

/** Detecta si la plataforma está configurada e instalada; si no, lleva al asistente. */
function useInstallStatus(): Status {
  const [st, setSt] = useState<Status>(getSb() ? 'checking' : 'needs-install')
  useEffect(() => {
    const c = getSb()
    if (!c) return
    c.rpc('lms_status').then(({ data, error }) => {
      setSt(!error && data?.installed && data?.has_admin ? 'ok' : 'needs-install')
    })
  }, [])
  return st
}

export default function App() {
  const status = useInstallStatus()
  const loc = useLocation()
  if (status === 'checking') return <Loading text="Conectando con la academia…" />
  if (status === 'needs-install') {
    return (
      <Routes>
        <Route path="/instalar" element={<Install />} />
        <Route path="*" element={<Navigate to="/instalar" replace state={{ from: loc.pathname }} />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/cursos" element={<Catalog />} />
        <Route path="/cursos/:slug" element={<CourseDetail />} />
        <Route path="/nosotros" element={<About />} />
        <Route path="/contacto" element={<Contact />} />
        <Route path="/verificar" element={<Verify />} />
        <Route path="/verificar/:code" element={<Verify />} />
      </Route>
      <Route element={<BareLayout />}>
        <Route path="/ingresar" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/recuperar" element={<Forgot />} />
        <Route path="/restablecer" element={<Reset />} />
        <Route path="/estudiante" element={<RequireAuth><StudentDashboard /></RequireAuth>} />
        <Route path="/estudiante/certificados" element={<RequireAuth><StudentCertificates /></RequireAuth>} />
        <Route path="/estudiante/perfil" element={<RequireAuth><StudentProfile /></RequireAuth>} />
        <Route path="/aula/:slug" element={<RequireAuth><Classroom /></RequireAuth>} />
        <Route path="/instructor" element={<RequireAuth roles={['instructor']}><InstructorDashboard /></RequireAuth>} />
        <Route path="/instructor/cursos/:id" element={<RequireAuth roles={['instructor']}><div className="wrap"><CourseEditor /></div></RequireAuth>} />
      </Route>
      <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminLayout /></RequireAuth>}>
        <Route index element={<AdminDashboard />} />
        <Route path="cursos" element={<AdminCourses />} />
        <Route path="cursos/:id" element={<CourseEditor />} />
        <Route path="estudiantes" element={<AdminStudents />} />
        <Route path="estudiantes/:id" element={<StudentDetail />} />
        <Route path="instructores" element={<AdminInstructors />} />
        <Route path="categorias" element={<AdminCategories />} />
        <Route path="pagos" element={<AdminPayments />} />
        <Route path="reportes" element={<AdminReports />} />
        <Route path="configuracion" element={<AdminSettings />} />
      </Route>
      <Route path="/instalar" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
