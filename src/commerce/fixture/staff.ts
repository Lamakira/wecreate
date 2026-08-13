/**
 * The staff the fixture data plane knows.
 *
 * These credentials are published in source, and that is only safe because of
 * where the fixture can be reached from: `resolveCommerceProviderId()` selects
 * it *only* when `WECREATE_COMMERCE_PROVIDER=fixture` is set explicitly, so an
 * unconfigured deployment falls back to no data plane at all rather than to
 * this. Nothing here is a real address or a real password, and no production
 * environment ever loads this module.
 *
 * Three accounts, because three different things have to be provable. One
 * administers commerce and has an authenticator. One reaches the same assurance
 * and still may not see commerce data, because Content Editor and Commerce
 * Operator are separate permissions (issue #1). And one has no second factor
 * yet, which is the state every new staff member starts in.
 */

export interface FixtureStaffFactor {
  id: string;
  label: string;
  /** Base32, the way an authenticator app is given one. */
  secret: string;
}

import { COMMERCE_OPERATOR_ROLE } from "../operators";

export interface FixtureStaffAccount {
  id: string;
  email: string;
  password: string;
  /** WeCreate's own roles. `commerce_operator` is the one this back office asks for. */
  roles: string[];
  factors: FixtureStaffFactor[];
}

export const FIXTURE_STAFF: FixtureStaffAccount[] = [
  {
    id: "staff-commerce",
    email: "commerce@wecreate.test",
    password: "operatrice-commerce-2026",
    roles: [COMMERCE_OPERATOR_ROLE],
    factors: [
      {
        id: "factor-commerce-phone",
        label: "Téléphone",
        secret: "JBSWY3DPEHPK3PXP",
      },
    ],
  },
  {
    id: "staff-editorial",
    email: "editorial@wecreate.test",
    password: "editrice-contenu-2026",
    roles: ["content_editor"],
    factors: [
      {
        id: "factor-editorial-phone",
        label: "Téléphone",
        secret: "KRSXG5CTMVRXEZLUKQ",
      },
    ],
  },
  {
    id: "staff-new-operator",
    email: "recrue@wecreate.test",
    password: "nouvelle-recrue-2026",
    roles: [COMMERCE_OPERATOR_ROLE],
    factors: [],
  },
];
