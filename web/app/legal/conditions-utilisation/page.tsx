import type { Metadata } from 'next'
import {
  LegalPageShell,
  LegalSection,
  LegalParagraph,
  LegalList,
} from '@/components/legal/LegalPageShell'

export const metadata: Metadata = {
  title: 'Conditions d’utilisation — Trail Cockpit',
  description:
    'Conditions d’utilisation de l’application Trail Cockpit : compte, services tiers, responsabilité et propriété intellectuelle.',
}

const UPDATED_AT = '11 mai 2026'
const CONTACT_EMAIL = 'support@trailcockpit.run'

export default function ConditionsUtilisationPage() {
  return (
    <LegalPageShell
      eyebrow="Réglementaire"
      title="Conditions d’utilisation"
      description="Règles d’usage applicables à l’application Trail cockpit."
      updatedAt={UPDATED_AT}
    >
      <LegalSection title="Objet de l’application">
        <LegalParagraph>
          Trail cockpit fournit des informations, analyses et recommandations
          à titre indicatif. L’utilisateur reste responsable de ses choix
          d’entraînement et de sa pratique sportive.
        </LegalParagraph>
        <LegalParagraph>
          L’application ne fournit pas de diagnostic médical, ne prescrit pas
          de traitement et ne remplace pas un professionnel de santé ou un
          coach qualifié.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Création du compte">
        <LegalParagraph>
          L’accès aux fonctionnalités de Trail cockpit nécessite la création
          d’un compte. L’utilisateur s’engage à fournir des informations
          exactes lors de l’inscription et à les maintenir à jour.
        </LegalParagraph>
        <LegalParagraph>
          L’utilisateur est seul responsable de la confidentialité de ses
          identifiants de connexion et de toute utilisation faite de son
          compte. Toute utilisation suspecte doit être signalée sans délai
          à l’éditeur.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Connexion à des services tiers">
        <LegalParagraph>
          L’utilisateur peut connecter Trail cockpit à des services tiers
          (par exemple Strava) afin de synchroniser ses activités sportives.
          Cette connexion s’effectue via les protocoles d’autorisation
          proposés par ces services (OAuth) et reste révocable à tout
          moment.
        </LegalParagraph>
        <LegalParagraph>
          L’utilisateur reconnaît que l’usage de ces services tiers est régi
          par leurs propres conditions générales et politiques de
          confidentialité, et qu’il en accepte les termes lors de la
          connexion.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Exactitude des données">
        <LegalParagraph>
          Les analyses produites par Trail cockpit reposent sur la qualité et
          l’exactitude des données fournies par l’utilisateur ou par les
          services tiers connectés. Des données incomplètes, erronées ou
          mal calibrées (par exemple une fréquence cardiaque maximale
          incorrecte) peuvent entraîner des résultats inexacts.
        </LegalParagraph>
        <LegalParagraph>
          L’utilisateur est invité à vérifier régulièrement les paramètres
          de son profil et à signaler toute anomalie.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Assistant IA et recommandations">
        <LegalParagraph>
          Lorsque l’application propose des recommandations générées par un
          assistant intelligent, celles-ci sont produites automatiquement à
          partir des données disponibles. Elles ne constituent ni un avis
          médical, ni un plan d’entraînement personnalisé établi par un
          professionnel diplômé.
        </LegalParagraph>
        <LegalParagraph>
          L’utilisateur conserve toujours la décision finale sur
          l’application ou non de ces recommandations.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Absence de service médical">
        <LegalParagraph>
          Trail cockpit n’est pas un dispositif médical. L’application ne
          permet pas d’établir un diagnostic, de prescrire un traitement,
          d’évaluer une aptitude médicale à la pratique sportive ni de se
          substituer à un suivi médical.
        </LegalParagraph>
        <LegalParagraph>
          En cas de douleur, blessure, fatigue anormale, malaise ou doute
          sur son aptitude à pratiquer une activité sportive, l’utilisateur
          doit consulter un professionnel de santé.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Responsabilité de l’utilisateur">
        <LegalList
          items={[
            'Adapter son entraînement à son état de forme, à son expérience et à son environnement.',
            'Respecter les règles de sécurité applicables à sa discipline sportive et à son lieu de pratique.',
            'Vérifier que sa condition physique et son équipement sont compatibles avec l’effort envisagé.',
            'Suspendre l’activité en cas de douleur, blessure ou symptôme inhabituel et consulter un professionnel de santé.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Disponibilité du service">
        <LegalParagraph>
          L’éditeur s’efforce d’assurer la disponibilité et la fiabilité de
          l’application, mais ne peut garantir une absence totale
          d’interruption, de bug ou de retard, notamment en cas d’opération
          de maintenance, d’incident technique, ou d’indisponibilité des
          services tiers connectés (Strava, hébergeur, etc.).
        </LegalParagraph>
        <LegalParagraph>
          L’éditeur se réserve le droit de faire évoluer, suspendre ou
          interrompre tout ou partie des fonctionnalités, notamment pour
          des raisons techniques, réglementaires ou de sécurité.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <LegalParagraph>
          L’ensemble des éléments composant l’application Trail cockpit
          (nom, logo, interface, textes, graphismes, code source,
          algorithmes d’analyse) est protégé. Toute reproduction,
          représentation ou exploitation non autorisée est interdite.
        </LegalParagraph>
        <LegalParagraph>
          L’utilisateur conserve la propriété de ses propres données
          sportives. Il accorde à l’éditeur, dans le strict cadre du
          fonctionnement du service, le droit de les traiter aux fins
          décrites dans la politique de confidentialité.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <LegalParagraph>
          Le traitement des données personnelles de l’utilisateur est décrit
          en détail dans la politique de confidentialité de l’application,
          accessible depuis la section « Réglementaire » des réglages.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Suppression du compte">
        <LegalParagraph>
          L’utilisateur peut demander à tout moment la suppression de son
          compte et de l’ensemble de ses données personnelles associées en
          envoyant un e-mail à{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20cockpit%20%E2%80%94%20Suppression%20du%20compte`}
            className="text-trail-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Modification des conditions">
        <LegalParagraph>
          L’éditeur peut faire évoluer les présentes conditions
          d’utilisation, notamment pour tenir compte d’évolutions
          réglementaires, techniques ou fonctionnelles. La date de
          dernière mise à jour figure en haut du présent document.
        </LegalParagraph>
        <LegalParagraph>
          En cas de modification substantielle, l’utilisateur sera informé
          par un moyen raisonnable (notification dans l’application ou
          e-mail). La poursuite de l’utilisation du service après une
          mise à jour vaut acceptation des nouvelles conditions.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <LegalParagraph>
          Les présentes conditions d’utilisation sont soumises au droit
          français. En cas de litige, et à défaut de résolution amiable,
          les tribunaux français seront compétents, sous réserve des
          dispositions impératives applicables au consommateur.
        </LegalParagraph>
      </LegalSection>
    </LegalPageShell>
  )
}
