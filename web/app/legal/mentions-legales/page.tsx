import type { Metadata } from 'next'
import {
  LegalPageShell,
  LegalSection,
  LegalParagraph,
  LegalList,
  LegalTodo,
} from '@/components/legal/LegalPageShell'

export const metadata: Metadata = {
  title: 'Mentions légales — Trail Cockpit',
  description:
    'Mentions légales de l’application Trail Cockpit : éditeur, contact, hébergeur et propriété intellectuelle.',
}

const UPDATED_AT = '11 mai 2026'
const CONTACT_EMAIL = 'support@trailcockpit.run'

export default function MentionsLegalesPage() {
  return (
    <LegalPageShell
      eyebrow="Réglementaire"
      title="Mentions légales"
      description="Informations légales relatives à l’application Trail cockpit."
      updatedAt={UPDATED_AT}
    >
      <LegalSection title="Éditeur de l’application">
        <LegalParagraph>
          L’application Trail cockpit est éditée à titre individuel par Franck Meri.
        </LegalParagraph>
        <LegalTodo>
          {/* TODO: compléter avec la forme juridique (auto-entrepreneur, société, etc.), le SIRET et l’adresse professionnelle complète. */}
          Information à compléter : forme juridique, SIRET, adresse postale du
          responsable de la publication.
        </LegalTodo>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalParagraph>
          Pour toute question relative à l’application, à son fonctionnement ou
          à ses contenus, vous pouvez écrire à :
        </LegalParagraph>
        <LegalParagraph>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20cockpit%20%E2%80%94%20Mentions%20l%C3%A9gales`}
            className="text-trail-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Hébergement">
        <LegalParagraph>
          L’application Trail cockpit est hébergée par :
        </LegalParagraph>
        <LegalList
          items={[
            <>
              <strong className="text-trail-text">Vercel Inc.</strong> —
              hébergeur principal de l’application web et de l’API.
              <br />
              440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.
              <br />
              Site :{' '}
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
              <strong className="text-trail-text">Supabase Inc.</strong> —
              hébergeur de la base de données et du service
              d’authentification.
              <br />
              970 Toa Payoh North #07-04, Singapour 318992.
              <br />
              Site :{' '}
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

      <LegalSection title="Objet de l’application">
        <LegalParagraph>
          Trail cockpit est une application de suivi, d’analyse et d’aide à
          l’entraînement sportif. L’application permet notamment de suivre des
          activités sportives, d’analyser des statistiques, de suivre la charge
          d’entraînement et, selon les fonctionnalités activées, d’utiliser
          des données provenant de services tiers comme Strava, Garmin, Suunto,
          Polar ou autres services compatibles.
        </LegalParagraph>
        <LegalParagraph>
          L’application n’est pas un dispositif médical et ne remplace pas
          l’avis d’un médecin, d’un kinésithérapeute, d’un entraîneur diplômé
          ou de tout autre professionnel qualifié.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <LegalParagraph>
          L’ensemble des éléments composant l’application Trail cockpit (nom,
          logo, interface, textes, graphismes, code source, algorithmes
          d’analyse) est protégé par le droit d’auteur et, le cas échéant,
          par le droit des marques. Toute reproduction, représentation,
          modification ou exploitation, totale ou partielle, sans autorisation
          écrite préalable de l’éditeur est interdite.
        </LegalParagraph>
        <LegalParagraph>
          Les marques et logos de services tiers cités dans l’application
          (notamment Strava) restent la propriété exclusive de leurs
          détenteurs respectifs.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Services tiers">
        <LegalParagraph>
          Trail cockpit peut s’interfacer avec différents services tiers afin
          de synchroniser les données sportives de l’utilisateur, notamment :
        </LegalParagraph>
        <LegalList
          items={[
            'Strava — synchronisation des activités via l’API officielle Strava.',
            'D’autres services compatibles peuvent être ajoutés ultérieurement (Garmin, Suunto, Polar, etc.).',
          ]}
        />
        <LegalParagraph>
          L’utilisation de ces services tiers reste soumise à leurs propres
          conditions d’utilisation et politiques de confidentialité.
          L’utilisateur est seul responsable de l’acceptation de ces
          conditions.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Limitation de responsabilité">
        <LegalParagraph>
          L’éditeur met tout en œuvre pour fournir une application fiable et
          des analyses pertinentes. Toutefois, les informations, analyses et
          recommandations fournies par Trail cockpit le sont à titre purement
          indicatif et ne sauraient engager la responsabilité de l’éditeur
          quant aux décisions sportives ou de santé prises par l’utilisateur.
        </LegalParagraph>
        <LegalParagraph>
          L’éditeur ne peut être tenu responsable des indisponibilités
          techniques, interruptions de service, erreurs ou pertes de données
          provenant des services tiers connectés à l’application, ni des
          dommages directs ou indirects pouvant résulter de l’usage ou de
          l’impossibilité d’usage de l’application.
        </LegalParagraph>
      </LegalSection>
    </LegalPageShell>
  )
}
