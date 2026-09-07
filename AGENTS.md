# Mindflayer Foundry Module — Architectural Intent and Clarifications

This repository contains the Foundry VTT side of the Mindflayer tabletop system.

Some parts of the architecture can look unusual if approached as a conventional Foundry module. The following points capture design intent and historical context that should be preserved unless there is a concrete reason to change it.

## The internal submodule system is intentional

`src/js/modules/` is effectively a small plugin/submodule framework inside the Foundry module.

This was deliberately introduced after an earlier implementation had shared functionality duplicated and spread throughout the codebase.

Submodules declare their dependencies using `moduleDependencies`.

The loader is responsible for:

- discovering submodules;
- determining which modules actually need to run;
- loading dependencies before dependants;
- calling lifecycle methods in the correct order;
- unloading modules safely;
- selectively reloading a module and its dependants.

Do not flatten this architecture merely because it resembles a "framework inside a plugin".

Its purpose is to keep shared infrastructure such as controller communication separate from feature-specific behavior.

## Selective reload is a runtime feature, not developer hot reload

The reload functionality was added because some table configuration changes otherwise required reloading the complete Foundry browser page.

This matters particularly for the Beamer/table client.

When relevant Foundry settings change, affected submodules should be able to:

1. clean up their listeners/resources;
2. unload;
3. reload with the new configuration;
4. reload dependant modules as required;
5. become ready again.

This is user-facing runtime reconfiguration.

Do not remove selective reload in favor of requiring a browser refresh unless there is a strong technical reason.

## `mindflayer-server` is a message broker

The external `mindflayer-server` is not primarily a device-management service.

Conceptually it behaves like a WebSocket message bus/chat room.

Participants include:

- physical Mindflayer keypads/controllers;
- the Foundry Mindflayer module;
- potentially other Mindflayer clients.

Keypads send events to the server.

The Foundry module receives those events and can send commands back, for example LED configuration.

The server should remain relatively unaware of Foundry-specific application logic.

## Socket and controller responsibilities are deliberately separated

The Socket submodule owns the low-level WebSocket connection and dispatches messages by protocol type.

`ControllerManager` sits above that and owns the physical keypad/controller abstraction.

For example, raw messages such as:

- `registration`
- `key-event`

are received through Socket and consumed by `ControllerManager`.

Feature modules should normally depend on `ControllerManager` or another higher-level module rather than duplicating raw WebSocket/protocol handling.

Preserve this separation.

## Shared functionality should remain shared

A previous architectural problem was duplication of functionality such as controller communication.

If several feature modules need the same capability, prefer one submodule or utility that owns that capability.

However, do not introduce abstractions merely because several modules happen to call Foundry.

Domain ownership is valid.

For example:

- camera APIs belong in camera control;
- door APIs belong in door handling;
- lighting APIs belong in torch/light handling.

Only extract something into a shared service/helper when it is genuinely cross-cutting or duplicated.

Utilities such as token lookup already exist for this reason.

## libWrapper/private Foundry API usage is intentional where necessary

Mindflayer historically needed behavior that Foundry did not expose through public hooks.

As a result, the module uses `libWrapper` to intercept some Foundry internals.

Private-looking API usage should not automatically be "cleaned up".

During a Foundry migration, inspect each wrapper and determine whether:

1. the target still exists;
2. a newer target is required;
3. Foundry now provides a public hook/API that can replace the wrapper.

If a public API now exists, prefer it.

Otherwise, preserving a contained `libWrapper` integration is acceptable.

The wrappers are important migration boundaries and are covered by the regression/smoke-test infrastructure.

## Core table functionality

The following functionality is considered core and should receive priority during migration and regression work.

### Physical keypad/controller interaction

Players interact with the table using physical keypads.

Controller registration, key state, repeated/held keys, LED state, and the mapping from controllers to table/player state are fundamental functionality.

### Automatic Beamer camera

The Beamer/display instance should automatically frame relevant player tokens.

The current behavior intentionally:

- considers relevant player/keypad/combat/controlled tokens;
- computes a bounding area;
- chooses an appropriate zoom;
- keeps the view inside the scene;
- pans/zooms smoothly rather than jumping instantly.

Do not redesign the camera behavior merely because a different tracking algorithm appears more elegant.

In particular, the camera is not intended to aggressively chase a player moving rapidly ahead.

The current relatively slow/smooth response is acceptable behavior.

### Door interaction

Opening/closing nearby doors through the keypad is core functionality.

### Token torch/light control

Players must be able to toggle the torch/light associated with their token using the keypad.

### DM-controlled table configuration

The preferred configuration model is for the DM to configure controller/player/token relationships centrally.

## Lower-priority or uncertain historical features

The following features exist but are not currently considered blockers for restoring the table:

- Ambilight;
- table LED ring;
- timers;
- some combat helpers;
- player login/self-assignment.

Ambilight/table LED functionality was not exercised in the most recent known-good table setup, so its current real-hardware state is less certain.

Timers have been useful historically but are no longer considered important enough to block the migration.

Do not delete these features casually, but prioritize the core functionality above.

## Player self-login is not currently required

The historical `playerLogin` feature allowed players to use a small web UI to associate the keypad at their seat with the character they were playing.

For the current appliance/table design this can be replaced by DM-side configuration.

Do not spend migration effort restoring player self-login unless it becomes useful again.

## Future movement-measurement idea

A possible future feature is allowing a player to hold a keypad combination and simulate token movement for measurement without actually moving the token.

This is not part of the current migration scope.

Current keypad architecture should preferably not prevent implementing it later, but no implementation is required now.

## Foundry migration philosophy

Preserve behavior first.

The module has several deep Foundry integration points because its functionality is unusual.

During upgrades:

1. rely on regression tests to characterize existing behavior;
2. migrate one Foundry API boundary at a time;
3. prefer public Foundry APIs where they now exist;
4. preserve existing domain/submodule boundaries;
5. avoid unrelated architectural/tooling rewrites;
6. run the real-Foundry smoke suite;
7. finally verify the result on the physical table.

The migration is not complete merely because the module builds and loads.

Final validation requires real hardware testing of the core table functionality.