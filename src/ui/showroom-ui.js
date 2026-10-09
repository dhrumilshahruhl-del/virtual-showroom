export function createShowroomUi(root, initialState) {
  const status = root.querySelector('.showroom__status');
  const buttons = {
    reset: root.querySelector('[data-action="reset"]'),
    copyView: root.querySelector('[data-action="copy-view"]'),
  };

  function sync() {
    return initialState;
  }

  sync();

  return {
    buttons,
    setStatus(message, mode = 'info') {
      if (!status) return;
      status.textContent = message;
      status.dataset.mode = mode;
      status.hidden = !message;
    },
    sync,
  };
}
