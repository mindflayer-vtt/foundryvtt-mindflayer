export type RGBColor = Readonly<{ r: number; g: number; b: number }>;
export type LEDColors = Readonly<{ led1: RGBColor; led2: RGBColor }>;
export type LEDStateReport = Readonly<{ appliedLeds: LEDColors | null }>;

export function createReceiverRegistration(players: ReadonlyArray<{ id: string; name: string }>) {
  return {
    type: "registration",
    status: "connected",
    receiver: true,
    players: players.map((player) => ({ id: player.id, name: player.name })),
  };
}

export function createControllerConfiguration(
  controllerId: string,
  led1: RGBColor,
  led2: RGBColor,
) {
  return {
    type: "configuration",
    "controller-id": controllerId,
    led1,
    led2,
  };
}

export function createAmbilightMessage(
  target: string,
  universe: number,
  colors: ArrayLike<number>,
) {
  return {
    type: "ambilight",
    target,
    universe,
    colors: Array.from(colors),
  };
}
