import { confirmFactorAction, enrolFactorAction } from "@/commerce/actions";
import type { PendingEnrolment } from "@/commerce/session";
import type { CommerceOperator } from "@/commerce/types";

import { CommerceButton } from "./commerce-button";
import { CommerceField, CommercePanel } from "./commerce-form";

/**
 * A shared secret, in blocks of four.
 *
 * It is typed into another device by hand, one character at a time, and a
 * thirty-two character run of letters and digits is where that goes wrong.
 * Every authenticator accepts the spaces or ignores them, and so does the
 * `decodeBase32()` this project verifies against.
 */
function groupKey(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * A staff member's authenticators: the one they sign in with, and the backup
 * that keeps a lost phone from locking WeCreate out of its own commerce data.
 *
 * Enrolling a second factor is ordinary work here rather than a recovery
 * procedure, because the alternative WeCreate would otherwise reach for is a
 * shared account — and a shared account makes the audit trail meaningless. Each
 * factor is enrolled separately, with its own secret, so losing one costs
 * nothing but the time to remove it.
 */
export function FactorsPanel({
  operator,
  pending,
  mayEnrol,
}: {
  operator: CommerceOperator;
  pending: PendingEnrolment | undefined;
  mayEnrol: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CommercePanel
        title="Vos applications d'authentification"
        description={`Compte : ${operator.email}. Chaque membre de l'équipe a le sien ; aucun identifiant n'est partagé.`}
      >
        {operator.factors.length === 0 ? (
          <p className="m-0 text-body-sm font-light text-wc-muted-2">
            Aucune application enregistrée. Ajoutez-en une pour ouvrir
            l&apos;espace commerce.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {operator.factors.map((factor) => (
              <li
                key={factor.id}
                data-testid="second-factor"
                className="border border-wc-line-dark px-4 py-3 text-body font-light"
              >
                {factor.label}
              </li>
            ))}
          </ul>
        )}
      </CommercePanel>

      {pending ? (
        <CommercePanel
          title="Terminer l'enregistrement"
          description="Ajoutez cette clé dans votre application d'authentification, puis saisissez le code qu'elle affiche. La clé n'est montrée qu'une fois."
        >
          <form
            action={confirmFactorAction}
            data-testid="confirm-factor"
            className="flex flex-col gap-4 sm:max-w-md"
          >
            <p className="m-0">
              <span className="block text-micro uppercase tracking-24 text-wc-muted-2">
                Clé — {pending.label}
              </span>
              <code
                data-testid="factor-secret"
                className="mt-2 block border border-wc-border bg-wc-surface px-3 py-2 font-mono text-body tracking-[0.12em] break-all"
              >
                {groupKey(pending.secret)}
              </code>
            </p>
            {/* A key nobody can mistranscribe matters more here than anywhere
                else on the site: get one character wrong and the authenticator
                produces plausible six-digit codes that will never be accepted,
                which reads as "the site is broken" rather than "the key is
                wrong". Grouping is half the answer; saying out loud that this
                alphabet has no 0 and no 1 is the other half. */}
            <p className="m-0 text-body-sm font-light text-wc-muted-2">
              Recopiez-la par groupes de quatre, sans les espaces. Cet alphabet
              ne contient ni le chiffre 0 ni le chiffre 1 : ce sont toujours les
              lettres O et I.
            </p>
            <p className="m-0 text-body-sm font-light">
              <a
                href={pending.uri}
                className="underline underline-offset-4 break-all"
              >
                Ouvrir directement dans une application d&apos;authentification
              </a>
            </p>
            <CommerceField
              label="Code de vérification"
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <div>
              <CommerceButton pendingLabel="Vérification…">Confirmer</CommerceButton>
            </div>
          </form>
        </CommercePanel>
      ) : null}

      {mayEnrol && !pending ? (
        <CommercePanel
          title="Ajouter une application"
          description="Une seconde application, sur un autre appareil, est votre secours si vous perdez le premier."
        >
          <form
            action={enrolFactorAction}
            data-testid="enrol-factor"
            className="flex flex-col gap-4 sm:max-w-md"
          >
            <CommerceField
              label="Nom de l'appareil"
              name="label"
              required
              hint="Par exemple « Téléphone » ou « Tablette de secours »."
            />
            <div>
              <CommerceButton pendingLabel="Enregistrement…">Ajouter</CommerceButton>
            </div>
          </form>
        </CommercePanel>
      ) : null}

      {!mayEnrol && !pending ? (
        <p className="m-0 text-body font-light text-wc-muted-2">
          Saisissez d&apos;abord le code de l&apos;application déjà enregistrée :
          un mot de passe seul ne suffit pas pour en ajouter une autre.
        </p>
      ) : null}
    </div>
  );
}
