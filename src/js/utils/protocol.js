export function createReceiverRegistration(players) {
  return {
    type: "registration",
    status: "connected",
    receiver: true,
    players: players.map((player) => ({ id: player.id, name: player.name })),
  };
}

export function createControllerConfiguration(controllerId, led1, led2) {
  return {
    type: "configuration",
    "controller-id": controllerId,
    led1,
    led2,
  };
}

export function createAmbilightMessage(target, universe, colors) {
  return {
    type: "ambilight",
    target,
    universe,
    colors: Array.from(colors),
  };
}
