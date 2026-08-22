import { redirect } from "next/navigation";

import { CommerceButton } from "@/components/commerce/commerce-button";
import {
  CommerceField,
  CommerceNotice,
  CommercePanel,
} from "@/components/commerce/commerce-form";
import { readSignedInOperator } from "@/commerce/session";

import { signInAction, verifySecondFactorAction } from "@/commerce/actions";

export const instant = false;

interface ConnexionRouteProps {
  searchParams: Promise<{ message?: string }>;
}

/**
 * Where a member of WeCreate's staff signs in, in two steps that are always
 * both required.
 *
 * A password identifies the person; a code from their own authenticator proves
 * they are there. Commerce data — which files WeCreate sells, who uploaded
 * them, what was activated when — is behind both, for viewing as much as for
 * changing (issue #1), so a stolen password on its own opens nothing.
 *
 * Which step to show is read from the session rather than remembered between
 * requests: signed in but not yet verified *is* the state after step one, so
 * reloading, going back or arriving from a bookmark all land in the right
 * place.
 */
export default async function CommerceSignInPage({
  searchParams,
}: ConnexionRouteProps) {
  const { message } = await searchParams;

  const operator = await readSignedInOperator();
  if (operator?.assurance === "aal2") {
    // Whether this account administers commerce is not decided here — the back
    // office says so itself, so a Content Editor is told why rather than being
    // bounced between two pages.
    redirect("/commerce");
  }
  if (operator && operator.factors.length === 0) {
    redirect("/commerce/securite");
  }

  return (
    <>
      <h1 className="mt-0 mb-8 text-section font-light">Espace commerce</h1>
      <CommerceNotice message={message} />

      {operator ? (
        <CommercePanel
          title="Code de vérification"
          description={`Compte ${operator.email}. Ouvrez votre application d'authentification et saisissez le code à six chiffres qu'elle affiche.`}
        >
          <form
            action={verifySecondFactorAction}
            data-testid="second-factor-form"
            className="flex flex-col gap-4 sm:max-w-md"
          >
            {operator.factors.length > 1 ? (
              <label className="block">
                <span className="block text-micro uppercase tracking-24 text-wc-muted-2">
                  Application
                </span>
                <select
                  name="factorId"
                  defaultValue={operator.factors[0].id}
                  className="mt-2 w-full border border-wc-border bg-wc-surface px-3 py-2 text-body text-wc-white"
                >
                  {operator.factors.map((factor) => (
                    <option key={factor.id} value={factor.id}>
                      {factor.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input
                type="hidden"
                name="factorId"
                value={operator.factors[0]?.id ?? ""}
              />
            )}
            <CommerceField
              label="Code de vérification"
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <div>
              <CommerceButton pendingLabel="Vérification…">Vérifier</CommerceButton>
            </div>
          </form>
        </CommercePanel>
      ) : (
        <CommercePanel
          title="Connexion"
          description="Utilisez votre compte personnel. Aucun identifiant n'est partagé entre plusieurs personnes : chaque opération est enregistrée au nom de qui l'a faite."
        >
          <form
            action={signInAction}
            data-testid="sign-in-form"
            className="flex flex-col gap-4 sm:max-w-md"
          >
            <CommerceField
              label="Adresse e-mail"
              name="email"
              type="email"
              required
              autoComplete="username"
            />
            <CommerceField
              label="Mot de passe"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
            <div>
              <CommerceButton pendingLabel="Connexion…">Se connecter</CommerceButton>
            </div>
          </form>
        </CommercePanel>
      )}
    </>
  );
}
