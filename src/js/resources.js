const resourceCatalog = Object.freeze({
  coins: { max: Number.MAX_VALUE },
  shards: { max: 1e15 },
  scrap: { max: Number.MAX_SAFE_INTEGER, integer: true },
  glowleaf: { max: Number.MAX_SAFE_INTEGER, integer: true },
  rootFiber: { max: Number.MAX_SAFE_INTEGER, integer: true },
  prismEssence: { max: Number.MAX_SAFE_INTEGER, integer: true },
  copperOre: { max: Number.MAX_SAFE_INTEGER, integer: true },
  silverOre: { max: Number.MAX_SAFE_INTEGER, integer: true },
  starCrystals: { max: Number.MAX_SAFE_INTEGER, integer: true },
  stars: { max: Number.MAX_VALUE, account: "asc", integer: true },
});

function resourceBalance(state, id) {
  const { account } = resourceCatalog[id];
  return (account ? state[account] : state)[id];
}

function initializeResources(state, source) {
  for (const [id, { account, max, integer }] of Object.entries(
    resourceCatalog,
  )) {
    const ledger = account ? state[account] : state;
    const value = account ? source?.[account]?.[id] : source?.[id];
    const amount = Number.isFinite(value)
      ? Math.min(max, Math.max(0, value))
      : 0;
    ledger[id] = integer ? Math.floor(amount) : amount;
  }
  return state;
}

function creditResource(state, id, amount) {
  if (!(amount > 0)) return;
  const { max, account } = resourceCatalog[id];
  const ledger = account ? state[account] : state;
  ledger[id] = Math.min(max, ledger[id] + amount);
}

function spendResource(state, id, amount) {
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    resourceBalance(state, id) < amount
  )
    return false;
  const { account } = resourceCatalog[id];
  (account ? state[account] : state)[id] -= amount;
  return true;
}

function creditCoins(state, amount) {
  if (!(amount > 0)) return;
  creditResource(state, "coins", amount);
  state.total = Math.min(Number.MAX_VALUE, state.total + amount);
  state.asc.life = Math.min(Number.MAX_VALUE, state.asc.life + amount);
}

export { creditCoins, creditResource, initializeResources, spendResource };
