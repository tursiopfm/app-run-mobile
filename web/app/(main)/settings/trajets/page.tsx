import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getServerUser } from '@/lib/database/get-user'
import { CommuteRoutesSection } from '@/components/settings/CommuteRoutesSection'

export default async function CommuteRoutesPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  return (
    <div className="px-3 py-3 space-y-3 max-w-lg md:max-w-3xl mx-auto pb-8">
      <div className="px-1 flex items-center gap-2">
        <Link
          href="/settings"
          className="text-trail-muted hover:text-trail-text -ml-1 p-1"
          aria-label="Retour aux réglages"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <p className="text-[22px] font-black text-trail-text leading-tight">
            Trajets domicile-travail
          </p>
          <p className="text-[12px] text-trail-muted leading-[16px] mt-1">
            Configure tes trajets Runtaf / Vélotaf pour que les activités soient détectées et
            renommées automatiquement (aller et retour).
          </p>
        </div>
      </div>

      <div className="rounded-[14px] bg-trail-card border border-trail-border p-[10px] space-y-[10px]">
        <CommuteRoutesSection />
      </div>
    </div>
  )
}
