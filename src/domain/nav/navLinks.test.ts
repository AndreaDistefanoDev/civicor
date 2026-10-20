import { buildNavigationAppUrl, buildNavigationUrl } from './navLinks';

const d = { lat: 36.92587, lng: 14.73091 };

it('Waze', () => expect(buildNavigationUrl('waze', d)).toBe('https://waze.com/ul?ll=36.92587,14.73091&navigate=yes'));
it('Google Maps', () =>
  expect(buildNavigationUrl('google', d)).toBe(
    'https://www.google.com/maps/dir/?api=1&destination=36.92587,14.73091&travelmode=driving',
  ));
it('Apple Maps', () => expect(buildNavigationUrl('apple', d)).toBe('https://maps.apple.com/?daddr=36.92587,14.73091&dirflg=d'));

describe('link che aprono direttamente l\'app', () => {
  it('Waze', () => expect(buildNavigationAppUrl('waze', d)).toBe('waze://?ll=36.92587,14.73091&navigate=yes'));
  it('Google Maps', () => expect(buildNavigationAppUrl('google', d)).toBe('comgooglemaps://?daddr=36.92587,14.73091&directionsmode=driving'));
  it('Apple Maps usa il link web, che iOS apre già nell\'app', () =>
    expect(buildNavigationAppUrl('apple', d)).toBe('https://maps.apple.com/?daddr=36.92587,14.73091&dirflg=d'));
});
