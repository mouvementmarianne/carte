# mouvementmarianne-carte

[![Accessibility tests](https://img.shields.io/badge/tests-manual-yellow.svg)](#test-please)

Carte interactive du Mouvement Marianne permettant de visualiser les territoires, de la région jusqu'à la collectivité visitée.
Les données sont lues depuis l'API REST WordPress et affichées sous forme de carte interactive.

## 🧞 Commands


| Command                    | Action                                                                        |
| :------------------------- | :-----------------------------------------------------------------------------|
| `yarn install`             | Installe les dépendances                                                      |
| `yarn upgrade-interactive` | Met à jour les dépendances interactivement: attendez un minimum (1)           |
| `yarn lint:check`          | `biome check --write .`                                                       |
| `yarn format`              | `biome format --write .`                                                      |
| `yarn test:e2e`            | `playwright test`: valide accessibilité et usage principal                    |
| `yarn test:install`        | `playwright install`: s'utilise en cas de mise à jour Playwright              |
| `yarn geo`                 | `./src/wp-content/uploads/carto/geo.sh`: télécharge et allège des données     |

### clone & install using yarn, be welcome
git clone https://github.com/eric-faraut/mouvementmarianne-carte.git

yarn install...

### (1) c.f. exemple de compromission de la chaîne d'approvisionnement open-source axios
Selon la réactivité de la chaîne npm, GitHub, ... 
attendez quelques heures par sécurité
#### code malveillant (CWE-506)
- https://advisories.gitlab.com/npm/axios/GHSA-fw8c-xr5c-95f9/?utm_source=chatgpt.com
- https://osv.dev/vulnerability/MAL-2026-2307?utm_source=chatgpt.com 
    - MAL-2026-2307 
- axios@1.14.1
- axios@0.30.4
