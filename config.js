// Settings of the web demo. Links are the same ones the website uses (tools/build_site.py: DOWNLOAD_URL, BUY_URL, SITE_URL).
export const OUT_SCALE = 2; // the free app enlarges 2x, 4x needs the licence: the demo follows the free tier (the networks make 4x, the result is scaled down)
export const WATERMARK_TEXT = "easyupscaleai.com"; // sharp text rows across the whole demo result (the app has none)
export const PRICE = "14,99 €";
export const LINKS = {
  clean: "", // filled from CLEAN_BUY_URL below
  download: "https://apps.microsoft.com/detail/9NBXJTP02Q2G",
  buy: "https://buy.polar.sh/polar_cl_Kvqhz63szGGnNM8HHYlhSbUIsm6lb3N0iLccO4RdxQz",
  home: "https://easyupscaleai.com/cs/",
  privacy: "https://easyupscaleai.com/cs/privacy.html",
  refund: "https://easyupscaleai.com/cs/refund.html",
  about: "https://easyupscaleai.com/cs/about.html",
};
export const POLAR_API = "https://api.polar.sh/v1/customer-portal/license-keys/validate"; // the same public, login-free endpoint the app uses (app/activation.py)
export const POLAR_ORG_ID = "ad6e983b-f519-437d-80e5-22d92f285a3c";
export const LICENCE_GRACE_DAYS = 7; // like the app: a verified key keeps working this long without reaching the server
// A clean result of ONE image: a separate Polar product (1.49 EUR, one-time) whose licence-key benefit has the prefix below and a usage limit of 1.
// Paste its checkout link here (build.py reads it from this line too); while it is empty the buy button for it stays hidden.
export const CLEAN_BUY_URL = "https://buy.polar.sh/polar_cl_67U5HxLzXrpSjOOrqZ4sgwkTUbdJYpkXAeLYe3xynp9";
export const SINGLE_KEY_PREFIX = "EUC_";
export const PRICE_CLEAN = "1,49 €";
LINKS.clean = CLEAN_BUY_URL;
