import AbstractSubModule from "../AbstractSubModule";
import { VTT_MODULE_NAME } from "../../settings/constants";

export const BEAMER_USER_SETTING = "beamerUserId";

/** World user ownership only; camera and transport keep their existing owners. */
export default class BeamerUsers extends AbstractSubModule {
  #busy = false;
  static shouldStart() { return true; }

  constructor(instance) {
    super(instance);
  }

  get selectedId() { return game.settings.get(VTT_MODULE_NAME, BEAMER_USER_SETTING); }

  review(user) {
    if (!user) return ["Selected user is missing"];
    const issues = [];
    const roles = CONST.USER_ROLES;
    const trusted = user.role === roles.TRUSTED;
    if (![roles.PLAYER, roles.TRUSTED].includes(user.role) || user.isGM) {
      issues.push("A dedicated Player or Trusted Player role is required");
    }
    if (user.character) issues.push("Remove the assigned character before adoption");
    if (!trusted && Object.keys(CONST.USER_PERMISSIONS).some(key => user.can(key))) {
      issues.push("Disable individual user capabilities before adoption");
    }
    for (const collection of game.collections.values()) {
      if (collection.contents.some(document => {
        const ownership = document.ownership;
        return ownership && (ownership[user.id] ?? ownership.default ?? 0) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
      })) { issues.push("Document ownership requires manual review"); break; }
    }
    return issues;
  }

  status() {
    const user = game.users.get(this.selectedId);
    const issues = this.review(user);
    return { worldId: game.world.id, state: !this.selectedId ? "pairing-required" : issues.length ? "review-required" : "configured",
      user: user ? { id: user.id, name: user.name, role: user.role } : null, issues: this.selectedId ? issues : [] };
  }

  async #change(operation) {
    if (!game.user?.isGM || !this.loaded) throw new Error("A running GM session is required");
    if (this.#busy) throw new Error("Beamer user configuration is already in progress");
    if (this.selectedId) throw new Error("A Beamer user is already selected for this world");
    this.#busy = true;
    try { return await operation(); } finally { this.#busy = false; }
  }

  async create({ name = "Beamer", password }: { name?: string; password?: string } = {}) {
    return this.#change(async () => {
      if (typeof name !== "string" || !name.trim() || name.length > 64) throw new Error("Enter a Beamer user name");
      if (typeof password !== "string" || password.length < 12 || password.length > 256) throw new Error("Use a password between 12 and 256 characters");
      name = name.trim();
      if (game.users.contents.some(user => user.name.toLowerCase() === name.toLowerCase())) throw new Error("That user name exists; review explicit adoption instead");
      const permissions = Object.fromEntries(Object.keys(CONST.USER_PERMISSIONS).map(key => [key, false]));
      const user = await foundry.documents.User.create({ name, password, role: CONST.USER_ROLES.PLAYER,
        permissions, flags: { [VTT_MODULE_NAME]: { beamerManaged: true } } });
      if (this.review(user).length) throw new Error("Created user needs permission review before pairing; no existing users were changed");
      await game.settings.set(VTT_MODULE_NAME, BEAMER_USER_SETTING, user.id);
      return this.status();
    });
  }

  async adopt({ userId, confirm = false }: { userId?: string; confirm?: boolean } = {}) {
    return this.#change(async () => {
      if (confirm !== true) throw new Error("Explicit adoption confirmation is required");
      const user = game.users.get(userId);
      const issues = this.review(user);
      if (issues.length) throw new Error(issues.join("; "));
      // Adoption changes only the world's selected ID, never the existing user.
      await game.settings.set(VTT_MODULE_NAME, BEAMER_USER_SETTING, user.id);
      return this.status();
    });
  }
}
