import type { Metadata } from 'next'
import {
  LegalPageShell,
  LegalSection,
  LegalParagraph,
  LegalList,
} from '@/components/legal/LegalPageShell'
import { getServerT } from '@/lib/i18n/server'

const CONTACT_EMAIL = 'contact@trailcockpit.run'

export async function generateMetadata(): Promise<Metadata> {
  const T = getServerT().legal.terms
  return {
    title:       T.metaTitle,
    description: T.pageDescription,
  }
}

export default function ConditionsUtilisationPage() {
  const t = getServerT()
  const T = t.legal.terms
  return (
    <LegalPageShell
      eyebrow={t.legal.eyebrow}
      title={T.pageTitle}
      description={T.pageDescription}
      updatedAt={t.legal.updatedAtValue}
    >
      <LegalSection title={T.sectionPurpose}>
        <LegalParagraph>{T.purposeP1}</LegalParagraph>
        <LegalParagraph>{T.purposeP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={T.sectionAccount}>
        <LegalParagraph>{T.accountP1}</LegalParagraph>
        <LegalParagraph>{T.accountP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={T.sectionThirdParty}>
        <LegalParagraph>{T.thirdPartyP1}</LegalParagraph>
        <LegalParagraph>{T.thirdPartyP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={T.sectionAccuracy}>
        <LegalParagraph>{T.accuracyP1}</LegalParagraph>
        <LegalParagraph>{T.accuracyP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={T.sectionAi}>
        <LegalParagraph>{T.aiP1}</LegalParagraph>
        <LegalParagraph>{T.aiP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={T.sectionMedical}>
        <LegalParagraph>{T.medicalP1}</LegalParagraph>
        <LegalParagraph>{T.medicalP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={T.sectionResponsibility}>
        <LegalList items={[T.resp1, T.resp2, T.resp3, T.resp4]} />
      </LegalSection>

      <LegalSection title={T.sectionAvailability}>
        <LegalParagraph>{T.availabilityP1}</LegalParagraph>
        <LegalParagraph>{T.availabilityP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={T.sectionIp}>
        <LegalParagraph>{T.ipP1}</LegalParagraph>
        <LegalParagraph>{T.ipP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={T.sectionData}>
        <LegalParagraph>{T.dataP}</LegalParagraph>
      </LegalSection>

      <LegalSection title={T.sectionDelete}>
        <LegalParagraph>
          {T.deletePrompt}{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20cockpit%20%E2%80%94%20Suppression%20du%20compte`}
            className="text-trail-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          {T.deleteOutro}
        </LegalParagraph>
      </LegalSection>

      <LegalSection title={T.sectionChanges}>
        <LegalParagraph>{T.changesP1}</LegalParagraph>
        <LegalParagraph>{T.changesP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={T.sectionLaw}>
        <LegalParagraph>{T.lawP}</LegalParagraph>
      </LegalSection>
    </LegalPageShell>
  )
}
