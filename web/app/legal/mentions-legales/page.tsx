import type { Metadata } from 'next'
import {
  LegalPageShell,
  LegalSection,
  LegalParagraph,
  LegalList,
  LegalTodo,
} from '@/components/legal/LegalPageShell'
import { getServerT } from '@/lib/i18n/server'

const CONTACT_EMAIL = 'contact@trailcockpit.run'

export async function generateMetadata(): Promise<Metadata> {
  const M = getServerT().legal.mentions
  return {
    title:       M.metaTitle,
    description: M.pageDescription,
  }
}

export default function MentionsLegalesPage() {
  const t = getServerT()
  const M = t.legal.mentions
  return (
    <LegalPageShell
      eyebrow={t.legal.eyebrow}
      title={M.pageTitle}
      description={M.pageDescription}
      updatedAt={t.legal.updatedAtValue}
    >
      <LegalSection title={M.sectionEditor}>
        <LegalParagraph>{M.editorParagraph}</LegalParagraph>
        <LegalTodo>{M.editorTodo}</LegalTodo>
      </LegalSection>

      <LegalSection title={M.sectionContact}>
        <LegalParagraph>{M.contactPrompt}</LegalParagraph>
        <LegalParagraph>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20cockpit%20%E2%80%94%20Mentions%20l%C3%A9gales`}
            className="text-trail-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </LegalParagraph>
      </LegalSection>

      <LegalSection title={M.sectionHosting}>
        <LegalParagraph>{M.hostingIntro}</LegalParagraph>
        <LegalList
          items={[
            <>
              <strong className="text-trail-text">{M.vercelLabel}</strong> {M.vercelDesc}
              <br />
              {M.vercelAddress}
              <br />
              {M.vercelSiteLabel}{' '}
              <a
                href="https://vercel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-trail-primary hover:underline"
              >
                vercel.com
              </a>
            </>,
            <>
              <strong className="text-trail-text">{M.supabaseLabel}</strong> {M.supabaseDesc}
              <br />
              {M.supabaseAddress}
              <br />
              {M.supabaseSiteLabel}{' '}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-trail-primary hover:underline"
              >
                supabase.com
              </a>
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title={M.sectionPurpose}>
        <LegalParagraph>{M.purposeP1}</LegalParagraph>
        <LegalParagraph>{M.purposeP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={M.sectionIp}>
        <LegalParagraph>{M.ipP1}</LegalParagraph>
        <LegalParagraph>{M.ipP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={M.sectionThirdParty}>
        <LegalParagraph>{M.thirdPartyIntro}</LegalParagraph>
        <LegalList items={[M.thirdPartyItem1, M.thirdPartyItem2]} />
        <LegalParagraph>{M.thirdPartyOutro}</LegalParagraph>
      </LegalSection>

      <LegalSection title={M.sectionLiability}>
        <LegalParagraph>{M.liabilityP1}</LegalParagraph>
        <LegalParagraph>{M.liabilityP2}</LegalParagraph>
      </LegalSection>
    </LegalPageShell>
  )
}
