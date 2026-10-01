(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlanBrand = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var INK = '#0c2f3d', PETROL = '#0e6a82', AMBER = '#e8a33d';
  var N = 0;

  function logo(px, onDark) {
    var id = 'anl' + (N++);
    var tile = onDark
      ? '<rect width="64" height="64" rx="16" fill="#fff"/>'
      : '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + PETROL + '"/><stop offset="1" stop-color="' + INK + '"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#' + id + ')"/>';
    var stroke = onDark ? PETROL : '#fff';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="' + px + '" height="' + px + '" role="img" aria-label="AN Psixoloji Mərkəz loqosu">' + tile +
      '<g fill="none" stroke="' + stroke + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 45 22 19 32 45M15.5 36h13"/><path d="M39 45V19l13 26V19"/></g>' +
      '<circle cx="52" cy="14" r="3.6" fill="' + AMBER + '"/></svg>';
  }

  function favicon() {
    return 'data:image/svg+xml,' + encodeURIComponent(logo(64, false));
  }

  return { logo: logo, favicon: favicon, INK: INK, PETROL: PETROL, AMBER: AMBER };
});
