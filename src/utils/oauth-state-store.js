const stateStore = new Map();

exports.saveState = (state) => {
  stateStore.set(state, Date.now());
  setTimeout(() => stateStore.delete(state), 10 * 60 * 1000);
};

exports.validateAndDeleteState = (state) => {
  if (!stateStore.has(state)) return false;
  stateStore.delete(state);
  return true;
};
