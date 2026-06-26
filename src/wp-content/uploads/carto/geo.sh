mkdir -p donnees/geo
cd donnees/geo
curl -L -o regions-50m.geojson.gz \
"https://www.data.gouv.fr/api/1/datasets/r/0d74ff02-8f0b-4c01-a3fb-bf4968fb57ee"
curl -L -o departements-50m.geojson.gz \
"https://www.data.gouv.fr/api/1/datasets/r/93a2ba8f-e30f-4916-a73b-0c4d87247ace"
gunzip regions-50m.geojson.gz
gunzip departements-50m.geojson.gz
yarn mapshaper \
  regions-50m.geojson \
  -simplify dp 25% keep-shapes \
  -o precision=0.00001 \
  regions.geojson
yarn mapshaper \
  departements-50m.geojson \
  -simplify dp 25% keep-shapes \
  -o precision=0.00001 \
  departements.geojson