(() => {
  'use strict';

  const ADMIN_PIN = '1239';
  const SESSION_KEY = 'leighMatchdayAdminUnlocked';

  const pinView = document.querySelector('#pin-view');
  const dashboardView = document.querySelector('#dashboard-view');
  const pinForm = document.querySelector('#pin-form');
  const pinInput = document.querySelector('#pin-input');
  const pinMessage = document.querySelector('#pin-message');
  const unlockButton = document.querySelector('#unlock-button');
  const lockButton = document.querySelector('#lock-button');

  function showDashboard() {
    sessionStorage.setItem(SESSION_KEY, 'true');
    pinView.hidden = true;
    dashboardView.hidden = false;
    document.title = 'Photo Moderation | Leigh Leopards Matchday';
  }

  function showPin() {
    sessionStorage.removeItem(SESSION_KEY);
    dashboardView.hidden = true;
    pinView.hidden = false;
    pinForm.reset();
    pinMessage.textContent = '';
    unlockButton.disabled = false;
    window.setTimeout(() => pinInput.focus(), 50);
  }

  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
    pinMessage.textContent = '';
    pinInput.removeAttribute('aria-invalid');
  });

  pinForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (pinInput.value.length !== 4) {
      pinMessage.textContent = 'Enter all four digits.';
      pinInput.setAttribute('aria-invalid', 'true');
      pinInput.focus();
      return;
    }

    unlockButton.disabled = true;

    if (pinInput.value === ADMIN_PIN) {
      showDashboard();
      return;
    }

    pinMessage.textContent = 'Incorrect code. Please try again.';
    pinInput.setAttribute('aria-invalid', 'true');
    pinInput.select();
    unlockButton.disabled = false;
  });

  lockButton.addEventListener('click', showPin);

  if (sessionStorage.getItem(SESSION_KEY) === 'true') {
    showDashboard();
  } else {
    showPin();
  }
})();
