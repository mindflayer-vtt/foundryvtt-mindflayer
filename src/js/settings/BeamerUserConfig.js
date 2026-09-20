import { VTT_MODULE_NAME } from "./constants";

/** GM-only presentation; world user policy belongs to the BeamerUsers submodule. */
export class BeamerUserConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "Mindflayer Beamer user", id: "mindflayer-beamer-user-config",
      template: "modules/mindflayer-token-controller/templates/beamer-user-config.html",
      width: 520, height: "auto", closeOnSubmit: false,
    });
  }

  get service() { return game.modules.get(VTT_MODULE_NAME)?.instance?.modules.BeamerUsers; }

  getData() {
    if (!game.user?.isGM || !this.service?.loaded) return { unavailable: true };
    const status = this.service.status();
    return { status, selected: Boolean(this.service.selectedId),
      candidates: game.users.contents.map(user => {
        const issues = this.service.review(user);
        return { id: user.id, name: user.name, eligible: !issues.length, review: issues.join("; ") };
      }) };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const form = html[0];
    for (const field of form.querySelectorAll('[data-pairing-id]')) {
      field.addEventListener("click", () => field.select());
      field.addEventListener("focus", () => field.select());
    }
    const mode = form.querySelector('[name="mode"]');
    if (!mode) return;
    const updateMode = () => {
      for (const group of form.querySelectorAll('[data-mode]')) {
        group.hidden = group.dataset.mode !== mode.value;
        group.disabled = group.hidden;
      }
      form.querySelector('[data-error]').textContent = "";
    };
    mode.addEventListener("change", () => {
      updateMode();
      form.querySelector('fieldset:not([hidden]) input, fieldset:not([hidden]) select')?.focus();
      this.setPosition({ height: "auto" });
    });
    const secret = form.querySelector('[name="password"]');
    const reveal = form.querySelector('[data-reveal]');
    reveal.addEventListener("click", () => {
      const visible = secret.type === "password";
      secret.type = visible ? "text" : "password";
      reveal.textContent = visible ? "Hide password" : "Show password";
      reveal.setAttribute("aria-pressed", String(visible));
    });
    updateMode();
    form.querySelector('[name="name"]')?.focus();
  }

  async _updateObject(_event, data) {
    if (!game.user?.isGM || !this.service?.loaded) return;
    const form = this.form;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      if (data.mode === "create") await this.service.create({ name: data.name, password: data.password });
      else if (data.mode === "adopt") await this.service.adopt({ userId: data.userId, confirm: data.confirm === true });
      else throw new Error("Invalid mode");
      form.querySelector('[name="password"]').value = "";
      await this.render();
    } catch {
      // Foundry exceptions can contain submitted document data. Never display/log them.
      form.querySelector('[data-error]').textContent = "Could not configure Beamer. Check the user name, password length, adoption confirmation and permissions. If a user was created, review it for explicit adoption; no existing password was reset.";
      form.querySelector('[data-error]').focus();
    } finally { submit.disabled = false; }
  }
}
