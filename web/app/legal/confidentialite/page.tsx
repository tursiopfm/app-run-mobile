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
  const P = getServerT().legal.privacy
  return {
    title:       P.metaTitle,
    description: P.pageDescription,
  }
}

export default function ConfidentialitePage() {
  const t = getServerT()
  const P = t.legal.privacy
  return (
    <LegalPageShell
      eyebrow={t.legal.eyebrow}
      title={P.pageTitle}
      description={P.pageDescription}
      updatedAt={t.legal.updatedAtValue}
    >
      <LegalSection title={P.sectionController}>
        <LegalParagraph>{P.controllerP1}</LegalParagraph>
        <LegalParagraph>
          {P.controllerPrompt}{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20cockpit%20%E2%80%94%20RGPD`}
            className="text-trail-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </LegalParagraph>
      </LegalSection>

      <LegalSection title={P.sectionCollected}>
        <LegalParagraph>{P.collectedP}</LegalParagraph>
      </LegalSection>

      <LegalSection title={P.sectionAccount}>
        <LegalList items={[P.accountItem1, P.accountItem2, P.accountItem3]} />
      </LegalSection>

      <LegalSection title={P.sectionSports}>
        <LegalParagraph>{P.sportsP}</LegalParagraph>
      </LegalSection>

      <LegalSection title={P.sectionGps}>
        <LegalList items={[P.gpsItem1, P.gpsItem2]} />
        <LegalParagraph>{P.gpsP}</LegalParagraph>
      </LegalSection>

      <LegalSection title={P.sectionThirdParty}>
        <LegalParagraph>{P.thirdPartyP1}</LegalParagraph>
        <LegalParagraph>{P.thirdPartyP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={P.sectionAi}>
        <LegalParagraph>{P.aiP1}</LegalParagraph>
        <LegalParagraph>{P.aiP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={P.sectionPurposes}>
        <LegalList
          items={[P.purpose1, P.purpose2, P.purpose3, P.purpose4, P.purpose5, P.purpose6]}
        />
      </LegalSection>

      <LegalSection title={P.sectionLegalBasis}>
        <LegalList items={[P.basis1, P.basis2, P.basis3, P.basis4]} />
      </LegalSection>

      <LegalSection title={P.sectionSensitive}>
        <LegalParagraph>{P.sensitiveP1}</LegalParagraph>
        <LegalParagraph>{P.sensitiveP2}</LegalParagraph>
      </LegalSection>

      <LegalSection title={P.sectionRecipients}>
        <LegalList items={[P.recipient1, P.recipient2, P.recipient3]} />
        <LegalParagraph>{P.recipientsOutro}</LegalParagraph>
      </LegalSection>

      <LegalSection title={P.sectionRetention}>
        <LegalList items={[P.retention1, P.retention2, P.retention3, P.retention4]} />
      </LegalSection>

      <LegalSection title={P.sectionSecurity}>
        <LegalParagraph>{P.securityP}</LegalParagraph>
      </LegalSection>

      <LegalSection title={P.sectionRights}>
        <LegalParagraph>{P.rightsIntro}</LegalParagraph>
        <LegalList
          items={[
            P.right1,
            P.right2,
            P.right3,
            P.right4,
            P.right5,
            P.right6,
            P.right7,
            P.right8,
          ]}
        />
        <LegalParagraph>
          {P.rightsPrompt}{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20cockpit%20%E2%80%94%20RGPD%20%E2%80%94%20Demande%20de%20droits`}
            className="text-trail-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </LegalParagraph>
      </LegalSection>

      <LegalSection title={P.sectionDelete}>
        <LegalParagraph>
          {P.deletePrompt}{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20cockpit%20%E2%80%94%20Suppression%20du%20compte`}
            className="text-trail-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          {P.deleteOutro}
        </LegalParagraph>
      </LegalSection>

      <LegalSection title={P.sectionContact}>
        <LegalParagraph>
          {P.contactPrompt}{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20cockpit%20%E2%80%94%20RGPD`}
            className="text-trail-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </LegalParagraph>
      </LegalSection>
    </LegalPageShell>
  )
}
