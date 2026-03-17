# O-TUD - Daily Activity Collection Tool Frontend

A web-based tool for collecting and visualizing daily activities in a timeline format. Designed for research studies and time-use surveys.

Based on [github.com/andreifoldes/o-timeusediary by Andrei Tamas Foldes et al.](https://github.com/andreifoldes/o-timeusediary).


## Quick Start

- **[Live Demo](https://dfsp-spirit.github.io/o-timeusediary/index.html)** - Try the application


## Technology Stack

* HTML
* CSS
* JavaScript


Note: We use Python/FastAPI for the backend.


## E2E Tests (Playwright)

Playwright tests are stored in `frontend/tests/e2e`.

### Local run

1. Start the app stack (recommended: nginx + backend) from repo root:

	- `./run_dev_nginx_both.bash`

2. In a second terminal, install frontend test dependencies:

	- `cd frontend`
	- `npm install`
	- `npx playwright install --with-deps chromium`

3. Run tests:

	- `npm run test:e2e`

Optional:

- Headed run: `npm run test:e2e:headed`

### CI

GitHub Actions workflow for e2e tests is defined in:

- `.github/workflows/e2e_tests.yml`

It starts Postgres, configures nginx and backend with CI settings, and runs `npx playwright test` from `frontend/`.

### Current test coverage

The initial test verifies this flow:

1. Instruction page loads and `Start` is clicked.
2. Main page loads and `Skip time reporting` is clicked, then confirmed in modal.
3. Redirect to the thank-you page is verified.


## License

This project is open-source and available under the MIT License (see LICENSE file).
