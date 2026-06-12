(function (global) {
  'use strict';

  var VELO_APP_URL = 'https://app.velo.finance';

  var Velo = {
    mount: function (containerId, options) {
      if (!options || !options.invoiceId) {
        throw new Error('Velo.mount: options.invoiceId is required');
      }

      var container = document.getElementById(containerId);
      if (!container) {
        throw new Error('Velo.mount: container #' + containerId + ' not found');
      }

      var appUrl = options.appUrl || VELO_APP_URL;
      var src = appUrl + '/pay/' + encodeURIComponent(options.invoiceId) + '?embed=1';

      var iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.style.cssText = [
        'border:none',
        'width:' + (options.width || '100%'),
        'height:' + (options.height || '560px'),
        'border-radius:' + (options.borderRadius || '16px'),
        'display:block',
      ].join(';');
      iframe.allow = 'payment';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
      iframe.title = 'Velo Payment';

      container.innerHTML = '';
      container.appendChild(iframe);

      function handleMessage(event) {
        // Validate exact origin — never use '*'
        if (event.origin !== appUrl) return;

        var data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'velo:paid' && typeof options.onPaid === 'function') {
          options.onPaid({ invoiceId: options.invoiceId, txHash: data.txHash });
        }
        if (data.type === 'velo:expired' && typeof options.onExpired === 'function') {
          options.onExpired({ invoiceId: options.invoiceId });
        }
        if (data.type === 'velo:error' && typeof options.onError === 'function') {
          options.onError({ message: data.message });
        }
      }

      global.addEventListener('message', handleMessage);

      return {
        destroy: function () {
          global.removeEventListener('message', handleMessage);
          if (container.contains(iframe)) container.removeChild(iframe);
        },
      };
    },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Velo;
  } else {
    global.Velo = Velo;
  }
})(typeof window !== 'undefined' ? window : this);
