const overpassService = require('./src/services/overpass.service');

const mapOsmElements = (elements, userLat, userLng) => {
  return elements
    .filter(el => el.tags && el.tags.name)
    .map((el, i) => {
      const hLat = Number(el.lat);
      const hLng = Number(el.lon);
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
