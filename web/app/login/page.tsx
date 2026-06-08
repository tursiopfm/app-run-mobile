import { redirect } from 'next/navigation'

// Page de login historique : tout l'auth vit désormais sur `/` (LoginForm).
export default function LoginRedirect() {
  redirect('/')
}
