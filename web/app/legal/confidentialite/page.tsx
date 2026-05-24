import type { Metadata } from 'next'
import {
  LegalPageShell,
  LegalSection,
  LegalParagraph,
  LegalList,
} from '@/components/legal/LegalPageShell'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Trail Cockpit',
  description:
    'Politique de confidentialité de l’application Trail Cockpit : données collectées, finalités, durées et droits des utilisateurs.',
}

const UPDATED_AT = '11 mai 2026'
const CONTACT_EMAIL = 'contact@trailcockpit.run'

export default function ConfidentialitePage() {
  return (
    <LegalPageShell
      eyebrow="Réglementaire"
      title="Politique de confidentialité"
      description="Comment Trail cockpit collecte, utilise et protège vos données personnelles."
      updatedAt={UPDATED_AT}
    >
      <LegalSection title="Responsable du traitement">
        <LegalParagraph>
          Le responsable du traitement des données personnelles collectées via
          l’application Trail cockpit est Franck Meri, éditeur de l’application.
        </LegalParagraph>
        <LegalParagraph>
          Pour toute demande relative à vos données personnelles, vous pouvez
          écrire à :{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20cockpit%20%E2%80%94%20RGPD`}
            className="text-trail-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Données collectées">
        <LegalParagraph>
          Trail cockpit collecte uniquement les données nécessaires au
          fonctionnement de ses services. Les catégories de données ci-dessous
          peuvent être traitées selon les fonctionnalités utilisées.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Données de compte">
        <LegalList
          items={[
            'Adresse e-mail utilisée pour la création du compte.',
            'Identifiant interne unique de l’utilisateur.',
            'Préférences d’interface (thème, unités, fuseau horaire, etc.).',
          ]}
        />
      </LegalSection>

      <LegalSection title="Données sportives">
        <LegalParagraph>
          Trail cockpit peut traiter des données sportives telles que la
          distance, la durée, l’allure, la vitesse, le dénivelé, la fréquence
          cardiaque, la puissance, la cadence, la charge d’entraînement, la
          fatigue, la récupération, les records personnels et l’historique
          d’entraînement.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Données GPS ou de géolocalisation">
        <LegalList
          items={[
            'Traces GPS associées aux activités synchronisées (parcours, points kilométriques, dénivelé).',
            'Données dérivées : segments, vitesses, allures par section.',
          ]}
        />
        <LegalParagraph>
          Aucune géolocalisation en temps réel n’est effectuée par
          l’application. Les positions traitées proviennent uniquement des
          activités déjà enregistrées par les services tiers connectés.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Données issues de services tiers">
        <LegalParagraph>
          Lorsque l’utilisateur connecte un service tiers (par exemple Strava),
          Trail cockpit reçoit les données auxquelles l’utilisateur a accepté
          de donner accès lors de l’autorisation OAuth : profil athlète,
          activités, et statistiques associées.
        </LegalParagraph>
        <LegalParagraph>
          L’utilisateur peut révoquer cet accès à tout moment depuis les
          réglages de son compte Strava ou depuis les paramètres de Trail
          cockpit.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Données liées à l’assistant IA ou au coaching">
        <LegalParagraph>
          Lorsque l’utilisateur utilise des fonctionnalités d’assistant IA ou
          de coaching, les éléments fournis (questions, objectifs, ressentis,
          données d’entraînement transmises pour analyse) peuvent être
          traités afin de produire les recommandations demandées.
        </LegalParagraph>
        <LegalParagraph>
          Ces données peuvent être transmises à des fournisseurs de modèles
          d’intelligence artificielle exclusivement pour répondre à la
          demande de l’utilisateur. Elles ne sont pas utilisées à des fins
          publicitaires.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Finalités du traitement">
        <LegalList
          items={[
            'Permettre la création et la gestion du compte utilisateur.',
            'Synchroniser et afficher les activités sportives.',
            'Calculer des indicateurs de charge, de fatigue, de capacité et de fraîcheur.',
            'Fournir des analyses, statistiques et recommandations d’entraînement.',
            'Assurer la sécurité technique du service (lutte contre la fraude, prévention des abus).',
            'Répondre aux demandes de support et aux obligations légales.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Bases légales">
        <LegalList
          items={[
            'Exécution du contrat liant l’utilisateur à l’éditeur (fourniture du service).',
            'Consentement de l’utilisateur, notamment pour la connexion à des services tiers et le traitement de données sensibles.',
            'Intérêt légitime de l’éditeur pour la sécurité et l’amélioration du service.',
            'Respect des obligations légales applicables.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Données sensibles ou relatives à la santé">
        <LegalParagraph>
          Certaines données, comme la fréquence cardiaque, la fatigue, la
          récupération, les douleurs, les blessures ou les informations
          relatives à l’état de forme, peuvent révéler des informations
          relatives à l’état physique de l’utilisateur. Elles doivent donc
          être traitées avec une attention particulière.
        </LegalParagraph>
        <LegalParagraph>
          Ces données ne sont jamais cédées à des tiers à des fins
          commerciales et ne sont utilisées que dans le cadre des
          fonctionnalités explicitement activées par l’utilisateur.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Destinataires des données">
        <LegalList
          items={[
            'L’éditeur de l’application, dans la stricte mesure nécessaire au fonctionnement du service.',
            'Les sous-traitants techniques (hébergeur, base de données, fournisseur d’authentification, fournisseur d’IA le cas échéant), liés par des engagements de confidentialité et de sécurité.',
            'Les services tiers que l’utilisateur a expressément connectés à son compte (par exemple Strava).',
          ]}
        />
        <LegalParagraph>
          Aucune donnée n’est vendue à des tiers à des fins publicitaires.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Durées de conservation">
        <LegalList
          items={[
            'Données de compte : conservées tant que le compte est actif.',
            'Données sportives : conservées tant que le compte est actif, afin de permettre l’analyse historique de la pratique.',
            'Journaux techniques et de sécurité : conservés sur une durée limitée nécessaire à la sécurité du service.',
            'Après suppression du compte, les données personnelles sont supprimées ou anonymisées dans les meilleurs délais, sous réserve des obligations légales de conservation.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Sécurité">
        <LegalParagraph>
          L’éditeur met en œuvre des mesures techniques et organisationnelles
          raisonnables pour protéger les données contre la perte, l’accès non
          autorisé, l’altération ou la divulgation : chiffrement des
          connexions (HTTPS), authentification sécurisée, accès restreint aux
          données, sauvegardes régulières.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Droits des utilisateurs">
        <LegalParagraph>
          Conformément à la réglementation applicable en matière de données
          personnelles, l’utilisateur dispose des droits suivants :
        </LegalParagraph>
        <LegalList
          items={[
            'Droit d’accès à ses données.',
            'Droit de rectification des données inexactes.',
            'Droit à l’effacement (« droit à l’oubli »).',
            'Droit à la limitation du traitement.',
            'Droit à la portabilité des données.',
            'Droit d’opposition au traitement pour motif légitime.',
            'Droit de retirer son consentement à tout moment.',
            'Droit d’introduire une réclamation auprès d’une autorité de contrôle compétente (en France, la CNIL).',
          ]}
        />
        <LegalParagraph>
          L’utilisateur peut demander l’accès, la rectification ou la
          suppression de ses données en écrivant à :{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20cockpit%20%E2%80%94%20RGPD%20%E2%80%94%20Demande%20de%20droits`}
            className="text-trail-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
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
          . La suppression est effectuée dans les meilleurs délais.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Contact RGPD">
        <LegalParagraph>
          Pour toute question relative à la présente politique de
          confidentialité ou au traitement de vos données personnelles, vous
          pouvez écrire à :{' '}
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
