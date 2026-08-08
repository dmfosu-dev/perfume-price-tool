// Values shared between server and client code.
// Keep this module free of Node built-ins — anything imported here can end up
// in the browser bundle, and `node:crypto` etc. will not survive the trip.

export const MIN_PASSWORD_LENGTH = 10;
