/*
==========================================
CONFIGURATION
==========================================
*/
const GEO_PATH = '/wp-content/uploads/carto/geo';

const STATUSES = {
	actif: {
		color: '#2ecc71',
		icon: '🟢',
	},
	fragile: {
		color: '#e67e22',
		icon: '🟠',
	},
	critique: {
		color: '#e74c3c',
		icon: '🔴',
	},
	non_implante: {
		color: '#bdc3c7',
		icon: '⚪',
	},
};

const DEFAULT_BORDER = 1;
const SELECTED_BORDER = 3;

const DEFAULT_OPACITY = 0.5;
const SELECTED_OPACITY = 0.7;

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
	departmentsIndex: {},

	regionIdToCode: {},

	selectedRegion: null,

	regionsLayer: null,
	departmentsLayer: null,

	departmentsGeoJson: null,

	departmentsLayersCache: {},

	departmentsGeoJsonByRegion: {},
};

async function loadDepartments() {
	const response = await fetch('/wp-json/wp/v2/departement?per_page=100');

	if (!response.ok) throw new Error('Impossible de charger les départements');

	store.departments = await response.json();

	debug('Nombre de départements :', store.departments.length);
}

async function loadRegions() {
	const response = await fetch('/wp-json/wp/v2/region?per_page=18');

	if (!response.ok) throw new Error('Impossible de charger les départements');

	store.regions = await response.json();

	debug('Nombre de régions :', store.regions.length);
}

/*
==========================================
UTILS
==========================================
*/
function debug(...args) {
	if (DEBUG) console.log(...args);
}

function buildRegionIdToCode() {
	for (const region of store.regions) {
		store.regionIdToCode[region.id] = region.acf.code_insee_region;
	}
}

function asyncMap() {
	return new Promise((resolve) => {
		const check = () => {
			const map = store.map ?? WPLeafletMapPlugin?.maps?.[0];

			if (map) {
				store.map = map;
				resolve(map);
				return;
			}

			requestAnimationFrame(check);
		};

		check();
	});
}

function waitForLeafletRender() {
	return new Promise((resolve) => {
		const check = () => {
			if (document.querySelector('path.leaflet-interactive')) {
				resolve();
				return;
			}

			requestAnimationFrame(check);
		};

		check();
	});
}

async function loadDepartmentsGeoJson() {
	if (store.departmentsGeoJson) return;

	const response = await fetch(`${GEO_PATH}/departements.geojson`);

	store.departmentsGeoJson = await response.json();

	buildDepartmentsGeoJsonIndex();
}

function buildDepartmentsGeoJsonIndex() {
	store.departmentsGeoJsonByRegion = {};

	for (const feature of store.departmentsGeoJson.features) {
		const regionCode =
			store.departmentsIndex[feature.properties.code]?.regionCode;

		if (!regionCode) {
			continue;
		}

		if (!store.departmentsGeoJsonByRegion[regionCode]) {
			store.departmentsGeoJsonByRegion[regionCode] = [];
		}

		store.departmentsGeoJsonByRegion[regionCode].push(feature);
	}
}

function normalizeName(name = '') {
	return name.trim().toLocaleLowerCase('fr');
}

function findCdr(regionCode, nom) {
	const key = normalizeName(nom);

	return store.regionsIndex[regionCode]?.cdrs?.find(
		(cdr) => normalizeName(cdr.nom) === key,
	);
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
			statut: region.acf.statut,
			benevoles: 0,
			referents: [],
			cdrs: [
				{
					nom: region.acf.charge_de_developpement_regional_1,
					telephone: region.acf.telephone_1,
				},
				{
					nom: region.acf.charge_de_developpement_regional_2,
					telephone: region.acf.telephone_2,
				},
			].filter((cdr) => cdr.nom),
		};
	}

	// Agrégation des départements
	for (const department of departments) {
		const data = department.acf;
		// debug('department.acf : ', department.acf);

		const regionId = data.region_liee?.[0];
		if (!regionId) {
			debug('Département sans région :', department.title.rendered);
			continue;
		}

		const code = store.regionIdToCode[regionId];
		if (!code) {
			debug('Code INSEE introuvable : ', regionId);
			continue;
		}

		const region = store.regionsIndex[code];
		region.benevoles += Number(data.nombre_de_benevoles ?? 0);
		region.referents.push({
			nom: department.title.rendered,
			referent: data.referent_departemental,
		});
	}
}

function buildDepartmentsIndex(departments) {
	store.departmentsIndex = {};

	for (const department of departments) {
		const data = department.acf;

		const regionCode = String(store.regionIdToCode[data.region_liee?.[0]]);

		const referent = data.referent_departemental;

		const cdr = findCdr(regionCode, referent);

		store.departmentsIndex[data.code_insee_departement] = {
			nom: department.title.rendered,
			referent: data.referent_departemental || null,
			telephone: cdr?.telephone || null,
			statut: data.statut,
			priseDeFonction: data.date_de_prise_de_fonction,
			benevoles: Number(data.nombre_de_benevoles ?? 0),
			regionCode,
		};
	}
}

/*
==========================================
MAP
==========================================
*/
function getLayerStyle(feature, index) {
	const entity = index[feature.properties.code];
	const statut = entity?.statut ?? 'non_implante';

	const selected =
		feature.properties.code === store.selectedRegion ||
		entity?.regionCode === store.selectedRegion;

	return {
		color: '#2c3e50',
		weight: selected ? SELECTED_BORDER : DEFAULT_BORDER,
		fillColor: (STATUSES[statut] ?? STATUSES.non_implante).color,
		fillOpacity: selected ? SELECTED_OPACITY : DEFAULT_OPACITY,
	};
}

async function initGeoJsonLayer({
	nom,
	geoJson,
	fichier,
	index,
	onEachFeature,
	map,
}) {
	if (!geoJson) {
		const t0 = performance.now();

		const response = await fetch(`${GEO_PATH}/${fichier}`);

		geoJson = await response.json();

		debug(
			`GeoJSON ${nom} téléchargé et parsé en`,
			performance.now() - t0,
			'ms',
		);
	}

	debug(`Features ${nom} :`, geoJson.features.length);

	debug(
		`Taille ${nom} :`,
		Math.round(JSON.stringify(geoJson).length / 1024),
		'Ko',
	);

	const t1 = performance.now();

	const layer = L.geoJSON(geoJson, {
		style: (feature) => getLayerStyle(feature, index),
		onEachFeature,
	});

	debug(`Création Leaflet ${nom} en`, performance.now() - t1, 'ms');

	const t2 = performance.now();

	layer.addTo(map);

	debug(`Ajout ${nom} à la carte en`, performance.now() - t2, 'ms');

	layer.eachLayer((layer) => makeLayerAccessible(layer, index));

	return layer;
}

async function initDepartmentsLayer(regionCode) {
	if (store.departmentsLayersCache[regionCode]) {
		store.departmentsLayersCache[regionCode].addTo(store.map);

		return store.departmentsLayersCache[regionCode];
	}

	await loadDepartmentsGeoJson();

	const geoJson = {
		type: 'FeatureCollection',
		features: store.departmentsGeoJsonByRegion[String(regionCode)] ?? [],
	};

	const layer = await initGeoJsonLayer({
		nom: 'départements',
		geoJson,
		index: store.departmentsIndex,
		onEachFeature: registerDepartmentEvents,
		map: store.map,
	});

	store.departmentsLayersCache[regionCode] = layer;

	return layer;
}

async function initMap() {
	debug('Chargement GeoJSON...');
	const loading = document.getElementById('map-loading');
	loading?.removeAttribute('hidden');

	store.regionsLayer = await initGeoJsonLayer({
		nom: 'régions',
		fichier: 'regions.geojson',
		index: store.regionsIndex,
		onEachFeature: registerRegionEvents,
		map: store.map,
	});

	debug('Couche régions :', store.regionsLayer.getLayers().length);

	loading?.setAttribute('hidden', '');
}

function registerRegionEvents(feature, layer) {
	const region = store.regionsIndex[feature.properties.code];

	if (!region) return;

	layer.on('click', async () => {
		try {
			store.selectedRegion = feature.properties.code;

			store.regionsLayer.setStyle((feature) =>
				getLayerStyle(feature, store.regionsIndex),
			);

			if (store.departmentsLayer) {
				store.departmentsLayer.remove();
				store.departmentsLayer = null;
			}

			store.departmentsLayer = await initDepartmentsLayer(
				feature.properties.code,
			);

			layer.bindPopup(buildRegionPopup(feature)).openPopup();
		} catch (error) {
			console.error('Erreur lors du clic sur la région :', error);
		}
	});
}

function registerDepartmentEvents(feature, layer) {
	layer.on('click', () => {
		layer.bindPopup(buildDepartmentPopup(feature)).openPopup();
	});
}

function makeLayerAccessible(layer, index) {
	const entity = index[layer.feature.properties.code];
	const el = layer.getElement();

	if (!el) return;

	if (!entity) {
		el.style.cursor = 'not-allowed';
		return;
	}

	el.setAttribute('role', 'button');
	el.setAttribute('tabindex', '0');
	el.setAttribute(
		'aria-label',
		`Afficher les informations de ${layer.feature.properties.nom}`,
	);

	makePopupAccessible(layer);

	el.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			layer.fire('click');
		}
	});
}

function makePopupAccessible(layer) {
	layer.on('popupopen', (event) => {
		const popup = event.popup.getElement();

		if (!popup) {
			return;
		}

		popup.setAttribute('role', 'dialog');
		popup.setAttribute('tabindex', '-1');
		popup.focus();

		popup.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				layer.closePopup();
			}
		});
	});

	layer.on('popupclose', () => {
		layer.getElement()?.focus();
	});
}

/*
==========================================
MARKUP
==========================================
*/
function buildRegionPopup(feature) {
	const region = store.regionsIndex[feature.properties.code];
	if (!region) {
		return `
            <strong>${feature.properties.nom}</strong><br><br>
            Aucune donnée n'est encore renseignée pour cette région.
        `;
	}

	const departements = `${region.referents.length} département${region.referents.length > 1 ? 's' : ''}`;
	const benevoles = `${region.benevoles} bénévole${region.benevoles > 1 ? 's' : ''}`;
	const referents = region.referents
		.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }))
		.map(({ nom, referent }) => `• ${nom} : ${referent || 'Non renseigné'}`)
		.join('<br>');
	const cdrs = region.cdrs.map(({ nom }) => nom).join(' et ');

	const telephones = region.cdrs
		.map(({ nom, telephone }) => `${telephone} (${nom})`)
		.join(' / ');

	return `
        <strong>${region.nom}</strong><br><br>
        👤 Chargé·e de Développement Régional : ${cdrs || 'Non renseigné'}<br><br>
        📞 ${telephones || 'Non renseigné'}<br><br>
        📍 ${departements}<br><br>
		📋 Référent·e·s des départements :<br>
			${referents}
        <br><br>
		👥 ${benevoles}<br><br>
    `;
}

function buildDepartmentPopup(feature) {
	const department = store.departmentsIndex[feature.properties.code];

	if (!department) return 'Aucune donnée.';

	return `
        <strong>${department.nom}</strong><br><br>
        👤 Référent·e départemental·e : ${department.referent ?? 'Non renseigné'} <br><br>
        📞 ${department.telephone ?? 'Non renseigné'} <br><br>
        ${STATUSES[department.statut]?.icon ?? '⚪'} ${department.statut ?? 'Non renseigné'} <br><br>
        📅 Date de prise de fonction : ${department.priseDeFonction ?? 'Non renseignée'} <br><br>
        👥 ${department.benevoles} bénévoles
    `;
}
/*
==========================================
BOOTSTRAP
==========================================
*/
async function bootstrap() {
	//debug('Bootstrap');

	await loadDepartments();

	await loadRegions();
	// debug(JSON.stringify(store.regions[0], null, 2));
	buildRegionIdToCode();

	// debug(JSON.stringify(store.departments[0], null, 2));
	buildRegionsIndex(store.departments);
	buildDepartmentsIndex(store.departments);

	await asyncMap();
	//debug('Carte prête');

	await initMap();
	await waitForLeafletRender();

	window.__ready = true;
	debug('Carte initialisée');
}

bootstrap();
