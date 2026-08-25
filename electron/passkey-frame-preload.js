/**
 * Guest frame preload — disable WebAuthn / passkeys (Windows Security popup).
 * Also re-injected from main via webFrameMain on every frame navigate.
 */
(() => {
  const SCRIPT = `(() => {
    try {
      Object.defineProperty(navigator, 'credentials', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    } catch (_) {}
    try {
      const reject = async () => {
        throw new DOMException(
          'The user agent does not support public key credentials.',
          'NotSupportedError'
        );
      };
      if (typeof CredentialsContainer !== 'undefined' && CredentialsContainer.prototype) {
        for (const method of Object.getOwnPropertyNames(CredentialsContainer.prototype)) {
          if (method === 'constructor') continue;
          try {
            Object.defineProperty(CredentialsContainer.prototype, method, {
              value: reject,
              configurable: true,
              writable: true,
            });
          } catch (_) {}
        }
      }
    } catch (_) {}
    try {
      if (typeof PublicKeyCredential !== 'undefined') {
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => false;
        if (PublicKeyCredential.isConditionalMediationAvailable) {
          PublicKeyCredential.isConditionalMediationAvailable = async () => false;
        }
      }
    } catch (_) {}
  })();`;

  try {
    const { webFrame } = require('electron');
    webFrame.executeJavaScript(SCRIPT).catch(() => {});
  } catch (_) {}

  try {
    // eslint-disable-next-line no-new-func
    new Function(SCRIPT)();
  } catch (_) {}
})();
