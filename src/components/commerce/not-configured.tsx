import { CommercePanel } from "./commerce-form";

/**
 * What the back office says on a deployment with no commerce data plane.
 *
 * The same answer `/studio` gives without a Sanity project: setup instructions
 * rather than a broken screen. It matters that this is not a sign-in form that
 * always refuses — a form implies an account exists, and here none can.
 *
 * A deployment in this state is a working website: the Boutique reports that no
 * product has an activated file, so every one of them reads *bientôt
 * disponible*, and nothing can be bought. That is the correct state before
 * WeCreate's Supabase project exists.
 */
export function CommerceNotConfigured() {
  return (
    <CommercePanel
      title="Espace commerce non configuré"
      description="Ce déploiement n'a pas de base commerce. Les fichiers livrés, les comptes du personnel et le journal des opérations y sont conservés ; sans elle, aucun produit ne peut être mis en vente."
    >
      <p className="m-0 text-body-sm font-light text-wc-muted-2">
        Renseignez <code className="font-mono">SUPABASE_URL</code> et{" "}
        <code className="font-mono">SUPABASE_ANON_KEY</code>, puis appliquez les
        migrations de <code className="font-mono">supabase/migrations/</code>.
        La marche à suivre est dans le README, section «&nbsp;Setting up
        Supabase&nbsp;».
      </p>
    </CommercePanel>
  );
}
