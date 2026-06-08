import { redirect } from 'next/navigation'

// Reset par lien email supprimé (flux code OTP inline sur `/`).
// Les anciens liens encore en circulation atterrissent ici → on les renvoie sur l'accueil.
export default function ResetRedirect() {
  redirect('/')
}
