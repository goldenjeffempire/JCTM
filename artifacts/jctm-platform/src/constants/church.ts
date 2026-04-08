export const CHURCH_NAME = "Jesus Christ Temple Ministry";

export const CHURCH_ADDRESS_LINES = [
  "Land of Good News",
  "Km 1 East West Road,",
  "Patani Expressway,",
  "Ebrumede Roundabout, Effurun,",
  "Delta State, Nigeria",
] as const;

export const CHURCH_ADDRESS_FULL =
  "Km 1 East West Road, Patani Expressway, Ebrumede Roundabout, Effurun, Delta State, Nigeria";

export const CHURCH_ADDRESS_SHORT =
  "Ebrumede Roundabout, Effurun, Delta State, Nigeria";

export const CHURCH_MAPS_QUERY = encodeURIComponent(
  "Km 1 East West Road Patani Expressway Ebrumede Roundabout Effurun Delta State Nigeria",
);

export const GOOGLE_MAPS_URL =
  `https://www.google.com/maps/dir/?api=1&destination=${CHURCH_MAPS_QUERY}&travelmode=driving`;

export const GOOGLE_MAPS_PLACE_URL =
  `https://www.google.com/maps/search/?api=1&query=${CHURCH_MAPS_QUERY}`;

export const APPLE_MAPS_URL =
  `https://maps.apple.com/?daddr=${CHURCH_MAPS_QUERY}`;

export const WAZE_URL =
  `https://waze.com/ul?q=${CHURCH_MAPS_QUERY}&navigate=yes`;
