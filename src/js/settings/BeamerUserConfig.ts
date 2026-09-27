import { VTT_MODULE_NAME } from "./constants";
import type BeamerUsers from "../modules/beamerUsers";

type ReviewableUser = NonNullable<Parameters<BeamerUsers["review"]>[0]>;

interface BeamerUserFormData {
  mode: string;
  name?: string;
  password?: string;
  userId?: string;
  confirm?: boolean;
}

/** GM-only presentation; world user policy belongs to the BeamerUsers submodule. */
export class BeamerUserConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "Mindflayer Beamer user", id: "mindflayer-beamer-user-config",
      template: "modules/mindflayer-token-controller/templates/beamer-user-config.html",
      width: 520, height: "auto", closeOnSubmit: false,
    });
  }

  get service(): BeamerUsers | undefined { return game.modules.get(VTT_MODULE_NAME)?.instance?.modules.BeamerUsers; }

  getData() {
    const service = this.service;
    if (!game.user?.isGM || !service?.loaded) return { unavailable: true };
    const status = service.status();
    return { status, selected: Boolean(service.selectedId),
      candidates: game.users.contents.map((user: ReviewableUser) => {
        const issues = service.review(user);
        return { id: user.id, name: user.name, eligible: !issues.length, review: issues.join("; ") };
      }) };
  }

  activateListeners(html: any) {
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

  async _updateObject(_event: Event, data: BeamerUserFormData): Promise<void> {
    const service = this.service;
    if (!game.user?.isGM || !service?.loaded) return;
    const form = this.form;
    const submit = form.querySelector('[type="submit"]') as HTMLButtonElement;
    submit.disabled = true;
    try {
      if (data.mode === "create") await service.create({ name: data.name, password: data.password });
      else if (data.mode === "adopt") await service.adopt({ userId: data.userId, confirm: data.confirm === true });
      else throw new Error("Invalid mode");
      (form.querySelector('[name="password"]') as HTMLInputElement).value = "";
      await this.render();
    } catch {
      // Foundry exceptions can contain submitted document data. Never display/log them.
      const error = form.querySelector('[data-error]') as HTMLElement | null;
      if (error) {
        error.textContent = "Could not configure Beamer. Check the user name, password length, adoption confirmation and permissions. If a user was created, review it for explicit adoption; no existing password was reset.";
        error.focus();
      }
    } finally { submit.disabled = false; }
  }
}
