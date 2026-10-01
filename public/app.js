const form = document.querySelector('#login-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const emailError = document.querySelector('#email-error');
const passwordError = document.querySelector('#password-error');
const status = document.querySelector('#status');
const submitButton = document.querySelector('#submit-button');

function validate(email, password) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required.';
  else if (!email.includes('@')) errors.email = 'Email must contain “@”.';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  return errors;
}

function renderErrors(errors) {
  emailError.textContent = errors.email || '';
  passwordError.textContent = errors.password || '';
  emailInput.setAttribute('aria-invalid', String(Boolean(errors.email)));
  passwordInput.setAttribute('aria-invalid', String(Boolean(errors.password)));
  emailInput.classList.toggle('border-red-500', Boolean(errors.email));
  passwordInput.classList.toggle('border-red-500', Boolean(errors.password));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = '';
  status.className = 'mt-4 min-h-6 text-center text-sm font-medium';

  const email = emailInput.value;
  const password = passwordInput.value;
  const errors = validate(email, password);
  renderErrors(errors);
  if (Object.keys(errors).length) return;

  submitButton.disabled = true;
  submitButton.textContent = 'Checking…';
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    status.textContent = result.message;
    status.classList.add(result.ok ? 'text-green-700' : 'text-red-600');
  } catch {
    status.textContent = 'Unable to reach the server.';
    status.classList.add('text-red-600');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Sign in';
  }
});
