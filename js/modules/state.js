let state = {
  config: null,
  categories: null,
  paymentMethods: null,
  currentView: null,
  currentMonth: null,
  isLoading: false
};

export function getState() {
  return state;
}

export function setState(partial) {
  state = { ...state, ...partial };
}

export function resetState() {
  state = {
    config: null,
    categories: null,
    paymentMethods: null,
    currentView: null,
    currentMonth: null,
    isLoading: false
  };
}
