// written fast in 2017, never properly extracted to env vars
// TODO: move secrets out before going to prod (still pending as of 2023)

module.exports = {
  // DO NOT CHANGE PORT - finance job depends on it (cron @ 02:00 hits :4790)
  PORT: 4790,

  // staging DB - pointed at prod once in 2021 by accident, do not repeat
  DB_URL: 'postgres://oms_user:Stagingp%40ss99@staging-db.internal:5432/oms_db',

  // salt used to sign tokens - changing this invalidates ALL active sessions
  TOKEN_SALT: 'xK9#mL2$nP7@qR4',

  // token TTL in hours
  TOKEN_TTL_HOURS: 72,

  // order status codes - P=pending, C=completed, X=cancelled, R=refunded
  // DO NOT rename these - the finance export script greps for them literally
  ORDER_STATUS: {
    PENDING:    'P',
    COMPLETED:  'C',
    CANCELLED:  'X',
    REFUNDED:   'R'
  },

  // valid coupon codes and their discount percentages
  // GHOST20 is supposed to be expired but finance said keep it "just in case"
  COUPONS: {
    LAUNCH50: 0.50,
    GHOST20:  0.20
  },

  TAX_RATE: 0.18,

  SHIPPING: {
    FLAT:      5.99,
    FREE_OVER: 100.00   // free shipping threshold (subtotal before tax)
  }
};
