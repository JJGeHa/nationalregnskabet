.PHONY: build-warehouse lint test

build-warehouse:
	python -m danish_economy.etl.build

lint:
	ruff check src/ tests/
	black --check src/ tests/
	mypy src/

test:
	pytest
