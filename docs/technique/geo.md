# Alléger .geojson
## Où? 
https://www.data.gouv.fr/datasets/contours-administratifs
### Comment?
mkdir -p donnees/geo
cd donnees/geo
#### Régions
curl -L -O "https://www.data.gouv.fr/api/1/datasets/r/0d74ff02-8f0b-4c01-a3fb-bf4968fb57ee"
#### Départements
curl -L -O "https://www.data.gouv.fr/api/1/datasets/r/93a2ba8f-e30f-4916-a73b-0c4d87247ace"
## Alléger
### Décompresser et supprimer le fichier compressé
gunzip regions-50m.geojson.gz
gunzip departements-50m.geojson.gz
### Simplifier Douglas-Peucker 25%
yarn mapshaper \
  regions-50m.geojson \
  -simplify dp 25% keep-shapes \
  -o precision=0.00001 \
  data/optimized/regions.geojson
  
yarn mapshaper \
  departements-50m.geojson \
  -simplify dp 25% keep-shapes \
  -o precision=0.00001 \
  data/optimized/departements.geojson
### Résultat
departements: 6 -> 1,6 Mo
regions: 3,6 Mo -> 960 ko