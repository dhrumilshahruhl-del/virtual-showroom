import { launchShowroom } from './showroom.js';

export const showroom = launchShowroom();

const legalTrigger = document.querySelector('.showroom__legal-link');
const legalDialog = document.getElementById('legal-credits');
const legalClose = legalDialog.querySelector('.equipment-modal__close');
legalTrigger.addEventListener('click', () => {
  if (!legalDialog.open) {
    legalDialog.showModal();
    legalDialog.scrollTop = 0;
    legalClose.focus({ preventScroll: true });
  }
});
legalClose.addEventListener('click', () => legalDialog.close());
legalDialog.addEventListener('close', () => legalTrigger.focus({ preventScroll: true }));
