import { Mail } from 'lucide-react'

const CONTACT_EMAIL = 'contact@trailcockpit.run'

export function ContactCard() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}?subject=Trail%20Cockpit%20%E2%80%94%20Support`}
      className="flex items-center justify-center gap-[8px] w-full px-3 py-[12px] rounded-[10px] bg-trail-primary text-white text-[13px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
    >
      <Mail size={14} />
      Envoyer un email
    </a>
  )
}
