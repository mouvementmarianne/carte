/*
==========================================
CONFIGURATION
==========================================
*/
const GEO_PATH = '/wp-content/uploads/carto/geo';

const STATUSES = {
    actif: '#2ecc71',
    //vigilance: '#f1c40f',
    fragile: '#e67e22',
    critique: '#e74c3c',
    non_implante: '#bdc3c7'
};

const DEBUG = true;

/*
==========================================
DATA
==========================================
*/
const store = {
    departments: [],
    regions: [],
    regionsIndex: {},
    regionIdToCode: {},
};

async function loadDepartments() {

    const response = await fetch(
        '/wp-json/wp/v2/departement?per_page=100'
    );

    if (! response.ok)
        throw new Error('Impossible de charger les départements');

    store.departments = await response.json();

    debug('Nombre de départements :', store.departments.length);
}

async function loadRegions() {
    const response = await fetch(
        '/wp-json/wp/v2/region?per_page=18'
    );

    if (! response.ok)
        throw new Error('Impossible de charger les départements');

    store.regions = await response.json();

    debug('Nombre de régions :', store.regions.length);
}

/*
==========================================
UTILS
==========================================
*/
function debug(...args) {
    if (DEBUG)
        console.log(...args);
}

function asyncMap() {
    return new Promise(resolve => {

        const check = () => {

            const map = WPLeafletMapPlugin.maps?.[0];

            if (map) {
                resolve(map);
                return;
            }

            requestAnimationFrame(check);
        };

        check();
    });
}

function buildRegionIdToCode() {
    for (const region of store.regions) {
        store.regionIdToCode[region.id] =
            region.acf.code_insee_region;
    }
}

/*
==========================================
BUSINESS
==========================================
*/
function buildRegionsIndex(departments) {
    store.regionsIndex = {};

     // Initialisation depuis WordPress
    for (const region of store.regions) {
        const code = region.acf.code_insee_region;

        store.regionsIndex[code] = {
            nom: region.title.rendered,
            cdr: region.acf.charge_de_developpement_regional,
            statut: region.acf.statut,
            telephone: region.acf.telephone,
            departements: 0,
            benevoles: 0
        };
    }

    // Agrégation des départements
    for (const department of departments) {
        const data = department.acf;
        // debug('department.acf : ', department.acf);

        const regionId = data.region_liee?.[0];
        if (! regionId) {
            debug(
                'Département sans région :',
                department.title.rendered
            );
            continue;
        }

        const code = store.regionIdToCode[regionId];
        if (! code) {
            debug(
                'Code INSEE introuvable : ',
                regionId
            );
            continue;
        }

        const region = store.regionsIndex[code];
        region.departements++;
        region.benevoles += Number(data.nombre_de_benevoles ?? 0);
    }
}

/*
==========================================
MAP
==========================================
*/
function getStyle(feature) {
    const { code } = feature.properties;

    const region = store.regionsIndex[code];
    const statut = region?.statut ?? 'non_implante';

    return {
        color: '#2c3e50',
        weight: 1,
        fillColor: STATUSES[statut],
        fillOpacity: 0.5
    };
}

async function initMap(map) {
    debug('Init territoire');

    const response = await fetch(`${GEO_PATH}/regions.geojson`);
    const geoJson = await response.json();

    const layer = L.geoJSON(geoJson, {
        style: getStyle,

        onEachFeature(feature, layer) {
            const region = store.regionsIndex[feature.properties.code];

            if (! region) {
                 layer.on('add', () => {
                    layer.getElement().style.cursor = 'not-allowed';
                });
                return;
            }
            layer.on('click', () => {
                layer.bindPopup(buildRegionPopup(feature)).openPopup();
            });
        }
    });

    layer.addTo(map);
}

/*
==========================================
MARKUP
==========================================
*/
function buildRegionPopup(feature) {
    const region = store.regionsIndex[feature.properties.code];
    const departements =
        `${region.departements} département${region.departements > 1 ? 's' : ''}`;
    const benevoles =
        `${region.benevoles} bénévole${region.benevoles > 1 ? 's' : ''}`;

    if (!region) {
        return `
            <strong>${feature.properties.nom}</strong><br><br>
            Aucune donnée n'est encore renseignée pour cette région.
        `;
    }

    return `
        <strong>${region.nom}</strong><br><br>
        👤 Chargé·e de Développement Régional : ${region.cdr || 'Non renseigné'}<br><br>
        📞 ${region.telephone || 'Non renseigné'}<br><br>
        📍 ${departements}<br><br>
        👥 ${benevoles}<br><br>
    `;
}
/*
==========================================
BOOTSTRAP
==========================================
*/
async function bootstrap() {
    debug('Bootstrap');

    await loadDepartments();

    await loadRegions();
    // debug(JSON.stringify(store.regions[0], null, 2));
    buildRegionIdToCode();

    // debug(JSON.stringify(store.departments[0], null, 2));
    buildRegionsIndex(store.departments);

    const map = await asyncMap();
    debug('Map ready');

    await initMap(map);
    debug('Map initialized');
}

bootstrap();