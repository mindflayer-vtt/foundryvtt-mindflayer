export function isCombatActive(): boolean {
  return game.combat?.started ?? false;
}
