const overpassService = require('./src/services/overpass.service');

const toRad = (value) => (value * Math.PI) / 180;
const haversine = (lat1, lon1, lat2, lon2) => {
  const la1 = Number(lat1);
  const lo1 = Number(lon1);
  const la2 = Number(lat2);
  const lo2 = Number(lon2);
  const R = 6371;
  const dLat = toRad(la2 - la1);
  const dLon = toRad(lo2 - lo1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const mapOsmElements = (elements, userLat, userLng) => {
  return elements
    .filter(el => el.tags && el.tags.name)
    .map((el, i) => {
      const hLat = Number(el.lat || (el.center && el.center.lat));
      const hLng = Number(el.lon || (el.center && el.center.lon));
      if (isNaN(hLat) || isNaN(hLng)) {
         return null;
      }
      return {
        id: `osm-${el.id || i}`,
        name: el.tags.name,
      };
    })
    .filter(Boolean);
};

async function test() {
  try {
    const data = await overpassService.fetchOverpass(28.7041, 77.1025, 5000);
    console.log("SUCCESS! Elements:", data.elements?.length);
    const mapped = mapOsmElements(data.elements, 28.7041, 77.1025);
    console.log("Mapped hospitals:", mapped.length);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

test();
